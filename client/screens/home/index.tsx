import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  View,
  ActivityIndicator,
  FlatList,
  TextInput,
  Keyboard,
  RefreshControl,
  Modal,
  Alert,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import AppHeader from '@/components/AppHeader';
import { FilterDropdown } from '@/components/DropdownPicker';
import { Spacing, BorderRadius } from '@/constants/theme';
import Toast from 'react-native-toast-message';
import JSZip from 'jszip';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
// @ts-ignore - 这些属性存在于 legacy 模块中
const EncodingType = FileSystem.EncodingType;
// @ts-ignore
const cacheDirectory = FileSystem.cacheDirectory;
import { 
  unifiedStorageService, 
  TicketIndexItem,
  LocalSettings,
  LocalImage,
  localTicketService,
} from '@/services/local-storage';
import { createStyles } from './styles';

type TicketDisplayItem = TicketIndexItem & {
  images: Array<{
    id: string;
    url: string;
    thumbnailUrl?: string;
    localPath?: string;
    sortOrder: number;
  }>;
  tags: Array<{
    id: string;
    name: string;
  }>;
  ocrText: string | null;
  collectionId: string | null;
  location: string | null;
  notes: string | null;
};

interface Tag {
  id: string;
  name: string;
}

interface Collection {
  id: string;
  name: string;
}

export default function HomeScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const { token } = useAuth();

  const [tickets, setTickets] = useState<TicketDisplayItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // 存储模式
  const [storageMode, setStorageMode] = useState<'local-only' | 'cloud'>('local-only');
  
  // 搜索状态
  const [searchText, setSearchText] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  // 筛选状态
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  
  // 筛选选项数据
  const [tags, setTags] = useState<Tag[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  
  // 下拉菜单展开状态
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // 批量选择模式
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [isBatchOperating, setIsBatchOperating] = useState(false);

  // 初始化统一存储服务
  useEffect(() => {
    unifiedStorageService.initialize();
  }, []);

  // 加载存储模式
  const loadStorageMode = useCallback(async () => {
    try {
      const settings = await unifiedStorageService.getSettings();
      setStorageMode(settings.storageMode);
    } catch (error) {
      console.error('加载存储模式失败:', error);
    }
  }, []);

  // 加载基础数据（标签、合集）
  const loadBaseData = useCallback(async () => {
    try {
      const [tagsData, collectionsData] = await Promise.all([
        unifiedStorageService.getTags(token ?? undefined),
        unifiedStorageService.getCollections(token ?? undefined),
      ]);

      setTags(tagsData.map(t => ({ id: t.id, name: t.name })));
      setCollections(collectionsData.map(c => ({ id: c.id, name: c.name })));
    } catch (error) {
      console.error('加载基础数据失败:', error);
    }
  }, [token]);

  // 加载票据列表（使用统一存储服务）
  const fetchTickets = useCallback(async () => {
    setIsLoading(true);
    try {
      // 使用统一存储服务获取票据索引
      const ticketItems = await unifiedStorageService.getTickets(
        {
          sortBy,
          tagFilter: selectedTag ?? undefined,
          collectionFilter: selectedCollection ?? undefined,
        },
        token ?? undefined
      );

      // 转换为显示格式
      const ticketsData: TicketDisplayItem[] = ticketItems.map(item => ({
        id: item.id,
        title: item.title,
        ticketDate: item.ticketDate,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        isCloudSynced: item.isCloudSynced,
        cloudId: item.cloudId,
        thumbnailPath: item.thumbnailPath,
        imageCount: item.imageCount,
        isPrivate: item.isPrivate || false,
        images: item.thumbnailPath ? [{
          id: '0',
          url: item.thumbnailPath,
          thumbnailUrl: item.thumbnailPath,
          sortOrder: 0,
        }] : [],
        tags: [],
        ocrText: null,
        collectionId: null,
        location: null,
        notes: null,
      }));

      setTickets(ticketsData);
    } catch (error) {
      console.error('获取票据列表失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, [token, selectedTag, selectedCollection, sortBy]);

  // 搜索票据
  const handleSearch = useCallback(async () => {
    const keyword = searchText.trim();
    
    if (!keyword) {
      // 如果搜索词为空，重新加载全部票据
      fetchTickets();
      return;
    }

    setIsSearching(true);
    Keyboard.dismiss();

    try {
      // 使用统一存储服务搜索
      const results = await unifiedStorageService.searchTickets(keyword, token ?? undefined);
      
      const ticketsData: TicketDisplayItem[] = results.map(item => ({
        id: item.id,
        title: item.title,
        ticketDate: item.ticketDate,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        isCloudSynced: item.isCloudSynced,
        cloudId: item.cloudId,
        thumbnailPath: item.thumbnailPath,
        imageCount: item.imageCount,
        isPrivate: item.isPrivate || false,
        images: item.thumbnailPath ? [{
          id: '0',
          url: item.thumbnailPath,
          thumbnailUrl: item.thumbnailPath,
          sortOrder: 0,
        }] : [],
        tags: [],
        ocrText: null,
        collectionId: null,
        location: null,
        notes: null,
      }));

      setTickets(ticketsData);

      if (ticketsData.length === 0) {
        Toast.show({ type: 'info', text1: '未找到相关票据', position: 'top' });
      }
    } catch (error) {
      console.error('搜索失败:', error);
      Toast.show({ type: 'error', text1: '搜索失败', text2: '请检查网络后重试' });
    } finally {
      setIsSearching(false);
    }
  }, [token, searchText, selectedTag, selectedCollection, sortBy, fetchTickets]);

  // 清除搜索
  const clearSearch = () => {
    setSearchText('');
    fetchTickets();
  };

  // 页面获得焦点时刷新
  useFocusEffect(
    useCallback(() => {
      loadStorageMode();
      loadBaseData();
      fetchTickets();
    }, [loadStorageMode, loadBaseData, fetchTickets])
  );

  // 下拉刷新
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // 重新加载存储模式
      await loadStorageMode();
      
      // 云端模式：双向同步
      if (storageMode === 'cloud' && token) {
        const result = await unifiedStorageService.bidirectionalSync(token);
        const messages = [];
        if (result.uploaded > 0) {
          messages.push(`上传 ${result.uploaded} 张`);
        }
        if (result.downloaded > 0) {
          messages.push(`下载 ${result.downloaded} 张`);
        }
        if (messages.length > 0) {
          Toast.show({ 
            type: 'success', 
            text1: '同步完成', 
            text2: messages.join('，'),
            position: 'top',
            visibilityTime: 1500,
          });
        } else {
          Toast.show({ 
            type: 'info', 
            text1: '同步完成', 
            text2: '数据已是最新',
            position: 'top',
            visibilityTime: 1500,
          });
        }
      }
      
      // 刷新数据
      await Promise.all([loadBaseData(), fetchTickets()]);
    } catch (error) {
      console.error('刷新失败:', error);
      Toast.show({ type: 'error', text1: '刷新失败', position: 'top' });
    } finally {
      setIsRefreshing(false);
    }
  }, [storageMode, token, loadStorageMode, loadBaseData, fetchTickets]);

  // 跳转到新建票据页面
  const handleNewTicket = () => {
    router.push('/ticket-upload');
  };

  // 跳转到票据详情
  const handleTicketPress = (ticketId: string) => {
    router.push('/ticket-detail', { id: ticketId });
  };

  // 格式化日期
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  };

  // 清除所有筛选
  const clearFilters = () => {
    setSelectedTag(null);
    setSelectedCollection(null);
    setSortBy('newest');
    setSearchText('');
    fetchTickets();
  };

  // 处理下拉菜单切换
  const handleDropdownToggle = (dropdown: string) => {
    setOpenDropdown(openDropdown === dropdown ? null : dropdown);
  };

  // 处理筛选变更
  const handleFilterChange = (type: string, value: string | null) => {
    if (type === 'tag') setSelectedTag(value);
    else if (type === 'collection') setSelectedCollection(value);
    else if (type === 'sort') setSortBy(value as 'newest' | 'oldest');
    setOpenDropdown(null);
  };

  // 进入选择模式
  const enterSelectMode = (ticketId: string) => {
    setSelectMode(true);
    setSelectedIds(new Set([ticketId]));
  };

  // 退出选择模式
  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
    setShowActionMenu(false);
  };

  // 切换选择状态
  const toggleSelection = (ticketId: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(ticketId)) {
      newSet.delete(ticketId);
    } else {
      newSet.add(ticketId);
    }
    setSelectedIds(newSet);
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedIds.size === tickets.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tickets.map(t => t.id)));
    }
  };

  // 批量删除
  const handleBatchDelete = () => {
    const count = selectedIds.size;
    Alert.alert(
      '确认删除',
      `确定要删除选中的 ${count} 张票据吗？\n删除后可在回收站中恢复。`,
      [
        { text: '取消', style: 'cancel' },
        { 
          text: '删除', 
          style: 'destructive',
          onPress: async () => {
            setIsBatchOperating(true);
            let successCount = 0;
            try {
              for (const id of selectedIds) {
                const success = await unifiedStorageService.deleteTicket(id, token ?? undefined);
                if (success) successCount++;
              }
              Toast.show({ 
                type: 'success', 
                text1: '删除成功', 
                text2: `${successCount} 张票据已移入回收站`,
                position: 'top',
              });
              exitSelectMode();
              fetchTickets();
            } catch (error) {
              Toast.show({ type: 'error', text1: '删除失败' });
            } finally {
              setIsBatchOperating(false);
            }
          }
        },
      ]
    );
  };

  // 批量备份
  const handleBatchBackup = async () => {
    if (selectedIds.size === 0) return;
    
    setIsBatchOperating(true);
    try {
      const zip = new JSZip();
      let imageCount = 0;
      
      // 获取选中票据的详细数据
      for (const ticketId of selectedIds) {
        const ticket = await unifiedStorageService.getTicket(ticketId);
        if (!ticket) continue;
        
        // 创建票据目录
        const ticketFolder = zip.folder(`tickets/${ticketId}`);
        
        // 保存票据元数据
        const metaData = { ...ticket, localPath: undefined };
        ticketFolder?.file('meta.json', JSON.stringify(metaData, null, 2));
        
        // 添加图片
        const imagesFolder = ticketFolder?.folder('images');
        if (ticket.images && ticket.images.length > 0) {
          for (let i = 0; i < ticket.images.length; i++) {
            const img = ticket.images[i];
            const localImgPath = (img as LocalImage).localPath;
            if (!localImgPath) continue;
            
            const imageUri = unifiedStorageService.getTicketImageUri(ticketId, localImgPath);
            try {
              const base64 = await FileSystem.readAsStringAsync(imageUri, {
                encoding: EncodingType.Base64,
              });
              imagesFolder?.file(`${i}.jpg`, base64, { base64: true });
              imageCount++;
            } catch (e) {
              console.warn('读取图片失败:', imageUri, e);
            }
          }
        }
      }
      
      // 生成备份文件
      const zipContent = await zip.generateAsync({ 
        type: 'base64',
        compression: 'DEFLATE',
      });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const fileName = `tickets-backup-${timestamp}.zip`;
      const tempPath = `${cacheDirectory}${fileName}`;
      
      await FileSystem.writeAsStringAsync(tempPath, zipContent, {
        encoding: EncodingType.Base64,
      });
      
      // 分享文件
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(tempPath, {
          mimeType: 'application/zip',
          dialogTitle: '保存备份文件',
        });
        Toast.show({ type: 'success', text1: '备份成功', text2: `已导出 ${selectedIds.size} 张票据` });
      }
      
      exitSelectMode();
    } catch (error) {
      console.error('批量备份失败:', error);
      Toast.show({ type: 'error', text1: '备份失败', text2: error instanceof Error ? error.message : '未知错误' });
    } finally {
      setIsBatchOperating(false);
    }
  };

  const renderTicketItem = ({ item, index }: { item: TicketDisplayItem; index: number }) => {
    const isSelected = selectedIds.has(item.id);
    
    // 获取图片URI（本地票据需要拼接完整路径）
    const getThumbnailUri = () => {
      if (item.thumbnailPath) {
        // 检查是否是本地路径
        if (!item.thumbnailPath.startsWith('http')) {
          return unifiedStorageService.getTicketImageUri(item.id, item.thumbnailPath);
        }
        return item.thumbnailPath;
      }
      if (item.images[0]?.thumbnailUrl) {
        if (!item.images[0].thumbnailUrl.startsWith('http')) {
          return unifiedStorageService.getTicketImageUri(item.id, item.images[0].thumbnailUrl);
        }
        return item.images[0].thumbnailUrl;
      }
      return null;
    };
    
    const thumbnailUri = getThumbnailUri();
    const imageCount = item.imageCount || item.images.length;

    return (
    <TouchableOpacity 
      style={[
        styles.ticketCard,
        isSelected && { backgroundColor: theme.primary + '15', borderColor: theme.primary, borderWidth: 1.5 }
      ]}
      onPress={() => selectMode ? toggleSelection(item.id) : handleTicketPress(item.id)}
      onLongPress={() => !selectMode && enterSelectMode(item.id)}
      activeOpacity={0.8}
      delayLongPress={500}
    >
      {/* 选择模式下显示复选框 */}
      {selectMode && (
        <View style={styles.checkboxContainer}>
          <View style={[
            styles.checkbox,
            isSelected && { backgroundColor: theme.primary, borderColor: theme.primary }
          ]}>
            {isSelected && (
              <FontAwesome6 name="check" size={12} color="#FFFFFF" />
            )}
          </View>
        </View>
      )}
      
      {/* 缩略图 */}
      <View style={styles.thumbnailContainer}>
        {thumbnailUri ? (
          <Image
            source={{ uri: thumbnailUri }}
            style={styles.thumbnail}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
            <FontAwesome6 name="image" size={20} color={theme.textMuted} />
          </View>
        )}
        {imageCount > 1 && (
          <View style={styles.imageCount}>
            <FontAwesome6 name="images" size={10} color="#FFFFFF" />
            <ThemedText variant="caption" color="#FFFFFF" style={{ marginLeft: 2 }}>
              {imageCount}
            </ThemedText>
          </View>
        )}
        {/* 云端同步标识 */}
        {item.isCloudSynced && (
          <View style={styles.syncBadge}>
            <FontAwesome6 name="cloud" size={8} color="#FFFFFF" />
          </View>
        )}
        {/* 私密票据锁标识 */}
        {item.isPrivate && (
          <View style={[styles.syncBadge, { backgroundColor: theme.accent || '#F59E0B' }]}>
            <FontAwesome6 name="lock" size={8} color="#FFFFFF" />
          </View>
        )}
      </View>

      {/* 内容 */}
      <View style={styles.ticketContent}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <ThemedText variant="bodyMedium" color={theme.textPrimary} numberOfLines={1} style={{ flex: 1 }}>
            {item.title}
          </ThemedText>
          {/* 私密票据标题旁的锁图标 */}
          {item.isPrivate && (
            <FontAwesome6 name="lock" size={10} color={theme.textMuted} style={{ marginLeft: Spacing.xs }} />
          )}
        </View>
        
        {/* 标签 */}
        {item.tags.length > 0 && (
          <View style={styles.tagRow}>
            {item.tags.slice(0, 2).map(tag => (
              <View key={tag.id} style={styles.miniTag}>
                <ThemedText variant="caption" color={theme.primary}>
                  {tag.name}
                </ThemedText>
              </View>
            ))}
            {item.tags.length > 2 && (
              <ThemedText variant="caption" color={theme.textMuted}>
                +{item.tags.length - 2}
              </ThemedText>
            )}
          </View>
        )}

        {/* 底部信息 */}
        <View style={styles.ticketMeta}>
          {item.ticketDate && (
            <View style={styles.metaItem}>
              <FontAwesome6 name="calendar" size={10} color={theme.textMuted} />
              <ThemedText variant="caption" color={theme.textMuted} style={{ marginLeft: 4 }}>
                {formatDate(item.ticketDate)}
              </ThemedText>
            </View>
          )}
        </View>
      </View>

      {/* 箭头（非选择模式） */}
      {!selectMode && <FontAwesome6 name="chevron-right" size={12} color={theme.textMuted} />}
    </TouchableOpacity>
  );
  };

  return (
    <Screen
      backgroundColor={theme.backgroundRoot}
      statusBarStyle={isDark ? 'light' : 'dark'}
      safeAreaEdges={['top']}
    >
      <AppHeader />

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
            title={storageMode === 'cloud' ? '下拉同步数据' : '下拉刷新'}
            titleColor={theme.textMuted}
          />
        }
      >
        {/* 搜索框 - 可直接输入搜索 */}
        <View style={styles.searchBar}>
          <FontAwesome6 name="magnifying-glass" size={14} color={theme.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="搜索票据..."
            placeholderTextColor={theme.textMuted}
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearSearchBtn}>
              <FontAwesome6 name="xmark" size={14} color={theme.textMuted} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
            {isSearching ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <ThemedText variant="smallMedium" color="#FFFFFF">搜索</ThemedText>
            )}
          </TouchableOpacity>
        </View>

        {/* 新建票据按钮 */}
        <TouchableOpacity style={styles.newTicketBtn} onPress={handleNewTicket}>
          <View style={styles.newTicketIcon}>
            <FontAwesome6 name="plus" size={18} color="#FFFFFF" />
          </View>
          <ThemedText variant="bodyMedium" color="#FFFFFF">新建票据</ThemedText>
        </TouchableOpacity>

        {/* 筛选区域 */}
        <View style={styles.filterSection}>
          <View style={styles.filterRow}>
            {/* 标签筛选 */}
            <FilterDropdown
              value={selectedTag}
              options={tags.map(t => ({ id: t.id, name: t.name }))}
              placeholder="标签"
              onChange={(v) => handleFilterChange('tag', v)}
              theme={theme}
            />

            {/* 合集筛选 */}
            <FilterDropdown
              value={selectedCollection}
              options={collections.map(c => ({ id: c.id, name: c.name }))}
              placeholder="合集"
              onChange={(v) => handleFilterChange('collection', v)}
              theme={theme}
            />

            {/* 排序 */}
            <FilterDropdown
              value={sortBy === 'newest' ? 'newest' : 'oldest'}
              options={[
                { id: 'newest', name: '最新' },
                { id: 'oldest', name: '最早' },
              ]}
              placeholder="排序"
              onChange={(v) => handleFilterChange('sort', v)}
              theme={theme}
            />

            {/* 清除筛选 */}
            {(selectedTag || selectedCollection || searchText) && (
              <TouchableOpacity style={styles.clearBtn} onPress={clearFilters}>
                <FontAwesome6 name="xmark" size={12} color={theme.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 票据列表 */}
        <View style={styles.ticketSection}>
          <View style={styles.sectionHeader}>
            <ThemedText variant="bodyMedium" color={theme.textPrimary}>
              {searchText ? '搜索结果' : '我的票据'}
            </ThemedText>
            <ThemedText variant="small" color={theme.textMuted}>
              共 {tickets.length} 张
            </ThemedText>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : tickets.length === 0 ? (
            <View style={styles.emptyContainer}>
              <FontAwesome6 name="ticket" size={48} color={theme.textMuted} />
              <ThemedText variant="body" color={theme.textMuted} style={{ marginTop: Spacing.md }}>
                {searchText ? '未找到相关票据' : '暂无票据'}
              </ThemedText>
              <ThemedText variant="small" color={theme.textMuted}>
                {searchText ? '尝试其他关键词' : '点击上方按钮开始添加'}
              </ThemedText>
            </View>
          ) : (
            <FlatList
              data={tickets}
              renderItem={renderTicketItem}
              keyExtractor={item => item.id}
              scrollEnabled={false}
              contentContainerStyle={styles.ticketList}
            />
          )}
        </View>
      </ScrollView>

      {/* 选择模式顶部栏 */}
      {selectMode && (
        <View style={[styles.selectModeBar, { backgroundColor: theme.primary }]}>
          <TouchableOpacity onPress={exitSelectMode} style={styles.selectModeCancel}>
            <FontAwesome6 name="xmark" size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <ThemedText variant="bodyMedium" color="#FFFFFF">
            已选择 {selectedIds.size} 项
          </ThemedText>
          <TouchableOpacity onPress={toggleSelectAll}>
            <ThemedText variant="smallMedium" color="#FFFFFF">
              {selectedIds.size === tickets.length ? '取消全选' : '全选'}
            </ThemedText>
          </TouchableOpacity>
        </View>
      )}

      {/* 选择模式底部操作菜单 */}
      {selectMode && (
        <View style={[styles.bottomActionBar, { backgroundColor: theme.backgroundDefault }]}>
          <TouchableOpacity 
            style={styles.actionItem}
            onPress={handleBatchBackup}
            disabled={selectedIds.size === 0 || isBatchOperating}
          >
            <View style={[styles.actionIconBg, { backgroundColor: theme.primary + '20' }]}>
              {isBatchOperating ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <FontAwesome6 name="file-export" size={18} color={theme.primary} />
              )}
            </View>
            <ThemedText variant="small" color={selectedIds.size === 0 ? theme.textMuted : theme.textPrimary}>
              备份
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionItem}
            onPress={handleBatchDelete}
            disabled={selectedIds.size === 0 || isBatchOperating}
          >
            <View style={[styles.actionIconBg, { backgroundColor: theme.error + '20' }]}>
              <FontAwesome6 name="trash" size={18} color={theme.error} />
            </View>
            <ThemedText variant="small" color={selectedIds.size === 0 ? theme.textMuted : theme.textPrimary}>
              删除
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionItem}
            onPress={() => Toast.show({ type: 'info', text1: '敬请期待', text2: '此功能正在开发中' })}
            disabled={selectedIds.size === 0 || isBatchOperating}
          >
            <View style={[styles.actionIconBg, { backgroundColor: theme.accent + '20' }]}>
              <FontAwesome6 name="folder" size={18} color={theme.accent} />
            </View>
            <ThemedText variant="small" color={selectedIds.size === 0 ? theme.textMuted : theme.textPrimary}>
              移动
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionItem}
            onPress={() => Toast.show({ type: 'info', text1: '敬请期待', text2: '此功能正在开发中' })}
            disabled={selectedIds.size === 0 || isBatchOperating}
          >
            <View style={[styles.actionIconBg, { backgroundColor: theme.textSecondary + '20' }]}>
              <FontAwesome6 name="share" size={18} color={theme.textSecondary} />
            </View>
            <ThemedText variant="small" color={selectedIds.size === 0 ? theme.textMuted : theme.textPrimary}>
              分享
            </ThemedText>
          </TouchableOpacity>
        </View>
      )}
    </Screen>
  );
}
