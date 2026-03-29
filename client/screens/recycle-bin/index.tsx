import React, { useState, useMemo, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ScrollView,
  TouchableOpacity,
  View,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '@/contexts/AuthContext';
import AppHeader from '@/components/AppHeader';
import { Image } from 'expo-image';
import { Spacing } from '@/constants/theme';
import { createStyles } from './styles';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://localhost:9091';

interface DeletedTicket {
  id: string;
  ticketId: string;
  title: string;
  deletedAt: string;
  ticket: {
    title: string | null;
    images: Array<{ id: string; url: string; thumbnailUrl: string }>;
  };
}

export default function RecycleBinScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { token } = useAuth();

  const [deletedTickets, setDeletedTickets] = useState<DeletedTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);

  // 获取回收站数据
  const fetchDeletedTickets = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/tickets/deleted`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (data.success) {
        setDeletedTickets(data.tickets || []);
      }
    } catch (error) {
      console.error('获取回收站失败:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      fetchDeletedTickets();
    }, [fetchDeletedTickets])
  );

  // 恢复票据
  const handleRestore = async (ticketId: string) => {
    if (!token) return;

    try {
      setActioningId(ticketId);
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/tickets/${ticketId}/restore`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (data.success) {
        Toast.show({ type: 'success', text1: '恢复成功' });
        fetchDeletedTickets();
      } else {
        Toast.show({ type: 'error', text1: '恢复失败', text2: data.error });
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: '网络错误' });
    } finally {
      setActioningId(null);
    }
  };

  // 彻底删除
  const handlePermanentDelete = async (ticketId: string) => {
    if (!token) return;

    try {
      setActioningId(ticketId);
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/tickets/${ticketId}/permanent`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (data.success) {
        Toast.show({ type: 'success', text1: '已彻底删除' });
        fetchDeletedTickets();
      } else {
        Toast.show({ type: 'error', text1: '删除失败', text2: data.error });
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: '网络错误' });
    } finally {
      setActioningId(null);
    }
  };

  // 格式化删除时间
  const formatDeletedAt = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return '今天删除';
    if (diffDays === 1) return '昨天删除';
    if (diffDays < 7) return `${diffDays}天前删除`;
    return `${date.getMonth() + 1}月${date.getDate()}日删除`;
  };

  const renderTicketItem = ({ item }: { item: DeletedTicket }) => (
    <View style={styles.ticketCard}>
      <View style={styles.ticketContent}>
        {item.ticket.images?.[0] ? (
          <Image
            source={{ uri: item.ticket.images[0].thumbnailUrl }}
            style={styles.thumbnail}
            contentFit="cover"
          />
        ) : (
          <View style={styles.thumbnail}>
            <FontAwesome6 name="ticket" size={24} color={theme.textMuted} />
          </View>
        )}
        <View style={styles.ticketInfo}>
          <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.ticketTitle}>
            {item.ticket.title || '无标题票据'}
          </ThemedText>
          <View style={styles.ticketMeta}>
            <FontAwesome6 name="clock" size={12} color={theme.textMuted} />
            <ThemedText variant="small" color={theme.textMuted} style={styles.deletedAt}>
              {formatDeletedAt(item.deletedAt)}
            </ThemedText>
          </View>
        </View>
      </View>
      
      <View style={styles.actions}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.actionButtonLeft]}
          onPress={() => handleRestore(item.ticketId)}
          disabled={actioningId === item.ticketId}
        >
          <FontAwesome6 name="rotate-left" size={14} color={theme.primary} />
          <ThemedText variant="smallMedium" style={[styles.actionText, styles.restoreText]}>
            恢复
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handlePermanentDelete(item.ticketId)}
          disabled={actioningId === item.ticketId}
        >
          <FontAwesome6 name="trash" size={14} color={theme.error} />
          <ThemedText variant="smallMedium" style={[styles.actionText, styles.deleteText]}>
            彻底删除
          </ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <AppHeader title="回收站" />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
      <AppHeader title="回收站" />

      {deletedTickets.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <FontAwesome6 name="trash-can" size={32} color={theme.textMuted} />
          </View>
          <ThemedText variant="body" color={theme.textSecondary}>
            回收站是空的
          </ThemedText>
          <ThemedText variant="small" color={theme.textMuted}>
            删除的票据将在这里保留30天
          </ThemedText>
        </View>
      ) : (
        <>
          <FlatList
            data={deletedTickets}
            keyExtractor={(item) => item.id}
            renderItem={renderTicketItem}
            contentContainerStyle={styles.scrollContent}
          />
          <ThemedText variant="small" color={theme.textMuted} style={styles.tipText}>
            回收站中的票据将在30天后自动清除
          </ThemedText>
        </>
      )}
    </Screen>
  );
}
