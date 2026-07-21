import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
  Keyboard,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSelector, useDispatch } from 'react-redux';
import {
  setGlobalSearch,
  clearGlobalSearch,
} from '../../store/slices/searchSlice';
import {
  loadNotifications,
  markAsRead,
  markAllAsRead,
} from '../../store/slices/notificationSlice';
import { useSidebar } from '../../contexts/SidebarContext';
import { useTheme } from '../../contexts/ThemeContext';

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
  const { toggleSidebar } = useSidebar();
  const { user } = useSelector(state => state.auth);
  const { notifications, unreadCount, loading } = useSelector(
    state => state.notifications,
  );
  const searchQuery = useSelector(state => state.search.query);

  const { isDark, toggleTheme } = useTheme();

  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const pageTitle = pageTitles[route.name] ?? route.name;
  const isNotificationsPage = route.name === 'Notifications';

  const iconColor = isDark ? '#94A3B8' : '#334155';
  const bg = isDark ? '#0F172A' : '#ffffff';
  const borderColor = isDark ? '#1E293B' : '#e2e8f0';
  const titleColor = isDark ? '#F9FAFB' : '#0f172a';
  const searchBg = isDark ? '#1E293B' : '#f1f5f9';
  const searchTextColor = isDark ? '#F9FAFB' : '#0f172a';

  const openSearch = () => setSearchOpen(true);

  const closeSearch = () => {
    Keyboard.dismiss();
    setSearchOpen(false);
    dispatch(clearGlobalSearch());
  };

  const routeName = route.name;
  useEffect(() => {
    setSearchOpen(false);
    dispatch(clearGlobalSearch());
  }, [routeName]);

  useEffect(() => {
    if (!searchOpen) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeSearch();
      return true;
    });
    return () => sub.remove();
  }, [searchOpen]);

  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: insets.top,
          backgroundColor: bg,
          borderBottomColor: borderColor,
        },
      ]}
    >
      <View style={styles.row}>
        {searchOpen ? (
          <View style={styles.searchRowInline}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={closeSearch}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="arrow-left" size={22} color={iconColor} />
            </TouchableOpacity>
            <View style={[styles.searchField, { backgroundColor: searchBg }]}>
              <Icon
                name="magnify"
                size={18}
                color="#94a3b8"
                style={styles.searchIcon}
              />
              <TextInput
                style={[styles.searchInput, { color: searchTextColor }]}
                value={searchQuery}
                onChangeText={text => dispatch(setGlobalSearch(text))}
                placeholder="Search..."
                placeholderTextColor="#94a3b8"
                autoFocus
                returnKeyType="search"
                onSubmitEditing={Keyboard.dismiss}
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
          </View>
        ) : (
          <>
            {/* Left: Menu + Title */}
            <View style={styles.leftSection}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => toggleSidebar()}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="menu" size={24} color={iconColor} />
              </TouchableOpacity>
              <Text
                style={[styles.title, { color: titleColor }]}
                numberOfLines={1}
              >
                {pageTitle}
              </Text>
            </View>

            {/* Right: Actions */}
            <View style={styles.rightSection}>
              {/* Search */}
              <TouchableOpacity
                style={styles.iconButton}
                onPress={openSearch}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="magnify" size={22} color={iconColor} />
              </TouchableOpacity>

              {/* Dark mode toggle */}
              <TouchableOpacity
                style={styles.iconButton}
                onPress={toggleTheme}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon
                  name={isDark ? 'weather-sunny' : 'weather-night'}
                  size={22}
                  color={isDark ? '#FBBF24' : iconColor}
                />
              </TouchableOpacity>

              {/* Bell */}
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() =>
                  isNotificationsPage
                    ? null
                    : navigation.navigate('Notifications')
                }
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="bell-outline" size={22} color={iconColor} />
                {unreadCount > 0 && (
                  <View style={[styles.badge, { borderColor: bg }]} />
                )}
              </TouchableOpacity>

              {/* Avatar only — no text on mobile */}
              <TouchableOpacity
                style={styles.avatar}
                onPress={() => navigation.navigate('Settings')}
              >
                <Text style={styles.avatarText}>{initials(user?.name)}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* ── Notification Modal ── */}
      <Modal
        visible={notifOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setNotifOpen(false)}
      >
        <Pressable
          style={styles.notifOverlay}
          onPress={() => setNotifOpen(false)}
        >
          <Pressable
            style={[styles.notifPanel, isDark && styles.notifPanelDark]}
            onPress={() => {}}
          >
            {/* Header */}
            <View
              style={[styles.notifHeader, isDark && styles.notifHeaderDark]}
            >
              <View style={styles.notifHeaderLeft}>
                <Icon name="bell-outline" size={16} color="#6366F1" />
                <Text
                  style={[styles.notifTitle, isDark && { color: '#F9FAFB' }]}
                >
                  Notifications
                </Text>
                {unreadCount > 0 && (
                  <View style={styles.notifCountBadge}>
                    <Text style={styles.notifCountText}>{unreadCount}</Text>
                  </View>
                )}
              </View>
              <View style={styles.notifHeaderRight}>
                {unreadCount > 0 && (
                  <TouchableOpacity
                    style={styles.notifIconBtn}
                    onPress={() => dispatch(markAllAsRead())}
                  >
                    <Icon name="check-all" size={16} color="#6366F1" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.notifIconBtn}
                  onPress={() => dispatch(loadNotifications())}
                >
                  <Icon name="refresh" size={15} color="#94A3B8" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.notifIconBtn}
                  onPress={() => setNotifOpen(false)}
                >
                  <Icon name="close" size={16} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            </View>

            {/* List */}
            <ScrollView
              style={styles.notifList}
              showsVerticalScrollIndicator={false}
            >
              {loading ? (
                <View style={styles.notifEmpty}>
                  <Text
                    style={[
                      styles.notifEmptyText,
                      isDark && { color: '#94A3B8' },
                    ]}
                  >
                    Loading...
                  </Text>
                </View>
              ) : notifications.length === 0 ? (
                <View style={styles.notifEmpty}>
                  <Icon name="bell-off-outline" size={28} color="#CBD5E1" />
                  <Text
                    style={[
                      styles.notifEmptyText,
                      isDark && { color: '#94A3B8' },
                    ]}
                  >
                    All caught up!
                  </Text>
                  <Text style={styles.notifEmptySubText}>
                    No new notifications
                  </Text>
                </View>
              ) : (
                notifications.map(n => (
                  <TouchableOpacity
                    key={n._id}
                    style={[
                      styles.notifItem,
                      isDark && styles.notifItemDark,
                      !n.isRead &&
                        (isDark
                          ? styles.notifItemUnreadDark
                          : styles.notifItemUnread),
                    ]}
                    onPress={() => dispatch(markAsRead(n._id))}
                  >
                    <View
                      style={[
                        styles.notifDot,
                        {
                          backgroundColor: n.isRead ? 'transparent' : '#6366F1',
                        },
                      ]}
                    />
                    <View style={styles.notifItemContent}>
                      <Text
                        style={[
                          styles.notifItemTitle,
                          isDark && { color: '#F9FAFB' },
                        ]}
                        numberOfLines={1}
                      >
                        {n.title}
                      </Text>
                      <Text style={styles.notifItemMsg} numberOfLines={2}>
                        {n.message}
                      </Text>
                      <Text style={styles.notifItemTime}>
                        {new Date(n.createdAt).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            {/* Footer */}
            <TouchableOpacity
              style={[styles.notifFooter, isDark && styles.notifFooterDark]}
              onPress={() => {
                setNotifOpen(false);
                navigation.navigate('Notifications');
              }}
            >
              <Text style={styles.notifFooterText}>
                {notifications.length > 0
                  ? 'View all notifications →'
                  : 'View notification history →'}
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    borderBottomWidth: 1,
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
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  iconButton: {
    padding: 6,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    borderWidth: 1.5,
  },
  avatar: {
    width: 34,
    height: 34,
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

  // Inline search (row swap mode)
  searchRowInline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  searchField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 38,
  },
  searchIcon: { marginRight: 6 },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },

  // Notification modal
  notifOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 58,
    paddingRight: 10,
  },
  notifPanel: {
    width: 310,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
  },
  notifPanelDark: { backgroundColor: '#1E293B' },

  notifHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  notifHeaderDark: { borderBottomColor: '#334155' },
  notifHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  notifHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  notifTitle: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  notifCountBadge: {
    backgroundColor: '#EEF2FF',
    borderRadius: 20,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  notifCountText: { fontSize: 11, fontWeight: '600', color: '#6366F1' },
  notifIconBtn: { padding: 6, borderRadius: 8 },

  notifList: { maxHeight: 300 },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 10,
  },
  notifItemDark: { borderBottomColor: '#334155' },
  notifItemUnread: { backgroundColor: '#EEF2FF' },
  notifItemUnreadDark: { backgroundColor: 'rgba(99,102,241,0.15)' },
  notifDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
    flexShrink: 0,
  },
  notifItemContent: { flex: 1 },
  notifItemTitle: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  notifItemMsg: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 17,
  },
  notifItemTime: { fontSize: 11, color: '#94A3B8', marginTop: 4 },

  notifEmpty: { alignItems: 'center', paddingVertical: 32, gap: 6 },
  notifEmptyText: { fontSize: 13, fontWeight: '500', color: '#64748B' },
  notifEmptySubText: { fontSize: 12, color: '#94A3B8' },

  notifFooter: {
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  notifFooterDark: { borderTopColor: '#334155' },
  notifFooterText: { fontSize: 13, fontWeight: '600', color: '#6366F1' },
});

export default Topbar;
