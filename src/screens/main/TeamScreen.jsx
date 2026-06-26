import React, { useEffect, useState } from 'react';
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
  Alert,
  KeyboardAvoidingView,
  Platform,
  useColorScheme,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useSelector } from 'react-redux';
import { useTheme } from '../../contexts/ThemeContext';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/Feather';
import { userService } from '../../services/userService';
import { canUser } from '../../utils/permissions';
import AgentMap from '../../components/AgentMap';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const ROLE_LABELS = {
  admin: 'Administrator',
  manager: 'Manager',
  tl: 'Team Lead',
  exec: 'Executive',
  viewer: 'Viewer',
};

const ROLES = ['admin', 'manager', 'tl', 'exec', 'viewer'];

const COLORS = [
  { avatarBg: '#E9D5FF', avatarText: '#7C3AED', badgeBg: '#F3E8FF', badgeText: '#7C3AED' },
  { avatarBg: '#BBF7D0', avatarText: '#16A34A', badgeBg: '#DCFCE7', badgeText: '#16A34A' },
  { avatarBg: '#FED7AA', avatarText: '#EA580C', badgeBg: '#FFEDD5', badgeText: '#EA580C' },
  { avatarBg: '#BFDBFE', avatarText: '#2563EB', badgeBg: '#DBEAFE', badgeText: '#2563EB' },
  { avatarBg: '#FBCFE8', avatarText: '#DB2777', badgeBg: '#FCE7F3', badgeText: '#DB2777' },
];

const getColorByIndex = (index) => COLORS[index % COLORS.length];

const getInitials = (name = '') =>
  name
    .split(' ')
    .map((p) => p[0]?.toUpperCase())
    .slice(0, 2)
    .join('');

// ─── Role Picker Modal ────────────────────────────────────────────────────────
const RolePicker = ({ visible, value, onChange, onClose, isDark }) => {
  const s = isDark ? dark : light;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.pickerSheet, s.card]}>
          <Text style={[styles.pickerTitle, s.textPrimary]}>Select Role</Text>
          {ROLES.map((role) => (
            <TouchableOpacity
              key={role}
              style={[styles.pickerOption, value === role && styles.pickerOptionActive]}
              onPress={() => { onChange(role); onClose(); }}
            >
              <Text style={[styles.pickerOptionText, s.textPrimary, value === role && styles.pickerOptionTextActive]}>
                {ROLE_LABELS[role]}
              </Text>
              {value === role && <Icon name="check" size={16} color="#2563EB" />}
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

// ─── Manager Picker Modal ─────────────────────────────────────────────────────
const ManagerPicker = ({ visible, value, onChange, onClose, managers, isDark }) => {
  const s = isDark ? dark : light;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.pickerSheet, s.card]}>
          <Text style={[styles.pickerTitle, s.textPrimary]}>Assign Manager</Text>
          <TouchableOpacity
            style={[styles.pickerOption, !value && styles.pickerOptionActive]}
            onPress={() => { onChange(''); onClose(); }}
          >
            <Text style={[styles.pickerOptionText, s.textPrimary, !value && styles.pickerOptionTextActive]}>
              No Manager
            </Text>
            {!value && <Icon name="check" size={16} color="#2563EB" />}
          </TouchableOpacity>
          {managers.map((m) => (
            <TouchableOpacity
              key={m._id}
              style={[styles.pickerOption, value === m._id && styles.pickerOptionActive]}
              onPress={() => { onChange(m._id); onClose(); }}
            >
              <Text style={[styles.pickerOptionText, s.textPrimary, value === m._id && styles.pickerOptionTextActive]}>
                {m.name}
              </Text>
              {value === m._id && <Icon name="check" size={16} color="#2563EB" />}
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

// ─── Filter Picker Modal ──────────────────────────────────────────────────────
const FilterPicker = ({ visible, value, onChange, onClose, managers, isDark }) => {
  const s = isDark ? dark : light;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.pickerSheet, s.card]}>
          <Text style={[styles.pickerTitle, s.textPrimary]}>Filter by Manager</Text>
          {[{ _id: 'all', name: 'All Members' }, ...managers, { _id: 'unassigned', name: 'Unassigned' }].map((item) => (
            <TouchableOpacity
              key={item._id}
              style={[styles.pickerOption, value === item._id && styles.pickerOptionActive]}
              onPress={() => { onChange(item._id); onClose(); }}
            >
              <Text style={[styles.pickerOptionText, s.textPrimary, value === item._id && styles.pickerOptionTextActive]}>
                {item.name}
              </Text>
              {value === item._id && <Icon name="check" size={16} color="#2563EB" />}
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

// ─── User Card ────────────────────────────────────────────────────────────────
const UserCard = ({ user, index, canManage, isSelf, onEdit, onDelete, getManagerName, isDark }) => {
  const s = isDark ? dark : light;
  const color = getColorByIndex(index);
  const managerName = getManagerName(user.managerId);

  return (
    <View style={[styles.card, s.card]}>
      {/* Action buttons */}
      {canManage && (
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.cardActionBtn, s.cardActionBtnBg]}
            onPress={() => onEdit(user)}
          >
            <Icon name="edit-2" size={15} color={isDark ? '#9CA3AF' : '#6B7280'} />
          </TouchableOpacity>
          {!isSelf && (
            <TouchableOpacity
              style={[styles.cardActionBtn, s.cardActionBtnBg]}
              onPress={() => onDelete(user)}
            >
              <Icon name="trash-2" size={14} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Avatar + Info */}
      <View style={styles.cardTop}>
        <View style={[styles.avatar, { backgroundColor: color.avatarBg }]}>
          <Text style={[styles.avatarText, { color: color.avatarText }]}>
            {getInitials(user.name)}
          </Text>
          <View style={styles.onlineDot} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={[styles.cardName, s.textPrimary]} numberOfLines={1}>{user.name}</Text>
          <Text style={[styles.cardEmail, s.textMuted]} numberOfLines={1}>{user.email}</Text>
          <View style={[styles.badge, { backgroundColor: color.badgeBg }]}>
            <Text style={[styles.badgeText, { color: color.badgeText }]}>
              {ROLE_LABELS[user.role] || user.role}
            </Text>
          </View>
        </View>
      </View>

      {/* Divider */}
      <View style={[styles.divider, s.divider]} />

      {/* Meta */}
      <View style={styles.cardMeta}>
        {user.phone ? (
          <Text style={[styles.cardMetaText, s.textMuted]}>
            <Text style={[styles.cardMetaLabel, s.textSecondary]}>Phone: </Text>
            {user.phone}
          </Text>
        ) : null}
        <Text style={[styles.cardMetaText, s.textMuted]}>
          <Text style={[styles.cardMetaLabel, s.textSecondary]}>Leads: </Text>
          {user.leadCount ?? 0}
        </Text>
        {!['admin', 'manager'].includes(user.role) && (
          <Text style={[styles.cardMetaText, s.textMuted]}>
            <Text style={[styles.cardMetaLabel, s.textSecondary]}>Manager: </Text>
            {managerName || 'Unassigned'}
          </Text>
        )}
      </View>
    </View>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const TeamScreen = () => {
  const { isDark } = useTheme();
  const s = isDark ? dark : light;

  const currentUser = useSelector((state) => state.auth.user);
  const settings = useSelector((state) => state.settings.data);
  const settingsLoading = useSelector((state) => state.settings.loading);

  const canViewTeam = canUser(currentUser, settings, 'view_team');
  const canManageUsers = canUser(currentUser, settings, 'manage_users');
  const canManage = currentUser?.role === 'admin' || canManageUsers;

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('list');
  const [selectedManagerFilter, setSelectedManagerFilter] = useState('all');
  const [filterPickerVisible, setFilterPickerVisible] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rolePickerVisible, setRolePickerVisible] = useState(false);
  const [managerPickerVisible, setManagerPickerVisible] = useState(false);

  const [form, setForm] = useState({
    name: '', email: '', phone: '', role: 'exec', password: '', managerId: '',
  });

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await userService.getUsers(1, 100);
      setUsers(response?.data || []);
    } catch (error) {
      Toast.show({ type: 'error', text1: error.response?.data?.message || 'Unable to load team members' });
    } finally {
      setLoading(false);
    }
  };

  const managers = users.filter((u) => u.role === 'manager');

  const filteredUsers =
    selectedManagerFilter === 'all'
      ? users
      : selectedManagerFilter === 'unassigned'
      ? users.filter((u) => !u.managerId)
      : users.filter((u) => {
          const id = u.managerId?._id || u.managerId;
          return id?.toString() === selectedManagerFilter;
        });

  const getManagerName = (managerId) => {
    if (!managerId) return null;
    if (typeof managerId === 'object' && managerId._id) {
      const manager = users.find((u) => u._id === managerId._id);
      return manager && manager.role === 'manager' ? managerId.name : null;
    }
    const manager = users.find((u) => u._id?.toString() === managerId?.toString());
    return manager && manager.role === 'manager' ? manager.name : null;
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setForm({ name: '', email: '', phone: '', role: 'exec', password: '', managerId: '' });
    setShowPassword(false);
    setModalOpen(true);
  };

  const openEditModal = (user) => {
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
    if (!form.name.trim()) { Toast.show({ type: 'error', text1: 'Name is required' }); return; }
    if (!form.email.trim()) { Toast.show({ type: 'error', text1: 'Email is required' }); return; }
    if (!editingUser && !form.password.trim()) { Toast.show({ type: 'error', text1: 'Password is required for new users' }); return; }

    try {
      setSaving(true);
      if (editingUser) {
        const payload = { name: form.name, phone: form.phone, role: form.role, managerId: form.managerId || null };
        if (form.password.trim()) payload.password = form.password;
        await userService.updateUser(editingUser._id, payload);
        Toast.show({ type: 'success', text1: 'Team member updated' });
      } else {
        await userService.createUser({
          name: form.name, email: form.email, phone: form.phone,
          role: form.role, password: form.password, managerId: form.managerId || null,
        });
        Toast.show({ type: 'success', text1: 'Team member invited' });
      }
      closeModal();
      fetchUsers();
    } catch (error) {
      Toast.show({ type: 'error', text1: error.response?.data?.message || 'Unable to save user' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (user) => {
    Alert.alert(
      'Delete member?',
      `${user.name} will be permanently removed from the team. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await userService.deleteUser(user._id);
              Toast.show({ type: 'success', text1: 'Team member deleted' });
              fetchUsers();
            } catch (error) {
              Toast.show({ type: 'error', text1: error.response?.data?.message || 'Unable to delete user' });
            }
          },
        },
      ]
    );
  };

  const isSelf = (user) => currentUser?._id === user._id;

  const filterLabel =
    selectedManagerFilter === 'all'
      ? 'All Members'
      : selectedManagerFilter === 'unassigned'
      ? 'Unassigned'
      : managers.find((m) => m._id === selectedManagerFilter)?.name || 'All Members';

  const tabIconColor = (tab) =>
    activeTab === tab ? '#2563EB' : isDark ? '#9CA3AF' : '#6B7280';

  // ── Settings loading skeleton ─────────────────────────────────────────────
  if (settingsLoading && !settings) {
    return (
      <View style={[styles.container, s.bg]}>
        <View style={styles.skeletonHeader} />
        {[1, 2, 3].map((i) => (
          <View key={i} style={[styles.skeletonCard, s.card]} />
        ))}
      </View>
    );
  }

  // ── Access denied ─────────────────────────────────────────────────────────
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

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={[styles.header, s.headerBorder]}>
        <View>
          <Text style={[styles.headerTitle, s.textPrimary]}>Team</Text>
          <Text style={[styles.headerSub, s.textMuted]}>Manage your CRM users and roles.</Text>
        </View>
        {canManage && (
          <TouchableOpacity style={styles.inviteBtn} onPress={openCreateModal}>
            <View style={styles.inviteBtnInner}>
              <Icon name="user-plus" size={14} color="#fff" />
              <Text style={styles.inviteBtnText}>Invite</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Tab Toggle ─────────────────────────────────────────────────── */}
      <View style={[styles.tabRow, s.tabBg]}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'list' && s.tabActive]}
          onPress={() => setActiveTab('list')}
        >
          <View style={styles.tabBtnInner}>
            <Icon name="users" size={14} color={tabIconColor('list')} />
            <Text style={[styles.tabBtnText, activeTab === 'list' ? styles.tabBtnTextActive : s.textMuted]}>
              List View
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'map' && s.tabActive]}
          onPress={() => setActiveTab('map')}
        >
          <View style={styles.tabBtnInner}>
            <Icon name="map" size={14} color={tabIconColor('map')} />
            <Text style={[styles.tabBtnText, activeTab === 'map' ? styles.tabBtnTextActive : s.textMuted]}>
              Map View
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ── Map Tab ────────────────────────────────────────────────────── */}
      {activeTab === 'map' ? (
        <AgentMap />
      ) : (
        <>
          {/* ── Filter Row ───────────────────────────────────────────── */}
          <View style={[styles.filterRow, s.filterBorder]}>
            <Text style={[styles.filterLabel, s.textSecondary]}>Filter:</Text>
            <TouchableOpacity
              style={[styles.filterBtn, s.inputBg, s.inputBorder]}
              onPress={() => setFilterPickerVisible(true)}
            >
              <Text style={[styles.filterBtnText, s.textPrimary]} numberOfLines={1}>
                {filterLabel}
              </Text>
              <Icon name="chevron-right" size={16} color={isDark ? '#9CA3AF' : '#6B7280'} />
            </TouchableOpacity>
          </View>

          {/* ── User List ────────────────────────────────────────────── */}
          {loading ? (
            <FlatList
              data={[1, 2, 3, 4]}
              keyExtractor={(i) => String(i)}
              contentContainerStyle={styles.listContent}
              renderItem={() => (
                <View style={[styles.skeletonCard, s.card]} />
              )}
            />
          ) : filteredUsers.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, s.textMuted]}>
                No team members found{selectedManagerFilter !== 'all' ? ' for this manager' : ''}.
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredUsers}
              keyExtractor={(item) => item._id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              renderItem={({ item, index }) => (
                <UserCard
                  user={item}
                  index={index}
                  canManage={canManage}
                  isSelf={isSelf(item)}
                  onEdit={openEditModal}
                  onDelete={handleDelete}
                  getManagerName={getManagerName}
                  isDark={isDark}
                />
              )}
            />
          )}
        </>
      )}

      {/* ── Pickers ─────────────────────────────────────────────────────── */}
      <FilterPicker
        visible={filterPickerVisible}
        value={selectedManagerFilter}
        onChange={setSelectedManagerFilter}
        onClose={() => setFilterPickerVisible(false)}
        managers={managers}
        isDark={isDark}
      />

      {/* ── Create / Edit Modal ─────────────────────────────────────────── */}
      <Modal visible={modalOpen} animationType="fade" transparent onRequestClose={closeModal}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeModal}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
             {/* backdrop handled by modalOverlay TouchableOpacity wrapper */}
          <View style={[styles.modalSheet, s.card]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, s.textPrimary]}>
                  {editingUser ? 'Edit team member' : 'Invite team member'}
                </Text>
                <Text style={[styles.modalSubtitle, s.textMuted]}>
                  {editingUser
                    ? 'Update name, phone, role, or password.'
                    : 'Create a new user and invite them to the CRM.'}
                </Text>
              </View>
              <TouchableOpacity style={[styles.closeBtn, s.closeBtnBg]} onPress={closeModal}>
                <Icon name="x" size={16} color={isDark ? '#D1D5DB' : '#374151'} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 16 }}>
              {/* Name */}
              <View style={styles.formField}>
                <Text style={[styles.formLabel, s.textSecondary]}>Full name</Text>
                <TextInput
                  style={[styles.input, s.input]}
                  value={form.name}
                  onChangeText={(v) => setForm((p) => ({ ...p, name: v }))}
                  placeholder="Enter full name"
                  placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                />
              </View>

              {/* Email */}
              <View style={styles.formField}>
                <Text style={[styles.formLabel, s.textSecondary]}>Email address</Text>
                <TextInput
                  style={[styles.input, s.input, editingUser && styles.inputDisabled]}
                  value={form.email}
                  onChangeText={(v) => setForm((p) => ({ ...p, email: v }))}
                  placeholder="Enter email"
                  placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!editingUser}
                />
              </View>

              {/* Phone */}
              <View style={styles.formField}>
                <Text style={[styles.formLabel, s.textSecondary]}>Phone</Text>
                <TextInput
                  style={[styles.input, s.input]}
                  value={form.phone}
                  onChangeText={(v) => setForm((p) => ({ ...p, phone: v }))}
                  placeholder="Enter phone number"
                  placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                  keyboardType="phone-pad"
                />
              </View>

              {/* Role */}
              <View style={styles.formField}>
                <Text style={[styles.formLabel, s.textSecondary]}>Role</Text>
                <TouchableOpacity
                  style={[styles.input, s.input, styles.pickerTrigger]}
                  onPress={() => setRolePickerVisible(true)}
                >
                  <Text style={s.textPrimary}>{ROLE_LABELS[form.role]}</Text>
                  <Icon name="chevron-right" size={16} color={isDark ? '#9CA3AF' : '#6B7280'} />
                </TouchableOpacity>
              </View>

              {/* Manager */}
              {!['admin', 'manager'].includes(form.role) && (
                <View style={styles.formField}>
                  <Text style={[styles.formLabel, s.textSecondary]}>Assign Manager</Text>
                  <TouchableOpacity
                    style={[styles.input, s.input, styles.pickerTrigger]}
                    onPress={() => setManagerPickerVisible(true)}
                  >
                    <Text style={s.textPrimary}>
                      {form.managerId
                        ? managers.find((m) => m._id === form.managerId)?.name || 'No Manager'
                        : 'No Manager'}
                    </Text>
                    <Icon name="chevron-right" size={16} color={isDark ? '#9CA3AF' : '#6B7280'} />
                  </TouchableOpacity>
                </View>
              )}

              {/* Password */}
              <View style={styles.formField}>
                <Text style={[styles.formLabel, s.textSecondary]}>
                  {editingUser ? 'Change Password' : 'Password'}
                </Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    style={[styles.input, s.input, { flex: 1 }]}
                    value={form.password}
                    onChangeText={(v) => setForm((p) => ({ ...p, password: v }))}
                    placeholder={editingUser ? 'Leave blank to keep current' : 'Choose a password'}
                    placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={[styles.eyeBtn, s.inputBg]}
                    onPress={() => setShowPassword((p) => !p)}
                  >
                    <Icon
                      name={showPassword ? 'eye-off' : 'eye'}
                      size={18}
                      color={isDark ? '#9CA3AF' : '#6B7280'}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={{ height: 24 }} />
            </ScrollView>

            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity style={[styles.cancelBtn, s.cancelBtn]} onPress={closeModal}>
                <Text style={[styles.cancelBtnText, s.textSecondary]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.saveBtnText}>
                      {editingUser ? 'Update member' : 'Invite member'}
                    </Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </TouchableOpacity>
      </Modal>

      {/* Role / Manager pickers inside modal */}
      <RolePicker
        visible={rolePickerVisible}
        value={form.role}
        onChange={(v) => setForm((p) => ({ ...p, role: v }))}
        onClose={() => setRolePickerVisible(false)}
        isDark={isDark}
      />
      <ManagerPicker
        visible={managerPickerVisible}
        value={form.managerId}
        onChange={(v) => setForm((p) => ({ ...p, managerId: v }))}
        onClose={() => setManagerPickerVisible(false)}
        managers={managers}
        isDark={isDark}
      />
    </View>
  );
};

// ─── Base Styles ──────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  headerSub: { fontSize: 13, marginTop: 2 },
  inviteBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  inviteBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inviteBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 12,
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabBtnText: { fontSize: 13, fontWeight: '500' },
  tabBtnTextActive: { color: '#2563EB', fontWeight: '600' },

  // Filter row
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
    borderBottomWidth: 1,
  },
  filterLabel: { fontSize: 13, fontWeight: '500' },
  filterBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  filterBtnText: { fontSize: 13, flex: 1 },

  // List
  listContent: { padding: 16, gap: 10, paddingBottom: 32 },

  // Card
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 0,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardActions: { position: 'absolute', top: 12, right: 12, flexDirection: 'row', gap: 4, zIndex: 1 },
  cardActionBtn: { padding: 7, borderRadius: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingRight: 72 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { fontSize: 17, fontWeight: '600' },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#4ADE80',
    borderWidth: 2,
    borderColor: '#fff',
  },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 14, fontWeight: '600' },
  cardEmail: { fontSize: 12, marginTop: 1 },
  badge: { alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '500' },
  divider: { height: 1, marginVertical: 12 },
  cardMeta: { gap: 5 },
  cardMetaText: { fontSize: 12 },
  cardMetaLabel: { fontWeight: '500' },

  // Skeleton
  skeletonHeader: { height: 60, backgroundColor: '#E5E7EB', borderRadius: 12, margin: 16 },
  skeletonCard: { height: 130, borderRadius: 16, margin: 16, backgroundColor: '#E5E7EB' },

  // Access Denied
  accessDeniedBox: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
    borderRadius: 16,
    padding: 24,
    margin: 24,
  },
  accessDeniedTitle: { fontSize: 18, fontWeight: '700', color: '#B91C1C' },
  accessDeniedText: { fontSize: 13, color: '#DC2626', marginTop: 6 },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 16 },
modalSheet: {
    borderRadius: 24,
    padding: 20,
    maxHeight: SCREEN_HEIGHT * 0.85,
    borderWidth: 1,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  modalSubtitle: { fontSize: 13, marginTop: 3 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  modalFooter: { flexDirection: 'row', gap: 10, paddingTop: 12 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  cancelBtnText: { fontWeight: '500', fontSize: 14 },
  saveBtn: {
    flex: 1,
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  // Form
  formField: { marginBottom: 14 },
  formLabel: { fontSize: 13, fontWeight: '500', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  inputDisabled: { opacity: 0.5 },
  pickerTrigger: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  passwordRow: { flexDirection: 'row', gap: 8 },
  eyeBtn: { width: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

  // Picker Sheet
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', paddingHorizontal: 16 },
  pickerSheet: { borderRadius: 16, padding: 16, borderWidth: 1 },
  pickerTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  pickerOptionActive: { backgroundColor: 'rgba(37,99,235,0.05)', borderRadius: 10, paddingHorizontal: 8 },
  pickerOptionText: { fontSize: 14 },
  pickerOptionTextActive: { color: '#2563EB', fontWeight: '600' },

  // Empty
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { fontSize: 14, textAlign: 'center' },
});

// ─── Theme tokens ─────────────────────────────────────────────────────────────
const light = StyleSheet.create({
  bg: { backgroundColor: '#F9FAFB' },
  card: { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' },
  textPrimary: { color: '#111827' },
  textSecondary: { color: '#374151' },
  textMuted: { color: '#6B7280' },
  divider: { backgroundColor: '#E5E7EB' },
  headerBorder: { borderBottomColor: '#E5E7EB' },
  tabBg: { backgroundColor: '#F3F4F6' },
  tabActive: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 1 },
  filterBorder: { borderBottomColor: '#E5E7EB' },
  inputBg: { backgroundColor: '#F9FAFB' },
  inputBorder: { borderColor: '#D1D5DB' },
  input: { backgroundColor: '#F9FAFB', borderColor: '#D1D5DB', color: '#111827' },
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
  filterBorder: { borderBottomColor: '#1E293B' },
  inputBg: { backgroundColor: '#1E293B' },
  inputBorder: { borderColor: '#334155' },
  input: { backgroundColor: '#1E293B', borderColor: '#334155', color: '#F9FAFB' },
  cancelBtn: { borderColor: '#334155', backgroundColor: '#1E293B' },
  closeBtnBg: { backgroundColor: '#334155' },
  cardActionBtnBg: { backgroundColor: '#334155' },
});

export default TeamScreen;