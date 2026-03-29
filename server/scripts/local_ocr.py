#!/usr/bin/env python3
"""
本地OCR服务脚本 - 使用RapidOCR
用法: python local_ocr.py <image_path>
输出: JSON格式的识别结果
"""

import sys
import json
import os
from rapidocr_onnxruntime import RapidOCR

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "请提供图片路径"}))
        sys.exit(1)
    
    image_path = sys.argv[1]
    
    if not os.path.exists(image_path):
        print(json.dumps({"error": f"图片文件不存在: {image_path}"}))
        sys.exit(1)
    
    try:
        # 初始化OCR引擎
        ocr = RapidOCR()
        
        # 执行OCR识别
        result, elapse = ocr(image_path)
        
        if result is None or len(result) == 0:
            print(json.dumps({"text": "", "raw_result": []}))
            return
        
        # 提取文本
        texts = []
        for item in result:
            if item and len(item) >= 2:
                text = item[1]  # item[1] 是识别的文本
                if text:
                    texts.append(text)
        
        full_text = "\n".join(texts)
        
        # 返回结果
        output = {
            "text": full_text,
            "raw_result": [
                {
                    "text": item[1] if len(item) > 1 else "",
                    "confidence": float(item[2]) if len(item) > 2 and item[2] is not None else 0.0,
                    "box": list(item[0]) if len(item) > 0 and item[0] is not None else []
                }
                for item in result if item
            ],
            "elapse": elapse
        }
        
        print(json.dumps(output, ensure_ascii=False))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
