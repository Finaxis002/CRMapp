import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  FlatList,
  StyleSheet,
  Platform,
  Dimensions,
  Pressable,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';   // <-- import theme hook

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * CustomDropdown - Reusable dropdown component
 *
 * @param {Array} options - [{value, label}] or [string]
 * @param {string|Array} value - Selected value(s)
 * @param {Function} onChange - Callback (value) => void  OR  (values[]) => void for multi
 * @param {string} placeholder - Placeholder text
 * @param {boolean} searchable - Show search bar
 * @param {boolean} multiSelect - Allow multiple selection
 * @param {boolean} disabled - Disable dropdown
 * @param {string} label - Optional label above dropdown
 * @param {boolean} required - Show * mark
 * @param {string} emptyText - Text when no options
 * @param {number} maxHeight - Max height of dropdown list
 * @param {Object} style - Custom container style
 */
const CustomDropdown = ({
  options = [],
  value,
  onChange,
  placeholder = 'Select an option',
  searchable = false,
  multiSelect = false,
  disabled = false,
  label,
  required = false,
  emptyText = 'No options available',
  maxHeight = SCREEN_HEIGHT * 0.5,
  style,
  searchPlaceholder = 'Search...',
  showSelectedCount = true,
}) => {
  const { isDark } = useTheme();                       // <-- get dark mode flag

  // ─── Theme colors ─────────────────────────────────────────────
  const theme = useMemo(() => ({
    bg:           isDark ? '#1e293b' : '#ffffff',
    surface:      isDark ? '#0f172a' : '#f9fafb',
    border:       isDark ? '#334155' : '#d1d5db',
    text:         isDark ? '#f1f5f9' : '#111827',
    subText:      isDark ? '#94a3b8' : '#6b7280',
    placeholder:  isDark ? '#64748b' : '#9ca3af',
    inputBg:      isDark ? '#1e293b' : '#f3f4f6',
    selectedBg:   isDark ? 'rgba(90,123,246,0.25)' : 'rgba(90,123,246,0.06)',
    selectedText: '#5a7bf6',  // keep brand colour
    checkboxBorder: isDark ? '#475569' : '#d1d5db',
    checkboxChecked: '#5a7bf6',
    headerBorder: isDark ? '#334155' : '#f3f4f6',
    closeBtnBg:   isDark ? '#334155' : '#f3f4f6',
    emptyIcon:    isDark ? '#475569' : '#d1d5db',
    clearText:    '#ef4444',  // keep red
  }), [isDark]);

  // ─── State ────────────────────────────────────────────────────
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const normalizedOptions = useMemo(() => {
    return options.map(opt => {
      if (typeof opt === 'object' && opt !== null) {
        return {
          value: opt.value ?? opt.label,
          label: opt.label ?? String(opt.value),
        };
      }
      return { value: opt, label: String(opt) };
    });
  }, [options]);

  const filteredOptions = useMemo(() => {
    if (!searchable || !searchQuery.trim()) return normalizedOptions;
    return normalizedOptions.filter(opt =>
      opt.label.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [normalizedOptions, searchQuery, searchable]);

  const displayText = useMemo(() => {
    if (multiSelect) {
      const selectedValues = Array.isArray(value) ? value : [];
      if (selectedValues.length === 0) return placeholder;
      if (showSelectedCount && selectedValues.length > 1) {
        return `${selectedValues.length} selected`;
      }
      const labels = selectedValues
        .map(v => normalizedOptions.find(o => o.value === v)?.label)
        .filter(Boolean);
      return labels.join(', ') || placeholder;
    } else {
      const found = normalizedOptions.find(o => o.value === value);
      return found?.label || placeholder;
    }
  }, [value, multiSelect, normalizedOptions, placeholder, showSelectedCount]);

  const isPlaceholder = useMemo(() => {
    if (multiSelect) return !Array.isArray(value) || value.length === 0;
    return value === '' || value === null || value === undefined;
  }, [value, multiSelect]);

  const isSelected = useCallback(
    optValue => {
      if (multiSelect) {
        return Array.isArray(value) && value.includes(optValue);
      }
      return value === optValue;
    },
    [value, multiSelect],
  );

  const handleSelect = useCallback(
    optValue => {
      if (multiSelect) {
        const current = Array.isArray(value) ? value : [];
        const next = current.includes(optValue)
          ? current.filter(v => v !== optValue)
          : [...current, optValue];
        onChange(next);
      } else {
        onChange(optValue);
        setIsOpen(false);
        setSearchQuery('');
      }
    },
    [value, multiSelect, onChange],
  );

  const handleClose = () => {
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClearAll = () => {
    if (multiSelect) {
      onChange([]);
    } else {
      onChange('');
    }
  };

  // ─── Render functions ─────────────────────────────────────────
  const renderItem = ({ item }) => {
    const selected = isSelected(item.value);
    return (
      <TouchableOpacity
        onPress={() => handleSelect(item.value)}
        style={[
          styles.optionItem,
          { borderBottomColor: theme.border },
          selected && { backgroundColor: theme.selectedBg },
        ]}
        activeOpacity={0.7}
      >
        {multiSelect ? (
          <View
            style={[
              styles.checkbox,
              { borderColor: theme.checkboxBorder },
              selected && {
                borderColor: theme.checkboxChecked,
                backgroundColor: theme.checkboxChecked,
              },
            ]}
          >
            {selected ? <Icon name="check" size={14} color="#fff" /> : null}
          </View>
        ) : null}
        <Text
          style={[
            styles.optionText,
            { color: selected ? theme.selectedText : theme.text },
            selected && styles.optionTextSelected,
          ]}
          numberOfLines={2}
        >
          {item.label}
        </Text>
        {!multiSelect && selected ? (
          <Icon name="check" size={18} color={theme.selectedText} />
        ) : null}
      </TouchableOpacity>
    );
  };

  // ─── Component ─────────────────────────────────────────────────
  return (
    <View style={style}>
      {label ? (
        <Text style={[styles.label, { color: theme.text }]}>
          {label} {required ? <Text style={styles.required}>*</Text> : null}
        </Text>
      ) : null}

      {/* Trigger button */}
      <TouchableOpacity
        disabled={disabled}
        onPress={() => setIsOpen(true)}
        style={[
          styles.trigger,
          {
            borderColor: theme.border,
            backgroundColor: disabled ? theme.surface : theme.bg,
          },
          disabled && styles.triggerDisabled,
        ]}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.triggerText,
            { color: isPlaceholder ? theme.placeholder : theme.text },
          ]}
          numberOfLines={1}
        >
          {displayText}
        </Text>
        <Icon
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={theme.subText}
        />
      </TouchableOpacity>

      {/* Dropdown Modal */}
      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={handleClose}
      >
        <Pressable style={styles.overlay} onPress={handleClose}>
          <Pressable
            style={[
              styles.dropdownContainer,
              { backgroundColor: theme.bg },
            ]}
            onPress={() => {}}
          >
            {/* Header */}
            <View style={[styles.modalHeader, { borderBottomColor: theme.headerBorder }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {label || placeholder}
              </Text>
              <TouchableOpacity
                onPress={handleClose}
                style={[styles.closeBtn, { backgroundColor: theme.closeBtnBg }]}
              >
                <Icon name="close" size={20} color={theme.subText} />
              </TouchableOpacity>
            </View>

            {/* Search bar */}
            {searchable ? (
              <View style={[styles.searchWrap, { backgroundColor: theme.inputBg }]}>
                <Icon name="magnify" size={18} color={theme.placeholder} />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder={searchPlaceholder}
                  placeholderTextColor={theme.placeholder}
                  style={[styles.searchInput, { color: theme.text }]}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                {searchQuery ? (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Icon name="close-circle" size={18} color={theme.placeholder} />
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}

            {/* Multi-select actions */}
            {multiSelect && Array.isArray(value) && value.length > 0 ? (
              <View style={styles.actionsRow}>
                <Text style={[styles.countText, { color: theme.subText }]}>
                  {value.length} selected
                </Text>
                <TouchableOpacity onPress={handleClearAll}>
                  <Text style={styles.clearText}>Clear all</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Options list */}
            <View style={{ maxHeight }}>
              {filteredOptions.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Icon name="inbox-outline" size={40} color={theme.emptyIcon} />
                  <Text style={[styles.emptyText, { color: theme.placeholder }]}>
                    {searchQuery ? 'No results found' : emptyText}
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={filteredOptions}
                  keyExtractor={(item, idx) => `${item.value}-${idx}`}
                  renderItem={renderItem}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator
                />
              )}
            </View>

            {/* Done button for multi-select */}
            {multiSelect ? (
              <TouchableOpacity onPress={handleClose} style={styles.doneBtn}>
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

// ─── Static styles ──────────────────────────────────────────────
const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  required: { color: '#ef4444' },

  trigger: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  triggerDisabled: { opacity: 0.5 },
  triggerText: {
    flex: 1,
    fontSize: 14,
    marginRight: 8,
  },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  dropdownContainer: {
    width: '100%',
    maxWidth: 500,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 20,
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    margin: 12,
    borderRadius: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },

  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  countText: {
    fontSize: 12,
    fontWeight: '500',
  },
  clearText: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '600',
  },

  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  optionText: {
    flex: 1,
    fontSize: 14,
  },
  optionTextSelected: {
    fontWeight: '600',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyWrap: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
  },

  doneBtn: {
    marginHorizontal: 12,
    marginBottom: 12,
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#5a7bf6',
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default CustomDropdown;