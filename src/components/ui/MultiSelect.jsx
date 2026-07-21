import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useUISystem } from '../../hooks/useUISystem';

const MultiSelect = ({
  options = [],
  value = [],
  onChange = () => {},
  placeholder = 'Select user',
  disabled = false,
  isSearchable = true,
  closeMenuOnSelect = false,
  hideSelectedOptions = false,
  noOptionsMessage = () => 'No options found',
  getOptionLabel = opt => opt.label || opt,
  getOptionValue = opt => opt.value || opt,
  maxMenuHeight = 260,
  isClearable = true,
  isMulti = true,
}) => {
  const { colors, borderRadius } = useUISystem();
  const primary = colors.primary || '#6366f1';

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', e => {
      setKeyboardHeight(e?.endCoordinates?.height || 0);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const filteredOptions = useMemo(() => {
    let filtered = options;
    if (isSearchable && searchTerm) {
      filtered = filtered.filter(opt =>
        String(getOptionLabel(opt))
          .toLowerCase()
          .includes(searchTerm.toLowerCase()),
      );
    }
    if (hideSelectedOptions) {
      filtered = filtered.filter(
        opt => !value.some(v => getOptionValue(v) === getOptionValue(opt)),
      );
    }
    return filtered;
  }, [
    options,
    value,
    searchTerm,
    isSearchable,
    hideSelectedOptions,
    getOptionLabel,
    getOptionValue,
  ]);

  useEffect(() => {
    if (!isOpen) setSearchTerm('');
  }, [isOpen]);

  const isSelected = opt => {
    const optionValue = getOptionValue(opt);
    return value.some(v => getOptionValue(v) === optionValue);
  };

  const toggleOption = opt => {
    const optionValue = getOptionValue(opt);
    let newValue;
    if (isSelected(opt)) {
      newValue = value.filter(v => getOptionValue(v) !== optionValue);
    } else {
      newValue = isMulti ? [...value, opt] : [opt];
    }
    onChange(newValue);
    if (closeMenuOnSelect && !isMulti) setIsOpen(false);
    if (closeMenuOnSelect && !hideSelectedOptions) setIsOpen(false);
  };

  const removeTag = opt => {
    const optionValue = getOptionValue(opt);
    onChange(value.filter(v => getOptionValue(v) !== optionValue));
  };

  const handleClear = () => onChange([]);

  const styles = useMemo(
    () => createStyles(colors, primary, borderRadius),
    [colors, primary, borderRadius],
  );

  return (
    <View style={styles.root}>
      <TouchableOpacity
        activeOpacity={0.8}
        disabled={disabled}
        onPress={() => setIsOpen(o => !o)}
        style={[
          styles.trigger,
          isOpen && styles.triggerOpen,
          disabled && styles.disabled,
        ]}
      >
        <View style={styles.tagsWrap}>
          {value.length > 0 ? (
            value.map((item, idx) => (
              <View key={`${getOptionValue(item)}-${idx}`} style={styles.tag}>
                <Text style={styles.tagText}>{getOptionLabel(item)}</Text>
                <TouchableOpacity
                  onPress={() => removeTag(item)}
                  style={styles.tagClose}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Icon name="close" size={10} color="#fff" />
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <Text style={styles.placeholder}>{placeholder}</Text>
          )}
        </View>

        <View style={styles.rightIcons}>
          {isClearable && value.length > 0 ? (
            <TouchableOpacity
              onPress={handleClear}
              style={styles.clearBtn}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Icon name="close" size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          ) : null}
          <Icon
            name={isOpen ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textTertiary}
          />
        </View>
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsOpen(false)}>
          <View style={[styles.overlay, { paddingBottom: keyboardHeight }]}>
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.menu,
                  { maxHeight: maxMenuHeight + (isSearchable ? 58 : 12) },
                ]}
              >
                {isSearchable ? (
                  <View style={styles.searchWrap}>
                    <TextInput
                      autoFocus
                      placeholder="Search..."
                      placeholderTextColor={colors.placeholder}
                      value={searchTerm}
                      onChangeText={setSearchTerm}
                      style={styles.searchInput}
                    />
                  </View>
                ) : null}

                <FlatList
                  data={filteredOptions}
                  keyExtractor={(item, idx) => `${getOptionValue(item)}-${idx}`}
                  style={{ maxHeight: maxMenuHeight }}
                  keyboardShouldPersistTaps="handled"
                  ListEmptyComponent={
                    <View style={styles.noOptionsWrap}>
                      <Text style={styles.noOptionsText}>
                        {noOptionsMessage()}
                      </Text>
                    </View>
                  }
                  renderItem={({ item }) => {
                    const selected = isSelected(item);
                    return (
                      <TouchableOpacity
                        onPress={() => toggleOption(item)}
                        style={styles.optionRow}
                      >
                        <View
                          style={[
                            styles.optionCheck,
                            selected && styles.optionCheckSelected,
                          ]}
                        >
                          {selected ? (
                            <Icon name="check" size={11} color="#fff" />
                          ) : null}
                        </View>
                        <Text
                          style={[
                            styles.optionText,
                            selected && styles.optionTextSelected,
                          ]}
                        >
                          {getOptionLabel(item)}
                        </Text>
                      </TouchableOpacity>
                    );
                  }}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

const createStyles = (colors, primary, borderRadius) =>
  StyleSheet.create({
    root: { width: '100%' },
    trigger: {
      width: '100%',
      minHeight: 44,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: borderRadius?.md ?? 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 6,
    },
    triggerOpen: { borderColor: primary },
    disabled: { opacity: 0.6 },
    tagsWrap: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
    tag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: primary,
    },
    tagText: { color: '#fff', fontSize: 11, fontWeight: '600' },
    tagClose: { padding: 1 },
    placeholder: { color: colors.placeholder, fontSize: 13 },
    rightIcons: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    clearBtn: { padding: 3 },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(15,23,42,0.35)',
      justifyContent: 'center',
      paddingHorizontal: 20,
    },
    menu: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    searchWrap: {
      padding: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    searchInput: {
      height: 36,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.background || '#f9fafb',
      paddingHorizontal: 10,
      color: colors.textPrimary,
      fontSize: 13,
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    optionCheck: {
      width: 18,
      height: 18,
      borderRadius: 5,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    optionCheckSelected: { borderColor: primary, backgroundColor: primary },
    optionText: { fontSize: 13, fontWeight: '500', color: colors.textPrimary },
    optionTextSelected: { color: primary, fontWeight: '700' },
    noOptionsWrap: { paddingVertical: 24, alignItems: 'center' },
    noOptionsText: {
      color: colors.textTertiary,
      fontSize: 12,
      fontWeight: '500',
    },
  });

export default MultiSelect;
