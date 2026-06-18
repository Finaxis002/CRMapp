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
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

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
  maxMenuHeight = 280,
  isClearable = true,
  isMulti = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

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
                >
                  <Icon name="close" size={12} color="#fff" />
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <Text style={styles.placeholder}>{placeholder}</Text>
          )}
        </View>

        <View style={styles.rightIcons}>
          {isClearable && value.length > 0 ? (
            <TouchableOpacity onPress={handleClear} style={styles.clearBtn}>
              <Icon name="close" size={18} color="#9ca3af" />
            </TouchableOpacity>
          ) : null}
          <Icon
            name={isOpen ? 'chevron-up' : 'chevron-down'}
            size={22}
            color="#9ca3af"
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
          <View style={styles.overlay}>
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.menu,
                  { maxHeight: maxMenuHeight + (isSearchable ? 66 : 16) },
                ]}
              >
                {isSearchable ? (
                  <View style={styles.searchWrap}>
                    <TextInput
                      autoFocus
                      placeholder="Search..."
                      placeholderTextColor="#9ca3af"
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
                            <Icon name="check" size={13} color="#fff" />
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

const styles = StyleSheet.create({
  root: { width: '100%' },
  trigger: {
    width: '100%',
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  triggerOpen: { borderColor: '#6366f1', backgroundColor: '#eef2ff' },
  disabled: { opacity: 0.6 },
  tagsWrap: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#6366f1',
  },
  tagText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  tagClose: { padding: 1 },
  placeholder: { color: '#6b7280', fontSize: 14, fontWeight: '500' },
  rightIcons: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  clearBtn: { padding: 4 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.35)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  menu: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  searchWrap: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  searchInput: {
    height: 40,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#f9fafb',
    paddingHorizontal: 12,
    color: '#111827',
    fontSize: 14,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  optionCheck: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  optionCheckSelected: { borderColor: '#6366f1', backgroundColor: '#6366f1' },
  optionText: { fontSize: 14, fontWeight: '500', color: '#374151' },
  optionTextSelected: { color: '#6366f1', fontWeight: '700' },
  noOptionsWrap: { paddingVertical: 32, alignItems: 'center' },
  noOptionsText: { color: '#9ca3af', fontSize: 14, fontWeight: '500' },
});

export default MultiSelect;
