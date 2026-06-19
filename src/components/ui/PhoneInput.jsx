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

const Flag = ({ code, size = 16 }) => (
  <Image
    source={{ uri: `https://flagcdn.com/w40/${code}.png` }}
    style={{
      width: size,
      height: size * 0.72,
      borderRadius: 2,
    }}
    resizeMode="cover"
  />
);

const CustomPhoneInput = ({ value = '', onChange, defaultCountry = 'IN' }) => {
  const [selected, setSelected] = useState(
    () => COUNTRIES.find(c => c.code === defaultCountry) || COUNTRIES[0],
  );
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);

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
    return COUNTRIES.filter(
      c =>
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        c.dial.includes(query) ||
        c.code.toLowerCase().includes(query.toLowerCase()),
    );
  }, [query]);

  const handleSelect = country => {
    setSelected(country);
    setOpen(false);
    onChange(country.dial + rawNumber);
  };

  const handleNumberChange = rawValue => {
    const raw = rawValue.replace(/\D/g, '').slice(0, 12);
    onChange(selected.dial + raw);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.inputRow, isFocused && styles.inputRowFocused]}>
        {/* Country button - Flag + Dial + Arrow (compact) */}
        <TouchableOpacity
          onPress={() => setOpen(o => !o)}
          style={styles.countryButton}
          activeOpacity={0.7}
        >
          <Flag code={selected.flag} size={16} />
          <Text style={styles.dialText}>{selected.dial}</Text>
          <Icon name="chevron-down" size={12} color="#9ca3af" />
        </TouchableOpacity>

        {/* Phone input - max space */}
        <TextInput
          keyboardType="phone-pad"
          value={rawNumber}
          onChangeText={handleNumberChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Phone number"
          placeholderTextColor="#cbd5e1"
          style={styles.numberInput}
          maxLength={12}
        />
      </View>

      {/* Country picker modal */}
      <Modal
        visible={open}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback>
              <View style={styles.dropdown}>
                {/* Header */}
                <View style={styles.modalHeader}>
                  <View>
                    <Text style={styles.modalTitle}>Select Country</Text>
                    <Text style={styles.modalSubtitle}>
                      Choose your country code
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setOpen(false)}
                    style={styles.closeBtn}
                  >
                    <Icon name="close" size={18} color="#6b7280" />
                  </TouchableOpacity>
                </View>

                {/* Search */}
                <View style={styles.searchWrap}>
                  <Icon name="magnify" size={18} color="#9ca3af" />
                  <TextInput
                    autoFocus
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search by country or code..."
                    placeholderTextColor="#9ca3af"
                    style={styles.searchInput}
                  />
                  {query ? (
                    <TouchableOpacity onPress={() => setQuery('')}>
                      <Icon name="close-circle" size={18} color="#9ca3af" />
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* Country list */}
                <FlatList
                  data={filtered}
                  keyExtractor={item => item.code}
                  style={styles.countryList}
                  keyboardShouldPersistTaps="handled"
                  ListEmptyComponent={
                    <View style={styles.emptyWrap}>
                      <Icon
                        name="map-search-outline"
                        size={40}
                        color="#d1d5db"
                      />
                      <Text style={styles.emptyText}>No country found</Text>
                    </View>
                  }
                  renderItem={({ item }) => {
                    const active = selected.code === item.code;
                    return (
                      <TouchableOpacity
                        onPress={() => handleSelect(item)}
                        style={[
                          styles.countryRow,
                          active && styles.countryRowActive,
                        ]}
                        activeOpacity={0.6}
                      >
                        <Flag code={item.flag} size={22} />
                        <View style={styles.countryInfo}>
                          <Text
                            style={[
                              styles.countryName,
                              active && styles.countryNameActive,
                            ]}
                            numberOfLines={1}
                          >
                            {item.name}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.countryDial,
                            active && styles.countryDialActive,
                          ]}
                        >
                          {item.dial}
                        </Text>
                        {active ? (
                          <Icon
                            name="check-circle"
                            size={18}
                            color="#5a7bf6"
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

const styles = StyleSheet.create({
  root: { width: '100%' },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },

  inputRowFocused: {
    borderColor: '#5a7bf6',
    borderWidth: 1.5,
  },

  countryButton: {
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    backgroundColor: '#f9fafb',
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
  },

  dialText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },

  numberInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 8,
    color: '#111827',
    fontSize: 13,
    paddingVertical: 0,
    fontWeight: '500',
    minWidth: 0,
  },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  dropdown: {
    maxHeight: 540,
    borderRadius: 20,
    backgroundColor: '#fff',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: 10 },
    elevation: 15,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    color: '#111827',
    fontSize: 14,
    paddingVertical: 0,
  },
  countryList: { maxHeight: 400 },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  countryRowActive: {
    backgroundColor: 'rgba(90,123,246,0.06)',
  },
  countryInfo: { flex: 1 },
  countryName: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
  },
  countryNameActive: {
    color: '#5a7bf6',
    fontWeight: '600',
  },
  countryDial: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '600',
  },
  countryDialActive: {
    color: '#5a7bf6',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 14,
  },
});

export default CustomPhoneInput;
