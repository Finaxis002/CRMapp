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

const Flag = ({ code, size = 20 }) => (
  <Image
    source={{ uri: `https://flagcdn.com/w40/${code}.png` }}
    style={{ width: size, height: size * 0.75, borderRadius: 2 }}
    resizeMode="cover"
  />
);

const CustomPhoneInput = ({ value = '', onChange, defaultCountry = 'IN' }) => {
  const [selected, setSelected] = useState(
    () => COUNTRIES.find(c => c.code === defaultCountry) || COUNTRIES[0],
  );
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

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
      <View style={styles.inputRow}>
        <TouchableOpacity
          onPress={() => setOpen(o => !o)}
          style={styles.countryButton}
        >
          <Flag code={selected.flag} size={18} />
          <Text style={styles.dialText}>{selected.dial}</Text>
          <Icon name="chevron-down" size={16} color="#9ca3af" />
        </TouchableOpacity>

        <TextInput
          keyboardType="phone-pad"
          value={rawNumber}
          onChangeText={handleNumberChange}
          placeholder="Enter phone number"
          placeholderTextColor="#9ca3af"
          style={styles.numberInput}
        />
      </View>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback>
              <View style={styles.dropdown}>
                <View style={styles.searchWrap}>
                  <TextInput
                    autoFocus
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search country..."
                    placeholderTextColor="#9ca3af"
                    style={styles.searchInput}
                  />
                </View>

                <FlatList
                  data={filtered}
                  keyExtractor={item => item.code}
                  style={styles.countryList}
                  ListEmptyComponent={
                    <Text style={styles.emptyText}>No country found</Text>
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
                      >
                        <Flag code={item.flag} size={18} />
                        <Text
                          style={[
                            styles.countryName,
                            active && styles.countryNameActive,
                          ]}
                        >
                          {item.name}
                        </Text>
                        <Text style={styles.countryDial}>{item.dial}</Text>
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
  root: { width: '100%', marginTop: 4 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  countryButton: {
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  dialText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  numberInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 12,
    color: '#111827',
    fontSize: 14,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.35)',
    justifyContent: 'center',
    padding: 20,
  },
  dropdown: {
    maxHeight: 360,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  searchWrap: {
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  searchInput: {
    height: 36,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: '#f9fafb',
    paddingHorizontal: 12,
    color: '#111827',
    fontSize: 14,
  },
  countryList: { maxHeight: 300 },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  countryRowActive: { backgroundColor: '#eff6ff' },
  countryName: { flex: 1, fontSize: 14, color: '#1f2937' },
  countryNameActive: { color: '#1d4ed8', fontWeight: '600' },
  countryDial: { fontSize: 12, color: '#9ca3af', fontFamily: 'monospace' },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 20,
    color: '#9ca3af',
    fontSize: 14,
  },
});

export default CustomPhoneInput;
