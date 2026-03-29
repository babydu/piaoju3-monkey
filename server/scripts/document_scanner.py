#!/usr/bin/env python3
"""
智能文档扫描器 - 优化版 v2
针对票据场景优化的边缘检测和图像增强算法

优化点：
1. 边缘检测：优先使用边缘+轮廓检测，适配票据特征
2. 图像增强：降噪+适度增强，避免颗粒感
3. 多策略融合评分优化
"""

import cv2
import numpy as np
import sys
import json
import base64
from typing import Optional, Tuple, List, Dict

def debug_print(msg: str):
    """输出调试信息到 stderr，避免污染 stdout 的 JSON 输出"""
    print(msg, file=sys.stderr)

def load_image_from_base64(base64_str: str) -> np.ndarray:
    """从 Base64 字符串加载图片"""
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
    
    排序规则（几何特征）：
    - 左上(tl): x+y 最小（离原点最近）
    - 右下(br): x+y 最大（离原点最远）
    - diff = y - x
      - argmin(diff) = y-x 最小 -> y 小 x 大 -> 右上角 (tr)
      - argmax(diff) = y-x 最大 -> y 大 x 小 -> 左下角 (bl)
    """
    rect = np.zeros((4, 2), dtype="float32")
    
    # x+y 最小的是左上，最大的是右下
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]  # 左上
    rect[2] = pts[np.argmax(s)]  # 右下
    
    # y-x 最小的是右上，最大的是左下
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]  # 右上
    rect[3] = pts[np.argmax(diff)]  # 左下
    
    return rect


def ensure_quad_order(pts: np.ndarray) -> np.ndarray:
    """
    确保四边形点的顺序正确（左上、右上、右下、左下）
    
    如果点已经接近正确的顺序（如用户手动调整后），则保持原顺序
    如果点顺序明显错误，则重新排序
    
    这样可以避免用户手动调整后的点被错误重排
    """
    if pts.shape != (4, 2):
        return order_points(pts)
    
    # 计算每个点的特征：左上角应该是 x+y 最小
    # 检查当前顺序是否已经正确
    sums = pts.sum(axis=1)
    diffs = np.diff(pts, axis=1).flatten()
    
    # 预期的特征
    # tl: 最小的 sum, 较大的 diff (负值)
    # tr: 中等的 sum, 最小的 diff (最大负值)
    # br: 最大的 sum, 中等的 diff
    # bl: 中等的 sum, 最大的 diff (正值)
    
    # 检查第一个点是否是左上角（sum 最小或次小）
    min_sum_idx = np.argmin(sums)
    
    # 如果第一个点就是 sum 最小的点，说明顺序可能已经正确
    if min_sum_idx == 0:
        # 进一步验证：检查最后一个点是否是左下角（diff 最大）
        max_diff_idx = np.argmax(diffs)
        if max_diff_idx == 3:
            # 顺序正确
            return pts.astype("float32")
    
    # 顺序不正确，重新排序
    return order_points(pts)


def four_point_transform(image: np.ndarray, pts: np.ndarray, preserve_order: bool = False) -> np.ndarray:
    """
    透视变换：将四边形区域变换为矩形
    
    Args:
        image: 输入图像
        pts: 四个角点坐标 [tl, tr, br, bl] 或任意顺序
        preserve_order: 已废弃 - 始终使用 order_points 重排以确保正确
    
    Note:
        order_points 会根据点的几何位置自动识别角色：
        - x+y 最小的点 -> 左上 (tl)
        - x+y 最大的点 -> 右下 (br)
        - x-y 最小的点 -> 右上 (tr)
        - x-y 最大的点 -> 左下 (bl)
        
        这样无论用户如何拖拽四个角，都能正确识别其角色
    """
    # 始终使用 order_points 重排，确保点的角色正确
    rect = order_points(pts)
    
    (tl, tr, br, bl) = rect
    
    widthA = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
    widthB = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
    maxWidth = max(int(widthA), int(widthB), 100)
    
    heightA = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
    heightB = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
    maxHeight = max(int(heightA), int(heightB), 100)
    
    dst = np.array([
        [0, 0],
        [maxWidth - 1, 0],
        [maxWidth - 1, maxHeight - 1],
        [0, maxHeight - 1]
    ], dtype="float32")
    
    M = cv2.getPerspectiveTransform(rect, dst)
    warped = cv2.warpPerspective(image, M, (maxWidth, maxHeight))
    
    return warped


def resize_for_processing(image: np.ndarray, max_size: int = 800) -> Tuple[np.ndarray, float]:
    """缩放图片以加速处理"""
    h, w = image.shape[:2]
    scale = 1.0
    
    if max(h, w) > max_size:
        scale = max_size / max(h, w)
        image = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    
    return image, scale


def detect_edges_contour_based(image: np.ndarray) -> Optional[np.ndarray]:
    """
    策略1: 基于轮廓检测（主要策略）
    适用于有明显边界的票据
    
    优化点：
    1. 多尺度预处理
    2. 更灵活的阈值策略
    3. 针对移动端拍摄图片的优化
    """
    h, w = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # 高斯模糊降噪（使用更大的核）
    blurred = cv2.GaussianBlur(gray, (7, 7), 0)
    
    # 自适应直方图均衡化（CLAHE）- 应对光照不均
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(blurred)
    
    # 尝试多种阈值策略
    binaries = []
    
    # 策略1: Otsu阈值
    _, binary_otsu = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    binaries.append(('otsu', binary_otsu))
    
    # 策略2: 自适应阈值
    binary_adaptive = cv2.adaptiveThreshold(
        enhanced, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
        cv2.THRESH_BINARY, 21, 10
    )
    binaries.append(('adaptive', binary_adaptive))
    
    # 策略3: 全局阈值（中等值）
    _, binary_global = cv2.threshold(enhanced, 127, 255, cv2.THRESH_BINARY)
    binaries.append(('global', binary_global))
    
    # 对每种二值化结果尝试轮廓检测
    for strategy_name, binary in binaries:
        # 形态学操作：闭运算连接断边（使用更大的核）
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))
        closed = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=2)
        
        # 开运算去除小噪点
        opened = cv2.morphologyEx(closed, cv2.MORPH_OPEN, kernel, iterations=1)
        
        # 边缘检测
        edges = cv2.Canny(opened, 30, 100)
        
        # 膨胀边缘
        dilated = cv2.dilate(edges, kernel, iterations=3)
        
        # 查找轮廓
        contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if not contours:
            continue
        
        # 按面积排序，取最大的几个
        contours = sorted(contours, key=cv2.contourArea, reverse=True)
        
        for contour in contours[:5]:
            # 面积检查 - 降低阈值，适应更多场景
            area = cv2.contourArea(contour)
            if area < h * w * 0.05:  # 至少占5%（降低阈值）
                continue
            
            # 多边形逼近
            peri = cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, 0.02 * peri, True)
            
            if len(approx) == 4:
                return approx.reshape(4, 2)
            
            # 如果不是4边形，尝试凸包
            hull = cv2.convexHull(contour)
            peri_hull = cv2.arcLength(hull, True)
            approx_hull = cv2.approxPolyDP(hull, 0.02 * peri_hull, True)
            
            if len(approx_hull) == 4:
                return approx_hull.reshape(4, 2)
        
        # 如果没有找到4边形，取最大轮廓的最小外接矩形
        if contours:
            rect = cv2.minAreaRect(contours[0])
            box = cv2.boxPoints(rect)
            area = cv2.contourArea(box)
            if area > h * w * 0.05:
                return box
    
    return None


def detect_edges_color_based(image: np.ndarray) -> Optional[np.ndarray]:
    """
    策略2: 基于颜色差异检测
    适用于票据与背景颜色有明显差异的场景
    """
    h, w = image.shape[:2]
    
    # 转换到HSV空间
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    
    # 计算边缘区域的颜色统计
    margin = min(h, w) // 10
    center = hsv[margin:h-margin, margin:w-margin]
    edge_top = hsv[:margin, :]
    edge_bottom = hsv[h-margin:, :]
    edge_left = hsv[:, :margin]
    edge_right = hsv[:, w-margin:]
    
    # 计算中心区域和边缘区域的颜色差异
    center_mean = np.mean(center, axis=(0, 1))
    
    # 使用颜色差异创建掩码
    diff = np.abs(hsv.astype(np.float32) - center_mean.astype(np.float32))
    diff_gray = np.sum(diff, axis=2)
    
    # 阈值分割
    threshold = np.percentile(diff_gray, 70)
    mask = (diff_gray > threshold).astype(np.uint8) * 255
    
    # 形态学操作
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=3)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)
    
    # 查找轮廓
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if not contours:
        return None
    
    contours = sorted(contours, key=cv2.contourArea, reverse=True)
    contour = contours[0]
    
    peri = cv2.arcLength(contour, True)
    approx = cv2.approxPolyDP(contour, 0.02 * peri, True)
    
    if len(approx) == 4:
        return approx.reshape(4, 2)
    
    rect = cv2.minAreaRect(contour)
    box = cv2.boxPoints(rect)
    return box


def detect_edges_gradient_based(image: np.ndarray) -> Optional[np.ndarray]:
    """
    策略3: 基于梯度检测
    适用于有明显边缘的票据
    """
    h, w = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Sobel梯度
    grad_x = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
    grad_y = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
    gradient = np.sqrt(grad_x**2 + grad_y**2)
    gradient = (gradient / gradient.max() * 255).astype(np.uint8)
    
    # 阈值
    _, binary = cv2.threshold(gradient, 50, 255, cv2.THRESH_BINARY)
    
    # 形态学操作
    kernel_h = cv2.getStructuringElement(cv2.MORPH_RECT, (20, 3))
    kernel_v = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 20))
    
    horizontal = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel_h, iterations=2)
    vertical = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel_v, iterations=2)
    
    combined = cv2.bitwise_or(horizontal, vertical)
    
    # 膨胀
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7))
    dilated = cv2.dilate(combined, kernel, iterations=3)
    
    # 查找轮廓
    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if not contours:
        return None
    
    contours = sorted(contours, key=cv2.contourArea, reverse=True)
    
    for contour in contours[:3]:
        peri = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.02 * peri, True)
        
        if len(approx) == 4:
            return approx.reshape(4, 2)
    
    rect = cv2.minAreaRect(contours[0])
    box = cv2.boxPoints(rect)
    return box


def detect_edges_adaptive(image: np.ndarray) -> Optional[np.ndarray]:
    """
    策略4: 自适应阈值检测
    适用于光照不均匀的场景
    """
    h, w = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # 自适应阈值
    binary = cv2.adaptiveThreshold(
        gray, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        25, 10
    )
    
    # 形态学操作
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))
    binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=3)
    binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel, iterations=2)
    
    # 查找轮廓
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if not contours:
        return None
    
    contours = sorted(contours, key=cv2.contourArea, reverse=True)
    contour = contours[0]
    
    peri = cv2.arcLength(contour, True)
    approx = cv2.approxPolyDP(contour, 0.02 * peri, True)
    
    if len(approx) == 4:
        return approx.reshape(4, 2)
    
    rect = cv2.minAreaRect(contour)
    box = cv2.boxPoints(rect)
    return box


def evaluate_quad_quality(image: np.ndarray, quad: np.ndarray) -> float:
    """
    评估四边形的质量分数（优化版）
    
    优化点：
    1. 降低面积阈值，适应更多场景
    2. 放宽角度要求，适应不规则票据
    """
    h, w = image.shape[:2]
    image_area = h * w
    
    quad_area = cv2.contourArea(quad)
    area_ratio = quad_area / image_area
    
    # 面积检查：票据通常占图片的15%-98%（降低下限）
    if area_ratio < 0.15 or area_ratio > 0.98:
        return 0.0
    
    rect = order_points(quad)
    (tl, tr, br, bl) = rect
    
    # 计算边长
    width = max(
        np.sqrt((tr[0] - tl[0]) ** 2 + (tr[1] - tl[1]) ** 2),
        np.sqrt((br[0] - bl[0]) ** 2 + (br[1] - bl[1]) ** 2)
    )
    height = max(
        np.sqrt((bl[0] - tl[0]) ** 2 + (bl[1] - tl[1]) ** 2),
        np.sqrt((br[0] - tr[0]) ** 2 + (br[1] - tr[1]) ** 2)
    )
    
    if width < 30 or height < 30:
        return 0.0
    
    aspect_ratio = max(width, height) / max(min(width, height), 1)
    
    # 票据宽高比通常在0.2-6之间（放宽限制）
    aspect_score = 1.0 if aspect_ratio < 6 else max(0, 1 - (aspect_ratio - 6) * 0.1)
    
    # 角度检查
    def angle(p1, p2, p3):
        v1 = p1 - p2
        v2 = p3 - p2
        cos_angle = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-6)
        return np.abs(np.arccos(np.clip(cos_angle, -1, 1)))
    
    angles = [
        angle(tl, tr, br),
        angle(tr, br, bl),
        angle(br, bl, tl),
        angle(bl, tl, tr)
    ]
    
    # 角度接近90度得分更高（放宽角度范围）
    angle_score = sum(1 for a in angles if np.abs(a - np.pi / 2) < np.pi / 3) / 4
    
    # 凸性检查
    hull = cv2.convexHull(quad)
    hull_area = cv2.contourArea(hull)
    convexity = quad_area / hull_area if hull_area > 0 else 0
    
    # 综合评分（优化权重，更重视面积比例）
    score = (
        min(area_ratio, 0.9) * 0.30 +
        aspect_score * 0.25 +
        angle_score * 0.20 +
        convexity * 0.25
    )
    
    return score


def detect_document_edges(image: np.ndarray) -> Tuple[Optional[np.ndarray], Dict]:
    """
    检测文档边缘 - 主函数（优化版）
    
    优化策略：
    1. 多种预处理方法并行尝试
    2. 选择得分最高的结果
    3. 增加日志输出便于调试
    """
    h, w = image.shape[:2]
    small_image, scale = resize_for_processing(image, max_size=800)
    small_h, small_w = small_image.shape[:2]
    
    debug_print(f"[Scanner] 原图尺寸: {w}x{h}, 缩放后: {small_w}x{small_h}, scale={scale:.3f}")
    
    # 定义检测策略（按优先级排序）
    strategies = [
        ("轮廓检测", detect_edges_contour_based),
        ("颜色差异", detect_edges_color_based),
        ("梯度检测", detect_edges_gradient_based),
        ("自适应阈值", detect_edges_adaptive),
    ]
    
    best_quad = None
    best_score = 0
    best_strategy = None
    all_results = []
    
    for name, strategy in strategies:
        try:
            quad = strategy(small_image)
            
            if quad is not None:
                score = evaluate_quad_quality(small_image, quad)
                
                # 输出检测到的四边形坐标
                debug_print(f"[Scanner] {name}: 检测到四边形 score={score:.3f}, quad={quad.tolist()}")
                
                all_results.append({
                    "strategy": name,
                    "score": round(score, 3),
                    "success": True
                })
                
                # 选择得分最高且超过阈值的
                if score > best_score:
                    best_score = score
                    best_quad = quad
                    best_strategy = name
            else:
                debug_print(f"[Scanner] {name}: 未检测到四边形")
                all_results.append({
                    "strategy": name,
                    "score": 0,
                    "success": False
                })
        except Exception as e:
            debug_print(f"[Scanner] {name}: 检测异常 - {str(e)}")
            all_results.append({
                "strategy": name,
                "score": 0,
                "success": False,
                "error": str(e)[:50]
            })
    
    info = {
        "best_strategy": best_strategy,
        "confidence": round(best_score, 3),
        "all_strategies": all_results,
        "scale": scale
    }
    
    # 降低阈值以适应更多场景，默认使用一个接近全图的边框
    if best_quad is not None and best_score > 0.15:
        best_quad = best_quad / scale
        best_quad = order_points(best_quad)
        debug_print(f"[Scanner] 最终选择: {best_strategy}, score={best_score:.3f}, 原图坐标={best_quad.tolist()}")
        return best_quad, info
    
    # 如果所有策略都失败，返回默认边框（略小于全图）
    debug_print(f"[Scanner] 所有策略未达标，使用默认边框")
    default_quad = np.array([
        [w * 0.05, h * 0.05],   # 左上
        [w * 0.95, h * 0.05],   # 右上
        [w * 0.95, h * 0.95],   # 右下
        [w * 0.05, h * 0.95],   # 左下
    ], dtype="float32")
    
    return default_quad, info


def enhance_image(image: np.ndarray, mode: str = 'auto') -> np.ndarray:
    """
    图像增强（优化版 - 减少噪点）
    
    Args:
        image: 输入图像
        mode: 增强模式
            - 'auto': 自动模式，保持彩色，适度增强
            - 'enhance': 增强对比度和清晰度（减少噪点版本）
            - 'binarize': 黑白化（适合OCR）
    """
    if mode == 'binarize':
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image
        
        # 先降噪再处理
        denoised = cv2.fastNlMeansDenoising(gray, None, h=6, templateWindowSize=7, searchWindowSize=21)
        
        # CLAHE（降低clipLimit减少噪点增强）
        clahe = cv2.createCLAHE(clipLimit=1.5, tileGridSize=(8, 8))
        enhanced = clahe.apply(denoised)
        
        # 自适应阈值
        binary = cv2.adaptiveThreshold(
            enhanced, 255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY, 15, 8
        )
        
        # 轻微去噪
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
        binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)
        
        return binary
    
    else:  # 'auto' or 'enhance'
        if len(image.shape) == 3:
            # 先使用双边滤波降噪（保留边缘）
            denoised = cv2.bilateralFilter(image, d=5, sigmaColor=30, sigmaSpace=30)
            
            # LAB空间处理
            lab = cv2.cvtColor(denoised, cv2.COLOR_BGR2LAB)
            l, a, b = cv2.split(lab)
            
            # CLAHE增强亮度（降低clipLimit避免噪点增强）
            clahe = cv2.createCLAHE(clipLimit=1.2, tileGridSize=(8, 8))
            l_enhanced = clahe.apply(l)
            
            # 合并
            lab_enhanced = cv2.merge([l_enhanced, a, b])
            result = cv2.cvtColor(lab_enhanced, cv2.COLOR_LAB2BGR)
            
            # 轻微锐化（使用更温和的核）
            kernel = np.array([
                [0, -0.5, 0],
                [-0.5, 3, -0.5],
                [0, -0.5, 0]
            ])
            result = cv2.filter2D(result, -1, kernel)
            
            # 最后轻微降噪
            result = cv2.fastNlMeansDenoisingColored(result, None, h=3, hColor=3, templateWindowSize=7, searchWindowSize=21)
            
            return result
        else:
            # 灰度图处理
            denoised = cv2.fastNlMeansDenoising(image, None, h=6, templateWindowSize=7, searchWindowSize=21)
            clahe = cv2.createCLAHE(clipLimit=1.2, tileGridSize=(8, 8))
            return clahe.apply(denoised)


def process_document(
    image: np.ndarray,
    auto_transform: bool = True,
    enhance_mode: str = 'auto'
) -> Tuple[np.ndarray, bool, Optional[np.ndarray], Dict]:
    """处理文档图片"""
    edges, info = detect_document_edges(image)
    
    result_image = image.copy()
    edges_detected = edges is not None
    
    if auto_transform and edges is not None:
        result_image = four_point_transform(image, edges)
    
    if enhance_mode != 'none':
        result_image = enhance_image(result_image, enhance_mode)
    
    return result_image, edges_detected, edges, info


def main():
    """命令行入口"""
    if len(sys.argv) < 2:
        print(json.dumps({'success': False, 'error': 'No arguments provided'}))
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == 'detect':
        if len(sys.argv) < 3:
            print(json.dumps({'success': False, 'error': 'Usage: detect <input_path>'}))
            sys.exit(1)
        
        input_path = sys.argv[2]
        image = load_image_from_path(input_path)
        
        if image is None:
            print(json.dumps({'success': False, 'error': 'Failed to load image'}))
            sys.exit(1)
        
        edges, info = detect_document_edges(image)
        
        result = {
            'success': True,
            'edges_detected': edges is not None,
            'original_size': {'width': image.shape[1], 'height': image.shape[0]},
            'info': info
        }
        
        if edges is not None:
            result['edges'] = edges.tolist()
        
        print(json.dumps(result))
    
    elif command == 'transform':
        if len(sys.argv) < 4:
            print(json.dumps({'success': False, 'error': 'Usage: transform <input_path> <points_json>'}))
            sys.exit(1)
        
        input_path = sys.argv[2]
        points = json.loads(sys.argv[3])
        
        image = load_image_from_path(input_path)
        
        if image is None:
            print(json.dumps({'success': False, 'error': 'Failed to load image'}))
            sys.exit(1)
        
        pts = np.array(points, dtype="float32")
        debug_print(f"[Scanner] Transform 输入点: {pts.tolist()}")
        
        # four_point_transform 会自动使用 order_points 对点进行正确排序
        warped = four_point_transform(image, pts)
        
        debug_print(f"[Scanner] Transform 输出尺寸: {warped.shape[1]}x{warped.shape[0]}")
        
        result = {
            'success': True,
            'image': image_to_base64(warped),
            'original_size': {'width': image.shape[1], 'height': image.shape[0]},
            'processed_size': {'width': warped.shape[1], 'height': warped.shape[0]}
        }
        
        print(json.dumps(result))
    
    elif command == 'process':
        if len(sys.argv) < 3:
            print(json.dumps({'success': False, 'error': 'Usage: process <input_path> [enhance_mode]'}))
            sys.exit(1)
        
        input_path = sys.argv[2]
        enhance_mode = sys.argv[3] if len(sys.argv) > 3 else 'auto'
        
        image = load_image_from_path(input_path)
        
        if image is None:
            print(json.dumps({'success': False, 'error': 'Failed to load image'}))
            sys.exit(1)
        
        result_image, edges_detected, edges, info = process_document(
            image,
            auto_transform=True,
            enhance_mode=enhance_mode
        )
        
        result = {
            'success': True,
            'image': image_to_base64(result_image),
            'edges_detected': edges_detected,
            'original_size': {'width': image.shape[1], 'height': image.shape[0]},
            'processed_size': {'width': result_image.shape[1], 'height': result_image.shape[0]},
            'info': info
        }
        
        if edges is not None:
            result['edges'] = edges.tolist()
        
        print(json.dumps(result))
    
    else:
        print(json.dumps({'success': False, 'error': f'Unknown command: {command}'}))
        sys.exit(1)


if __name__ == '__main__':
    main()
