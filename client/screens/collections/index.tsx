import React, { useState, useMemo, useCallback } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  View,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useFocusEffect } from 'expo-router';
import { createStyles } from './styles';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://localhost:9091';

interface Collection {
  id: string;
  name: string;
  ticketCount: number;
  createdAt: string;
}

export default function CollectionsScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const { token } = useAuth();

  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [collectionName, setCollectionName] = useState('');

  const fetchCollections = useCallback(async () => {
    if (!token) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/collections`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setCollections(data.collections);
      }
    } catch (error) {
      console.error('获取合集列表失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      fetchCollections();
    }, [fetchCollections])
  );

  const handleAddCollection = () => {
    setEditingCollection(null);
    setCollectionName('');
    setModalVisible(true);
  };

  const handleEditCollection = (collection: Collection) => {
    setEditingCollection(collection);
    setCollectionName(collection.name);
    setModalVisible(true);
  };

  const handleDeleteCollection = (collection: Collection) => {
    Alert.alert(
      '删除确认',
      `确定要删除合集"${collection.name}"吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/collections/${collection.id}`, {
                method: 'DELETE',
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              });

              const data = await response.json();
              if (data.success) {
                fetchCollections();
              }
            } catch (error) {
              console.error('删除合集失败:', error);
              Alert.alert('错误', '删除失败，请重试');
            }
          },
        },
      ]
    );
  };

  const handleSaveCollection = async () => {
    if (!collectionName.trim()) {
      Alert.alert('错误', '合集名称不能为空');
      return;
    }

    try {
      const url = editingCollection
        ? `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/collections/${editingCollection.id}`
        : `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/collections`;
      const method = editingCollection ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: collectionName.trim() }),
      });

      const data = await response.json();
      if (data.success) {
        setModalVisible(false);
        fetchCollections();
      } else {
        Alert.alert('错误', data.error || '保存失败');
      }
    } catch (error) {
      console.error('保存合集失败:', error);
      Alert.alert('错误', '保存失败，请重试');
    }
  };

  return (
    <Screen
      backgroundColor={theme.backgroundRoot}
      statusBarStyle={isDark ? 'light' : 'dark'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <FontAwesome6 name="arrow-left" size={20} color={theme.textPrimary} />
        </TouchableOpacity>
        <ThemedText variant="h4" color={theme.textPrimary} style={styles.headerTitle}>
          合集管理
        </ThemedText>
        <TouchableOpacity style={styles.addButton} onPress={handleAddCollection}>
          <ThemedText variant="smallMedium" color={theme.buttonPrimaryText}>
            新建
          </ThemedText>
        </TouchableOpacity>
      </View>

      {/* List */}
      <ScrollView contentContainerStyle={styles.listContent}>
        {isLoading ? (
          <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 20 }} />
        ) : collections.length > 0 ? (
          collections.map(collection => (
            <View key={collection.id} style={styles.collectionItem}>
              <View style={styles.collectionInfo}>
                <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.collectionName}>
                  {collection.name}
                </ThemedText>
                <ThemedText variant="caption" color={theme.textMuted} style={styles.collectionCount}>
                  {collection.ticketCount} 张票据
                </ThemedText>
              </View>
              <View style={styles.collectionActions}>
                <TouchableOpacity style={styles.actionButton} onPress={() => handleEditCollection(collection)}>
                  <FontAwesome6 name="pen" size={16} color={theme.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={() => handleDeleteCollection(collection)}>
                  <FontAwesome6 name="trash" size={16} color={theme.error} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <FontAwesome6 name="folder" size={64} color={theme.textMuted} />
            <ThemedText variant="body" color={theme.textMuted} style={styles.emptyStateText}>
              暂无合集
            </ThemedText>
          </View>
        )}
      </ScrollView>

      {/* Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ThemedText variant="h4" color={theme.textPrimary} style={styles.modalTitle}>
              {editingCollection ? '编辑合集' : '新建合集'}
            </ThemedText>
            <TextInput
              style={styles.modalInput}
              placeholder="请输入合集名称"
              placeholderTextColor={theme.textMuted}
              value={collectionName}
              onChangeText={setCollectionName}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <ThemedText variant="body" color={theme.textPrimary} style={styles.cancelButtonText}>
                  取消
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleSaveCollection}
              >
                <ThemedText variant="body" color={theme.buttonPrimaryText} style={styles.confirmButtonText}>
                  确定
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
