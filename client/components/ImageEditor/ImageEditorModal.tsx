import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Image as RNImage,
  Alert,
  Platform,
  StyleSheet,
  PanResponder,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import { Image } from 'expo-image';
import * as FileSystem from 'expo-file-system/legacy';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Path, Line } from 'react-native-svg';
import { useTheme } from '@/hooks/useTheme';
import { ThemedText } from '@/components/ThemedText';
import { Spacing, BorderRadius } from '@/constants/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

type EditorPhase = 'detecting' | 'edge-confirm' | 'editing' | 'processing';

interface ImageEditorModalProps {
  visible: boolean;
  imageUri: string;
  onClose: () => void;
  onSave: (editedUri: string) => void;
  mode?: 'ticket' | 'avatar';
}

// 四边形四个点（相对于图片的坐标，0-1范围）
interface QuadPoints {
  tl: { x: number; y: number };
  tr: { x: number; y: number };
  br: { x: number; y: number };
  bl: { x: number; y: number };
}

async function imageUriToBase64(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } else {
    const fs = FileSystem as any;
    return await fs.readAsStringAsync(uri, { encoding: 'base64' });
  }
}

async function detectEdgesApi(base64Image: string) {
  const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/image/base64-detect-edges`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: `data:image/jpeg;base64,${base64Image}` }),
  });
  return await response.json();
}

async function transformImageApi(base64Image: string, points: number[][]) {
  const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/image/base64-transform`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: `data:image/jpeg;base64,${base64Image}`, points }),
  });
  return await response.json();
}

async function processImageApi(base64Image: string, mode: 'enhance' | 'binarize') {
  const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/image/base64-process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: `data:image/jpeg;base64,${base64Image}`, mode }),
  });
  return await response.json();
}

function getCacheDirectory(): string {
  const fs = FileSystem as any;
  return fs.cacheDirectory || fs.documentDirectory || '/tmp/';
}

export function ImageEditorModal({
  visible,
  imageUri,
  onClose,
  onSave,
  mode = 'ticket',
}: ImageEditorModalProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [phase, setPhase] = useState<EditorPhase>('detecting');
  const [processingText, setProcessingText] = useState('正在检测边框...');
  const [currentUri, setCurrentUri] = useState(imageUri);
  const [originalUri, setOriginalUri] = useState(imageUri);
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });
  // 后端返回的原始图片尺寸（可能和前端 imageSize 不同，因为 EXIF 旋转）
  const [backendImageSize, setBackendImageSize] = useState<{ width: number; height: number } | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: SCREEN_WIDTH - 40, height: SCREEN_HEIGHT * 0.45 });

  // 四边形四个点
  const [quadPoints, setQuadPoints] = useState<QuadPoints>({
    tl: { x: 0.05, y: 0.05 },
    tr: { x: 0.95, y: 0.05 },
    br: { x: 0.95, y: 0.95 },
    bl: { x: 0.05, y: 0.95 },
  });
  const [edgesDetected, setEdgesDetected] = useState(false);
  const [detectionInfo, setDetectionInfo] = useState<{ best_strategy?: string; confidence?: number } | null>(null);

  // 缩放和平移
  const zoomScale = useSharedValue(1);
  const zoomSavedScale = useSharedValue(1);
  const zoomTranslateX = useSharedValue(0);
  const zoomTranslateY = useSharedValue(0);
  const zoomSavedTranslateX = useSharedValue(0);
  const zoomSavedTranslateY = useSharedValue(0);

  // 拖拽状态 ref
  const dragStartRef = useRef<{
    pointX: number;  // 拖拽开始时的点位置（相对坐标）
    pointY: number;
    corner: keyof QuadPoints | null;
  }>({ pointX: 0, pointY: 0, corner: null });

  // 初始化
  useEffect(() => {
    if (visible) {
      setCurrentUri(imageUri);
      setOriginalUri(imageUri);
      resetZoom();
      setBackendImageSize(null);  // 清除后端尺寸，等待重新检测
      loadImageSize(imageUri);
      setPhase('detecting');
      setTimeout(() => detectEdgesInternal(imageUri), 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, imageUri]);

  // 加载图片尺寸
  const loadImageSize = useCallback((uri: string) => {
    RNImage.getSize(
      uri,
      (width: number, height: number) => {
        setImageSize({ width, height });
        const aspectRatio = width / height;
        let displayWidth = SCREEN_WIDTH - Spacing.lg * 2;
        let displayHeight = displayWidth / aspectRatio;
        const maxHeight = SCREEN_HEIGHT * 0.45;
        if (displayHeight > maxHeight) {
          displayHeight = maxHeight;
          displayWidth = displayHeight * aspectRatio;
        }
        setCanvasSize({ width: displayWidth, height: displayHeight });
      },
      (error) => console.error('Failed to get image size:', error)
    );
  }, []);

  // 检测边框
  const detectEdgesInternal = useCallback(async (uri: string) => {
    setPhase('detecting');
    setProcessingText('正在检测边框...');

    try {
      const base64 = await imageUriToBase64(uri);
      const result = await detectEdgesApi(base64);

      if (result.success && result.edgesDetected && result.edges) {
        setEdgesDetected(true);
        setDetectionInfo(result.info || null);

        const [tl, tr, br, bl] = result.edges;
        // 注意：后端返回的字段名是驼峰命名 originalSize，不是 original_size
        // 使用后端返回的尺寸，避免 EXIF 旋转导致的尺寸不一致问题
        const actualSize = result.originalSize || result.original_size || imageSize;
        
        // 保存后端返回的尺寸，供后续矫正使用
        if (result.originalSize || result.original_size) {
          setBackendImageSize(result.originalSize || result.original_size);
        }
        
        console.log('[EdgeDetect] result.originalSize:', result.originalSize);
        console.log('[EdgeDetect] actualSize:', actualSize);
        console.log('[EdgeDetect] imageSize:', imageSize);

        const clampVal = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

        setQuadPoints({
          tl: { x: clampVal(tl[0] / actualSize.width, 0.02, 0.98), y: clampVal(tl[1] / actualSize.height, 0.02, 0.98) },
          tr: { x: clampVal(tr[0] / actualSize.width, 0.02, 0.98), y: clampVal(tr[1] / actualSize.height, 0.02, 0.98) },
          br: { x: clampVal(br[0] / actualSize.width, 0.02, 0.98), y: clampVal(br[1] / actualSize.height, 0.02, 0.98) },
          bl: { x: clampVal(bl[0] / actualSize.width, 0.02, 0.98), y: clampVal(bl[1] / actualSize.height, 0.02, 0.98) },
        });
      } else {
        setEdgesDetected(false);
        setBackendImageSize(null);  // 清除后端尺寸
        setQuadPoints({
          tl: { x: 0.05, y: 0.05 },
          tr: { x: 0.95, y: 0.05 },
          br: { x: 0.95, y: 0.95 },
          bl: { x: 0.05, y: 0.95 },
        });
      }
      setPhase('edge-confirm');
    } catch (error: any) {
      console.error('Edge detection error:', error);
      setEdgesDetected(false);
      setBackendImageSize(null);  // 清除后端尺寸
      setPhase('edge-confirm');
    }
  }, [imageSize]);

  // 重置缩放
  const resetZoom = useCallback(() => {
    zoomScale.value = withSpring(1);
    zoomSavedScale.value = 1;
    zoomTranslateX.value = withSpring(0);
    zoomTranslateY.value = withSpring(0);
    zoomSavedTranslateX.value = 0;
    zoomSavedTranslateY.value = 0;
  }, []);

  // 创建角点 PanResponder
  const createCornerResponder = useCallback((corner: keyof QuadPoints) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt, gestureState) => {
        // 记录拖拽开始时的点位置
        setQuadPoints(prev => {
          dragStartRef.current = {
            pointX: prev[corner].x,
            pointY: prev[corner].y,
            corner,
          };
          return prev; // 不改变状态
        });
      },
      onPanResponderMove: (evt, gestureState) => {
        const { dx, dy } = gestureState;
        const start = dragStartRef.current;
        
        if (start.corner !== corner) return;
        
        // 考虑缩放的影响：缩放后图片变大，相同屏幕移动对应的图片坐标变化更小
        // 直接从 SharedValue 读取当前缩放值
        const currentScale = zoomScale.value || 1;
        const deltaX = dx / (canvasSize.width * currentScale);
        const deltaY = dy / (canvasSize.height * currentScale);
        const newX = Math.max(0.02, Math.min(0.98, start.pointX + deltaX));
        const newY = Math.max(0.02, Math.min(0.98, start.pointY + deltaY));

        setQuadPoints(prev => ({
          ...prev,
          [corner]: { x: newX, y: newY },
        }));
      },
      onPanResponderRelease: () => {
        dragStartRef.current = { pointX: 0, pointY: 0, corner: null };
      },
      onPanResponderTerminate: () => {
        dragStartRef.current = { pointX: 0, pointY: 0, corner: null };
      },
    });
  }, [canvasSize]);

  // 四个角的 PanResponder
  const tlResponder = useMemo(() => createCornerResponder('tl'), [createCornerResponder]);
  const trResponder = useMemo(() => createCornerResponder('tr'), [createCornerResponder]);
  const brResponder = useMemo(() => createCornerResponder('br'), [createCornerResponder]);
  const blResponder = useMemo(() => createCornerResponder('bl'), [createCornerResponder]);

  // 缩放手势（仅用于双指缩放）
  const pinchGesture = useMemo(() =>
    Gesture.Pinch()
      .onUpdate((e) => {
        zoomScale.value = Math.max(1, Math.min(4, zoomSavedScale.value * e.scale));
      })
      .onEnd(() => {
        if (zoomScale.value < 1) {
          zoomScale.value = withSpring(1);
          zoomSavedScale.value = 1;
        } else if (zoomScale.value > 4) {
          zoomScale.value = withSpring(4);
          zoomSavedScale.value = 4;
        } else {
          zoomSavedScale.value = zoomScale.value;
        }
      }),
  [zoomScale, zoomSavedScale]);

  const panGesture = useMemo(() =>
    Gesture.Pan()
      .onUpdate((e) => {
        zoomTranslateX.value = zoomSavedTranslateX.value + e.translationX;
        zoomTranslateY.value = zoomSavedTranslateY.value + e.translationY;
      })
      .onEnd(() => {
        zoomSavedTranslateX.value = zoomTranslateX.value;
        zoomSavedTranslateY.value = zoomTranslateY.value;
      }),
  [zoomTranslateX, zoomTranslateY, zoomSavedTranslateX, zoomSavedTranslateY]);

  const zoomGesture = useMemo(() =>
    Gesture.Simultaneous(pinchGesture, panGesture),
  [pinchGesture, panGesture]);

  // 缩放动画样式
  const zoomAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: zoomTranslateX.value },
      { translateY: zoomTranslateY.value },
      { scale: zoomScale.value },
    ],
  }));

  // 确认边框
  const handleConfirmEdges = useCallback(async () => {
    setPhase('processing');
    setProcessingText('正在矫正图片...');

    try {
      const base64 = await imageUriToBase64(originalUri);
      
      // 使用后端返回的尺寸（如果有），否则使用前端获取的尺寸
      // 这是关键：前端的 imageSize 可能因为 EXIF 旋转而与后端处理的尺寸不一致
      const actualSize = backendImageSize || imageSize;
      
      const points = [
        [Math.round(quadPoints.tl.x * actualSize.width), Math.round(quadPoints.tl.y * actualSize.height)],
        [Math.round(quadPoints.tr.x * actualSize.width), Math.round(quadPoints.tr.y * actualSize.height)],
        [Math.round(quadPoints.br.x * actualSize.width), Math.round(quadPoints.br.y * actualSize.height)],
        [Math.round(quadPoints.bl.x * actualSize.width), Math.round(quadPoints.bl.y * actualSize.height)],
      ];
      
      console.log('[Transform] Using size:', actualSize);
      console.log('[Transform] Points:', points);

      const result = await transformImageApi(base64, points);

      if (result.success && result.url) {
        if (Platform.OS === 'web') {
          setCurrentUri(result.url);
        } else {
          const tempPath = `${getCacheDirectory()}transformed_${Date.now()}.jpg`;
          const fs = FileSystem as any;
          const downloadResult = await fs.downloadAsync(result.url, tempPath);
          setCurrentUri(downloadResult.uri);
        }
        setPhase('editing');
      } else {
        Alert.alert('矫正失败', result.error || '请重试');
        setPhase('edge-confirm');
      }
    } catch (error: any) {
      console.error('Transform error:', error);
      Alert.alert('矫正失败', error.message || '未知错误');
      setPhase('edge-confirm');
    }
  }, [quadPoints, originalUri, imageSize, backendImageSize]);

  const handleSkipEdgeConfirm = useCallback(() => setPhase('editing'), []);

  const handleResetEdges = useCallback(() => {
    setQuadPoints({
      tl: { x: 0.05, y: 0.05 },
      tr: { x: 0.95, y: 0.05 },
      br: { x: 0.95, y: 0.95 },
      bl: { x: 0.05, y: 0.95 },
    });
    setEdgesDetected(false);
  }, []);

  const handleEnhance = useCallback(async () => {
    setPhase('processing');
    setProcessingText('正在增强图像...');
    try {
      const base64 = await imageUriToBase64(currentUri);
      const result = await processImageApi(base64, 'enhance');
      if (result.success && result.url) {
        if (Platform.OS === 'web') {
          setCurrentUri(result.url);
        } else {
          const tempPath = `${getCacheDirectory()}enhanced_${Date.now()}.jpg`;
          const fs = FileSystem as any;
          setCurrentUri((await fs.downloadAsync(result.url, tempPath)).uri);
        }
      } else {
        Alert.alert('增强失败', result.error || '请重试');
      }
    } catch (error: any) {
      Alert.alert('增强失败', error.message);
    } finally {
      setPhase('editing');
    }
  }, [currentUri]);

  const handleBinarize = useCallback(async () => {
    setPhase('processing');
    setProcessingText('正在黑白化...');
    try {
      const base64 = await imageUriToBase64(currentUri);
      const result = await processImageApi(base64, 'binarize');
      if (result.success && result.url) {
        if (Platform.OS === 'web') {
          setCurrentUri(result.url);
        } else {
          const tempPath = `${getCacheDirectory()}binarized_${Date.now()}.jpg`;
          const fs = FileSystem as any;
          setCurrentUri((await fs.downloadAsync(result.url, tempPath)).uri);
        }
      } else {
        Alert.alert('黑白化失败', result.error || '请重试');
      }
    } catch (error: any) {
      Alert.alert('黑白化失败', error.message);
    } finally {
      setPhase('editing');
    }
  }, [currentUri]);

  const handleRotate90 = useCallback(async () => {
    setPhase('processing');
    setProcessingText('正在旋转...');
    try {
      const result = await ImageManipulator.manipulateAsync(
        currentUri, [{ rotate: 90 }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
      );
      setCurrentUri(result.uri);
      loadImageSize(result.uri);
    } catch {
      Alert.alert('旋转失败', '请重试');
    } finally {
      setPhase('editing');
    }
  }, [currentUri, loadImageSize]);

  const handleReset = useCallback(() => {
    setCurrentUri(originalUri);
    setPhase('edge-confirm');
    detectEdgesInternal(originalUri);
  }, [originalUri, detectEdgesInternal]);

  const handleSave = useCallback(async () => {
    setPhase('processing');
    setProcessingText('正在保存...');
    try {
      const result = await ImageManipulator.manipulateAsync(
        currentUri, [],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );
      onSave(result.uri);
      onClose();
    } catch {
      Alert.alert('保存失败', '请重试');
    } finally {
      setPhase('editing');
    }
  }, [currentUri, onSave, onClose]);

  // 渲染四边形覆盖层
  const renderQuadOverlay = () => {
    const tl = { x: quadPoints.tl.x * canvasSize.width, y: quadPoints.tl.y * canvasSize.height };
    const tr = { x: quadPoints.tr.x * canvasSize.width, y: quadPoints.tr.y * canvasSize.height };
    const br = { x: quadPoints.br.x * canvasSize.width, y: quadPoints.br.y * canvasSize.height };
    const bl = { x: quadPoints.bl.x * canvasSize.width, y: quadPoints.bl.y * canvasSize.height };

    const maskPath = `
      M 0 0 L ${canvasSize.width} 0 L ${canvasSize.width} ${canvasSize.height} L 0 ${canvasSize.height} Z
      M ${tl.x} ${tl.y} L ${tr.x} ${tr.y} L ${br.x} ${br.y} L ${bl.x} ${bl.y} Z
    `;

    const handleSize = 44; // 增大触摸区域

    return (
      <View style={[styles.overlayContainer, { width: canvasSize.width, height: canvasSize.height }]}>
        <Svg width={canvasSize.width} height={canvasSize.height}>
          <Path d={maskPath} fill="rgba(0,0,0,0.35)" fillRule="evenodd" />
          <Line x1={tl.x} y1={tl.y} x2={tr.x} y2={tr.y} stroke="#FFD700" strokeWidth="2" />
          <Line x1={tr.x} y1={tr.y} x2={br.x} y2={br.y} stroke="#FFD700" strokeWidth="2" />
          <Line x1={br.x} y1={br.y} x2={bl.x} y2={bl.y} stroke="#FFD700" strokeWidth="2" />
          <Line x1={bl.x} y1={bl.y} x2={tl.x} y2={tl.y} stroke="#FFD700" strokeWidth="2" />
        </Svg>

        {/* 四个可拖拽角点 - 使用 PanResponder */}
        <View
          style={[styles.cornerHandle, { left: tl.x - handleSize/2, top: tl.y - handleSize/2, width: handleSize, height: handleSize }]}
          {...tlResponder.panHandlers}
        >
          <View style={styles.cornerHandleInner} />
        </View>

        <View
          style={[styles.cornerHandle, { left: tr.x - handleSize/2, top: tr.y - handleSize/2, width: handleSize, height: handleSize }]}
          {...trResponder.panHandlers}
        >
          <View style={styles.cornerHandleInner} />
        </View>

        <View
          style={[styles.cornerHandle, { left: br.x - handleSize/2, top: br.y - handleSize/2, width: handleSize, height: handleSize }]}
          {...brResponder.panHandlers}
        >
          <View style={styles.cornerHandleInner} />
        </View>

        <View
          style={[styles.cornerHandle, { left: bl.x - handleSize/2, top: bl.y - handleSize/2, width: handleSize, height: handleSize }]}
          {...blResponder.panHandlers}
        >
          <View style={styles.cornerHandleInner} />
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <FontAwesome6 name="xmark" size={20} color={theme.textPrimary} />
            </TouchableOpacity>
            <ThemedText variant="h4" color={theme.textPrimary}>
              {phase === 'edge-confirm' ? '调整边框' : '编辑图片'}
            </ThemedText>
            <TouchableOpacity
              style={[styles.saveBtn, phase === 'processing' && styles.saveBtnDisabled]}
              onPress={phase === 'editing' ? handleSave : undefined}
              disabled={phase !== 'editing'}
            >
              {phase === 'processing' ? (
                <ActivityIndicator size="small" color={theme.buttonPrimaryText} />
              ) : (
                <ThemedText variant="smallMedium" color={phase === 'editing' ? theme.buttonPrimaryText : theme.textMuted}>
                  完成
                </ThemedText>
              )}
            </TouchableOpacity>
          </View>

          {/* 图片预览 */}
          <View style={styles.previewContainer}>
            {(phase === 'detecting' || phase === 'processing') && (
              <View style={styles.processingOverlay}>
                <ActivityIndicator size="large" color={theme.primary} />
                <ThemedText variant="body" color="#FFFFFF" style={{ marginTop: Spacing.sm }}>
                  {processingText}
                </ThemedText>
              </View>
            )}

            {phase === 'edge-confirm' && (
              <GestureDetector gesture={zoomGesture}>
                <Animated.View style={[styles.previewWrapper, zoomAnimatedStyle]}>
                  <Image
                    source={{ uri: originalUri }}
                    style={[styles.previewImage, { width: canvasSize.width, height: canvasSize.height }]}
                    contentFit="cover"
                  />
                  {renderQuadOverlay()}
                </Animated.View>
              </GestureDetector>
            )}

            {(phase === 'editing' || phase === 'processing') && (
              <Image
                source={{ uri: currentUri }}
                style={[styles.previewImage, { width: canvasSize.width, height: canvasSize.height }]}
                contentFit="contain"
              />
            )}
          </View>

          {phase === 'edge-confirm' && (
            <View style={styles.tipContainer}>
              <ThemedText variant="caption" color={theme.textMuted}>
                双指缩放平移 | 拖拽黄色圆点调整四边形
              </ThemedText>
              {detectionInfo && edgesDetected && (
                <ThemedText variant="caption" color={theme.success}>
                  检测: {detectionInfo.best_strategy} ({Math.round((detectionInfo.confidence || 0) * 100)}%)
                </ThemedText>
              )}
            </View>
          )}

          {phase === 'edge-confirm' && (
            <View style={styles.edgeConfirmBar}>
              <TouchableOpacity style={styles.edgeBtn} onPress={resetZoom}>
                <FontAwesome6 name="magnifying-glass" size={16} color={theme.textSecondary} />
                <ThemedText variant="small" color={theme.textSecondary}>重置视图</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.edgeBtn} onPress={handleResetEdges}>
                <FontAwesome6 name="rotate-left" size={16} color={theme.textSecondary} />
                <ThemedText variant="small" color={theme.textSecondary}>默认边框</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.edgeSkipBtn} onPress={handleSkipEdgeConfirm}>
                <ThemedText variant="small" color={theme.textSecondary}>跳过</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.edgeConfirmBtn} onPress={handleConfirmEdges}>
                <FontAwesome6 name="check" size={16} color="#FFFFFF" />
                <ThemedText variant="smallMedium" color="#FFFFFF">确认</ThemedText>
              </TouchableOpacity>
            </View>
          )}

          {phase === 'editing' && mode === 'ticket' && (
            <View style={styles.processToolbar}>
              <TouchableOpacity style={styles.toolBtn} onPress={handleEnhance}>
                <View style={[styles.toolIcon, { backgroundColor: '#FF9500' + '18' }]}>
                  <FontAwesome6 name="sun" size={20} color="#FF9500" />
                </View>
                <ThemedText variant="small" color={theme.textPrimary}>增强</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.toolBtn} onPress={handleBinarize}>
                <View style={[styles.toolIcon, { backgroundColor: '#5856D6' + '18' }]}>
                  <FontAwesome6 name="circle-half-stroke" size={20} color="#5856D6" />
                </View>
                <ThemedText variant="small" color={theme.textPrimary}>黑白</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.toolBtn} onPress={handleRotate90}>
                <View style={styles.toolIcon}>
                  <FontAwesome6 name="rotate-right" size={20} color={theme.primary} />
                </View>
                <ThemedText variant="small" color={theme.textPrimary}>旋转</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.toolBtn} onPress={handleReset}>
                <View style={[styles.toolIcon, { backgroundColor: theme.textMuted + '18' }]}>
                  <FontAwesome6 name="arrow-rotate-left" size={20} color={theme.textMuted} />
                </View>
                <ThemedText variant="small" color={theme.textPrimary}>重扫</ThemedText>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: theme.backgroundRoot },
  container: { flex: 1, paddingTop: Platform.OS === 'ios' ? 60 : 40 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  closeBtn: { padding: Spacing.sm },
  saveBtn: {
    backgroundColor: theme.primary, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg, minWidth: 60, alignItems: 'center',
  },
  saveBtnDisabled: { backgroundColor: theme.textMuted },
  previewContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#000000', padding: Spacing.lg,
  },
  previewWrapper: { position: 'relative' },
  previewImage: { borderRadius: BorderRadius.md },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center', justifyContent: 'center', zIndex: 10,
  },
  overlayContainer: { position: 'absolute', top: 0, left: 0 },
  cornerHandle: {
    position: 'absolute', alignItems: 'center', justifyContent: 'center', zIndex: 20,
  },
  cornerHandleInner: {
    width: 22, height: 22, backgroundColor: '#FFD700', borderRadius: 11,
    borderWidth: 2, borderColor: '#FFFFFF',
  },
  tipContainer: { alignItems: 'center', paddingVertical: Spacing.sm, gap: 4 },
  edgeConfirmBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderTopWidth: 1, borderTopColor: theme.border, backgroundColor: theme.backgroundDefault,
  },
  edgeBtn: { alignItems: 'center', gap: 4 },
  edgeSkipBtn: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg },
  edgeConfirmBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    backgroundColor: theme.primary, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
  },
  processToolbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderTopWidth: 1, borderTopColor: theme.border, backgroundColor: theme.backgroundDefault,
  },
  toolBtn: { alignItems: 'center', gap: Spacing.xs },
  toolIcon: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: theme.backgroundTertiary,
    alignItems: 'center', justifyContent: 'center',
  },
});
