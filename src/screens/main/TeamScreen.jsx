import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  StatusBar,
  Pressable,
} from 'react-native';
import { useSelector } from 'react-redux';
import { useTheme } from '../../contexts/ThemeContext';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/Feather';
import { userService } from '../../services/userService';
import { canUser } from '../../utils/permissions';
import AgentMap from '../../components/AgentMap';
import api from '../../services/api';
import { useNavigation } from '@react-navigation/native';

import ImprovedButton from '../../components/ui/ImprovedButton';
import ImprovedDropdown from '../../components/ui/ImprovedDropdown';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const ROLE_LABELS = {
  admin: 'Administrator',
  manager: 'Manager',
  tl: 'Team Lead',
  exec: 'Executive',
  viewer: 'Viewer',
};

const ROLES = ['admin', 'manager', 'tl', 'exec', 'viewer'];

const ROLE_STYLES = {
  admin: {
    avatarBg: '#E9D5FF',
    avatarText: '#7C3AED',
    badgeBg: '#F3E8FF',
    badgeText: '#7C3AED',
    ring: '#DDD6FE',
  },
  manager: {
    avatarBg: '#BBF7D0',
    avatarText: '#16A34A',
    badgeBg: '#DCFCE7',
    badgeText: '#16A34A',
    ring: '#BBF7D0',
  },
  tl: {
    avatarBg: '#BFDBFE',
    avatarText: '#2563EB',
    badgeBg: '#DBEAFE',
    badgeText: '#2563EB',
    ring: '#BFDBFE',
  },
  exec: {
    avatarBg: '#FED7AA',
    avatarText: '#EA580C',
    badgeBg: '#FFEDD5',
    badgeText: '#EA580C',
    ring: '#FED7AA',
  },
  viewer: {
    avatarBg: '#E5E7EB',
    avatarText: '#6B7280',
    badgeBg: '#F3F4F6',
    badgeText: '#6B7280',
    ring: '#E5E7EB',
  },
};

const getRoleStyle = role => ROLE_STYLES[role] || ROLE_STYLES.viewer;

const getInitials = (name = '') =>
  name
    .split(' ')
    .map(p => p[0]?.toUpperCase())
    .slice(0, 2)
    .join('');

// ─── Date helpers like Web ──────────────────────────────────────────────────
const todayStr = () => {
  try {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  } catch {
    return new Date().toISOString().split('T')[0];
  }
};

const formatCheckInTime = raw => {
  if (!raw) return null;
  let date = new Date(raw);
  if (isNaN(date.getTime())) {
    const match = /^(\d{1,2}):(\d{2})(:(\d{2}))?/.exec(String(raw));
    if (match) {
      date = new Date();
      date.setHours(
        Number(match[1]),
        Number(match[2]),
        Number(match[4] || 0),
        0,
      );
    } else {
      return null;
    }
  }
  try {
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata',
    });
  } catch {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
};

// ─── User Card - Web jaisa + online status ──────────────────────────────────
const UserCard = ({
  user,
  canManage,
  isSelf,
  onEdit,
  onDelete,
  getManagerName,
  isDark,
  onPressLeads,
}) => {
  const s = isDark ? dark : light;
  const style = getRoleStyle(user.role);
  const managerName = getManagerName(user.managerId);
  const isOnline = !!user._isOnline;
  const checkInTime = user._checkInTime;

  return (
    <View style={[styles.card, s.card]}>
      {canManage && (
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.cardActionBtn, s.cardActionBtnBg]}
            onPress={() => onEdit(user)}
          >
            <Icon
              name="edit-2"
              size={13}
              color={isDark ? '#9CA3AF' : '#6B7280'}
            />
          </TouchableOpacity>
          {!isSelf && (
            <TouchableOpacity
              style={[styles.cardActionBtn, s.cardActionBtnBg]}
              onPress={() => onDelete(user)}
            >
              <Icon name="trash-2" size={13} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={styles.cardTop}>
        <View
          style={[
            styles.avatar,
            {
              backgroundColor: style.avatarBg,
              borderColor: style.ring,
              borderWidth: 2,
            },
          ]}
        >
          <Text style={[styles.avatarText, { color: style.avatarText }]}>
            {getInitials(user.name)}
          </Text>
          <View
            style={[
              styles.onlineDot,
              {
                backgroundColor: isOnline ? '#22C55E' : '#D1D5DB',
                borderColor: s.card.backgroundColor,
              },
            ]}
          />
        </View>
        <View style={styles.cardInfo}>
          <Text style={[styles.cardName, s.textPrimary]} numberOfLines={1}>
            {user.name
              ?.split(' ')
              .map(w => w.charAt(0).toUpperCase() + w.slice(1))
              .join(' ')}
          </Text>
          <Text style={[styles.cardEmail, s.textMuted]} numberOfLines={1}>
            {user.email}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              gap: 5,
              flexWrap: 'wrap',
              marginTop: 4,
            }}
          >
            <View style={[styles.badge, { backgroundColor: style.badgeBg }]}>
              <Text style={[styles.badgeText, { color: style.badgeText }]}>
                {ROLE_LABELS[user.role] || user.role}
              </Text>
            </View>
            {isOnline && checkInTime && (
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: isDark
                      ? 'rgba(34,197,94,0.15)'
                      : '#DCFCE7',
                  },
                ]}
              >
                <Text style={[styles.badgeText, { color: '#16A34A' }]}>
                  🟢 {checkInTime}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={[styles.divider, s.divider]} />

      <View style={styles.cardMeta}>
        {user.phone ? (
          <View style={styles.metaRow}>
            <Icon
              name="phone"
              size={12}
              color={isDark ? '#6B7280' : '#9CA3AF'}
            />
            <Text style={[styles.cardMetaText, s.textMuted]}>{user.phone}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.metaRow}
          onPress={() => onPressLeads && onPressLeads(user)}
          activeOpacity={0.7}
        >
          <Icon name="users" size={12} color={isDark ? '#6B7280' : '#9CA3AF'} />
          <Text style={[styles.cardMetaText, s.textMuted]}>
            <Text style={[styles.cardMetaBold, s.textPrimary]}>
              {user.leadCount ?? 0}
            </Text>{' '}
            Leads assigned
          </Text>
          <Icon
            name="external-link"
            size={10}
            color="#2563EB"
            style={{ marginLeft: 2 }}
          />
        </TouchableOpacity>

        {!['admin', 'manager'].includes(user.role) && (
          <View style={styles.metaRow}>
            <Icon
              name="user-check"
              size={12}
              color={isDark ? '#6B7280' : '#9CA3AF'}
            />
            {managerName ? (
              <Text style={[styles.cardMetaText, s.textMuted]}>
                Reports to{' '}
                <Text style={[styles.cardMetaBold, s.textPrimary]}>
                  {managerName}
                </Text>
              </Text>
            ) : (
              <Text
                style={[
                  styles.cardMetaText,
                  { color: '#9CA3AF', fontStyle: 'italic' },
                ]}
              >
                No manager assigned
              </Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
};

// ─── Main ───────────────────────────────────────────────────────────────────

const TeamScreen = () => {
  const { isDark } = useTheme();
  const s = isDark ? dark : light;
  const navigation = useNavigation();

  const currentUser = useSelector(state => state.auth.user);
  const settings = useSelector(state => state.settings.data);
  const settingsLoading = useSelector(state => state.settings.loading);

  const canViewTeam = canUser(currentUser, settings, 'view_team');
  const canManageUsers = canUser(currentUser, settings, 'manage_users');
  const canManage = currentUser?.role === 'admin' || canManageUsers;

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('list');
  const [selectedManagerFilter, setSelectedManagerFilter] = useState('all');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('all');
  const [attendanceMap, setAttendanceMap] = useState({});

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'exec',
    password: '',
    managerId: '',
  });

  useEffect(() => {
    fetchUsers();
    fetchTodayAttendance();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await userService.getUsers(1, 100);
      setUsers(response?.data || []);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: error.response?.data?.message || 'Unable to load team members',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTodayAttendance = async () => {
    try {
      const res = await api.get(`/attendance/admin/day?date=${todayStr()}`);
      const data = res.data?.data || res.data || {};
      const map = {};
      (data.present || [])
        .filter(u => u.checkIn && !u.checkOut)
        .forEach(u => {
          map[u._id] = u.checkIn;
        });
      setAttendanceMap(map);
    } catch (e) {
      console.log('Attendance fetch failed', e?.message);
    }
  };

  const managers = users.filter(u => u.role === 'manager');

  const roleCounts = useMemo(() => {
    const counts = { all: users.length };
    ROLES.forEach(r => {
      counts[r] = users.filter(u => u.role === r).length;
    });
    return counts;
  }, [users]);

  const filteredUsers = useMemo(() => {
    return users
      .filter(
        u => selectedRoleFilter === 'all' || u.role === selectedRoleFilter,
      )
      .filter(u => {
        if (selectedManagerFilter === 'all') return true;
        if (selectedManagerFilter === 'unassigned') return !u.managerId;
        const id = u.managerId?._id || u.managerId;
        return id?.toString() === selectedManagerFilter;
      })
      .map(u => ({
        ...u,
        _isOnline: !!attendanceMap[u._id],
        _checkInTime: formatCheckInTime(attendanceMap[u._id]),
      }));
  }, [users, selectedRoleFilter, selectedManagerFilter, attendanceMap]);

  const getManagerName = managerId => {
    if (!managerId) return null;
    if (typeof managerId === 'object' && managerId._id) {
      const manager = users.find(u => u._id === managerId._id);
      return manager && manager.role === 'manager' ? managerId.name : null;
    }
    const manager = users.find(
      u => u._id?.toString() === managerId?.toString(),
    );
    return manager && manager.role === 'manager' ? manager.name : null;
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setForm({
      name: '',
      email: '',
      phone: '',
      role: 'exec',
      password: '',
      managerId: '',
    });
    setShowPassword(false);
    setModalOpen(true);
  };

  const openEditModal = user => {
    setEditingUser(user);
    setForm({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      role: user.role || 'exec',
      password: '',
      managerId: user.managerId?._id || user.managerId || '',
    });
    setShowPassword(false);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingUser(null);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      Toast.show({ type: 'error', text1: 'Name is required' });
      return;
    }
    if (!form.email.trim()) {
      Toast.show({ type: 'error', text1: 'Email is required' });
      return;
    }
    if (!editingUser && !form.password.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Password is required for new users',
      });
      return;
    }
    try {
      setSaving(true);
      if (editingUser) {
        const payload = {
          name: form.name,
          phone: form.phone,
          role: form.role,
          managerId: form.managerId || null,
        };
        if (form.password.trim()) payload.password = form.password;
        await userService.updateUser(editingUser._id, payload);
        Toast.show({ type: 'success', text1: 'Team member updated' });
      } else {
        await userService.createUser({
          name: form.name,
          email: form.email,
          phone: form.phone,
          role: form.role,
          password: form.password,
          managerId: form.managerId || null,
        });
        Toast.show({ type: 'success', text1: 'Team member invited' });
      }
      closeModal();
      fetchUsers();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: error.response?.data?.message || 'Unable to save user',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = user => {
    setDeleteConfirm(user);
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await userService.deleteUser(deleteConfirm._id);
      Toast.show({ type: 'success', text1: 'Team member deleted' });
      setDeleteConfirm(null);
      fetchUsers();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: error.response?.data?.message || 'Unable to delete user',
      });
    }
  };

  const handlePressLeads = user => {
    try {
      // Try to navigate to Pipeline/Kanban with filter - fallback toast
      if (navigation?.navigate) {
        // Assuming KanbanScreen reads route params or you have Leads route
        navigation.navigate('Pipeline', {
          assignedTo: user._id,
          assignedName: user.name,
        });
        Toast.show({ type: 'info', text1: `Showing leads for ${user.name}` });
      }
    } catch {
      Toast.show({
        type: 'info',
        text1: `${user.leadCount ?? 0} leads assigned to ${user.name}`,
      });
    }
  };

  const isSelf = user => currentUser?._id === user._id;
  const tabIconColor = tab =>
    activeTab === tab ? '#2563EB' : isDark ? '#9CA3AF' : '#6B7280';

  const managerFilterItems = [
    { value: 'all', label: 'All Members' },
    ...managers.map(m => ({ value: m._id, label: m.name })),
    { value: 'unassigned', label: 'Unassigned' },
  ];

  const roleFilterItems = [
    { value: 'all', label: `All Roles (${roleCounts.all})` },
    ...ROLES.map(r => ({
      value: r,
      label: `${ROLE_LABELS[r]} (${roleCounts[r] || 0})`,
    })),
  ];

  const roleItems = ROLES.map(r => ({ value: r, label: ROLE_LABELS[r] }));
  const managerAssignItems = [
    { value: '', label: 'No Manager' },
    ...managers.map(m => ({ value: m._id, label: m.name })),
  ];

  if (settingsLoading && !settings) {
    return (
      <View style={[styles.container, s.bg]}>
        <View style={[styles.skeletonHeader]} />
        {[1, 2, 3].map(i => (
          <View key={i} style={[styles.skeletonCard, s.card]} />
        ))}
      </View>
    );
  }

  if (!canViewTeam) {
    return (
      <View style={[styles.container, s.bg, styles.centered]}>
        <View style={styles.accessDeniedBox}>
          <Text style={styles.accessDeniedTitle}>Access Denied</Text>
          <Text style={styles.accessDeniedText}>
            You do not have permission to view or manage team members.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, s.bg]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header Compact - Fixed like KanbanScreen, NOT overlapping */}
      <View
        style={[
          styles.headerFixed,
          s.headerBorder,
          { backgroundColor: s.card.backgroundColor },
        ]}
      >
        <View style={styles.headerTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitleFixed, s.textPrimary]}>Team</Text>
            <Text style={[styles.headerSubFixed, s.textMuted]}>
              {filteredUsers.length} members •{' '}
              {Object.keys(attendanceMap).length} online today
            </Text>
          </View>
          {canManage && (
            <View style={{ marginLeft: 12 }}>
              <ImprovedButton
                title="+ Invite"
                size="small"
                onPress={openCreateModal}
              />
            </View>
          )}
        </View>
      </View>

      {/* Tabs */}
      <View style={[styles.tabRowCompact, s.tabBg]}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'list' && s.tabActive]}
          onPress={() => setActiveTab('list')}
        >
          <View style={styles.tabBtnInner}>
            <Icon name="users" size={13} color={tabIconColor('list')} />
            <Text
              style={[
                styles.tabBtnTextCompact,
                activeTab === 'list' ? styles.tabBtnTextActive : s.textMuted,
              ]}
            >
              List View
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'map' && s.tabActive]}
          onPress={() => setActiveTab('map')}
        >
          <View style={styles.tabBtnInner}>
            <Icon name="map" size={13} color={tabIconColor('map')} />
            <Text
              style={[
                styles.tabBtnTextCompact,
                activeTab === 'map' ? styles.tabBtnTextActive : s.textMuted,
              ]}
            >
              Map View
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {activeTab === 'map' ? (
        <AgentMap />
      ) : (
        <>
          {/* Filters - Role + Manager in ONE ROW like you asked */}
          <View
            style={[
              styles.filtersWrapRow,
              {
                backgroundColor: s.bg.backgroundColor,
                borderBottomColor:
                  s.headerBorder?.borderBottomColor || '#E5E7EB',
              },
            ]}
          >
            <View style={styles.filterItemRow}>
              <Text style={[styles.filterLabelCompact, s.textSecondary]}>
                Role:
              </Text>
              <ImprovedDropdown
                placeholder="All"
                items={roleFilterItems}
                selectedValue={selectedRoleFilter}
                onValueChange={setSelectedRoleFilter}
              />
            </View>
            <View style={styles.filterItemRow}>
              <Text style={[styles.filterLabelCompact, s.textSecondary]}>
                Manager:
              </Text>
              <ImprovedDropdown
                placeholder="All"
                items={managerFilterItems}
                selectedValue={selectedManagerFilter}
                onValueChange={setSelectedManagerFilter}
                searchable
              />
            </View>
          </View>

          {loading ? (
            <FlatList
              data={[1, 2, 3, 4]}
              keyExtractor={i => String(i)}
              contentContainerStyle={styles.listContentCompact}
              renderItem={() => (
                <View style={[styles.skeletonCardCompact, s.card]} />
              )}
            />
          ) : filteredUsers.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, s.textMuted]}>
                No team members found.
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredUsers}
              keyExtractor={item => item._id}
              contentContainerStyle={styles.listContentCompact}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <UserCard
                  user={item}
                  canManage={canManage}
                  isSelf={isSelf(item)}
                  onEdit={openEditModal}
                  onDelete={handleDelete}
                  getManagerName={getManagerName}
                  isDark={isDark}
                  onPressLeads={handlePressLeads}
                />
              )}
            />
          )}
        </>
      )}

      {/* Create / Edit Modal */}
      <Modal
        visible={modalOpen}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={90}
        >
          <Pressable style={styles.modalOverlayImproved} onPress={closeModal}>
            <Pressable
              style={[styles.modalSheetImproved, s.card]}
              onPress={e => e.stopPropagation()}
            >
              <View style={styles.modalHeaderCompact}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalTitleCompact, s.textPrimary]}>
                    {editingUser ? 'Edit team member' : 'Invite team member'}
                  </Text>
                  <Text style={[styles.modalSubtitleCompact, s.textMuted]}>
                    {editingUser
                      ? 'Update name, phone, role, or password.'
                      : 'Create a new user and invite them to the CRM.'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.closeBtn, s.closeBtnBg]}
                  onPress={closeModal}
                >
                  <Icon
                    name="x"
                    size={16}
                    color={isDark ? '#D1D5DB' : '#374151'}
                  />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                automaticallyAdjustKeyboardInsets={true}
                contentContainerStyle={{ paddingBottom: 40 }}
                style={{ marginTop: 12 }}
              >
                <View style={styles.formFieldCompact}>
                  <Text style={[styles.formLabelCompact, s.textSecondary]}>
                    Full name
                  </Text>
                  <TextInput
                    style={[styles.inputCompact, s.input]}
                    value={form.name}
                    onChangeText={v => setForm(p => ({ ...p, name: v }))}
                    placeholder="Enter full name"
                    placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                  />
                </View>
                <View style={styles.formFieldCompact}>
                  <Text style={[styles.formLabelCompact, s.textSecondary]}>
                    Email address
                  </Text>
                  <TextInput
                    style={[
                      styles.inputCompact,
                      s.input,
                      editingUser && styles.inputDisabled,
                    ]}
                    value={form.email}
                    onChangeText={v => setForm(p => ({ ...p, email: v }))}
                    placeholder="Enter email"
                    placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={!editingUser}
                  />
                </View>
                <View style={styles.formFieldCompact}>
                  <Text style={[styles.formLabelCompact, s.textSecondary]}>
                    Phone
                  </Text>
                  <TextInput
                    style={[styles.inputCompact, s.input]}
                    value={form.phone}
                    onChangeText={v => setForm(p => ({ ...p, phone: v }))}
                    placeholder="Enter phone number"
                    placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                    keyboardType="phone-pad"
                  />
                </View>
                <View style={styles.formFieldCompact}>
                  <Text style={[styles.formLabelCompact, s.textSecondary]}>
                    Role
                  </Text>
                  <ImprovedDropdown
                    placeholder="Select Role"
                    items={roleItems}
                    selectedValue={form.role}
                    onValueChange={v => setForm(p => ({ ...p, role: v }))}
                  />
                </View>
                {!['admin', 'manager'].includes(form.role) && (
                  <View style={styles.formFieldCompact}>
                    <Text style={[styles.formLabelCompact, s.textSecondary]}>
                      Assign Manager
                    </Text>
                    <ImprovedDropdown
                      placeholder="No Manager"
                      items={managerAssignItems}
                      selectedValue={form.managerId}
                      onValueChange={v =>
                        setForm(p => ({ ...p, managerId: v }))
                      }
                      searchable
                    />
                  </View>
                )}
                <View style={styles.formFieldCompact}>
                  <Text style={[styles.formLabelCompact, s.textSecondary]}>
                    {editingUser ? 'Change Password' : 'Password'}
                  </Text>
                  <View style={styles.passwordRowCompact}>
                    <TextInput
                      style={[styles.inputCompact, s.input, { flex: 1 }]}
                      value={form.password}
                      onChangeText={v => setForm(p => ({ ...p, password: v }))}
                      placeholder={
                        editingUser
                          ? 'Leave blank to keep current'
                          : 'Choose a password'
                      }
                      placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      style={[styles.eyeBtnCompact, s.inputBg]}
                      onPress={() => setShowPassword(p => !p)}
                    >
                      <Icon
                        name={showPassword ? 'eye-off' : 'eye'}
                        size={16}
                        color={isDark ? '#9CA3AF' : '#6B7280'}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>

              <View style={styles.modalFooterCompact}>
                <TouchableOpacity
                  style={[styles.cancelBtnCompact, s.cancelBtn]}
                  onPress={closeModal}
                >
                  <Text style={[styles.cancelBtnTextCompact, s.textSecondary]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.saveBtnCompact,
                    saving && styles.saveBtnDisabled,
                  ]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.saveBtnTextCompact}>
                      {editingUser ? 'Update' : 'Invite'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete Confirm Modal like Web */}
      <Modal
        visible={!!deleteConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteConfirm(null)}
      >
        <Pressable
          style={styles.modalOverlayImproved}
          onPress={() => setDeleteConfirm(null)}
        >
          <Pressable
            style={[styles.deleteModalCard, s.card]}
            onPress={e => e.stopPropagation()}
          >
            <View style={styles.deleteIconWrap}>
              <Icon name="trash-2" size={24} color="#DC2626" />
            </View>
            <Text style={[styles.deleteTitle, s.textPrimary]}>
              Delete member?
            </Text>
            <Text style={[styles.deleteDesc, s.textMuted]}>
              <Text style={[styles.deleteDescBold, s.textPrimary]}>
                {deleteConfirm?.name}
              </Text>{' '}
              will be permanently removed from the team. This cannot be undone.
            </Text>
            <View style={styles.deleteActions}>
              <TouchableOpacity
                style={[styles.cancelBtnCompact, s.cancelBtn, { flex: 1 }]}
                onPress={() => setDeleteConfirm(null)}
              >
                <Text style={[styles.cancelBtnTextCompact, s.textSecondary]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.saveBtnCompact,
                  { flex: 1, backgroundColor: '#DC2626' },
                ]}
                onPress={confirmDelete}
              >
                <Text style={styles.saveBtnTextCompact}>Yes, delete</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  headerCompact: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerTitleCompact: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  headerSubCompact: { fontSize: 11, marginTop: 1 },
  // Fixed header that won't overlap Invite
  headerFixed: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleFixed: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  headerSubFixed: { fontSize: 11, marginTop: 2, lineHeight: 14 },
  tabRowCompact: {
    flexDirection: 'row',
    marginHorizontal: 12,
    marginVertical: 8,
    borderRadius: 10,
    padding: 3,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tabBtnTextCompact: { fontSize: 12, fontWeight: '500' },
  tabBtnTextActive: { color: '#2563EB', fontWeight: '600' },
  filtersWrap: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  filterItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // NEW - one row side-by-side
  filtersWrapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterItemRow: { flex: 1, gap: 4 },
  filterLabelCompact: { fontSize: 11, fontWeight: '600', width: 55 },
  filterLabelCompactRow: { fontSize: 10, fontWeight: '600' },
  listContentCompact: { padding: 12, gap: 10, paddingBottom: 40 },
  card: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    marginBottom: 2,
  },
  cardActions: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    gap: 4,
    zIndex: 1,
  },
  cardActionBtn: { padding: 6, borderRadius: 8 },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingRight: 60,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '700' },
  onlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 13, fontWeight: '600' },
  cardEmail: { fontSize: 11, marginTop: 1 },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20 },
  badgeText: { fontSize: 10, fontWeight: '600' },
  divider: { height: 1, marginVertical: 8 },
  cardMeta: { gap: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardMetaText: { fontSize: 11 },
  cardMetaBold: { fontWeight: '600' },
  skeletonHeader: {
    height: 50,
    borderRadius: 10,
    margin: 12,
    backgroundColor: '#E5E7EB',
  },
  skeletonCard: {
    height: 120,
    borderRadius: 14,
    marginHorizontal: 12,
    marginVertical: 6,
    backgroundColor: '#E5E7EB',
  },
  skeletonCardCompact: {
    height: 110,
    borderRadius: 14,
    marginBottom: 8,
    backgroundColor: '#E5E7EB',
  },
  accessDeniedBox: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
    borderRadius: 14,
    padding: 20,
    margin: 16,
  },
  accessDeniedTitle: { fontSize: 15, fontWeight: '700', color: '#B91C1C' },
  accessDeniedText: { fontSize: 12, color: '#DC2626', marginTop: 4 },
  modalOverlayImproved: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalSheetImproved: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: SCREEN_HEIGHT * 0.92,
    borderWidth: 1,
  },
  modalHeaderCompact: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  modalTitleCompact: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  modalSubtitleCompact: { fontSize: 11, marginTop: 2, lineHeight: 14 },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formFieldCompact: { marginBottom: 10 },
  formLabelCompact: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  inputCompact: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
  },
  inputDisabled: { opacity: 0.5 },
  passwordRowCompact: { flexDirection: 'row', gap: 6 },
  eyeBtnCompact: {
    width: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalFooterCompact: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  cancelBtnCompact: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelBtnTextCompact: { fontWeight: '600', fontSize: 12 },
  saveBtnCompact: {
    flex: 1,
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnTextCompact: { color: '#fff', fontWeight: '600', fontSize: 12 },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    marginTop: 40,
  },
  emptyText: { fontSize: 12, textAlign: 'center' },
  deleteModalCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    maxWidth: 340,
    alignSelf: 'center',
    width: '90%',
  },
  deleteIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  deleteTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  deleteDesc: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 18,
    lineHeight: 16,
  },
  deleteDescBold: { fontWeight: '700' },
  deleteActions: { flexDirection: 'row', gap: 8, width: '100%' },
});

const light = StyleSheet.create({
  bg: { backgroundColor: '#F9FAFB' },
  card: { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' },
  textPrimary: { color: '#111827' },
  textSecondary: { color: '#374151' },
  textMuted: { color: '#6B7280' },
  divider: { backgroundColor: '#E5E7EB' },
  headerBorder: { borderBottomColor: '#E5E7EB' },
  tabBg: { backgroundColor: '#F3F4F6' },
  tabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  inputBg: { backgroundColor: '#F9FAFB' },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D1D5DB',
    color: '#111827',
  },
  cancelBtn: { borderColor: '#D1D5DB', backgroundColor: '#FFFFFF' },
  closeBtnBg: { backgroundColor: '#F3F4F6' },
  cardActionBtnBg: { backgroundColor: '#F9FAFB' },
});

const dark = StyleSheet.create({
  bg: { backgroundColor: '#0F172A' },
  card: { backgroundColor: '#1E293B', borderColor: '#334155' },
  textPrimary: { color: '#F9FAFB' },
  textSecondary: { color: '#D1D5DB' },
  textMuted: { color: '#9CA3AF' },
  divider: { backgroundColor: '#334155' },
  headerBorder: { borderBottomColor: '#1E293B' },
  tabBg: { backgroundColor: '#1E293B' },
  tabActive: { backgroundColor: '#0F172A' },
  inputBg: { backgroundColor: '#1E293B' },
  input: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
    color: '#F9FAFB',
  },
  cancelBtn: { borderColor: '#334155', backgroundColor: '#1E293B' },
  closeBtnBg: { backgroundColor: '#334155' },
  cardActionBtnBg: { backgroundColor: '#334155' },
});

export default TeamScreen;
