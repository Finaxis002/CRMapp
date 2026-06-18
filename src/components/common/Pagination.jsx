import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const Pagination = ({
  page,
  totalPages,
  total,
  limit,
  loading = false,
  onPageChange,
  onLimitChange,
  limitOptions = [10, 20, 50, 100],
}) => {
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  const buildPages = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      for (
        let i = Math.max(2, page - 1);
        i <= Math.min(totalPages - 1, page + 1);
        i++
      ) {
        pages.push(i);
      }
      if (page < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  const disabledPrev = page <= 1 || loading;
  const disabledNext = page >= totalPages || loading;

  return (
    <View style={styles.container}>
      <View style={styles.leftBlock}>
        <Text style={styles.infoText}>
          Showing{' '}
          <Text style={styles.boldText}>
            {from}-{to}
          </Text>{' '}
          of <Text style={styles.boldText}>{total}</Text> leads
        </Text>

        <View style={styles.limitRow}>
          <Text style={styles.limitLabel}>Rows per page:</Text>
          <View style={[styles.pickerWrap, loading && styles.disabled]}>
            <Picker
              enabled={!loading}
              selectedValue={limit}
              onValueChange={value => onLimitChange(Number(value))}
              mode="dropdown"
              style={styles.picker}
            >
              {limitOptions.map(n => (
                <Picker.Item key={n} label={String(n)} value={n} />
              ))}
            </Picker>
          </View>
        </View>
      </View>

      <View style={styles.pagesRow}>
        <TouchableOpacity
          disabled={disabledPrev}
          onPress={() => onPageChange(page - 1)}
          style={[styles.navBtn, disabledPrev && styles.disabled]}
        >
          <Icon name="chevron-left" size={16} color="#374151" />
          <Text style={styles.navText}>Prev</Text>
        </TouchableOpacity>

        {buildPages().map((p, i) =>
          p === '...' ? (
            <Text key={`dots-${i}`} style={styles.dots}>
              ...
            </Text>
          ) : (
            <TouchableOpacity
              key={p}
              disabled={loading}
              onPress={() => onPageChange(p)}
              style={[
                styles.pageBtn,
                p === page && styles.activePageBtn,
                loading && styles.disabled,
              ]}
            >
              <Text
                style={[styles.pageText, p === page && styles.activePageText]}
              >
                {p}
              </Text>
            </TouchableOpacity>
          ),
        )}

        <TouchableOpacity
          disabled={disabledNext}
          onPress={() => onPageChange(page + 1)}
          style={[styles.navBtn, disabledNext && styles.disabled]}
        >
          <Text style={styles.navText}>Next</Text>
          <Icon name="chevron-right" size={16} color="#374151" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#f9fafb',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 12,
  },
  leftBlock: { gap: 10 },
  infoText: { fontSize: 14, color: '#6b7280' },
  boldText: { fontWeight: '600', color: '#374151' },
  limitRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  limitLabel: { fontSize: 12, fontWeight: '500', color: '#6b7280' },
  pickerWrap: {
    height: 34,
    minWidth: 92,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#fff',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  picker: { height: 34, width: 110, color: '#374151' },
  pagesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  navText: { fontSize: 14, fontWeight: '500', color: '#374151' },
  pageBtn: {
    minWidth: 34,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  activePageBtn: { backgroundColor: '#5a7bf6', borderColor: '#5a7bf6' },
  pageText: { fontSize: 14, fontWeight: '500', color: '#374151' },
  activePageText: { color: '#fff' },
  dots: {
    paddingHorizontal: 6,
    paddingVertical: 7,
    fontSize: 14,
    color: '#9ca3af',
  },
  disabled: { opacity: 0.4 },
});

export default Pagination;
