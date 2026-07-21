import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
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
  const { colors, typography, spacing, borderRadius, elevation } =
    useUISystem();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = items.find(i => i.value === selectedValue);
  const errText = typeof error === 'string' ? error : errorMessage;
  const hasError = Boolean(error || errorMessage);

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return items;
    const q = query.trim().toLowerCase();
    return items.filter(
      i =>
        String(i.label).toLowerCase().includes(q) ||
        String(i.value).toLowerCase().includes(q),
    );
  }, [items, query, searchable]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const pick = item => {
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
              fontSize: 13,
              flex: 1,
            },
          ]}
        >
          {item.label}
        </Text>
        {isSelected && <Icon name="check" size={16} color={colors.primary} />}
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

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={close}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.backdropWrap}
        >
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
              onPress={e => e.stopPropagation?.()}
            >
              <View
                style={[styles.handle, { backgroundColor: colors.border }]}
              />

              <View
                style={[styles.sheetHeader, { paddingHorizontal: spacing.md }]}
              >
                <Text
                  style={[
                    typography.h4,
                    { color: colors.textPrimary, flex: 1, fontSize: 14 },
                  ]}
                >
                  {label || 'Select'}
                </Text>
                <Pressable
                  onPress={close}
                  hitSlop={10}
                  style={({ pressed }) => [
                    styles.closeButton,
                    {
                      backgroundColor: pressed
                        ? colors.backgroundSecondary
                        : 'transparent',
                    },
                  ]}
                >
                  <Icon name="close" size={18} color={colors.textSecondary} />
                </Pressable>
              </View>

              {searchable && (
                <View
                  style={{
                    paddingHorizontal: spacing.md,
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
                      size={16}
                      color={colors.textTertiary}
                      style={{ marginRight: 6 }}
                    />
                    <TextInput
                      value={query}
                      onChangeText={setQuery}
                      placeholder="Search..."
                      placeholderTextColor={colors.placeholder}
                      style={[
                        styles.search,
                        typography.body1,
                        { color: colors.textPrimary, fontSize: 13 },
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
                style={{ maxHeight: 280 }}
                ListEmptyComponent={
                  <View style={{ padding: spacing.lg, alignItems: 'center' }}>
                    <Text
                      style={[
                        typography.body2,
                        { color: colors.textTertiary, fontSize: 12 },
                      ]}
                    >
                      No options found
                    </Text>
                  </View>
                }
              />
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdropWrap: { flex: 1 },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { maxHeight: '75%', paddingBottom: 16 },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginTop: 8,
    marginBottom: 6,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  closeButton: {
    padding: 3,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    paddingHorizontal: 10,
    borderWidth: 1,
  },
  search: { flex: 1, padding: 0 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
