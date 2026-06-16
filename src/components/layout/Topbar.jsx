import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSelector, useDispatch } from 'react-redux';
import {
  setGlobalSearch,
  clearGlobalSearch,
} from '../../store/slices/searchSlice';

const BRAND = '#5a7bf6';

const pageTitles = {
  Dashboard: 'Dashboard',
  Leads: 'Leads',
  Pipeline: 'Pipeline',
  Calendar: 'Calendar',
  Payments: 'Payments',
  Attendance: 'Attendance',
  Import: 'Import',
  CrossSell: 'Cross-Sell',
  Team: 'Team',
  AdminPanel: 'Admin Panel',
  Integrations: 'Integrations',
  Reports: 'Reports & Analytics',
  Notifications: 'Notifications',
  Settings: 'Settings',
};

const initials = (name = '') =>
  name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');

const Topbar = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const { user } = useSelector(state => state.auth);
  const { unreadCount } = useSelector(state => state.notifications);
  const searchQuery = useSelector(state => state.search.query);
  const [searchOpen, setSearchOpen] = useState(false);

  const pageTitle = pageTitles[route.name] ?? route.name;

  return (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        {/* Left: Menu + Title */}
        <View style={styles.leftSection}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.toggleDrawer()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="menu" size={24} color="#334155" />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>
            {pageTitle}
          </Text>
        </View>

        {/* Right: Actions */}
        <View style={styles.rightSection}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setSearchOpen(!searchOpen)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="magnify" size={22} color="#334155" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate('Notifications')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="bell-outline" size={22} color="#334155" />
            {unreadCount > 0 && <View style={styles.badge} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate('Settings')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="cog-outline" size={22} color="#334155" />
          </TouchableOpacity>

          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(user?.name)}</Text>
          </View>
        </View>
      </View>

      {/* Expandable search bar */}
      {searchOpen && (
        <View style={styles.searchBar}>
          <Icon
            name="magnify"
            size={18}
            color="#94a3b8"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={text => dispatch(setGlobalSearch(text))}
            placeholder="Search..."
            placeholderTextColor="#94a3b8"
            autoFocus
          />
          {searchQuery ? (
            <TouchableOpacity
              onPress={() => dispatch(clearGlobalSearch())}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="close" size={18} color="#94a3b8" />
            </TouchableOpacity>
          ) : null}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  row: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconButton: {
    padding: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: BRAND,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 38,
    marginTop: 6,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    padding: 0,
  },
});

export default Topbar;
