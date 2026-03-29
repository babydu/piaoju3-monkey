import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  LayoutAnimation,
  Platform,
  UIManager,
  StyleSheet,
  Modal,
  Pressable,
  FlatList,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { Spacing, BorderRadius, Theme } from '@/constants/theme';

// 启用 Android 的 LayoutAnimation
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface DropdownOption {
  id: string | null;
  name: string;
}

interface DropdownPickerProps {
  label: string;
  value: string | null;
  options: DropdownOption[];
  placeholder?: string;
  onChange: (value: string | null) => void;
  allowCreate?: boolean;
  onCreate?: (name: string) => Promise<void>;
  theme: Theme;
}

export function DropdownPicker({
  label,
  value,
  options,
  placeholder = '请选择',
  onChange,
  allowCreate = false,
  onCreate,
  theme,
}: DropdownPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  
  const selectedOption = options.find(opt => opt.id === value);
  const filteredOptions = options.filter(opt => 
    opt.name.toLowerCase().includes(searchText.toLowerCase())
  );
  
  const handleSelect = (optionValue: string | null) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onChange(optionValue);
    setIsOpen(false);
    setSearchText('');
  };
  
  const handleCreate = async () => {
    if (!searchText.trim() || !onCreate) return;
    
    setIsCreating(true);
    try {
      await onCreate(searchText.trim());
      setSearchText('');
    } finally {
      setIsCreating(false);
    }
  };
  
  const styles = createDropdownStyles(theme);
  
  return (
    <View>
      <TouchableOpacity 
        style={styles.trigger}
        onPress={() => setIsOpen(true)}
      >
        <ThemedText 
          variant="body" 
          color={selectedOption ? theme.textPrimary : theme.textMuted}
        >
          {selectedOption?.name || placeholder}
        </ThemedText>
        <FontAwesome6 
          name="chevron-down" 
          size={12} 
          color={theme.textMuted} 
        />
      </TouchableOpacity>
      
      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsOpen(false)}>
          <Pressable 
            style={styles.dropdownModal}
            onPress={e => e.stopPropagation()}
          >
            {/* 搜索/创建输入框 */}
            {allowCreate && (
              <View style={styles.searchRow}>
                <TextInput
                  style={styles.searchInput}
                  value={searchText}
                  onChangeText={setSearchText}
                  placeholder="输入名称可新建..."
                  placeholderTextColor={theme.textMuted}
                  autoFocus
                />
                {searchText.trim() && (
                  <TouchableOpacity 
                    style={[styles.createBtn, isCreating && styles.createBtnDisabled]}
                    onPress={handleCreate}
                    disabled={isCreating}
                  >
                    <FontAwesome6 name="plus" size={12} color="#FFFFFF" />
                  </TouchableOpacity>
                )}
              </View>
            )}
            
            <FlatList
              data={[{ id: null, name: placeholder }, ...filteredOptions]}
              keyExtractor={(item, index) => item.id || `placeholder-${index}`}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[styles.option, value === item.id && styles.optionSelected]}
                  onPress={() => handleSelect(item.id)}
                >
                  <ThemedText 
                    variant="body" 
                    color={value === item.id ? theme.primary : theme.textPrimary}
                  >
                    {item.name}
                  </ThemedText>
                  {value === item.id && (
                    <FontAwesome6 name="check" size={12} color={theme.primary} />
                  )}
                </TouchableOpacity>
              )}
              style={styles.optionsList}
            />
            
            {filteredOptions.length === 0 && searchText && !allowCreate && (
              <View style={styles.emptyHint}>
                <ThemedText variant="small" color={theme.textMuted}>
                  未找到匹配项
                </ThemedText>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// 筛选下拉组件 - 使用Modal实现
interface FilterDropdownProps {
  value: string | null;
  options: DropdownOption[];
  placeholder: string;
  onChange: (value: string | null) => void;
  theme: Theme;
}

export function FilterDropdown({
  value,
  options,
  placeholder,
  onChange,
  theme,
}: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(opt => opt.id === value);
  
  const styles = createDropdownStyles(theme);
  
  const handleSelect = (optionValue: string | null) => {
    onChange(optionValue);
    setIsOpen(false);
  };
  
  return (
    <View>
      <TouchableOpacity 
        style={[styles.filterBtn, value && styles.filterBtnActive]}
        onPress={() => setIsOpen(true)}
      >
        <ThemedText 
          variant="small" 
          color={value ? theme.buttonPrimaryText : theme.textSecondary}
          numberOfLines={1}
        >
          {selectedOption?.name || placeholder}
        </ThemedText>
        <FontAwesome6 
          name="chevron-down" 
          size={10} 
          color={value ? theme.buttonPrimaryText : theme.textSecondary} 
        />
      </TouchableOpacity>
      
      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsOpen(false)}>
          <Pressable 
            style={styles.filterModal}
            onPress={e => e.stopPropagation()}
          >
            {/* 标题 */}
            <View style={styles.filterModalHeader}>
              <ThemedText variant="bodyMedium" color={theme.textPrimary}>
                选择{placeholder}
              </ThemedText>
              <TouchableOpacity onPress={() => setIsOpen(false)}>
                <FontAwesome6 name="xmark" size={16} color={theme.textMuted} />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={[{ id: null, name: '全部' }, ...options]}
              keyExtractor={(item, index) => item.id || `all-${index}`}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[
                    styles.filterOption, 
                    value === item.id && styles.filterOptionSelected
                  ]}
                  onPress={() => handleSelect(item.id)}
                >
                  <ThemedText 
                    variant="body" 
                    color={value === item.id ? theme.primary : theme.textPrimary}
                  >
                    {item.name}
                  </ThemedText>
                  {value === item.id && (
                    <FontAwesome6 name="check" size={14} color={theme.primary} />
                  )}
                </TouchableOpacity>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function createDropdownStyles(theme: Theme) {
  return StyleSheet.create({
    // DropdownPicker 样式
    trigger: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm + 2,
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    
    // Modal 样式
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.backgroundRoot,  // 实心背景
    },
    dropdownModal: {
      position: 'absolute',
      top: '30%',
      left: Spacing.lg,
      right: Spacing.lg,
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
      maxHeight: 300,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    searchInput: {
      flex: 1,
      height: 36,
      backgroundColor: theme.backgroundTertiary,
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.md,
      fontSize: 14,
      color: theme.textPrimary,
    },
    createBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: Spacing.sm,
    },
    createBtnDisabled: {
      opacity: 0.5,
    },
    optionsList: {
      maxHeight: 220,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    optionSelected: {
      backgroundColor: theme.primary + '08',
    },
    emptyHint: {
      padding: Spacing.lg,
      alignItems: 'center',
    },
    
    // FilterDropdown 样式
    filterBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: Spacing.sm + 4,
      paddingVertical: Spacing.xs + 2,
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.full,
      borderWidth: 1,
      borderColor: theme.border,
      minWidth: 60,
    },
    filterBtnActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    filterModal: {
      position: 'absolute',
      top: '25%',
      left: Spacing.lg,
      right: Spacing.lg,
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
      maxHeight: 350,
    },
    filterModalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    filterOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    filterOptionSelected: {
      backgroundColor: theme.primary + '08',
    },
  });
}
