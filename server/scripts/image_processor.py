#!/usr/bin/env python3
"""
票据图像处理脚本
使用 OpenCV 实现自动扫描、边缘检测、透视矫正、图像增强等功能

优化版本：
- 改进边缘检测算法，提高准确率
- 增加多种检测策略
- 更好的预处理和自适应阈值
"""

import cv2
import numpy as np
import sys
import os
import json
import base64
from typing import Optional, Tuple, List

def load_image_from_base64(base64_str: str) -> np.ndarray:
    """从 Base64 字符串加载图片"""
    # 移除 data:image/xxx;base64, 前缀
    if ',' in base64_str:
        base64_str = base64_str.split(',')[1]
    
    img_data = base64.b64decode(base64_str)
    nparr = np.frombuffer(img_data, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    return img

def load_image_from_path(path: str) -> np.ndarray:
    """从文件路径加载图片"""
    return cv2.imread(path)

def image_to_base64(img: np.ndarray, format: str = '.jpg') -> str:
    """将图片转换为 Base64 字符串"""
    _, buffer = cv2.imencode(format, img, [cv2.IMWRITE_JPEG_QUALITY, 95])
    return base64.b64encode(buffer).decode('utf-8')

def order_points(pts: np.ndarray) -> np.ndarray:
    """
    将四个点按照左上、右上、右下、左下的顺序排列
    """
    rect = np.zeros((4, 2), dtype="float32")
    
    # 左上角的点的和最小，右下角的点的和最大
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]
    
    # 右上角的点的差最小，左下角的点的差最大
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]
    
    return rect

def four_point_transform(image: np.ndarray, pts: np.ndarray) -> np.ndarray:
    """
    透视变换：将四边形区域变换为矩形
    仅做透视矫正，不进行任何图像增强
    """
    rect = order_points(pts)
    (tl, tr, br, bl) = rect
    
    # 计算新图像的宽度（取上下边长的最大值）
    widthA = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
    widthB = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
    maxWidth = max(int(widthA), int(widthB))
    
    # 计算新图像的高度（取左右边长的最大值）
    heightA = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
    heightB = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
    maxHeight = max(int(heightA), int(heightB))
    
    # 确保最小尺寸
    maxWidth = max(maxWidth, 100)
    maxHeight = max(maxHeight, 100)
    
    # 目标点
    dst = np.array([
        [0, 0],
        [maxWidth - 1, 0],
        [maxWidth - 1, maxHeight - 1],
        [0, maxHeight - 1]
    ], dtype="float32")
    
    # 计算透视变换矩阵并应用
    M = cv2.getPerspectiveTransform(rect, dst)
    warped = cv2.warpPerspective(image, M, (maxWidth, maxHeight))
    
    return warped

def preprocess_for_edge_detection(image: np.ndarray) -> np.ndarray:
    """
    专门为边缘检测优化的预处理
    """
    # 转换为灰度图
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # 1. 自适应直方图均衡化（CLAHE）- 增强对比度
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    
    # 2. 双边滤波 - 保边去噪
    denoised = cv2.bilateralFilter(enhanced, d=9, sigmaColor=75, sigmaSpace=75)
    
    return denoised

def detect_document_edges_strategy1(image: np.ndarray) -> Optional[np.ndarray]:
    """
    策略1：经典Canny边缘检测 + 轮廓查找
    适用于：背景简单、文档边界清晰的场景
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    
    # Otsu自动阈值
    _, binary = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    # 边缘检测
    edged = cv2.Canny(binary, 50, 200)
    
    # 形态学操作
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    edged = cv2.morphologyEx(edged, cv2.MORPH_CLOSE, kernel, iterations=2)
    
    # 查找轮廓
    contours, _ = cv2.findContours(edged, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if not contours:
        return None
    
    # 按面积排序
    contours = sorted(contours, key=cv2.contourArea, reverse=True)
    
    # 遍历前5个最大轮廓
    for contour in contours[:5]:
        peri = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.02 * peri, True)
        
        if len(approx) == 4:
            return approx.reshape(4, 2)
    
    return None

def detect_document_edges_strategy2(image: np.ndarray) -> Optional[np.ndarray]:
    """
    策略2：自适应阈值 + 形态学操作
    适用于：光照不均匀、对比度较低的场景
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # 自适应阈值
    binary = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV, 11, 2
    )
    
    # 形态学操作
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))
    morphed = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=3)
    morphed = cv2.morphologyEx(morphed, cv2.MORPH_OPEN, kernel, iterations=1)
    
    # 查找轮廓
    contours, _ = cv2.findContours(morphed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if not contours:
        return None
    
    # 按面积排序
    contours = sorted(contours, key=cv2.contourArea, reverse=True)
    
    # 取最大轮廓，尝试拟合四边形
    for contour in contours[:3]:
        # 计算凸包
        hull = cv2.convexHull(contour)
        
        # 多边形逼近
        peri = cv2.arcLength(hull, True)
        approx = cv2.approxPolyDP(hull, 0.02 * peri, True)
        
        # 如果是四边形，返回
        if len(approx) == 4:
            return approx.reshape(4, 2)
        
        # 如果是三角形或五边形，尝试优化
        if 3 <= len(approx) <= 6:
            # 使用最小外接矩形
            rect = cv2.minAreaRect(contour)
            box = cv2.boxPoints(rect)
            return box
    
    return None

def detect_document_edges_strategy3(image: np.ndarray) -> Optional[np.ndarray]:
    """
    策略3：颜色分割 + 轮廓查找
    适用于：票据有明显背景色的场景
    """
    # 转换到HSV空间
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    
    # 计算亮度通道的统计信息
    v_channel = hsv[:, :, 2]
    mean_v = np.mean(v_channel)
    
    # 根据亮度调整阈值
    if mean_v > 127:
        # 亮背景，找暗区域
        lower = np.array([0, 0, 0])
        upper = np.array([180, 255, int(mean_v * 0.7)])
    else:
        # 暗背景，找亮区域
        lower = np.array([0, 0, int(mean_v * 1.3)])
        upper = np.array([180, 255, 255])
    
    # 阈值分割
    mask = cv2.inRange(hsv, lower, upper)
    
    # 形态学操作
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)
    
    # 查找轮廓
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if not contours:
        return None
    
    # 按面积排序
    contours = sorted(contours, key=cv2.contourArea, reverse=True)
    
    for contour in contours[:3]:
        peri = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.02 * peri, True)
        
        if len(approx) == 4:
            return approx.reshape(4, 2)
        
        # 使用最小外接矩形
        rect = cv2.minAreaRect(contour)
        box = cv2.boxPoints(rect)
        return box
    
    return None

def detect_document_edges_strategy4(image: np.ndarray) -> Optional[np.ndarray]:
    """
    策略4：基于图像边缘的Hough变换
    适用于：文档有明显的直线边缘
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edged = cv2.Canny(blurred, 50, 150)
    
    # 霍夫变换检测直线
    lines = cv2.HoughLinesP(
        edged, 1, np.pi / 180,
        threshold=100,
        minLineLength=100,
        maxLineGap=10
    )
    
    if lines is None or len(lines) < 4:
        return None
    
    # 提取直线端点
    points = []
    for line in lines:
        x1, y1, x2, y2 = line[0]
        points.append([x1, y1])
        points.append([x2, y2])
    
    if len(points) < 4:
        return None
    
    # 使用凸包找到边界点
    points = np.array(points, dtype=np.float32)
    hull = cv2.convexHull(points)
    
    # 多边形逼近
    peri = cv2.arcLength(hull, True)
    approx = cv2.approxPolyDP(hull, 0.02 * peri, True)
    
    if len(approx) == 4:
        return approx.reshape(4, 2)
    
    # 使用最小外接矩形
    rect = cv2.minAreaRect(points)
    box = cv2.boxPoints(rect)
    return box

def detect_document_edges(image: np.ndarray) -> Optional[np.ndarray]:
    """
    检测文档边缘
    使用多种策略，返回最佳结果
    
    优化策略：
    1. 经典Canny边缘检测
    2. 自适应阈值处理
    3. 颜色分割
    4. Hough变换直线检测
    """
    height, width = image.shape[:2]
    min_area = width * height * 0.1  # 最小面积为图像的10%
    
    strategies = [
        detect_document_edges_strategy1,
        detect_document_edges_strategy2,
        detect_document_edges_strategy3,
        detect_document_edges_strategy4,
    ]
    
    best_result = None
    best_area = 0
    
    for strategy in strategies:
        try:
            edges = strategy(image)
            
            if edges is not None:
                # 计算四边形面积（使用轮廓面积）
                area = cv2.contourArea(edges)
                
                # 验证面积合理性
                if area > min_area and area > best_area:
                    # 验证四边形的有效性（不是过于扁平）
                    rect = order_points(edges)
                    (tl, tr, br, bl) = rect
                    
                    # 计算边长比例
                    width_ratio = max(
                        np.sqrt((tr[0]-tl[0])**2 + (tr[1]-tl[1])**2),
                        np.sqrt((br[0]-bl[0])**2 + (br[1]-bl[1])**2)
                    )
                    height_ratio = max(
                        np.sqrt((bl[0]-tl[0])**2 + (bl[1]-tl[1])**2),
                        np.sqrt((br[0]-tr[0])**2 + (br[1]-tr[1])**2)
                    )
                    
                    # 确保宽高比例合理（不太扁平）
                    if width_ratio > 50 and height_ratio > 50:
                        aspect_ratio = width_ratio / height_ratio
                        if 0.2 < aspect_ratio < 5:  # 合理的宽高比
                            best_result = edges
                            best_area = area
        except Exception as e:
            # 忽略策略失败，继续尝试下一个
            continue
    
    return best_result

def enhance_image(image: np.ndarray) -> np.ndarray:
    """
    图像增强：保持彩色，增强对比度和清晰度
    适用于票据图片的优化处理
    """
    # 保持彩色图像
    if len(image.shape) == 3:
        # 转换到 LAB 色彩空间
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        
        # 对亮度通道应用 CLAHE
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        l_enhanced = clahe.apply(l)
        
        # 合并通道
        lab_enhanced = cv2.merge([l_enhanced, a, b])
        result = cv2.cvtColor(lab_enhanced, cv2.COLOR_LAB2BGR)
        
        # 轻微锐化
        kernel = np.array([[0, -1, 0],
                          [-1, 5, -1],
                          [0, -1, 0]])
        result = cv2.filter2D(result, -1, kernel)
        
        return result
    else:
        # 灰度图处理
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(image)
        return enhanced

def binarize_image(image: np.ndarray) -> np.ndarray:
    """
    二值化处理，让文字更清晰
    使用更温和的算法，保留文字细节
    """
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image
    
    # 1. 轻微去噪
    denoised = cv2.fastNlMeansDenoising(gray, None, h=8, templateWindowSize=7, searchWindowSize=21)
    
    # 2. 对比度增强
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(denoised)
    
    # 3. 使用 OTSU 自适应阈值
    _, binary = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    return binary

def auto_scan_document(image: np.ndarray) -> Tuple[np.ndarray, bool, Optional[np.ndarray]]:
    """
    自动扫描文档
    返回：处理后的图像、是否检测到边缘、边缘坐标
    """
    # 检测文档边缘
    edges = detect_document_edges(image)
    
    if edges is not None:
        # 透视矫正
        warped = four_point_transform(image, edges)
        # 图像增强
        enhanced = enhance_image(warped)
        return enhanced, True, edges
    else:
        # 未检测到边缘，仅做图像增强
        enhanced = enhance_image(image)
        return enhanced, False, None

def detect_edges_only(
    image_path: str = None,
    base64_data: str = None
) -> dict:
    """
    仅检测文档边缘，不进行图像处理
    
    Returns:
        dict: 包含边缘坐标和原始图片尺寸
    """
    # 加载图片
    if image_path:
        image = load_image_from_path(image_path)
    elif base64_data:
        image = load_image_from_base64(base64_data)
    else:
        return {'success': False, 'error': 'No image provided'}
    
    if image is None:
        return {'success': False, 'error': 'Failed to load image'}
    
    # 检测文档边缘
    edges = detect_document_edges(image)
    
    result = {
        'success': True,
        'edges_detected': edges is not None,
        'original_size': {'width': image.shape[1], 'height': image.shape[0]}
    }
    
    if edges is not None:
        result['edges'] = edges.tolist()
    
    return result

def process_ticket_image(
    image_path: str = None,
    base64_data: str = None,
    mode: str = 'auto'
) -> dict:
    """
    处理票据图像
    
    Args:
        image_path: 图片文件路径
        base64_data: Base64 编码的图片数据
        mode: 处理模式
            - 'auto': 自动扫描（边缘检测 + 透视矫正 + 增强）
            - 'enhance': 仅增强（不进行透视矫正）
            - 'binarize': 二值化
    
    Returns:
        dict: 包含处理后的图片和处理信息
    """
    # 加载图片
    if image_path:
        image = load_image_from_path(image_path)
    elif base64_data:
        image = load_image_from_base64(base64_data)
    else:
        return {'success': False, 'error': 'No image provided'}
    
    if image is None:
        return {'success': False, 'error': 'Failed to load image'}
    
    result = {'success': True}
    
    if mode == 'auto':
        # 自动扫描
        processed, detected, edges = auto_scan_document(image)
        result['edges_detected'] = detected
        if edges is not None:
            result['edges'] = edges.tolist()
    
    elif mode == 'enhance':
        # 仅增强
        processed = enhance_image(image)
        result['edges_detected'] = False
    
    elif mode == 'binarize':
        # 二值化
        processed = binarize_image(image)
        result['edges_detected'] = False
    
    else:
        return {'success': False, 'error': f'Unknown mode: {mode}'}
    
    # 转换为 Base64
    result['image'] = image_to_base64(processed)
    result['original_size'] = {'width': image.shape[1], 'height': image.shape[0]}
    result['processed_size'] = {'width': processed.shape[1], 'height': processed.shape[0]}
    
    return result

def perspective_transform_with_points(
    image_path: str = None,
    base64_data: str = None,
    points: List[List[float]] = None,
    enhance: bool = False
) -> dict:
    """
    使用指定的四个点进行透视矫正
    
    Args:
        image_path: 图片文件路径
        base64_data: Base64 编码的图片数据
        points: 四个角点 [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
        enhance: 是否进行图像增强（默认不增强，让用户自己选择）
    
    Returns:
        dict: 包含处理后的图片
    """
    # 加载图片
    if image_path:
        image = load_image_from_path(image_path)
    elif base64_data:
        image = load_image_from_base64(base64_data)
    else:
        return {'success': False, 'error': 'No image provided'}
    
    if image is None:
        return {'success': False, 'error': 'Failed to load image'}
    
    if points is None or len(points) != 4:
        return {'success': False, 'error': 'Invalid points, need 4 points'}
    
    try:
        pts = np.array(points, dtype="float32")
        warped = four_point_transform(image, pts)
        
        # 只有明确要求时才增强
        if enhance:
            result_image = enhance_image(warped)
        else:
            result_image = warped
        
        return {
            'success': True,
            'image': image_to_base64(result_image),
            'original_size': {'width': image.shape[1], 'height': image.shape[0]},
            'processed_size': {'width': result_image.shape[1], 'height': result_image.shape[0]}
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}

def main():
    """命令行入口"""
    if len(sys.argv) < 2:
        print(json.dumps({'success': False, 'error': 'No arguments provided'}))
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == 'process':
        # 处理图片
        if len(sys.argv) < 4:
            print(json.dumps({'success': False, 'error': 'Usage: process <input_path> <mode>'}))
            sys.exit(1)
        
        input_path = sys.argv[2]
        mode = sys.argv[3]
        
        # detect-edges 模式只检测边缘
        if mode == 'detect-edges':
            result = detect_edges_only(image_path=input_path)
        else:
            result = process_ticket_image(image_path=input_path, mode=mode)
        print(json.dumps(result))
    
    elif command == 'detect-edges':
        # 仅检测边缘
        if len(sys.argv) < 3:
            print(json.dumps({'success': False, 'error': 'Usage: detect-edges <input_path>'}))
            sys.exit(1)
        
        input_path = sys.argv[2]
        result = detect_edges_only(image_path=input_path)
        print(json.dumps(result))
    
    elif command == 'transform':
        # 透视矫正
        if len(sys.argv) < 4:
            print(json.dumps({'success': False, 'error': 'Usage: transform <input_path> <points_json>'}))
            sys.exit(1)
        
        input_path = sys.argv[2]
        points = json.loads(sys.argv[3])
        
        result = perspective_transform_with_points(image_path=input_path, points=points)
        print(json.dumps(result))
    
    else:
        print(json.dumps({'success': False, 'error': f'Unknown command: {command}'}))
        sys.exit(1)

if __name__ == '__main__':
    main()
