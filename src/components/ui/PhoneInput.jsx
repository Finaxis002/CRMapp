import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  Modal,
  FlatList,
  StyleSheet,
  Keyboard,
} from 'react-native';

const COUNTRIES = [
  { code: 'AF', name: 'Afghanistan', dial: '+93', flag: 'af' },
  { code: 'AL', name: 'Albania', dial: '+355', flag: 'al' },
  { code: 'DZ', name: 'Algeria', dial: '+213', flag: 'dz' },
  { code: 'AD', name: 'Andorra', dial: '+376', flag: 'ad' },
  { code: 'AO', name: 'Angola', dial: '+244', flag: 'ao' },
  { code: 'AR', name: 'Argentina', dial: '+54', flag: 'ar' },
  { code: 'AM', name: 'Armenia', dial: '+374', flag: 'am' },
  { code: 'AU', name: 'Australia', dial: '+61', flag: 'au' },
  { code: 'AT', name: 'Austria', dial: '+43', flag: 'at' },
  { code: 'AZ', name: 'Azerbaijan', dial: '+994', flag: 'az' },
  { code: 'BS', name: 'Bahamas', dial: '+1242', flag: 'bs' },
  { code: 'BH', name: 'Bahrain', dial: '+973', flag: 'bh' },
  { code: 'BD', name: 'Bangladesh', dial: '+880', flag: 'bd' },
  { code: 'BB', name: 'Barbados', dial: '+1246', flag: 'bb' },
  { code: 'BY', name: 'Belarus', dial: '+375', flag: 'by' },
  { code: 'BE', name: 'Belgium', dial: '+32', flag: 'be' },
  { code: 'BZ', name: 'Belize', dial: '+501', flag: 'bz' },
  { code: 'BJ', name: 'Benin', dial: '+229', flag: 'bj' },
  { code: 'BT', name: 'Bhutan', dial: '+975', flag: 'bt' },
  { code: 'BO', name: 'Bolivia', dial: '+591', flag: 'bo' },
  { code: 'BA', name: 'Bosnia & Herzegovina', dial: '+387', flag: 'ba' },
  { code: 'BW', name: 'Botswana', dial: '+267', flag: 'bw' },
  { code: 'BR', name: 'Brazil', dial: '+55', flag: 'br' },
  { code: 'BN', name: 'Brunei', dial: '+673', flag: 'bn' },
  { code: 'BG', name: 'Bulgaria', dial: '+359', flag: 'bg' },
  { code: 'BF', name: 'Burkina Faso', dial: '+226', flag: 'bf' },
  { code: 'BI', name: 'Burundi', dial: '+257', flag: 'bi' },
  { code: 'KH', name: 'Cambodia', dial: '+855', flag: 'kh' },
  { code: 'CM', name: 'Cameroon', dial: '+237', flag: 'cm' },
  { code: 'CA', name: 'Canada', dial: '+1', flag: 'ca' },
  { code: 'CV', name: 'Cape Verde', dial: '+238', flag: 'cv' },
  { code: 'CF', name: 'Central African Rep.', dial: '+236', flag: 'cf' },
  { code: 'TD', name: 'Chad', dial: '+235', flag: 'td' },
  { code: 'CL', name: 'Chile', dial: '+56', flag: 'cl' },
  { code: 'CN', name: 'China', dial: '+86', flag: 'cn' },
  { code: 'CO', name: 'Colombia', dial: '+57', flag: 'co' },
  { code: 'KM', name: 'Comoros', dial: '+269', flag: 'km' },
  { code: 'CG', name: 'Congo (Republic)', dial: '+242', flag: 'cg' },
  { code: 'CD', name: 'Congo (DR)', dial: '+243', flag: 'cd' },
  { code: 'CR', name: 'Costa Rica', dial: '+506', flag: 'cr' },
  { code: 'HR', name: 'Croatia', dial: '+385', flag: 'hr' },
  { code: 'CU', name: 'Cuba', dial: '+53', flag: 'cu' },
  { code: 'CY', name: 'Cyprus', dial: '+357', flag: 'cy' },
  { code: 'CZ', name: 'Czech Republic', dial: '+420', flag: 'cz' },
  { code: 'DK', name: 'Denmark', dial: '+45', flag: 'dk' },
  { code: 'DJ', name: 'Djibouti', dial: '+253', flag: 'dj' },
  { code: 'DO', name: 'Dominican Republic', dial: '+1829', flag: 'do' },
  { code: 'EC', name: 'Ecuador', dial: '+593', flag: 'ec' },
  { code: 'EG', name: 'Egypt', dial: '+20', flag: 'eg' },
  { code: 'SV', name: 'El Salvador', dial: '+503', flag: 'sv' },
  { code: 'GQ', name: 'Equatorial Guinea', dial: '+240', flag: 'gq' },
  { code: 'ER', name: 'Eritrea', dial: '+291', flag: 'er' },
  { code: 'EE', name: 'Estonia', dial: '+372', flag: 'ee' },
  { code: 'SZ', name: 'Eswatini', dial: '+268', flag: 'sz' },
  { code: 'ET', name: 'Ethiopia', dial: '+251', flag: 'et' },
  { code: 'FJ', name: 'Fiji', dial: '+679', flag: 'fj' },
  { code: 'FI', name: 'Finland', dial: '+358', flag: 'fi' },
  { code: 'FR', name: 'France', dial: '+33', flag: 'fr' },
  { code: 'GA', name: 'Gabon', dial: '+241', flag: 'ga' },
  { code: 'GM', name: 'Gambia', dial: '+220', flag: 'gm' },
  { code: 'GE', name: 'Georgia', dial: '+995', flag: 'ge' },
  { code: 'DE', name: 'Germany', dial: '+49', flag: 'de' },
  { code: 'GH', name: 'Ghana', dial: '+233', flag: 'gh' },
  { code: 'GR', name: 'Greece', dial: '+30', flag: 'gr' },
  { code: 'GT', name: 'Guatemala', dial: '+502', flag: 'gt' },
  { code: 'GN', name: 'Guinea', dial: '+224', flag: 'gn' },
  { code: 'GW', name: 'Guinea-Bissau', dial: '+245', flag: 'gw' },
  { code: 'GY', name: 'Guyana', dial: '+592', flag: 'gy' },
  { code: 'HT', name: 'Haiti', dial: '+509', flag: 'ht' },
  { code: 'HN', name: 'Honduras', dial: '+504', flag: 'hn' },
  { code: 'HK', name: 'Hong Kong', dial: '+852', flag: 'hk' },
  { code: 'HU', name: 'Hungary', dial: '+36', flag: 'hu' },
  { code: 'IS', name: 'Iceland', dial: '+354', flag: 'is' },
  { code: 'IN', name: 'India', dial: '+91', flag: 'in' },
  { code: 'ID', name: 'Indonesia', dial: '+62', flag: 'id' },
  { code: 'IR', name: 'Iran', dial: '+98', flag: 'ir' },
  { code: 'IQ', name: 'Iraq', dial: '+964', flag: 'iq' },
  { code: 'IE', name: 'Ireland', dial: '+353', flag: 'ie' },
  { code: 'IL', name: 'Israel', dial: '+972', flag: 'il' },
  { code: 'IT', name: 'Italy', dial: '+39', flag: 'it' },
  { code: 'CI', name: 'Ivory Coast', dial: '+225', flag: 'ci' },
  { code: 'JM', name: 'Jamaica', dial: '+1876', flag: 'jm' },
  { code: 'JP', name: 'Japan', dial: '+81', flag: 'jp' },
  { code: 'JO', name: 'Jordan', dial: '+962', flag: 'jo' },
  { code: 'KZ', name: 'Kazakhstan', dial: '+7', flag: 'kz' },
  { code: 'KE', name: 'Kenya', dial: '+254', flag: 'ke' },
  { code: 'KI', name: 'Kiribati', dial: '+686', flag: 'ki' },
  { code: 'KP', name: 'Korea (North)', dial: '+850', flag: 'kp' },
  { code: 'KR', name: 'Korea (South)', dial: '+82', flag: 'kr' },
  { code: 'XK', name: 'Kosovo', dial: '+383', flag: 'xk' },
  { code: 'KW', name: 'Kuwait', dial: '+965', flag: 'kw' },
  { code: 'KG', name: 'Kyrgyzstan', dial: '+996', flag: 'kg' },
  { code: 'LA', name: 'Laos', dial: '+856', flag: 'la' },
  { code: 'LV', name: 'Latvia', dial: '+371', flag: 'lv' },
  { code: 'LB', name: 'Lebanon', dial: '+961', flag: 'lb' },
  { code: 'LS', name: 'Lesotho', dial: '+266', flag: 'ls' },
  { code: 'LR', name: 'Liberia', dial: '+231', flag: 'lr' },
  { code: 'LY', name: 'Libya', dial: '+218', flag: 'ly' },
  { code: 'LI', name: 'Liechtenstein', dial: '+423', flag: 'li' },
  { code: 'LT', name: 'Lithuania', dial: '+370', flag: 'lt' },
  { code: 'LU', name: 'Luxembourg', dial: '+352', flag: 'lu' },
  { code: 'MO', name: 'Macau', dial: '+853', flag: 'mo' },
  { code: 'MG', name: 'Madagascar', dial: '+261', flag: 'mg' },
  { code: 'MW', name: 'Malawi', dial: '+265', flag: 'mw' },
  { code: 'MY', name: 'Malaysia', dial: '+60', flag: 'my' },
  { code: 'MV', name: 'Maldives', dial: '+960', flag: 'mv' },
  { code: 'ML', name: 'Mali', dial: '+223', flag: 'ml' },
  { code: 'MT', name: 'Malta', dial: '+356', flag: 'mt' },
  { code: 'MH', name: 'Marshall Islands', dial: '+692', flag: 'mh' },
  { code: 'MR', name: 'Mauritania', dial: '+222', flag: 'mr' },
  { code: 'MU', name: 'Mauritius', dial: '+230', flag: 'mu' },
  { code: 'MX', name: 'Mexico', dial: '+52', flag: 'mx' },
  { code: 'FM', name: 'Micronesia', dial: '+691', flag: 'fm' },
  { code: 'MD', name: 'Moldova', dial: '+373', flag: 'md' },
  { code: 'MC', name: 'Monaco', dial: '+377', flag: 'mc' },
  { code: 'MN', name: 'Mongolia', dial: '+976', flag: 'mn' },
  { code: 'ME', name: 'Montenegro', dial: '+382', flag: 'me' },
  { code: 'MA', name: 'Morocco', dial: '+212', flag: 'ma' },
  { code: 'MZ', name: 'Mozambique', dial: '+258', flag: 'mz' },
  { code: 'MM', name: 'Myanmar', dial: '+95', flag: 'mm' },
  { code: 'NA', name: 'Namibia', dial: '+264', flag: 'na' },
  { code: 'NR', name: 'Nauru', dial: '+674', flag: 'nr' },
  { code: 'NP', name: 'Nepal', dial: '+977', flag: 'np' },
  { code: 'NL', name: 'Netherlands', dial: '+31', flag: 'nl' },
  { code: 'NZ', name: 'New Zealand', dial: '+64', flag: 'nz' },
  { code: 'NI', name: 'Nicaragua', dial: '+505', flag: 'ni' },
  { code: 'NE', name: 'Niger', dial: '+227', flag: 'ne' },
  { code: 'NG', name: 'Nigeria', dial: '+234', flag: 'ng' },
  { code: 'MK', name: 'North Macedonia', dial: '+389', flag: 'mk' },
  { code: 'NO', name: 'Norway', dial: '+47', flag: 'no' },
  { code: 'OM', name: 'Oman', dial: '+968', flag: 'om' },
  { code: 'PK', name: 'Pakistan', dial: '+92', flag: 'pk' },
  { code: 'PW', name: 'Palau', dial: '+680', flag: 'pw' },
  { code: 'PS', name: 'Palestine', dial: '+970', flag: 'ps' },
  { code: 'PA', name: 'Panama', dial: '+507', flag: 'pa' },
  { code: 'PG', name: 'Papua New Guinea', dial: '+675', flag: 'pg' },
  { code: 'PY', name: 'Paraguay', dial: '+595', flag: 'py' },
  { code: 'PE', name: 'Peru', dial: '+51', flag: 'pe' },
  { code: 'PH', name: 'Philippines', dial: '+63', flag: 'ph' },
  { code: 'PL', name: 'Poland', dial: '+48', flag: 'pl' },
  { code: 'PT', name: 'Portugal', dial: '+351', flag: 'pt' },
  { code: 'QA', name: 'Qatar', dial: '+974', flag: 'qa' },
  { code: 'RO', name: 'Romania', dial: '+40', flag: 'ro' },
  { code: 'RU', name: 'Russia', dial: '+7', flag: 'ru' },
  { code: 'RW', name: 'Rwanda', dial: '+250', flag: 'rw' },
  { code: 'SM', name: 'San Marino', dial: '+378', flag: 'sm' },
  { code: 'ST', name: 'São Tomé & Príncipe', dial: '+239', flag: 'st' },
  { code: 'SA', name: 'Saudi Arabia', dial: '+966', flag: 'sa' },
  { code: 'SN', name: 'Senegal', dial: '+221', flag: 'sn' },
  { code: 'RS', name: 'Serbia', dial: '+381', flag: 'rs' },
  { code: 'SC', name: 'Seychelles', dial: '+248', flag: 'sc' },
  { code: 'SL', name: 'Sierra Leone', dial: '+232', flag: 'sl' },
  { code: 'SG', name: 'Singapore', dial: '+65', flag: 'sg' },
  { code: 'SK', name: 'Slovakia', dial: '+421', flag: 'sk' },
  { code: 'SI', name: 'Slovenia', dial: '+386', flag: 'si' },
  { code: 'SB', name: 'Solomon Islands', dial: '+677', flag: 'sb' },
  { code: 'SO', name: 'Somalia', dial: '+252', flag: 'so' },
  { code: 'ZA', name: 'South Africa', dial: '+27', flag: 'za' },
  { code: 'SS', name: 'South Sudan', dial: '+211', flag: 'ss' },
  { code: 'ES', name: 'Spain', dial: '+34', flag: 'es' },
  { code: 'LK', name: 'Sri Lanka', dial: '+94', flag: 'lk' },
  { code: 'SD', name: 'Sudan', dial: '+249', flag: 'sd' },
  { code: 'SR', name: 'Suriname', dial: '+597', flag: 'sr' },
  { code: 'SE', name: 'Sweden', dial: '+46', flag: 'se' },
  { code: 'CH', name: 'Switzerland', dial: '+41', flag: 'ch' },
  { code: 'SY', name: 'Syria', dial: '+963', flag: 'sy' },
  { code: 'TW', name: 'Taiwan', dial: '+886', flag: 'tw' },
  { code: 'TJ', name: 'Tajikistan', dial: '+992', flag: 'tj' },
  { code: 'TZ', name: 'Tanzania', dial: '+255', flag: 'tz' },
  { code: 'TH', name: 'Thailand', dial: '+66', flag: 'th' },
  { code: 'TL', name: 'Timor-Leste', dial: '+670', flag: 'tl' },
  { code: 'TG', name: 'Togo', dial: '+228', flag: 'tg' },
  { code: 'TO', name: 'Tonga', dial: '+676', flag: 'to' },
  { code: 'TT', name: 'Trinidad & Tobago', dial: '+1868', flag: 'tt' },
  { code: 'TN', name: 'Tunisia', dial: '+216', flag: 'tn' },
  { code: 'TR', name: 'Turkey', dial: '+90', flag: 'tr' },
  { code: 'TM', name: 'Turkmenistan', dial: '+993', flag: 'tm' },
  { code: 'TV', name: 'Tuvalu', dial: '+688', flag: 'tv' },
  { code: 'UG', name: 'Uganda', dial: '+256', flag: 'ug' },
  { code: 'UA', name: 'Ukraine', dial: '+380', flag: 'ua' },
  { code: 'AE', name: 'United Arab Emirates', dial: '+971', flag: 'ae' },
  { code: 'GB', name: 'United Kingdom', dial: '+44', flag: 'gb' },
  { code: 'US', name: 'United States', dial: '+1', flag: 'us' },
  { code: 'UY', name: 'Uruguay', dial: '+598', flag: 'uy' },
  { code: 'UZ', name: 'Uzbekistan', dial: '+998', flag: 'uz' },
  { code: 'VU', name: 'Vanuatu', dial: '+678', flag: 'vu' },
  { code: 'VA', name: 'Vatican City', dial: '+379', flag: 'va' },
  { code: 'VE', name: 'Venezuela', dial: '+58', flag: 've' },
  { code: 'VN', name: 'Vietnam', dial: '+84', flag: 'vn' },
  { code: 'WS', name: 'Samoa', dial: '+685', flag: 'ws' },
  { code: 'YE', name: 'Yemen', dial: '+967', flag: 'ye' },
  { code: 'ZM', name: 'Zambia', dial: '+260', flag: 'zm' },
  { code: 'ZW', name: 'Zimbabwe', dial: '+263', flag: 'zw' },
];

const Flag = ({ code }) => (
  <Image
    source={{ uri: `https://flagcdn.com/w40/${code}.png` }}
    style={styles.flag}
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
      if (matched && matched.code !== selected.code) {
        setSelected(matched);
      }
    }
  }, [value, selected.code]);

  const rawNumber = (() => {
    const v = String(value || '');
    if (v.startsWith(selected.dial)) return v.slice(selected.dial.length);
    return v.replace(/\D/g, '');
  })();

  const filtered = query
    ? COUNTRIES.filter(
        c =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.dial.includes(query) ||
          c.code.toLowerCase().includes(query.toLowerCase()),
      )
    : COUNTRIES;

  const handleSelect = country => {
    setSelected(country);
    setOpen(false);
    setQuery('');
    onChange(country.dial + rawNumber);
  };

  const handleNumberChange = text => {
    const raw = text.replace(/\D/g, '').slice(0, 12);
    onChange(selected.dial + raw);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.countryItem,
        selected.code === item.code && styles.selectedItem,
      ]}
      onPress={() => handleSelect(item)}
    >
      <Flag code={item.flag} />
      <Text style={styles.countryName}>{item.name}</Text>
      <Text style={styles.countryDial}>{item.dial}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Main Input Row */}
      <View style={styles.inputRow}>
        <TouchableOpacity
          style={styles.dialerButton}
          onPress={() => {
            Keyboard.dismiss();
            setOpen(true);
          }}
        >
          <Flag code={selected.flag} />
          <Text style={styles.dialText}>{selected.dial}</Text>
          <Text style={styles.chevron}>▼</Text>
        </TouchableOpacity>

        <TextInput
          style={styles.numberInput}
          value={rawNumber}
          onChangeText={handleNumberChange}
          placeholder="Enter phone number"
          placeholderTextColor="#9ca3af"
          keyboardType="number-pad"
        />
      </View>

      {/* Country Picker Modal */}
      <Modal visible={open} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Search country..."
                placeholderTextColor="#9ca3af"
                autoFocus
              />
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Text style={styles.closeText}>Close</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={filtered}
              keyExtractor={item => item.code}
              renderItem={renderItem}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No country found</Text>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginTop: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  dialerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
    paddingHorizontal: 10,
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  flag: {
    width: 18,
    height: 14,
    borderRadius: 2,
    marginRight: 6,
  },
  dialText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginRight: 4,
  },
  chevron: {
    fontSize: 8,
    color: '#9ca3af',
  },
  numberInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#111827',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    height: '70%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  searchInput: {
    flex: 1,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    marginRight: 8,
    fontSize: 14,
    color: '#111827',
  },
  closeText: {
    color: '#2563eb',
    fontWeight: '600',
    fontSize: 14,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  selectedItem: {
    backgroundColor: '#eff6ff',
  },
  countryName: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: '#1f2937',
  },
  countryDial: {
    fontSize: 12,
    color: '#9ca3af',
    fontFamily: 'monospace',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#9ca3af',
  },
});

export default CustomPhoneInput;
