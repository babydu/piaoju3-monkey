import React, { useState, useMemo, useCallback } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  View,
  TextInput,
  ActivityIndicator,
  FlatList,
  Modal,
  Keyboard,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import AppHeader from '@/components/AppHeader';
import { Spacing, BorderRadius } from '@/constants/theme';
import Toast from 'react-native-toast-message';
import { createStyles } from './styles';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://localhost:9091';

interface Ticket {
  id: string;
  title: string;
  ocrText: string | null;
  location: string | null;
  ticketDate: string | null;
  images: Array<{
    id: string;
    url: string;
    thumbnailUrl: string;
  }>;
  tags: Array<{ id: string; name: string }>;
  collection?: { id: string; name: string };
}

interface Tag {
  id: string;
  name: string;
}

interface Collection {
  id: string;
  name: string;
}

export default function SearchScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const { token } = useAuth();

  // 搜索状态
  const [searchText, setSearchText] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Ticket[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  // 筛选状态
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'relevance' | 'newest' | 'oldest'>('relevance');

  // 筛选选项
  const [tags, setTags] = useState<Tag[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);

  // 弹窗状态
  const [showTagModal, setShowTagModal] = useState(false);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);

  // 加载筛选选项
  const loadFilterOptions = useCallback(async () => {
    if (!token) return;
    try {
      const [tagsRes, collectionsRes] = await Promise.all([
        fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/tags`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/collections`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const tagsData = await tagsRes.json();
      const collectionsData = await collectionsRes.json();

      if (tagsData.success) setTags(tagsData.tags || []);
      if (collectionsData.success) setCollections(collectionsData.collections || []);
    } catch (error) {
      console.error('加载筛选选项失败:', error);
    }
  }, [token]);

  // 执行搜索
  const handleSearch = useCallback(async () => {
    if (!token) return;

    const keyword = searchText.trim();
    if (!keyword && !selectedTagId && !selectedCollectionId) {
      Toast.show({ type: 'error', text1: '请输入搜索关键词或选择筛选条件' });
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    Keyboard.dismiss();

    try {
      const params = new URLSearchParams();
      if (keyword) params.append('keyword', keyword);
      if (selectedTagId) params.append('tagId', selectedTagId);
      if (selectedCollectionId) params.append('collectionId', selectedCollectionId);
      params.append('sort', sortBy);

      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/tickets/search?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        setSearchResults(data.tickets || []);
      } else {
        Toast.show({ type: 'error', text1: data.error || '搜索失败' });
      }
    } catch (error) {
      console.error('搜索失败:', error);
      Toast.show({ type: 'error', text1: '搜索失败', text2: '请检查网络后重试' });
    } finally {
      setIsSearching(false);
    }
  }, [token, searchText, selectedTagId, selectedCollectionId, sortBy]);

  // 清除筛选
  const clearFilters = () => {
    setSelectedTagId(null);
    setSelectedCollectionId(null);
    setSortBy('relevance');
    setSearchText('');
    setSearchResults([]);
    setHasSearched(false);
  };

  // 点击票据
  const handleTicketPress = (ticketId: string) => {
    router.push('/ticket-detail', { id: ticketId });
  };

  // 格式化日期
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // 渲染搜索结果
  const renderResultItem = ({ item }: { item: Ticket }) => (
    <TouchableOpacity style={styles.resultCard} onPress={() => handleTicketPress(item.id)}>
      {item.images[0] && (
        <Image source={{ uri: item.images[0].thumbnailUrl }} style={styles.resultThumbnail} contentFit="cover" />
      )}
      <View style={styles.resultContent}>
        <ThemedText variant="bodyMedium" color={theme.textPrimary} numberOfLines={1}>{item.title}</ThemedText>
        <View style={styles.resultMeta}>
          {item.ticketDate && (
            <ThemedText variant="caption" color={theme.textMuted}>{formatDate(item.ticketDate)}</ThemedText>
          )}
          {item.tags.length > 0 && (
            <View style={styles.resultTag}>
              <ThemedText variant="caption" color={theme.primary}>{item.tags[0].name}</ThemedText>
            </View>
          )}
        </View>
      </View>
      <FontAwesome6 name="chevron-right" size={12} color={theme.textMuted} />
    </TouchableOpacity>
  );

  // 初始化加载筛选选项
  React.useEffect(() => {
    loadFilterOptions();
  }, [loadFilterOptions]);

  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
      <AppHeader showBack title="搜索票据" />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 搜索框 */}
        <View style={styles.searchSection}>
          <View style={styles.searchRow}>
            <View style={styles.searchInputContainer}>
              <FontAwesome6 name="magnifying-glass" size={14} color={theme.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="搜索票据标题、内容..."
                placeholderTextColor={theme.textMuted}
                value={searchText}
                onChangeText={setSearchText}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
              />
              {searchText.length > 0 && (
                <TouchableOpacity onPress={() => setSearchText('')}>
                  <FontAwesome6 name="xmark" size={14} color={theme.textMuted} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
              <ThemedText variant="smallMedium" color={theme.buttonPrimaryText}>搜索</ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        {/* 筛选区域 */}
        <View style={styles.filterSection}>
          <View style={styles.filterRow}>
            <TouchableOpacity 
              style={[styles.filterBtn, selectedTagId && styles.filterBtnActive]}
              onPress={() => setShowTagModal(true)}
            >
              <FontAwesome6 name="tag" size={12} color={selectedTagId ? theme.buttonPrimaryText : theme.textSecondary} />
              <ThemedText variant="small" color={selectedTagId ? theme.buttonPrimaryText : theme.textSecondary} style={{ marginLeft: 4 }}>
                {selectedTagId ? tags.find(t => t.id === selectedTagId)?.name : '标签'}
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.filterBtn, selectedCollectionId && styles.filterBtnActive]}
              onPress={() => setShowCollectionModal(true)}
            >
              <FontAwesome6 name="folder" size={12} color={selectedCollectionId ? theme.buttonPrimaryText : theme.textSecondary} />
              <ThemedText variant="small" color={selectedCollectionId ? theme.buttonPrimaryText : theme.textSecondary} style={{ marginLeft: 4 }}>
                {selectedCollectionId ? collections.find(c => c.id === selectedCollectionId)?.name : '合集'}
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity style={styles.filterBtn} onPress={() => setShowSortModal(true)}>
              <FontAwesome6 name="arrow-down-short-wide" size={12} color={theme.textSecondary} />
              <ThemedText variant="small" color={theme.textSecondary} style={{ marginLeft: 4 }}>
                {sortBy === 'relevance' ? '相关度' : sortBy === 'newest' ? '最新' : '最早'}
              </ThemedText>
            </TouchableOpacity>

            {(selectedTagId || selectedCollectionId || searchText) && (
              <TouchableOpacity style={styles.clearBtn} onPress={clearFilters}>
                <FontAwesome6 name="rotate-left" size={12} color={theme.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 搜索结果 */}
        <View style={styles.resultsSection}>
          {hasSearched && (
            <View style={styles.resultsHeader}>
              <ThemedText variant="bodyMedium" color={theme.textPrimary}>搜索结果</ThemedText>
              <ThemedText variant="small" color={theme.textMuted}>共 {searchResults.length} 张</ThemedText>
            </View>
          )}

          {isSearching ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : hasSearched ? (
            searchResults.length === 0 ? (
              <View style={styles.emptyContainer}>
                <FontAwesome6 name="magnifying-glass" size={48} color={theme.textMuted} />
                <ThemedText variant="body" color={theme.textMuted} style={{ marginTop: Spacing.md }}>
                  未找到匹配的票据
                </ThemedText>
                <ThemedText variant="small" color={theme.textMuted}>请尝试其他关键词或筛选条件</ThemedText>
              </View>
            ) : (
              <FlatList
                data={searchResults}
                renderItem={renderResultItem}
                keyExtractor={item => item.id}
                scrollEnabled={false}
                contentContainerStyle={styles.resultList}
              />
            )
          ) : (
            <View style={styles.emptyContainer}>
              <FontAwesome6 name="magnifying-glass" size={48} color={theme.textMuted} />
              <ThemedText variant="body" color={theme.textMuted} style={{ marginTop: Spacing.md }}>
                输入关键词开始搜索
              </ThemedText>
              <ThemedText variant="small" color={theme.textMuted}>可搜索票据标题、OCR识别内容</ThemedText>
            </View>
          )}
        </View>
      </ScrollView>

      {/* 标签筛选弹窗 */}
      <Modal visible={showTagModal} transparent animationType="fade" onRequestClose={() => setShowTagModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowTagModal(false)}>
          <View style={styles.pickerModal}>
            <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.pickerTitle}>选择标签</ThemedText>
            <ScrollView showsVerticalScrollIndicator={false}>
              <TouchableOpacity 
                style={[styles.pickerItem, !selectedTagId && styles.pickerItemActive]}
                onPress={() => { setSelectedTagId(null); setShowTagModal(false); }}
              >
                <ThemedText variant="body" color={!selectedTagId ? theme.primary : theme.textPrimary}>全部标签</ThemedText>
              </TouchableOpacity>
              {tags.map(tag => (
                <TouchableOpacity 
                  key={tag.id}
                  style={[styles.pickerItem, selectedTagId === tag.id && styles.pickerItemActive]}
                  onPress={() => { setSelectedTagId(tag.id); setShowTagModal(false); }}
                >
                  <ThemedText variant="body" color={selectedTagId === tag.id ? theme.primary : theme.textPrimary}>{tag.name}</ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 合集筛选弹窗 */}
      <Modal visible={showCollectionModal} transparent animationType="fade" onRequestClose={() => setShowCollectionModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowCollectionModal(false)}>
          <View style={styles.pickerModal}>
            <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.pickerTitle}>选择合集</ThemedText>
            <ScrollView showsVerticalScrollIndicator={false}>
              <TouchableOpacity 
                style={[styles.pickerItem, !selectedCollectionId && styles.pickerItemActive]}
                onPress={() => { setSelectedCollectionId(null); setShowCollectionModal(false); }}
              >
                <ThemedText variant="body" color={!selectedCollectionId ? theme.primary : theme.textPrimary}>全部合集</ThemedText>
              </TouchableOpacity>
              {collections.map(collection => (
                <TouchableOpacity 
                  key={collection.id}
                  style={[styles.pickerItem, selectedCollectionId === collection.id && styles.pickerItemActive]}
                  onPress={() => { setSelectedCollectionId(collection.id); setShowCollectionModal(false); }}
                >
                  <ThemedText variant="body" color={selectedCollectionId === collection.id ? theme.primary : theme.textPrimary}>{collection.name}</ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 排序弹窗 */}
      <Modal visible={showSortModal} transparent animationType="fade" onRequestClose={() => setShowSortModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowSortModal(false)}>
          <View style={styles.pickerModal}>
            <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.pickerTitle}>排序方式</ThemedText>
            {[
              { value: 'relevance', label: '相关度优先' },
              { value: 'newest', label: '时间倒序（最新）' },
              { value: 'oldest', label: '时间正序（最早）' },
            ].map(item => (
              <TouchableOpacity 
                key={item.value}
                style={[styles.pickerItem, sortBy === item.value && styles.pickerItemActive]}
                onPress={() => { setSortBy(item.value as any); setShowSortModal(false); }}
              >
                <ThemedText variant="body" color={sortBy === item.value ? theme.primary : theme.textPrimary}>{item.label}</ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </Screen>
  );
}
