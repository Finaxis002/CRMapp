import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  Pressable,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDispatch, useSelector } from 'react-redux';
import { logout as logoutAction } from '../../store/slices/authSlice';
import { authService } from '../../services/authService';
import { canUser } from '../../utils/permissions';
import api from '../../services/api';
import OtpLogoutModal from './OtpLogoutModal';
import { useSidebar } from '../../contexts/SidebarContext';
import { useTheme } from '../../contexts/ThemeContext';

const BRAND = '#5a7bf6';
const SCREEN_WIDTH = Dimensions.get('window').width;
const SIDEBAR_WIDTH = SCREEN_WIDTH * 0.8;
const SWIPE_EDGE_WIDTH = 30;

const menuItems = [
  { label: 'Dashboard', icon: 'view-dashboard', name: 'Dashboard' },
  { label: 'Leads', icon: 'account-group', name: 'Leads' },
  { label: 'Pipeline', icon: 'chart-bar', name: 'Pipeline' },
  { label: 'Calendar', icon: 'calendar-month', name: 'Calendar' },
  {
    label: 'Payments',
    icon: 'credit-card-outline',
    name: 'Payments',
    permission: 'record_payments',
  },
  // { label: 'Attendance', icon: 'clipboard-check-outline', name: 'Attendance' },
  {
    label: 'Import',
    icon: 'upload',
    name: 'Import',
    permission: 'import_leads',
  },
  { label: 'Cross-Sell', icon: 'trending-up', name: 'CrossSell' },
  {
    label: 'Call Tracing',
    icon: 'phone-in-talk',
    name: 'CallTracing',
    permission: 'view_team',
  },
];

const adminItems = [
  {
    label: 'Team',
    icon: 'account-group',
    name: 'Team',
    permission: 'view_team',
  },
  {
    label: 'Admin Panel',
    icon: 'cog',
    name: 'AdminPanel',
    permission: 'admin_panel',
  },
  { label: 'Integrations', icon: 'connection', name: 'Integrations' },
  { label: 'Reports', icon: 'chart-line', name: 'Reports' },
];

const initials = (name = '') =>
  name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');

const CustomSidebar = ({ currentRoute }) => {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const { user } = useSelector(state => state.auth);
  const settings = useSelector(state => state.settings.data);
const { isOpen, openSidebar, closeSidebar } = useSidebar();
const { isDark } = useTheme();
  const [otpModalOpen, setOtpModalOpen] = useState(false);

  // Slide-in animation
  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: isOpen ? 0 : -SIDEBAR_WIDTH,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: isOpen ? 1 : 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isOpen, slideAnim, fadeAnim]);

  // Edge swipe gesture: only on left edge, only when closed, only horizontal
  const edgeSwipe = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-15, 15])
    .onEnd(event => {
      if (!isOpen && event.translationX > 40 && event.velocityX > 0.2) {
        openSidebar();
      }
    });

  const visibleMenuItems = useMemo(() => {
    return menuItems.filter(item => {
      if (item.permission && !canUser(user, settings, item.permission))
        return false;
      return true;
    });
  }, [user, settings]);

  const visibleAdminItems = useMemo(() => {
    return adminItems.filter(item => {
      if (item.permission && !canUser(user, settings, item.permission))
        return false;
      return true;
    });
  }, [user, settings]);

  const handleSendOtp = async () => {
    await api.post('/auth/send-logout-otp', { userId: user._id });
  };

  const handleVerifyOtp = async otp => {
    const response = await api.post('/auth/verify-logout-otp', {
      userId: user._id,
      otp,
    });
    return response.data.success === true;
  };

  const handleLogoutClick = () => {
    if (user?.role === 'admin') {
      handleConfirmedLogout();
    } else {
      setOtpModalOpen(true);
    }
  };

  const handleConfirmedLogout = async () => {
    setOtpModalOpen(false);
    closeSidebar();
    try {
      if (typeof authService.logout === 'function') {
        await authService.logout();
      } else {
        console.error('authService.logout is not a function');
      }
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      dispatch(logoutAction());
    }
  };

  // Sidebar items behave like drawer siblings (no back stack between them)
  const handleNavPress = name => {
    closeSidebar();
    navigation.reset({
      index: 0,
      routes: [{ name }],
    });
  };

  const renderNavItem = item => {
    const isActive = currentRoute === item.name;

    return (
      <TouchableOpacity
        key={item.name}
        style={[styles.navItem, isActive && styles.navItemActive]}
        onPress={() => handleNavPress(item.name)}
      >
        {isActive && <View style={styles.activeIndicator} />}
        <Icon
          name={item.icon}
          size={20}
          color={isActive ? BRAND : '#64748b'}
          style={styles.navIcon}
        />
        <Text style={[styles.navLabel, isActive && styles.navLabelActive, !isActive && { color: isDark ? '#94A3B8' : '#64748b' }]}>
  {item.label}
</Text>
      </TouchableOpacity>
    );
  };

  return (
    <>
      <OtpLogoutModal
        visible={otpModalOpen}
        onClose={() => setOtpModalOpen(false)}
        onConfirmed={handleConfirmedLogout}
        adminEmail={user?.email ?? ''}
        onSendOtp={handleSendOtp}
        onVerifyOtp={handleVerifyOtp}
      />

      {/* Edge swipe handler - left 30px, only when closed */}
      {!isOpen && (
        <GestureDetector gesture={edgeSwipe}>
          <View pointerEvents="box-none" style={styles.edgeHandler} />
        </GestureDetector>
      )}

      {/* Dim overlay (backdrop) */}
      <Animated.View
        pointerEvents={isOpen ? 'auto' : 'none'}
        style={[styles.backdrop, { opacity: fadeAnim }]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={closeSidebar} />
      </Animated.View>

      {/* Sliding sidebar panel */}
      <Animated.View
        pointerEvents={isOpen ? 'auto' : 'none'}
        style={[
  styles.container,
  {
    width: SIDEBAR_WIDTH,
    paddingTop: insets.top,
    paddingBottom: insets.bottom,
    transform: [{ translateX: slideAnim }],
    backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
  },
]}
      >
        {/* Logo Header */}
        <View style={[styles.header, { borderBottomColor: isDark ? '#334155' : 'rgba(90,123,246,0.12)' }]}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>SC</Text>
          </View>
          <View>
            <Text style={[styles.brandName, { color: isDark ? '#F9FAFB' : '#0f172a' }]}>Sharda CRM</Text>
<Text style={styles.brandSub}>Sales Platform</Text>
          </View>
        </View>

        {/* User Info */}
        <View style={[styles.userInfo, { borderBottomColor: isDark ? '#334155' : '#f1f5f9' }]}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>{initials(user?.name)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.userName, { color: isDark ? '#F9FAFB' : '#1e293b' }]} numberOfLines={1}>
  {user?.name}
</Text>
<Text style={styles.userRole}>{user?.role}</Text>
          </View>
        </View>

        {/* Nav Items */}
        <ScrollView
          style={styles.navScroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.navSection}>
            {visibleMenuItems.map(renderNavItem)}
          </View>

          {visibleAdminItems.length > 0 && (
            <View style={styles.navSection}>
              <Text style={styles.sectionLabel}>ADMIN</Text>
              {visibleAdminItems.map(renderNavItem)}
            </View>
          )}

          <View style={{ height: 20 }} />
        </ScrollView>

        {/* Logout */}
       <View style={[styles.logoutSection, { borderTopColor: isDark ? '#334155' : 'rgba(90,123,246,0.12)' }]}>
  <TouchableOpacity
    style={styles.logoutButton}
    onPress={handleLogoutClick}
  >
            <Icon name="logout" size={20} color="#ef4444" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  edgeHandler: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: SWIPE_EDGE_WIDTH,
    zIndex: 998,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 999,
  },
 container: {
  position: 'absolute',
  top: 0,
  bottom: 0,
  left: 0,
  backgroundColor: '#ffffff',
    zIndex: 1000,
    // iOS shadow
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    // Android elevation
    elevation: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(90,123,246,0.12)',
  },
  logoBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: BRAND,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 1,
  },
brandName: {
  fontSize: 15,
  fontWeight: '700',
  color: '#0f172a',
},
  brandSub: {
    fontSize: 10,
    fontWeight: '500',
    color: BRAND,
    letterSpacing: 0.5,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: BRAND,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  userRole: {
    fontSize: 12,
    color: '#94a3b8',
    textTransform: 'capitalize',
  },
  navScroll: {
    flex: 1,
    paddingTop: 12,
  },
  navSection: {
    paddingHorizontal: 12,
    gap: 2,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(90,123,246,0.6)',
    letterSpacing: 1.5,
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 6,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 12,
    position: 'relative',
  },
  navItemActive: {
    backgroundColor: 'rgba(90,123,246,0.1)',
  },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    top: '50%',
    marginTop: -10,
    width: 3,
    height: 20,
    borderRadius: 3,
    backgroundColor: BRAND,
  },
  navIcon: {},
  navLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
  },
  navLabelActive: {
    color: BRAND,
    fontWeight: '600',
  },
  logoutSection: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(90,123,246,0.12)',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ef4444',
  },
});

export default CustomSidebar;
