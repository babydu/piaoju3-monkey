import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  View,
  Modal,
  TextInput,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';
import { createStyles } from './styles';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://localhost:9091';

interface Tag {
  id: string;
  name: string;
  ticketCount: number;
  createdAt: string;
}

export default function TagsScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const { token } = useAuth();

  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [mergeModalVisible, setMergeModalVisible] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [tagName, setTagName] = useState('');
  
  // 合并相关状态
  const [isSelectingMerge, setIsSelectingMerge] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isMerging, setIsMerging] = useState(false);

  const fetchTags = useCallback(async () => {
    if (!token) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/tags`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setTags(data.tags);
      }
    } catch (error) {
      console.error('获取标签列表失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      fetchTags();
    }, [fetchTags])
  );

  const handleAddTag = () => {
    setEditingTag(null);
    setTagName('');
    setModalVisible(true);
  };

  const handleEditTag = (tag: Tag) => {
    if (isSelectingMerge) {
      toggleTagSelection(tag.id);
    } else {
      setEditingTag(tag);
      setTagName(tag.name);
      setModalVisible(true);
    }
  };

  const handleDeleteTag = async (tag: Tag) => {
    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/tags/${tag.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        Toast.show({
          type: 'success',
          text1: '删除成功',
          text2: `标签"${tag.name}"已删除`,
        });
        fetchTags();
      } else {
        Toast.show({
          type: 'error',
          text1: '删除失败',
          text2: data.error || '请重试',
        });
      }
    } catch (error) {
      console.error('删除标签失败:', error);
      Toast.show({
        type: 'error',
        text1: '删除失败',
        text2: '请重试',
      });
    }
  };

  const handleSaveTag = async () => {
    if (!tagName.trim()) {
      Toast.show({
        type: 'error',
        text1: '标签名称不能为空',
      });
      return;
    }

    try {
      const url = editingTag
        ? `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/tags/${editingTag.id}`
        : `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/tags`;
      const method = editingTag ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: tagName.trim() }),
      });

      const data = await response.json();
      if (data.success) {
        setModalVisible(false);
        Toast.show({
          type: 'success',
          text1: editingTag ? '修改成功' : '创建成功',
        });
        fetchTags();
      } else {
        Toast.show({
          type: 'error',
          text1: data.error || '保存失败',
        });
      }
    } catch (error) {
      console.error('保存标签失败:', error);
      Toast.show({
        type: 'error',
        text1: '保存失败',
        text2: '请重试',
      });
    }
  };

  // 合并相关函数
  const toggleTagSelection = (tagId: string) => {
    setSelectedTags(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const startMergeMode = () => {
    setIsSelectingMerge(true);
    setSelectedTags([]);
  };

  const cancelMergeMode = () => {
    setIsSelectingMerge(false);
    setSelectedTags([]);
  };

  const openMergeModal = () => {
    if (selectedTags.length < 2) {
      Toast.show({
        type: 'error',
        text1: '请至少选择2个标签',
      });
      return;
    }
    setMergeModalVisible(true);
  };

  const handleMerge = async (targetTagId: string) => {
    const sourceTagIds = selectedTags.filter(id => id !== targetTagId);
    setIsMerging(true);

    try {
      // 逐个合并到目标标签
      for (const sourceId of sourceTagIds) {
        const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/tags/merge`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            sourceTagId: sourceId,
            targetTagId: targetTagId,
          }),
        });

        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error);
        }
      }

      Toast.show({
        type: 'success',
        text1: '合并成功',
        text2: `已合并 ${sourceTagIds.length} 个标签`,
      });
      setMergeModalVisible(false);
      setIsSelectingMerge(false);
      setSelectedTags([]);
      fetchTags();
    } catch (error) {
      console.error('合并标签失败:', error);
      Toast.show({
        type: 'error',
        text1: '合并失败',
        text2: '请重试',
      });
    } finally {
      setIsMerging(false);
    }
  };

  const renderTagItem = ({ item }: { item: Tag }) => {
    const isSelected = selectedTags.includes(item.id);
    
    return (
      <TouchableOpacity
        style={[styles.tagItem, isSelected && styles.tagItemSelected]}
        onPress={() => {
          if (isSelectingMerge) {
            toggleTagSelection(item.id);
          }
        }}
        onLongPress={() => {
          if (!isSelectingMerge) {
            handleDeleteTag(item);
          }
        }}
        delayLongPress={500}
      >
        <View style={styles.tagInfo}>
          {isSelectingMerge && (
            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
              {isSelected && (
                <FontAwesome6 name="check" size={12} color={theme.buttonPrimaryText} />
              )}
            </View>
          )}
          <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.tagName}>
            {item.name}
          </ThemedText>
          <ThemedText variant="caption" color={theme.textMuted} style={styles.tagCount}>
            {item.ticketCount} 张票据
          </ThemedText>
        </View>
        {!isSelectingMerge && (
          <View style={styles.tagActions}>
            <TouchableOpacity style={styles.actionButton} onPress={() => handleEditTag(item)}>
              <FontAwesome6 name="pen" size={16} color={theme.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => handleDeleteTag(item)}>
              <FontAwesome6 name="trash" size={16} color={theme.error} />
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const selectedTagsData = tags.filter(t => selectedTags.includes(t.id));

  return (
    <Screen
      backgroundColor={theme.backgroundRoot}
      statusBarStyle={isDark ? 'light' : 'dark'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={isSelectingMerge ? cancelMergeMode : () => router.back()}
        >
          <FontAwesome6 
            name={isSelectingMerge ? 'xmark' : 'arrow-left'} 
            size={20} 
            color={theme.textPrimary} 
          />
        </TouchableOpacity>
        <ThemedText variant="h4" color={theme.textPrimary} style={styles.headerTitle}>
          {isSelectingMerge ? '选择要合并的标签' : '标签管理'}
        </ThemedText>
        {isSelectingMerge ? (
          <TouchableOpacity 
            style={styles.mergeButton} 
            onPress={openMergeModal}
            disabled={selectedTags.length < 2}
          >
            <ThemedText 
              variant="smallMedium" 
              color={selectedTags.length >= 2 ? theme.buttonPrimaryText : theme.textMuted}
            >
              合并({selectedTags.length})
            </ThemedText>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.addButton} onPress={handleAddTag}>
            <ThemedText variant="smallMedium" color={theme.buttonPrimaryText}>
              新建
            </ThemedText>
          </TouchableOpacity>
        )}
      </View>

      {/* Merge Mode Hint */}
      {isSelectingMerge && (
        <View style={styles.mergeHint}>
          <ThemedText variant="small" color={theme.textSecondary}>
            点击选择标签，长按可删除单个标签
          </ThemedText>
        </View>
      )}

      {/* Merge Mode Start Button */}
      {!isSelectingMerge && tags.length >= 2 && (
        <TouchableOpacity style={styles.mergeStartButton} onPress={startMergeMode}>
          <FontAwesome6 name="code-merge" size={16} color={theme.primary} />
          <ThemedText variant="small" color={theme.primary} style={{ marginLeft: 8 }}>
            合并标签
          </ThemedText>
        </TouchableOpacity>
      )}

      {/* List */}
      <FlatList
        data={tags}
        renderItem={renderTagItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 20 }} />
          ) : (
            <View style={styles.emptyState}>
              <FontAwesome6 name="tags" size={64} color={theme.textMuted} />
              <ThemedText variant="body" color={theme.textMuted} style={styles.emptyStateText}>
                暂无标签
              </ThemedText>
            </View>
          )
        }
      />

      {/* Edit/Create Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ThemedText variant="h4" color={theme.textPrimary} style={styles.modalTitle}>
              {editingTag ? '编辑标签' : '新建标签'}
            </ThemedText>
            <TextInput
              style={styles.modalInput}
              placeholder="请输入标签名称"
              placeholderTextColor={theme.textMuted}
              value={tagName}
              onChangeText={setTagName}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <ThemedText variant="body" color={theme.textPrimary}>
                  取消
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleSaveTag}
              >
                <ThemedText variant="body" color={theme.buttonPrimaryText}>
                  确定
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Merge Modal */}
      <Modal
        visible={mergeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMergeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.mergeModalContent}>
            <ThemedText variant="h4" color={theme.textPrimary} style={styles.modalTitle}>
              选择目标标签
            </ThemedText>
            <ThemedText variant="small" color={theme.textMuted} style={{ marginBottom: 16 }}>
              其他选中的标签将合并到此标签
            </ThemedText>
            
            <ScrollView style={styles.mergeList}>
              {selectedTagsData.map(tag => (
                <TouchableOpacity
                  key={tag.id}
                  style={styles.mergeItem}
                  onPress={() => handleMerge(tag.id)}
                  disabled={isMerging}
                >
                  <ThemedText variant="body" color={theme.textPrimary}>
                    {tag.name}
                  </ThemedText>
                  <ThemedText variant="caption" color={theme.textMuted}>
                    {tag.ticketCount} 张票据
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton, { marginTop: 16 }]}
              onPress={() => setMergeModalVisible(false)}
            >
              <ThemedText variant="body" color={theme.textPrimary}>
                取消
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
