import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  Image,
  TouchableWithoutFeedback,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useUISystem } from '../../hooks/useUISystem';

const COUNTRIES = [
  { code: 'AF', name: 'Afghanistan', dial: '+93', flag: 'af' },
  { code: 'AL', name: 'Albania', dial: '+355', flag: 'al' },
  { code: 'DZ', name: 'Algeria', dial: '+213', flag: 'dz' },
  { code: 'AD', name: 'Andorra', dial: '+376', flag: 'ad' },
  { code: 'AO', name: 'Angola', dial: '+244', flag: 'ao' },
  { code: 'AR', name: 'Argentina', dial: '+54', flag: 'ar' },
  { code: 'AU', name: 'Australia', dial: '+61', flag: 'au' },
  { code: 'AT', name: 'Austria', dial: '+43', flag: 'at' },
  { code: 'BD', name: 'Bangladesh', dial: '+880', flag: 'bd' },
  { code: 'BE', name: 'Belgium', dial: '+32', flag: 'be' },
  { code: 'BR', name: 'Brazil', dial: '+55', flag: 'br' },
  { code: 'CA', name: 'Canada', dial: '+1', flag: 'ca' },
  { code: 'CN', name: 'China', dial: '+86', flag: 'cn' },
  { code: 'FR', name: 'France', dial: '+33', flag: 'fr' },
  { code: 'DE', name: 'Germany', dial: '+49', flag: 'de' },
  { code: 'HK', name: 'Hong Kong', dial: '+852', flag: 'hk' },
  { code: 'IN', name: 'India', dial: '+91', flag: 'in' },
  { code: 'ID', name: 'Indonesia', dial: '+62', flag: 'id' },
  { code: 'IT', name: 'Italy', dial: '+39', flag: 'it' },
  { code: 'JP', name: 'Japan', dial: '+81', flag: 'jp' },
  { code: 'MY', name: 'Malaysia', dial: '+60', flag: 'my' },
  { code: 'MX', name: 'Mexico', dial: '+52', flag: 'mx' },
  { code: 'NP', name: 'Nepal', dial: '+977', flag: 'np' },
  { code: 'NL', name: 'Netherlands', dial: '+31', flag: 'nl' },
  { code: 'NZ', name: 'New Zealand', dial: '+64', flag: 'nz' },
  { code: 'PK', name: 'Pakistan', dial: '+92', flag: 'pk' },
  { code: 'PH', name: 'Philippines', dial: '+63', flag: 'ph' },
  { code: 'RU', name: 'Russia', dial: '+7', flag: 'ru' },
  { code: 'SA', name: 'Saudi Arabia', dial: '+966', flag: 'sa' },
  { code: 'SG', name: 'Singapore', dial: '+65', flag: 'sg' },
  { code: 'ZA', name: 'South Africa', dial: '+27', flag: 'za' },
  { code: 'ES', name: 'Spain', dial: '+34', flag: 'es' },
  { code: 'LK', name: 'Sri Lanka', dial: '+94', flag: 'lk' },
  { code: 'TH', name: 'Thailand', dial: '+66', flag: 'th' },
  { code: 'AE', name: 'United Arab Emirates', dial: '+971', flag: 'ae' },
  { code: 'GB', name: 'United Kingdom', dial: '+44', flag: 'gb' },
  { code: 'US', name: 'United States', dial: '+1', flag: 'us' },
  { code: 'VN', name: 'Vietnam', dial: '+84', flag: 'vn' },
];

const Flag = ({ code, size = 18 }) => (
  <Image
    source={{ uri: `https://flagcdn.com/w40/${code}.png` }}
    style={{ width: size, height: size * 0.72, borderRadius: 2 }}
    resizeMode="cover"
  />
);

/**
 * CustomPhoneInput
 * Props (unchanged): value, onChange(fullNumberWithDial), defaultCountry
 *
 * Visual goals:
 *  - ONE unified field (flag + dial + number share a single border).
 *  - Theme-aware via useUISystem (works in dark mode, matches the app).
 *  - Taller (48) + larger fonts so the placeholder never wraps.
 *    NOTE: also give this component a FULL-WIDTH row in the form so the
 *    placeholder has room (see LeadFormModal Profile tab regrouping).
 */
const CustomPhoneInput = ({ value = '', onChange, defaultCountry = 'IN' }) => {
  const { colors, typography, borderRadius } = useUISystem();

  const [selected, setSelected] = useState(
    () => COUNTRIES.find(c => c.code === defaultCountry) || COUNTRIES[0],
  );
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  // Auto-detect country when a full international number is pasted in.
  useEffect(() => {
    if (value && String(value).startsWith('+')) {
      const sorted = [...COUNTRIES].sort(
        (a, b) => b.dial.length - a.dial.length,
      );
      const matched = sorted.find(c => String(value).startsWith(c.dial));
      if (matched && matched.code !== selected.code) setSelected(matched);
    }
  }, [value, selected.code]);

  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  const rawNumber = useMemo(() => {
    const v = String(value || '');
    if (v.startsWith(selected.dial)) return v.slice(selected.dial.length);
    return v.replace(/\D/g, '');
  }, [value, selected.dial]);

  const filtered = useMemo(() => {
    if (!query) return COUNTRIES;
    const q = query.toLowerCase();
    return COUNTRIES.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        c.dial.includes(query) ||
        c.code.toLowerCase().includes(q),
    );
  }, [query]);

  const handleSelect = country => {
    setSelected(country);
    setOpen(false);
    onChange(country.dial + rawNumber);
  };

  const handleNumberChange = raw => {
    const digits = raw.replace(/\D/g, '').slice(0, 12);
    onChange(selected.dial + digits);
  };

  return (
    <View style={s.root}>
      <View
        style={[
          s.inputRow,
          {
            backgroundColor: colors.surface,
            borderColor: focused ? colors.primary : colors.border,
            borderRadius: borderRadius.md,
          },
        ]}
      >
        {/* Country selector — NO background, so the whole row reads as one field */}
        <TouchableOpacity
          onPress={() => setOpen(o => !o)}
          activeOpacity={0.7}
          style={[s.countryBtn, { borderRightColor: colors.border }]}
          accessibilityRole="button"
          accessibilityLabel={`Country code ${selected.dial}. Tap to change.`}
        >
          <Flag code={selected.flag} size={18} />
          <Text style={[s.dial, { color: colors.textPrimary }]}>
            {selected.dial}
          </Text>
          <Icon
            name={open ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={colors.textTertiary}
          />
        </TouchableOpacity>

        <TextInput
          keyboardType="phone-pad"
          value={rawNumber}
          onChangeText={handleNumberChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Phone number"
          placeholderTextColor={colors.placeholder}
          numberOfLines={1}
          maxLength={12}
          style={[s.number, { color: colors.textPrimary }]}
        />
      </View>

      {/* Country picker modal (theme-aware) */}
      <Modal
        visible={open}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View
            style={[
              s.overlay,
              { backgroundColor: colors.overlay || 'rgba(15,23,42,0.5)' },
            ]}
          >
            <TouchableWithoutFeedback>
              <View
                style={[
                  s.dropdown,
                  {
                    backgroundColor: colors.surface,
                    borderRadius: borderRadius.xl,
                  },
                ]}
              >
                {/* Header */}
                <View
                  style={[
                    s.mHeader,
                    { borderBottomColor: colors.borderLight || colors.border },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[typography.h4, { color: colors.textPrimary }]}
                    >
                      Select Country
                    </Text>
                    <Text
                      style={[
                        typography.caption,
                        { color: colors.textTertiary, marginTop: 2 },
                      ]}
                    >
                      Choose your country code
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setOpen(false)}
                    style={[
                      s.closeBtn,
                      {
                        backgroundColor: colors.backgroundSecondary,
                        borderRadius: borderRadius.full,
                      },
                    ]}
                    accessibilityLabel="Close"
                  >
                    <Icon name="close" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* Search */}
                <View
                  style={[
                    s.searchWrap,
                    {
                      backgroundColor: colors.backgroundSecondary,
                      borderRadius: borderRadius.md,
                    },
                  ]}
                >
                  <Icon name="magnify" size={18} color={colors.textTertiary} />
                  <TextInput
                    autoFocus
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search country or code"
                    placeholderTextColor={colors.placeholder}
                    style={[s.searchInput, { color: colors.textPrimary }]}
                  />
                  {query ? (
                    <TouchableOpacity onPress={() => setQuery('')}>
                      <Icon
                        name="close-circle"
                        size={18}
                        color={colors.textTertiary}
                      />
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* List */}
                <FlatList
                  data={filtered}
                  keyExtractor={item => item.code}
                  style={s.list}
                  keyboardShouldPersistTaps="handled"
                  ListEmptyComponent={
                    <View style={s.empty}>
                      <Icon
                        name="map-search-outline"
                        size={40}
                        color={colors.textTertiary}
                      />
                      <Text
                        style={[
                          typography.body2,
                          { color: colors.textTertiary },
                        ]}
                      >
                        No country found
                      </Text>
                    </View>
                  }
                  renderItem={({ item }) => {
                    const active = selected.code === item.code;
                    return (
                      <TouchableOpacity
                        onPress={() => handleSelect(item)}
                        activeOpacity={0.6}
                        style={[
                          s.row,
                          active && { backgroundColor: colors.primarySoft },
                        ]}
                      >
                        <Flag code={item.flag} size={22} />
                        <View style={s.rowInfo}>
                          <Text
                            style={[
                              typography.body2,
                              {
                                color: active
                                  ? colors.primary
                                  : colors.textPrimary,
                                fontWeight: active ? '600' : '500',
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {item.name}
                          </Text>
                        </View>
                        <Text
                          style={[
                            typography.caption,
                            {
                              color: active
                                ? colors.primary
                                : colors.textSecondary,
                              fontWeight: '600',
                            },
                          ]}
                        >
                          {item.dial}
                        </Text>
                        {active ? (
                          <Icon
                            name="check-circle"
                            size={18}
                            color={colors.primary}
                            style={{ marginLeft: 4 }}
                          />
                        ) : null}
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

const s = StyleSheet.create({
  root: { width: '100%' },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 48,
    borderWidth: 1,
    overflow: 'hidden',
  },

  // Transparent bg + hairline divider = reads as a single unified input.
  countryBtn: {
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    borderRightWidth: StyleSheet.hairlineWidth,
  },

  dial: { fontSize: 14, fontWeight: '600' },

  number: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 12,
    fontSize: 15,
    paddingVertical: 0,
    fontWeight: '500',
    minWidth: 0,
  },

  overlay: { flex: 1, justifyContent: 'center', padding: 20 },
  dropdown: {
    maxHeight: 540,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: 10 },
    elevation: 15,
  },
  mHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    height: 42,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
  list: { maxHeight: 400 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  rowInfo: { flex: 1 },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
});

export default CustomPhoneInput;
