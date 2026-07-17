import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useUISystem } from '../../hooks/useUISystem';
import SelectInput from './SelectInput';

export default function ImprovedDropdown({
  label,
  items = [],
  selectedValue,
  onValueChange,
  placeholder = 'Select an option',
  searchable = true,
  disabled = false,
  error = false,
  errorMessage,
  renderItem,
  required = false,
  helperText,
  icon,
}) {
  const { colors, typography, spacing, borderRadius, elevation } = useUISystem();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = items.find((i) => i.value === selectedValue);
  const errText = typeof error === 'string' ? error : errorMessage;
  const hasError = Boolean(error || errorMessage);

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return items;
    const q = query.trim().toLowerCase();
    return items.filter(
      (i) =>
        String(i.label).toLowerCase().includes(q) ||
        String(i.value).toLowerCase().includes(q),
    );
  }, [items, query, searchable]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const pick = (item) => {
    onValueChange?.(item.value, item);
    close();
  };

  const defaultRender = ({ item }) => {
    const isSelected = item.value === selectedValue;
    return (
      <Pressable
        onPress={() => pick(item)}
        style={[
          styles.option,
          {
            backgroundColor: isSelected ? colors.primarySoft : colors.surface,
            borderBottomColor: colors.borderLight,
          },
        ]}
      >
        <Text
          style={[
            typography.body1,
            {
              color: isSelected ? colors.primary : colors.textPrimary,
              fontWeight: isSelected ? '600' : '400',
              flex: 1,
            },
          ]}
        >
          {item.label}
        </Text>
        {isSelected && (
          <Icon name="check" size={18} color={colors.primary} />
        )}
      </Pressable>
    );
  };

  return (
    <>
      <SelectInput
        label={label}
        value={selectedValue}
        placeholder={placeholder}
        onPress={() => !disabled && setOpen(true)}
        error={hasError ? errText || true : undefined}
        helperText={helperText}
        required={required}
        disabled={disabled}
        icon={icon}
        renderValue={() => selected?.label}
      />

      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <Pressable
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          onPress={close}
        >
          <Pressable
            style={[
              styles.sheet,
              elevation.xl,
              {
                backgroundColor: colors.surface,
                borderTopLeftRadius: borderRadius['2xl'],
                borderTopRightRadius: borderRadius['2xl'],
              },
            ]}
            onPress={(e) => e.stopPropagation?.()}
          >
            <View style={[styles.handle, { backgroundColor: colors.border }]} />

            <View style={[styles.sheetHeader, { paddingHorizontal: spacing.lg }]}>
              <Text style={[typography.h4, { color: colors.textPrimary, flex: 1 }]}>
                {label || 'Select'}
              </Text>
              <Pressable onPress={close} hitSlop={10}>
                <Text style={{ color: colors.textSecondary, fontSize: 16 }}>
                  Close
                </Text>
              </Pressable>
            </View>

            {searchable && (
              <View
                style={{
                  paddingHorizontal: spacing.lg,
                  marginBottom: spacing.sm,
                }}
              >
                <View
                  style={[
                    styles.searchWrap,
                    {
                      backgroundColor: colors.backgroundSecondary,
                      borderRadius: borderRadius.md,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Icon
                    name="magnify"
                    size={18}
                    color={colors.textTertiary}
                    style={{ marginRight: 8 }}
                  />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search..."
                    placeholderTextColor={colors.placeholder}
                    style={[
                      styles.search,
                      typography.body1,
                      { color: colors.textPrimary },
                    ]}
                  />
                </View>
              </View>
            )}

            <FlatList
              data={filtered}
              keyExtractor={(item, index) => String(item.value ?? index)}
              renderItem={
                renderItem
                  ? ({ item }) => renderItem(item, () => pick(item))
                  : defaultRender
              }
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: 360 }}
              ListEmptyComponent={
                <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                  <Text style={[typography.body2, { color: colors.textTertiary }]}>
                    No options found
                  </Text>
                </View>
              }
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { maxHeight: '75%', paddingBottom: 24 },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginTop: 10,
    marginBottom: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  search: { flex: 1, padding: 0 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
