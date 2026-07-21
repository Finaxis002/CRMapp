import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';

const Pagination = ({
  page,
  totalPages,
  total,
  limit,
  loading = false,
  onPageChange,
  onLimitChange,
  limitOptions = [10, 20, 50, 100],

  from: fromProp = null,
  to: toProp = null,
}) => {
  const { isDark } = useTheme();
  const colors = {
    bg: isDark ? '#0f172a' : '#FFFFFF',
    border: isDark ? 'rgba(255,255,255,0.06)' : '#EEF2F7',
    textPrimary: isDark ? '#F8FAFC' : '#0F172A',
    textMuted: isDark ? '#94A3B8' : '#94A3B8',
    pickerBg: isDark ? '#0f172a' : '#F8FAFC',
    pickerBorder: isDark ? '#334155' : '#E2E8F0',
    pickerLabelText: isDark ? '#CBD5E1' : '#1E293B',
    navIcon: isDark ? '#CBD5E1' : '#475569',
    disabledIcon: isDark ? '#475569' : '#CBD5E1',
    activePageBg: '#5A7BF6',
    pageText: isDark ? '#CBD5E1' : '#475569',
  };
  const fromAuto = total === 0 ? 0 : (page - 1) * limit + 1;
  const toAuto = Math.min(page * limit, total);
  const from = fromProp ?? fromAuto;
  const to = toProp ?? toAuto;

  const buildPages = () => {
    const pages = [];
    if (totalPages <= 5) {
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
    <View
      style={[
        styles.container,
        { backgroundColor: colors.bg, borderTopColor: colors.border },
      ]}
    >
      {/* Top Row: Info + Per Page */}
      <View style={styles.topRow}>
        <Text
          style={[styles.infoText, { color: colors.textPrimary }]}
          numberOfLines={1}
        >
          <Text style={[styles.boldText, { color: colors.textPrimary }]}>
            {from}-{to}
          </Text>
          <Text style={[styles.muted, { color: colors.textMuted }]}> of </Text>
          <Text style={[styles.boldText, { color: colors.textPrimary }]}>
            {total}
          </Text>
        </Text>

        <View
          style={[
            styles.pickerWrap,
            loading && styles.disabled,
            {
              borderColor: colors.pickerBorder,
              backgroundColor: colors.pickerBg,
            },
          ]}
        >
          {/* Visible label overlay - always shows current value */}
          <View style={styles.pickerLabelRow} pointerEvents="none">
            <Text
              style={[
                styles.pickerLabelText,
                { color: colors.pickerLabelText },
              ]}
            >
              {limit} / page
            </Text>
            <Icon
              name="chevron-down"
              size={14}
              color={colors.pickerLabelText}
            />
          </View>

          {/* Transparent picker on top for interaction */}
          <Picker
            enabled={!loading}
            selectedValue={limit}
            onValueChange={value => onLimitChange(Number(value))}
            mode="dropdown"
            dropdownIconColor="transparent"
            style={styles.pickerHidden}
          >
            {limitOptions.map(n => (
              <Picker.Item key={n} label={`${n} / page`} value={n} />
            ))}
          </Picker>
        </View>
      </View>

      {/* Bottom Row: Pagination Controls */}
      <View style={styles.pagesRow}>
        <TouchableOpacity
          disabled={disabledPrev}
          onPress={() => onPageChange(page - 1)}
          style={[styles.navBtn, disabledPrev && styles.disabledBtn]}
          activeOpacity={0.7}
        >
          <Icon
            name="chevron-left"
            size={16}
            color={disabledPrev ? colors.disabledIcon : colors.navIcon}
          />
        </TouchableOpacity>

        <View style={styles.pagesGroup}>
          {buildPages().map((p, i) =>
            p === '...' ? (
              <View key={`dots-${i}`} style={styles.dotsWrap}>
                <Text style={styles.dots}>···</Text>
              </View>
            ) : (
              <TouchableOpacity
                key={p}
                disabled={loading || p === page}
                onPress={() => onPageChange(p)}
                style={[
                  styles.pageBtn,
                  p === page && styles.activePageBtn,
                  p === page && { backgroundColor: colors.activePageBg },
                ]}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.pageText,
                    p === page && styles.activePageText,
                    { color: p === page ? '#FFFFFF' : colors.pageText },
                  ]}
                >
                  {p}
                </Text>
              </TouchableOpacity>
            ),
          )}
        </View>

        <TouchableOpacity
          disabled={disabledNext}
          onPress={() => onPageChange(page + 1)}
          style={[styles.navBtn, disabledNext && styles.disabledBtn]}
          activeOpacity={0.7}
        >
          <Icon
            name="chevron-right"
            size={16}
            color={disabledNext ? colors.disabledIcon : colors.navIcon}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EEF2F7',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  infoText: {
    fontSize: 12,
    color: '#0F172A',
    flexShrink: 1,
  },
  muted: {
    color: '#94A3B8',
    fontWeight: '400',
  },
  boldText: {
    fontWeight: '700',
    color: '#0F172A',
  },
  pickerWrap: {
    height: 30,
    minWidth: 102,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  pickerLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 9,
    height: '100%',
  },
  pickerLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
  },
  pickerHidden: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
    color: 'transparent',
  },
  pagesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pagesGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageBtn: {
    minWidth: 32,
    height: 32,
    paddingHorizontal: 7,
    borderRadius: 8,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activePageBtn: {
    backgroundColor: '#5A7BF6',
    shadowColor: '#5A7BF6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  pageText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#475569',
  },
  activePageText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  dotsWrap: {
    width: 18,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
  disabledBtn: {
    backgroundColor: '#F8FAFC',
    borderColor: '#F1F5F9',
  },
});

export default Pagination;
