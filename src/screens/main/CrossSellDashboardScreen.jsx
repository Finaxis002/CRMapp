import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Modal, TextInput, Alert, RefreshControl,
  Dimensions,
} from 'react-native';
import { useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/Feather';
import api from '../../services/api';
import { userService } from '../../services/userService';
import { useTheme } from '../../contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CrossSellTab from '../../components/common/Crossselltab';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/* ══════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════ */
const SERVICE_META = {
  MSME:                { bg: '#E6F1FB', color: '#185FA5', icon: 'trending-up' },
  'GST Registration':  { bg: '#EAF3DE', color: '#3B6D11', icon: 'file-text' },
  'GST Return':        { bg: '#FAEEDA', color: '#854F0B', icon: 'bar-chart-2' },
  'Income Tax Return': { bg: '#EEEDFE', color: '#534AB7', icon: 'briefcase' },
  'Income Tax Audit':  { bg: '#FCEBEB', color: '#A32D2D', icon: 'search' },
  'Project Report':    { bg: '#FAEEDA', color: '#854F0B', icon: 'layers' },
  'Subsidy Services':  { bg: '#E1F5EE', color: '#0F6E56', icon: 'dollar-sign' },
  'Trade Mark':        { bg: '#FBEAF0', color: '#993556', icon: 'tag' },
  'IEC Code':          { bg: '#E6F1FB', color: '#185FA5', icon: 'globe' },
};

const getSvcMeta = (svc) =>
  SERVICE_META[svc] || { bg: '#F1EFE8', color: '#5F5E5A', icon: 'package' };

const STATUS_COLOR = {
  Interested:       { bg: 'rgba(5,150,105,0.12)',  color: '#059669' },
  Converted:        { bg: 'rgba(217,119,6,0.12)',  color: '#d97706' },
  'Not Interested': { bg: 'rgba(220,38,38,0.12)',  color: '#dc2626' },
  Pending:          { bg: 'rgba(107,114,128,0.12)', color: '#6b7280' },
};

/* ══════════════════════════════════════════════
   THEME TOKENS
══════════════════════════════════════════════ */
const getT = (isDark) => ({
  bg:           isDark ? '#0F172A' : '#f9fafb',
  card:         isDark ? '#1E293B' : '#ffffff',
  cardBorder:   isDark ? '#334155' : '#e5e7eb',
  textPrimary:  isDark ? '#F9FAFB' : '#111827',
  textSecondary:isDark ? '#D1D5DB' : '#374151',
  textMuted:    isDark ? '#9CA3AF' : '#6b7280',
  inputBg:      isDark ? '#1E293B' : '#f9fafb',
  inputBorder:  isDark ? '#334155' : '#e5e7eb',
  divider:      isDark ? '#334155' : '#f3f4f6',
  headerBg:     isDark ? '#1E293B' : '#ffffff',
  tabBarBg:     isDark ? '#1E293B' : '#ffffff',
  chipBg:       isDark ? '#0F172A' : '#f9fafb',
  skeletonBg:   isDark ? '#334155' : '#e5e7eb',
  filterBg:     isDark ? '#1E293B' : '#ffffff',
  pickerBg:     isDark ? '#1E293B' : '#ffffff',
  modalBg:      isDark ? '#1E293B' : '#ffffff',
  infoBg:       isDark ? 'rgba(37,99,235,0.15)' : 'rgba(37,99,235,0.07)',
  infoBorder:   isDark ? 'rgba(37,99,235,0.3)'  : 'rgba(37,99,235,0.15)',
  svcRowBg:     isDark ? '#0F172A' : '#f9fafb',
  barTrack:     isDark ? '#334155' : '#f3f4f6',
  convRateBg:   isDark ? 'rgba(5,150,105,0.12)' : 'rgba(5,150,105,0.06)',
  convRateBdr:  isDark ? 'rgba(5,150,105,0.25)' : 'rgba(5,150,105,0.15)',
  statCardBg:   isDark ? '#1E293B' : '#ffffff',
  drawerBg:     isDark ? '#1E293B' : '#ffffff',
});

/* ══════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════ */
const SectionLabel = ({ iconName, children, t }) => (
  <View style={sh.sectionLabel}>
    <Icon name={iconName} size={12} color={t.textMuted} />
    <Text style={[sh.sectionLabelText, { color: t.textMuted }]}>{children}</Text>
  </View>
);

const Spinner = () => (
  <View style={sh.spinnerBox}>
    <ActivityIndicator size="large" color="#2563eb" />
  </View>
);

/* ══════════════════════════════════════════════
   STAT CARD
══════════════════════════════════════════════ */
const StatCard = ({ iconName, label, value, color, t }) => (
  <View style={[sh.statCard, { borderLeftColor: color, backgroundColor: t.statCardBg, borderColor: t.cardBorder }]}>
    <View style={{ flex: 1 }}>
      <Text style={[sh.statLabel, { color: t.textMuted }]}>{label}</Text>
      <Text style={[sh.statValue, { color: t.textPrimary }]}>{value}</Text>
    </View>
    <View style={[sh.statIcon, { backgroundColor: color + '18' }]}>
      <Icon name={iconName} size={18} color={color} />
    </View>
  </View>
);

/* ══════════════════════════════════════════════
   BAR ROW
══════════════════════════════════════════════ */
const BarRow = ({ label, count, max, color, iconName, t }) => {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <View style={sh.barRow}>
      <Icon name={iconName} size={14} color={t.textMuted} />
      <View style={{ flex: 1 }}>
        <View style={sh.barRowTop}>
          <Text style={[sh.barRowLabel, { color: t.textSecondary }]} numberOfLines={1}>{label}</Text>
          <View style={[sh.badge, { backgroundColor: color + '18', borderColor: color + '40' }]}>
            <Text style={[sh.badgeText, { color }]}>{count}</Text>
          </View>
        </View>
        <View style={[sh.barTrack, { backgroundColor: t.barTrack }]}>
          <View style={[sh.barFill, { width: pct + '%', backgroundColor: color }]} />
        </View>
      </View>
    </View>
  );
};

/* ══════════════════════════════════════════════
   USER PICKER MODAL
══════════════════════════════════════════════ */
const UserPickerModal = ({ visible, users, selectedId, onSelect, onClose, t }) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <TouchableOpacity style={sh.pickerOverlay} activeOpacity={1} onPress={onClose}>
      <View style={[sh.pickerBox, { backgroundColor: t.pickerBg, borderColor: t.cardBorder, borderWidth: 1 }]}>
        <Text style={[sh.pickerTitle, { color: t.textPrimary }]}>Filter by User</Text>
        <ScrollView showsVerticalScrollIndicator={false}>
          <TouchableOpacity
            style={[sh.pickerOption, { borderColor: t.divider }, selectedId === 'all' && sh.pickerOptionActive]}
            onPress={() => { onSelect('all'); onClose(); }}
          >
            <Text style={[sh.pickerOptionText, { color: t.textSecondary }, selectedId === 'all' && sh.pickerOptionTextActive]}>All Users</Text>
            {selectedId === 'all' && <Icon name="check" size={14} color="#2563eb" />}
          </TouchableOpacity>
          {users.map(u => (
            <TouchableOpacity
              key={u._id}
              style={[sh.pickerOption, { borderColor: t.divider }, selectedId === u._id && sh.pickerOptionActive]}
              onPress={() => { onSelect(u._id); onClose(); }}
            >
              <Text style={[sh.pickerOptionText, { color: t.textSecondary }, selectedId === u._id && sh.pickerOptionTextActive]}>{u.name}</Text>
              {selectedId === u._id && <Icon name="check" size={14} color="#2563eb" />}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </TouchableOpacity>
  </Modal>
);

/* ══════════════════════════════════════════════
   RULE MODAL
══════════════════════════════════════════════ */
const RuleModal = ({ visible, rule, onClose, onSave, t }) => {
  const [triggerService, setTriggerService] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTriggerService(rule?.triggerService || '');
  }, [rule, visible]);

  const handleSave = async () => {
    if (!triggerService.trim()) { Alert.alert('Service name required'); return; }
    setSaving(true);
    try {
      const payload = { triggerService: triggerService.trim(), recommendations: [] };
      if (rule?._id) await api.put(`/cross-sell/rules/${rule._id}`, payload);
      else await api.post('/cross-sell/rules', payload);
      Alert.alert('Success', rule?._id ? 'Service updated!' : 'Service created!');
      onSave();
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={sh.modalOverlay}>
        <View style={[sh.modalBox, { maxHeight: 300, backgroundColor: t.modalBg }]}>
          <View style={[sh.modalHeader, { borderColor: t.divider }]}>
            <Text style={[sh.modalTitle, { color: t.textPrimary }]}>{rule?._id ? 'Edit Rule' : 'Add New Service Rule'}</Text>
            <TouchableOpacity onPress={onClose} style={sh.closeBtn}>
              <Icon name="x" size={18} color={t.textMuted} />
            </TouchableOpacity>
          </View>
          <View style={{ padding: 16 }}>
            <Text style={[sh.inputLabel, { color: t.textSecondary }]}>Trigger Service (Lead Product Field)</Text>
            <TextInput
              style={[sh.input, { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.textPrimary }]}
              value={triggerService}
              onChangeText={setTriggerService}
              placeholder="e.g. MSME, GST Registration..."
              placeholderTextColor={t.textMuted}
            />
            {rule?._id && (
              <Text style={{ fontSize: 11, color: t.textMuted, marginTop: 6 }}>
                Trigger service cannot be changed after creation.
              </Text>
            )}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <TouchableOpacity style={[sh.btnSecondary, { flex: 1, borderColor: t.cardBorder }]} onPress={onClose}>
                <Text style={[sh.btnSecondaryText, { color: t.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[sh.btnPrimary, { flex: 1 }, saving && sh.btnDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={sh.btnPrimaryText}>Save Rule</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

/* ══════════════════════════════════════════════
   ANALYTICS TAB
══════════════════════════════════════════════ */
const AnalyticsTab = ({ currentUserId, isAdmin, isTL, isManager, t }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('all');
  const [showUserPicker, setShowUserPicker] = useState(false);

  useEffect(() => {
    if (!isAdmin && !isTL && !isManager) return;
    userService.getAllUsers().then(r => setUsers(Array.isArray(r) ? r : [])).catch(() => {});
  }, [isAdmin, isTL, isManager]);

  const load = useCallback(async (uid = selectedUserId) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (!isAdmin && !isTL && !isManager && currentUserId) params.append('userId', currentUserId);
      else if ((isAdmin || isTL || isManager) && uid !== 'all') params.append('userId', uid);
      const q = params.toString() ? '?' + params.toString() : '';
      const res = await api.get('/cross-sell/dashboard' + q);
      setData(res.data?.data || null);
    } catch { Alert.alert('Error', 'Dashboard load failed'); }
    finally { setLoading(false); }
  }, [selectedUserId, isAdmin, isTL, isManager, currentUserId]);

  useEffect(() => { load(selectedUserId); }, [selectedUserId]);

  if (loading) return <Spinner />;
  if (!data) return null;

  const statusMap = {};
  (data.statusBreakdown || []).forEach(s => { statusMap[s._id] = s.count; });
  const interestedCount = (statusMap['Interested'] || 0) + (statusMap['Converted'] || 0);
  const notInterestedCount = statusMap['Not Interested'] || 0;
  const pendingCount = statusMap['Pending'] || 0;
  const convertedCount = statusMap['Converted'] || 0;
  const selectedUserName = users.find(u => u._id === selectedUserId)?.name || 'All Users';

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* User Filter */}
      {(isAdmin || isTL || isManager) && (
        <TouchableOpacity style={[sh.filterBtn, { backgroundColor: t.filterBg, borderColor: t.cardBorder }]} onPress={() => setShowUserPicker(true)}>
          <Icon name="users" size={13} color={t.textSecondary} />
          <Text style={[sh.filterBtnText, { color: t.textSecondary }]}>{selectedUserName}</Text>
          <Icon name="chevron-down" size={13} color={t.textMuted} />
        </TouchableOpacity>
      )}

      {/* Stat Cards */}
      <View style={sh.statGrid}>
        <StatCard iconName="users"        label="Leads Approached" value={data.totalLeadsWithCrossSell} color="#2563eb" t={t} />
        <StatCard iconName="file-text"    label="Recommendations"  value={data.totalRecommendations}    color="#7c3aed" t={t} />
        <StatCard iconName="check-circle" label="Interested"       value={interestedCount}               color="#059669" t={t} />
        <StatCard iconName="award"        label="Converted"        value={convertedCount}               color="#d97706" t={t} />
      </View>

      {/* Response Breakdown */}
      <View style={[sh.card, { backgroundColor: t.card, borderColor: t.cardBorder, marginBottom: 12 }]}>
        <SectionLabel iconName="bar-chart-2" t={t}>Response Breakdown</SectionLabel>
        <BarRow label="Interested / Converted" count={interestedCount}    max={data.totalRecommendations || 1} color="#059669" iconName="check-circle" t={t} />
        <BarRow label="Pending"                count={pendingCount}       max={data.totalRecommendations || 1} color="#d97706" iconName="clock"        t={t} />
        <BarRow label="Not Interested"         count={notInterestedCount} max={data.totalRecommendations || 1} color="#dc2626" iconName="x-circle"     t={t} />

        <View style={[sh.convRateBox, { backgroundColor: t.convRateBg, borderColor: t.convRateBdr }]}>
          <View style={sh.convRateCircle}>
            <Text style={[sh.convRatePct, { color: t.textPrimary }]}>{data.conversionRate}%</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[sh.convRateTitle, { color: t.textPrimary }]}>Conversion Rate</Text>
            <Text style={[sh.convRateSub, { color: t.textMuted }]}>{interestedCount} of {data.totalRecommendations} accepted</Text>
            <View style={[sh.badge, { backgroundColor: 'rgba(5,150,105,0.12)', borderColor: '#05966930', marginTop: 6, alignSelf: 'flex-start' }]}>
              <Text style={[sh.badgeText, { color: '#059669' }]}>{convertedCount} Converted</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Top Services */}
      <View style={[sh.card, { backgroundColor: t.card, borderColor: t.cardBorder, marginBottom: 12 }]}>
        <SectionLabel iconName="award" t={t}>Top Cross-Sold Services</SectionLabel>
        {data.topServices?.length > 0
          ? data.topServices.map((s) => {
              const meta = getSvcMeta(s._id);
              return (
                <View key={s._id} style={sh.topSvcRow}>
                  <View style={[sh.svcIconBox, { backgroundColor: meta.bg }]}>
                    <Icon name={meta.icon} size={15} color={meta.color} />
                  </View>
                  <Text style={[sh.topSvcName, { color: t.textPrimary }]}>{s._id}</Text>
                  <Text style={[sh.topSvcCount, { color: t.textPrimary }]}>
                    {s.count} <Text style={{ color: t.textMuted, fontWeight: '400' }}>sold</Text>
                  </Text>
                </View>
              );
            })
          : <Text style={[sh.emptyText, { color: t.textMuted }]}>No data yet</Text>
        }
      </View>

      {/* Conversion by Service */}
      {data.conversionByService?.length > 0 && (
        <View style={[sh.card, { backgroundColor: t.card, borderColor: t.cardBorder, marginBottom: 12 }]}>
          <SectionLabel iconName="trending-up" t={t}>Conversion by Original Service</SectionLabel>
          {data.conversionByService.map(row => {
            const rate = row.total > 0 ? ((row.interested / row.total) * 100).toFixed(0) : 0;
            const rColor = rate >= 50 ? '#059669' : rate >= 25 ? '#d97706' : '#dc2626';
            const meta = getSvcMeta(row._id);
            return (
              <View key={row._id} style={[sh.convRow, { borderColor: t.divider }]}>
                <View style={[sh.svcIconBox, { backgroundColor: meta.bg }]}>
                  <Icon name={meta.icon} size={13} color={meta.color} />
                </View>
                <Text style={[sh.convRowName, { color: t.textPrimary }]} numberOfLines={1}>{row._id || '—'}</Text>
                <Text style={[sh.convRowMuted, { color: t.textMuted }]}>{row.total} recs</Text>
                <View style={[sh.badge, { backgroundColor: rColor + '18', borderColor: rColor + '40' }]}>
                  <Text style={[sh.badgeText, { color: rColor }]}>{rate}%</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Recent Activity */}
      <View style={[sh.card, { backgroundColor: t.card, borderColor: t.cardBorder, marginBottom: 20 }]}>
        <SectionLabel iconName="clock" t={t}>Recent Activity</SectionLabel>
        {data.recentActivity?.length > 0
          ? data.recentActivity.map(rec => {
              const name = rec.leadId?.name || '?';
              const product = rec.leadId?.product || '—';
              const recCount = rec.recommendations?.length || 0;
              const intCount = rec.recommendations?.filter(r => r.status === 'Interested' || r.status === 'Converted').length || 0;
              return (
                <View key={rec._id} style={[sh.activityRow, { borderColor: t.divider }]}>
                  <View style={sh.avatar}>
                    <Text style={sh.avatarText}>{name[0].toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[sh.activityName, { color: t.textPrimary }]} numberOfLines={1}>{name}</Text>
                    <Text style={[sh.activitySub, { color: t.textMuted }]} numberOfLines={1}>{product}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[sh.activityCount, { color: t.textMuted }]}>{recCount} recs</Text>
                    {intCount > 0 && (
                      <View style={[sh.badge, { backgroundColor: 'rgba(5,150,105,0.12)', borderColor: '#05966930', marginTop: 3 }]}>
                        <Text style={[sh.badgeText, { color: '#059669' }]}>{intCount} interested</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          : <Text style={[sh.emptyText, { color: t.textMuted }]}>No recent activity</Text>
        }
      </View>

      <UserPickerModal
        visible={showUserPicker}
        users={users}
        selectedId={selectedUserId}
        onSelect={setSelectedUserId}
        onClose={() => setShowUserPicker(false)}
        t={t}
      />
    </ScrollView>
  );
};

/* ══════════════════════════════════════════════
   CROSS SELL DRAWER
══════════════════════════════════════════════ */
const CrossSellDrawer = ({ visible, lead, onClose, onSaved, t }) => {
  const insets = useSafeAreaInsets();
  return (
  <Modal
    visible={visible}
    animationType="slide"
    transparent
    onRequestClose={onClose}
  >
    <View style={{ flex: 1, flexDirection: 'row' }}>
      {/* Dark overlay */}
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
        activeOpacity={1}
        onPress={onClose}
      />

      {/* Drawer Panel */}
      <View style={[sh.drawerPanel, { backgroundColor: t.drawerBg, borderLeftColor: t.cardBorder, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* Header */}
        <View style={[sh.drawerHeader, { borderBottomColor: t.cardBorder }]}>
          <View style={{ flex: 1 }}>
            <Text style={[sh.drawerTitle, { color: t.textPrimary }]} numberOfLines={1}>
              {lead?.name || ''}
            </Text>
            <Text style={[sh.drawerSub, { color: t.textMuted }]} numberOfLines={1}>
              {lead?.product || '—'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={[sh.drawerCloseBtn, { borderColor: t.cardBorder }]}
          >
            <Icon name="x" size={14} color={t.textMuted} />
          </TouchableOpacity>
        </View>

        {/* CrossSellTab Content */}
        <ScrollView
          style={{ flex: 1, padding: 16 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {visible && lead && (
            <CrossSellTab
              lead={lead}
              onSaved={onSaved}
            />
          )}
        </ScrollView>
      </View>
    </View>
  </Modal>
  );
};

/* ══════════════════════════════════════════════
   LEADS OVERVIEW TAB
══════════════════════════════════════════════ */
const LeadsOverviewTab = ({ isAdmin, isTL, isManager, users, currentUserId, t }) => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [drawerLead, setDrawerLead] = useState(null);
  const [showUserPicker, setShowUserPicker] = useState(false);

  const load = async (p = 1, uid = selectedUserId, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', p);
      params.append('limit', 20);
      if (uid !== 'all') params.append('userId', uid);
      else if (!isAdmin && !isTL && !isManager && currentUserId) params.append('userId', currentUserId);
      const res = await api.get('/cross-sell/leads-overview?' + params.toString());
      setRecords(res.data?.data?.data || []);
      setPagination(res.data?.data?.pagination || { total: 0, totalPages: 1 });
    } catch { Alert.alert('Error', 'Leads load failed'); }
    finally { if (!silent) setLoading(false); }
  };

  useEffect(() => { load(1, selectedUserId); }, [selectedUserId]);

  const selectedUserName = users.find(u => u._id === selectedUserId)?.name || 'All Users';

  if (loading) return <Spinner />;

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={sh.tabHeader}>
        <View>
          <Text style={[sh.tabTitle, { color: t.textPrimary }]}>Leads Overview ({pagination.total})</Text>
          <Text style={[sh.tabSubtitle, { color: t.textMuted }]}>Cross-sell services and their status</Text>
        </View>
        {(isAdmin || isTL || isManager) && (
          <TouchableOpacity
            style={[sh.filterBtn, { backgroundColor: t.filterBg, borderColor: t.cardBorder }]}
            onPress={() => setShowUserPicker(true)}
          >
            <Icon name="users" size={13} color={t.textSecondary} />
            <Text style={[sh.filterBtnText, { color: t.textSecondary }]}>{selectedUserName}</Text>
            <Icon name="chevron-down" size={13} color={t.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {records.length === 0 ? (
        <View style={sh.emptyState}>
          <Icon name="users" size={36} color={t.textMuted} />
          <Text style={[sh.emptyTitle, { color: t.textMuted }]}>No leads found</Text>
        </View>
      ) : (
        records.map(rec => {
          const lead = rec.leadId;
          const name = lead?.name || '?';
          const product = rec.originalService || lead?.product || '—';
          const assignedName = rec.assignedTo?.name || '—';
          const recs = rec.recommendations || [];
          return (
            <View key={rec._id} style={[sh.leadCard, { backgroundColor: t.card, borderColor: t.cardBorder }]}>
              <View style={sh.leadCardTop}>
                <View style={sh.avatar}>
                  <Text style={sh.avatarText}>{name[0].toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[sh.leadName, { color: t.textPrimary }]}>{name}</Text>
                  <Text style={[sh.leadPhone, { color: t.textMuted }]}>{lead?.phone || '—'}</Text>
                </View>
                {/* Cross-Sell button — opens drawer */}
                <TouchableOpacity
                  style={[sh.crossSellBtn, { borderColor: '#2563eb' }]}
                  onPress={() => setDrawerLead({
                    _id: lead?._id,
                    name: lead?.name,
                    email: lead?.email,
                    product: rec.originalService || lead?.product,
                  })}
                >
                  <Text style={sh.crossSellBtnText}>Cross-Sell</Text>
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                <View style={[sh.infoChip, { backgroundColor: t.chipBg }]}>
                  <Text style={[sh.infoChipLabel, { color: t.textMuted }]}>SERVICE</Text>
                  <Text style={[sh.infoChipValue, { color: t.textPrimary }]}>{product}</Text>
                </View>
                <View style={[sh.infoChip, { backgroundColor: t.chipBg }]}>
                  <Text style={[sh.infoChipLabel, { color: t.textMuted }]}>ASSIGNED TO</Text>
                  <Text style={[sh.infoChipValue, { color: t.textPrimary }]}>{assignedName}</Text>
                </View>
              </View>

              {recs.length > 0 && (
                <View>
                  <Text style={[sh.recLabel, { color: t.textMuted }]}>RECOMMENDATIONS</Text>
                  <View style={sh.recRow}>
                    {recs.map((r, idx) => {
                      const sc = STATUS_COLOR[r.status] || STATUS_COLOR['Pending'];
                      return (
                        <TouchableOpacity
                          key={idx}
                          style={[sh.recChip, { backgroundColor: sc.bg, borderColor: sc.color + '40' }]}
                          onPress={() => setDrawerLead({
                            _id: lead?._id,
                            name: lead?.name,
                            email: lead?.email,
                            product: rec.originalService || lead?.product,
                          })}
                        >
                          <Text style={[sh.recChipSvc, { color: t.textPrimary }]}>{r.service}</Text>
                          <Text style={[sh.recChipStatus, { color: sc.color }]}>{r.status}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          );
        })
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <View style={sh.pagination}>
          <TouchableOpacity
            style={[sh.pageBtn, { backgroundColor: t.card, borderColor: t.cardBorder }, page === 1 && sh.pageBtnDisabled]}
            onPress={() => { setPage(page - 1); load(page - 1); }}
            disabled={page === 1}
          >
            <Icon name="chevron-left" size={14} color={page === 1 ? t.textMuted : t.textSecondary} />
            <Text style={[sh.pageBtnText, { color: page === 1 ? t.textMuted : t.textSecondary }]}>Prev</Text>
          </TouchableOpacity>
          <Text style={[sh.pageInfo, { color: t.textMuted }]}>Page {page} of {pagination.totalPages}</Text>
          <TouchableOpacity
            style={[sh.pageBtn, { backgroundColor: t.card, borderColor: t.cardBorder }, page === pagination.totalPages && sh.pageBtnDisabled]}
            onPress={() => { setPage(page + 1); load(page + 1); }}
            disabled={page === pagination.totalPages}
          >
            <Text style={[sh.pageBtnText, { color: page === pagination.totalPages ? t.textMuted : t.textSecondary }]}>Next</Text>
            <Icon name="chevron-right" size={14} color={page === pagination.totalPages ? t.textMuted : t.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Cross-Sell Drawer */}
      <CrossSellDrawer
        visible={!!drawerLead}
        lead={drawerLead}
        onClose={() => setDrawerLead(null)}
        onSaved={() => load(page, selectedUserId, true)}
        t={t}
      />

      <UserPickerModal
        visible={showUserPicker}
        users={users}
        selectedId={selectedUserId}
        onSelect={setSelectedUserId}
        onClose={() => setShowUserPicker(false)}
        t={t}
      />
    </ScrollView>
);
};

/* ══════════════════════════════════════════════
   RULES TAB
══════════════════════════════════════════════ */
const RulesTab = ({ isAdmin, isTL, isManager, t }) => {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalRule, setModalRule] = useState(null);
  const [ruleModalVisible, setRuleModalVisible] = useState(false);

  const loadRules = async () => {
    setLoading(true);
    try {
      const res = await api.get('/cross-sell/rules');
      setRules(res.data?.data || []);
    } catch { Alert.alert('Error', 'Rules load failed'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadRules(); }, []);

  const toggleActive = async (rule) => {
    try {
      await api.put(`/cross-sell/rules/${rule._id}`, {
        triggerService: rule.triggerService,
        recommendations: rule.recommendations || [],
        isActive: !rule.isActive,
      });
      setRules(p => p.map(r => r._id === rule._id ? { ...r, isActive: !r.isActive } : r));
    } catch { Alert.alert('Error', 'Update failed'); }
  };

  const confirmDelete = (rule) => {
    Alert.alert(
      'Delete Service',
      `"${rule.triggerService}" will be permanently deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/cross-sell/rules/${rule._id}`);
              setRules(p => p.filter(r => r._id !== rule._id));
            } catch (e) { Alert.alert('Error', e?.response?.data?.message || 'Delete failed'); }
          },
        },
      ]
    );
  };

  if (loading) return <Spinner />;

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={sh.tabHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[sh.tabTitle, { color: t.textPrimary }]}>Service Rules ({rules.length})</Text>
          <Text style={[sh.tabSubtitle, { color: t.textMuted }]}>Recommendations auto-appear when lead product matches</Text>
        </View>
        {(isAdmin || isTL || isManager) && (
          <TouchableOpacity
            style={sh.btnPrimary}
            onPress={() => { setModalRule(null); setRuleModalVisible(true); }}
          >
            <Icon name="plus" size={14} color="#fff" />
            <Text style={sh.btnPrimaryText}>Add</Text>
          </TouchableOpacity>
        )}
      </View>

      {rules.length === 0 ? (
        <View style={sh.emptyState}>
          <Icon name="package" size={36} color={t.textMuted} />
          <Text style={[sh.emptyTitle, { color: t.textMuted }]}>No rules yet</Text>
          <Text style={[sh.emptyDesc, { color: t.textMuted }]}>Add a service to get started</Text>
        </View>
      ) : (
        rules.map(rule => {
          const meta = getSvcMeta(rule.triggerService);
          return (
            <View key={rule._id} style={[sh.ruleCard, { backgroundColor: t.card, borderColor: t.cardBorder }]}>
              <View style={[sh.svcIconBox, { backgroundColor: meta.bg, width: 38, height: 38, borderRadius: 10 }]}>
                <Icon name={meta.icon} size={17} color={meta.color} />
              </View>
              <Text style={[sh.ruleName, { color: t.textPrimary }]} numberOfLines={1}>{rule.triggerService}</Text>

              {(isAdmin || isTL || isManager) && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <TouchableOpacity
                    style={[sh.ruleStatusBtn, { backgroundColor: rule.isActive ? 'rgba(5,150,105,0.1)' : t.chipBg }]}
                    onPress={() => toggleActive(rule)}
                  >
                    <Text style={[sh.ruleStatusText, { color: rule.isActive ? '#059669' : t.textMuted }]}>
                      {rule.isActive ? 'Active' : 'Inactive'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={sh.ruleIconBtn}
                    onPress={() => { setModalRule(rule); setRuleModalVisible(true); }}
                  >
                    <Icon name="edit-2" size={14} color={t.textMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity style={sh.ruleIconBtn} onPress={() => confirmDelete(rule)}>
                    <Icon name="trash-2" size={14} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })
      )}

      <RuleModal
        visible={ruleModalVisible}
        rule={modalRule}
        onClose={() => setRuleModalVisible(false)}
        onSave={() => { setRuleModalVisible(false); loadRules(); }}
        t={t}
      />
    </ScrollView>
  );
};

/* ══════════════════════════════════════════════
   MAIN SCREEN
══════════════════════════════════════════════ */
const CrossSellDashboardScreen = () => {
  const { user } = useSelector(s => s.auth);
  const { isDark } = useTheme();
  const t = getT(isDark);

  const isAdmin = user?.role === 'admin';
  const isTL = user?.role === 'tl';
  const isManager = user?.role === 'manager';
  const currentUserId = user?._id;

  const [activeTab, setActiveTab] = useState('analytics');
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (!isAdmin && !isTL && !isManager) return;
    userService.getAllUsers().then(r => setUsers(Array.isArray(r) ? r : [])).catch(() => {});
  }, [isAdmin, isTL, isManager]);

  const TABS = [
    { key: 'analytics', label: 'Analytics', icon: 'bar-chart-2' },
    { key: 'leads',     label: 'Leads',     icon: 'users' },
    ...(isAdmin || isTL || isManager ? [{ key: 'rules', label: 'Rules', icon: 'package' }] : []),
  ];

  return (
    <View style={[sh.container, { backgroundColor: t.bg }]}>
      {/* Header */}
      <View style={[sh.pageHeader, { backgroundColor: t.headerBg, borderColor: t.cardBorder }]}>
        <View style={sh.pageHeaderIcon}>
          <Icon name="trending-up" size={18} color="#fff" />
        </View>
        <View>
          <Text style={[sh.pageTitle, { color: t.textPrimary }]}>Cross-Sell</Text>
          <Text style={[sh.pageSubtitle, { color: t.textMuted }]}>Manage services & track opportunities</Text>
        </View>
      </View>

      {/* Tab Bar */}
      <View style={[sh.tabBar, { backgroundColor: t.tabBarBg, borderColor: t.cardBorder }]}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[sh.tabBtn, activeTab === tab.key && sh.tabBtnActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Icon name={tab.icon} size={13} color={activeTab === tab.key ? '#2563eb' : t.textMuted} />
            <Text style={[sh.tabBtnText, { color: t.textMuted }, activeTab === tab.key && sh.tabBtnTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <View style={{ flex: 1, padding: 16 }}>
        {activeTab === 'analytics' && (
          <AnalyticsTab currentUserId={currentUserId} isAdmin={isAdmin} isTL={isTL} isManager={isManager} t={t} />
        )}
        {activeTab === 'leads' && (
          <LeadsOverviewTab isAdmin={isAdmin} isTL={isTL} isManager={isManager} users={users} currentUserId={currentUserId} t={t} />
        )}
        {activeTab === 'rules' && (
          <RulesTab isAdmin={isAdmin} isTL={isTL} isManager={isManager} t={t} />
        )}
      </View>
    </View>
  );
};

/* ══════════════════════════════════════════════
   STYLES
══════════════════════════════════════════════ */
const sh = StyleSheet.create({
  container: { flex: 1 },

  pageHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14,
    borderBottomWidth: 1,
  },
  pageHeaderIcon: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: '#2563eb',
    alignItems: 'center', justifyContent: 'center',
  },
  pageTitle:    { fontSize: 18, fontWeight: '800' },
  pageSubtitle: { fontSize: 12, marginTop: 2 },

  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: 16, gap: 4,
  },
  tabBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabBtnActive:     { borderBottomColor: '#2563eb' },
  tabBtnText:       { fontSize: 13, fontWeight: '500' },
  tabBtnTextActive: { color: '#2563eb', fontWeight: '700' },

  card: {
    borderRadius: 16, padding: 16,
    borderWidth: 1, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },

  sectionLabel:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  sectionLabelText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  statCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderLeftWidth: 4,
    width: (SCREEN_WIDTH - 42) / 2,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  statLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  statValue: { fontSize: 22, fontWeight: '800' },
  statIcon:  { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  barRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  barRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  barRowLabel: { fontSize: 12, flex: 1 },
  barTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill:  { height: 8, borderRadius: 4 },

  badge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: '600' },

  convRateBox: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 14,
  },
  convRateCircle: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 4, borderColor: '#059669',
    alignItems: 'center', justifyContent: 'center',
  },
  convRatePct:   { fontSize: 14, fontWeight: '800' },
  convRateTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  convRateSub:   { fontSize: 12 },

  topSvcRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  topSvcName: { flex: 1, fontSize: 14, fontWeight: '600' },
  topSvcCount:{ fontSize: 14, fontWeight: '700' },

  convRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1 },
  convRowName: { flex: 1, fontSize: 13, fontWeight: '500' },
  convRowMuted:{ fontSize: 12 },

  activityRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1 },
  activityName: { fontSize: 13, fontWeight: '600' },
  activitySub:  { fontSize: 11, marginTop: 1 },
  activityCount:{ fontSize: 11, fontWeight: '600' },

  avatar:     { width: 34, height: 34, borderRadius: 17, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  tabHeader:   { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, gap: 10 },
  tabTitle:    { fontSize: 15, fontWeight: '700' },
  tabSubtitle: { fontSize: 12, marginTop: 2 },

  filterBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, marginBottom: 14 },
  filterBtnText: { fontSize: 12, fontWeight: '500' },

  leadCard:    { borderRadius: 14, padding: 14, borderWidth: 1, marginBottom: 10 },
  leadCardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  leadName:    { fontSize: 14, fontWeight: '700' },
  leadPhone:   { fontSize: 11, marginTop: 2 },
  crossSellBtn:     { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  crossSellBtnText: { fontSize: 11, fontWeight: '600', color: '#2563eb' },
  infoChip:      { flex: 1, borderRadius: 8, padding: 8 },
  infoChipLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  infoChipValue: { fontSize: 12, fontWeight: '600' },
  recLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  recRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  recChip:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  recChipSvc:    { fontSize: 11, fontWeight: '600' },
  recChipStatus: { fontSize: 10, fontWeight: '600' },

  ruleCard:      { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, padding: 14, borderWidth: 1, marginBottom: 8 },
  ruleName:      { flex: 1, fontSize: 14, fontWeight: '700' },
  ruleStatusBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  ruleStatusText:{ fontSize: 11, fontWeight: '600' },
  ruleIconBtn:   { padding: 6 },

  svcIconBox: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },

  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, paddingVertical: 16 },
  pageBtn:        { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  pageBtnDisabled:{ opacity: 0.4 },
  pageBtnText:    { fontSize: 13, fontWeight: '500' },
  pageInfo:       { fontSize: 12 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  modalBox:     { borderRadius: 20, maxHeight: '90%', width: '100%' },
  modalHeader:  { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1 },
  modalTitle:   { fontSize: 15, fontWeight: '700' },
  modalSubtitle:{ fontSize: 12, marginTop: 2 },
  closeBtn:     { padding: 4 },

  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  pickerBox:     { borderRadius: 16, padding: 16, maxHeight: '70%', width: '100%' },
  pickerTitle:   { fontSize: 14, fontWeight: '700', marginBottom: 12 },
  pickerOption:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1 },
  pickerOptionActive:    { backgroundColor: '#eff6ff', borderRadius: 8, paddingHorizontal: 8 },
  pickerOptionText:      { fontSize: 13 },
  pickerOptionTextActive:{ color: '#2563eb', fontWeight: '600' },

  btnPrimary:     { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  btnPrimaryText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  btnSecondary:   { borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  btnSecondaryText:{ fontWeight: '500', fontSize: 14 },
  btnDisabled:    { opacity: 0.6 },

  inputLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input:      { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },

  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyTitle: { fontSize: 15, fontWeight: '600' },
  emptyDesc:  { fontSize: 13 },
  emptyText:  { fontSize: 13, textAlign: 'center', paddingVertical: 12 },

  spinnerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 60 },

  // Drawer styles
  drawerPanel: {
    width: SCREEN_WIDTH * 0.92,
    height: '100%',
    borderLeftWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  drawerTitle:    { fontSize: 14, fontWeight: '700' },
  drawerSub:      { fontSize: 12, marginTop: 2 },
  drawerCloseBtn: {
    width: 28, height: 28, borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
});

export default CrossSellDashboardScreen;