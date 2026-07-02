import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useTheme } from '../../contexts/ThemeContext';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/Feather';
import { userService } from '../../services/userService';
// Agar aapke paas logout action hai redux slice mein, uska sahi path daalo:
// import { logout } from '../../store/slices/authSlice';

const ROLE_LABELS = {
  admin: 'Administrator',
  manager: 'Manager',
  tl: 'Team Lead',
  exec: 'Executive',
  viewer: 'Viewer',
};

const ROLE_COLORS = {
  admin: { bg: '#FEF3C7', text: '#92400E' },
  manager: { bg: '#DBEAFE', text: '#1D4ED8' },
  tl: { bg: '#F3E8FF', text: '#7C3AED' },
  exec: { bg: '#DCFCE7', text: '#16A34A' },
  viewer: { bg: '#F3F4F6', text: '#374151' },
};

const getInitials = (name = '') =>
  name
    .split(' ')
    .map((p) => p[0]?.toUpperCase())
    .slice(0, 2)
    .join('');

const InfoRow = ({ icon, label, value, s, isDark }) => (
  <View style={[styles.infoRow, s.divider]}>
    <View style={[styles.infoIconWrap, s.infoIconBg]}>
      <Icon name={icon} size={15} color={isDark ? '#9CA3AF' : '#6B7280'} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={[styles.infoLabel, s.textMuted]}>{label}</Text>
      <Text style={[styles.infoValue, s.textPrimary]} numberOfLines={1}>
        {value || '—'}
      </Text>
    </View>
  </View>
);

const ProfileScreen = () => {
  const { isDark, toggleTheme } = useTheme();
  const s = isDark ? dark : light;
  const dispatch = useDispatch();

  const currentUser = useSelector((state) => state.auth.user);
  const roleColor = ROLE_COLORS[currentUser?.role] || ROLE_COLORS.viewer;

  // ── Edit modal state ──
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [form, setForm] = useState({
    name: currentUser?.name || '',
    phone: currentUser?.phone || '',
    password: '',
  });

  const openEditModal = () => {
    setForm({
      name: currentUser?.name || '',
      phone: currentUser?.phone || '',
      password: '',
    });
    setShowPassword(false);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      Toast.show({ type: 'error', text1: 'Name is required' });
      return;
    }
    try {
      setSaving(true);
      const payload = { name: form.name, phone: form.phone };
      if (form.password.trim()) payload.password = form.password;

      const updated = await userService.updateUser(currentUser._id, payload);

      // Agar redux mein user update karne ka action hai to yahan dispatch karo:
      // dispatch(updateCurrentUser(updated?.data || payload));

      Toast.show({ type: 'success', text1: 'Profile updated successfully' });
      setModalOpen(false);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: error.response?.data?.message || 'Unable to update profile',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    // dispatch(logout());
    Toast.show({ type: 'info', text1: 'Logout action call karo yahan' });
  };

  return (
    <ScrollView style={[styles.container, s.bg]} showsVerticalScrollIndicator={false}>
      {/* ── Header / Avatar Card ── */}
      <View style={[styles.headerCard, s.card, styles.sectionShadow]}>
        <View style={styles.avatarWrap}>
          <View style={[styles.avatar, { backgroundColor: '#DBEAFE' }]}>
            <Text style={[styles.avatarText, { color: '#2563EB' }]}>
              {getInitials(currentUser?.name)}
            </Text>
          </View>
          <TouchableOpacity style={styles.editAvatarBtn} onPress={openEditModal}>
            <Icon name="edit-2" size={12} color="#fff" />
          </TouchableOpacity>
        </View>

        <Text style={[styles.userName, s.textPrimary]}>{currentUser?.name}</Text>
        <Text style={[styles.userEmail, s.textMuted]}>{currentUser?.email}</Text>

        <View style={[styles.roleBadge, { backgroundColor: roleColor.bg }]}>
          <Text style={[styles.roleBadgeText, { color: roleColor.text }]}>
            {ROLE_LABELS[currentUser?.role] || currentUser?.role}
          </Text>
        </View>

        <TouchableOpacity style={styles.editProfileBtn} onPress={openEditModal}>
          <Icon name="edit-2" size={14} color="#2563EB" />
          <Text style={styles.editProfileBtnText}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      {/* ── Info Section ── */}
      <View style={[styles.section, s.card, styles.sectionShadow]}>
        <Text style={[styles.sectionTitle, s.textSecondary]}>ACCOUNT INFO</Text>
        <InfoRow icon="mail" label="Email" value={currentUser?.email} s={s} isDark={isDark} />
        <InfoRow icon="phone" label="Phone" value={currentUser?.phone} s={s} isDark={isDark} />
        <InfoRow
          icon="shield"
          label="Role"
          value={ROLE_LABELS[currentUser?.role] || currentUser?.role}
          s={s}
          isDark={isDark}
        />
      </View>

      {/* ── Preferences Section ── */}
      <View style={[styles.section, s.card, styles.sectionShadow]}>
        <Text style={[styles.sectionTitle, s.textSecondary]}>PREFERENCES</Text>

        <TouchableOpacity style={[styles.actionRow, s.divider]} onPress={toggleTheme} activeOpacity={0.7}>
          <View style={[styles.infoIconWrap, { backgroundColor: isDark ? 'rgba(167,139,250,0.15)' : '#F3E8FF' }]}>
            <Icon name={isDark ? 'moon' : 'sun'} size={16} color={isDark ? '#A78BFA' : '#7C3AED'} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.actionRowText, s.textPrimary]}>{isDark ? 'Dark Mode' : 'Light Mode'}</Text>
            <Text style={[styles.actionRowSub, s.textMuted]}>
              {isDark ? 'Easier on the eyes at night' : 'Switch to dark theme'}
            </Text>
          </View>
          <View style={[styles.toggleTrack, isDark && styles.toggleTrackActive]}>
            <View style={[styles.toggleThumb, isDark && styles.toggleThumbActive]} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionRow, { borderBottomWidth: 0 }]}
          onPress={() => setNotificationsEnabled((p) => !p)}
          activeOpacity={0.7}
        >
          <View style={[styles.infoIconWrap, { backgroundColor: isDark ? 'rgba(96,165,250,0.15)' : '#DBEAFE' }]}>
            <Icon name="bell" size={16} color={isDark ? '#60A5FA' : '#2563EB'} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.actionRowText, s.textPrimary]}>Notifications</Text>
            <Text style={[styles.actionRowSub, s.textMuted]}>
              {notificationsEnabled ? 'You will receive push alerts' : 'Push alerts are muted'}
            </Text>
          </View>
          <View style={[styles.toggleTrack, notificationsEnabled && styles.toggleTrackActive]}>
            <View style={[styles.toggleThumb, notificationsEnabled && styles.toggleThumbActive]} />
          </View>
        </TouchableOpacity>
      </View>

      {/* ── Logout ── */}
      <TouchableOpacity style={[styles.logoutBtn, s.card, styles.sectionShadow]} onPress={handleLogout} activeOpacity={0.7}>
        <Icon name="log-out" size={16} color="#EF4444" />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <View style={{ height: 32 }} />

      {/* ── Edit Profile Modal ── */}
      <Modal visible={modalOpen} animationType="fade" transparent onRequestClose={() => setModalOpen(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalOpen(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={[styles.modalSheet, s.card]}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalTitle, s.textPrimary]}>Edit Profile</Text>
                  <Text style={[styles.modalSubtitle, s.textMuted]}>
                    Update your name, phone, or password.
                  </Text>
                </View>
                <TouchableOpacity style={[styles.closeBtn, s.closeBtnBg]} onPress={() => setModalOpen(false)}>
                  <Icon name="x" size={16} color={isDark ? '#D1D5DB' : '#374151'} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 16 }}>
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

                <View style={styles.formField}>
                  <Text style={[styles.formLabel, s.textSecondary]}>Email address</Text>
                  <TextInput
                    style={[styles.input, s.input, styles.inputDisabled]}
                    value={currentUser?.email}
                    editable={false}
                  />
                </View>

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

                <View style={styles.formField}>
                  <Text style={[styles.formLabel, s.textSecondary]}>Change Password</Text>
                  <View style={styles.passwordRow}>
                    <TextInput
                      style={[styles.input, s.input, { flex: 1 }]}
                      value={form.password}
                      onChangeText={(v) => setForm((p) => ({ ...p, password: v }))}
                      placeholder="Leave blank to keep current"
                      placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity style={[styles.eyeBtn, s.inputBg]} onPress={() => setShowPassword((p) => !p)}>
                      <Icon name={showPassword ? 'eye-off' : 'eye'} size={18} color={isDark ? '#9CA3AF' : '#6B7280'} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={{ height: 24 }} />
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity style={[styles.cancelBtn, s.cancelBtn]} onPress={() => setModalOpen(false)}>
                  <Text style={[styles.cancelBtnText, s.textSecondary]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.saveBtnText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },

  headerCard: {
    margin: 16,
    borderRadius: 18,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
  },
  avatarWrap: { position: 'relative', marginBottom: 12 },
  avatar: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 28, fontWeight: '700' },
  editAvatarBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  userName: { fontSize: 19, fontWeight: '700' },
  userEmail: { fontSize: 13, marginTop: 2 },
  roleBadge: { marginTop: 10, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  roleBadgeText: { fontSize: 12, fontWeight: '600' },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  editProfileBtnText: { color: '#2563EB', fontWeight: '600', fontSize: 13 },

  section: { marginHorizontal: 16, marginBottom: 16, borderRadius: 16, borderWidth: 1, padding: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 },

  sectionShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  infoIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { fontSize: 11 },
  infoValue: { fontSize: 14, fontWeight: '500', marginTop: 1 },

  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  actionRowText: { fontSize: 14, fontWeight: '500' },
  actionRowSub: { fontSize: 11, marginTop: 2 },

  toggleTrack: {
    width: 42,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#D1D5DB',
    padding: 2,
    justifyContent: 'center',
  },
  toggleTrackActive: { backgroundColor: '#2563EB' },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
  },
  toggleThumbActive: { alignSelf: 'flex-end' },

  logoutBtn: {
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logoutText: { color: '#EF4444', fontWeight: '600', fontSize: 14 },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 16 },
  modalSheet: { borderRadius: 24, padding: 20, maxHeight: '85%', borderWidth: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  modalSubtitle: { fontSize: 13, marginTop: 3 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  modalFooter: { flexDirection: 'row', gap: 10, paddingTop: 12 },
  cancelBtn: { flex: 1, borderWidth: 1, borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  cancelBtnText: { fontWeight: '500', fontSize: 14 },
  saveBtn: { flex: 1, backgroundColor: '#2563EB', borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  formField: { marginBottom: 14 },
  formLabel: { fontSize: 13, fontWeight: '500', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  inputDisabled: { opacity: 0.5 },
  passwordRow: { flexDirection: 'row', gap: 8 },
  eyeBtn: { width: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});

const light = StyleSheet.create({
  bg: { backgroundColor: '#F9FAFB' },
  card: { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' },
  textPrimary: { color: '#111827' },
  textSecondary: { color: '#374151' },
  textMuted: { color: '#6B7280' },
  divider: { borderBottomColor: '#E5E7EB' },
  inputBg: { backgroundColor: '#F9FAFB' },
  infoIconBg: { backgroundColor: '#F9FAFB' },
  input: { backgroundColor: '#F9FAFB', borderColor: '#D1D5DB', color: '#111827' },
  cancelBtn: { borderColor: '#D1D5DB', backgroundColor: '#FFFFFF' },
  closeBtnBg: { backgroundColor: '#F3F4F6' },
});

const dark = StyleSheet.create({
  bg: { backgroundColor: '#0F172A' },
  card: { backgroundColor: '#1E293B', borderColor: '#334155' },
  textPrimary: { color: '#F9FAFB' },
  textSecondary: { color: '#D1D5DB' },
  textMuted: { color: '#9CA3AF' },
  divider: { borderBottomColor: '#334155' },
  inputBg: { backgroundColor: '#1E293B' },
  infoIconBg: { backgroundColor: '#1E293B' },
  input: { backgroundColor: '#1E293B', borderColor: '#334155', color: '#F9FAFB' },
  cancelBtn: { borderColor: '#334155', backgroundColor: '#1E293B' },
  closeBtnBg: { backgroundColor: '#334155' },
});

export default ProfileScreen;