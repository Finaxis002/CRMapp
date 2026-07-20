// screens/main/CrossSellDashboardScreen.jsx — REFACTORED with UI Kit
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Modal, TextInput, Alert, RefreshControl,
  Dimensions,
} from 'react-native';
import { useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import api from '../../services/api';
import { userService } from '../../services/userService';
import { useUISystem } from '../../hooks/useUISystem';
import { useToast as useKitToast } from '../../components/ui/CustomToast';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CrossSellTab from '../../components/common/Crossselltab';

// ─── UI Kit imports ────────────────────────────────────────────────────────
import PageHeader from '../../components/ui/PageHeader';
import ImprovedCard from '../../components/ui/ImprovedCard';
import ImprovedButton from '../../components/ui/ImprovedButton';
import ImprovedTextInput from '../../components/ui/ImprovedTextInput';
import ImprovedDropdown from '../../components/ui/ImprovedDropdown';
import EmptyState from '../../components/ui/EmptyState';
import BottomSheet from '../../components/ui/BottomSheet';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import FilterChip from '../../components/ui/FilterChip';
import MetricCard from '../../components/ui/MetricCard';
import Avatar from '../../components/ui/Avatar';
import IconButton from '../../components/ui/IconButton';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/* ══════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════ */
const SERVICE_META = {
  MSME:                { bg: '#E6F1FB', color: '#185FA5', icon: 'trending-up' },
  'GST Registration':  { bg: '#EAF3DE', color: '#3B6D11', icon: 'file-text' },
  'GST Return':        { bg: '#FAEEDA', color: '#854F0B', icon: 'chart-bar' },
  'Income Tax Return': { bg: '#EEEDFE', color: '#534AB7', icon: 'briefcase' },
  'Income Tax Audit':  { bg: '#FCEBEB', color: '#A32D2D', icon: 'magnify' },
  'Project Report':    { bg: '#FAEEDA', color: '#854F0B', icon: 'layers' },
  'Subsidy Services':  { bg: '#E1F5EE', color: '#0F6E56', icon: 'currency-usd' },
  'Trade Mark':        { bg: '#FBEAF0', color: '#993556', icon: 'tag' },
  'IEC Code':          { bg: '#E6F1FB', color: '#185FA5', icon: 'web' },
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
   HELPERS
══════════════════════════════════════════════ */
const SectionLabel = ({ iconName, children }) => {
  const { colors } = useUISystem();
  return (
    <View style={sh.sectionLabel}>
      <Icon name={iconName} size={12} color={colors.textTertiary} />
      <Text style={[sh.sectionLabelText, { color: colors.textTertiary }]}>{children}</Text>
    </View>
  );
};

const Spinner = () => {
  const { colors } = useUISystem();
  return (
    <View style={sh.spinnerBox}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
};

/* ══════════════════════════════════════════════
   STAT CARD
══════════════════════════════════════════════ */
const StatCard = ({ iconName, label, value, color }) => {
  const { colors, borderRadius } = useUISystem();
  return (
    <ImprovedCard
      variant="outline"
      padding="medium"
      style={{ width: (SCREEN_WIDTH - 42) / 2, borderLeftWidth: 4, borderLeftColor: color }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={[sh.statLabel, { color: colors.textTertiary }]}>{label}</Text>
          <Text style={[sh.statValue, { color: colors.textPrimary }]}>{value}</Text>
        </View>
        <View style={[sh.statIcon, { backgroundColor: color + '18', borderRadius: borderRadius.lg }]}>
          <Icon name={iconName} size={18} color={color} />
        </View>
      </View>
    </ImprovedCard>
  );
};

/* ══════════════════════════════════════════════
   BAR ROW
══════════════════════════════════════════════ */
const BarRow = ({ label, count, max, color, iconName }) => {
  const { colors, borderRadius } = useUISystem();
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <View style={sh.barRow}>
      <Icon name={iconName} size={14} color={colors.textTertiary} />
      <View style={{ flex: 1 }}>
        <View style={sh.barRowTop}>
          <Text style={[sh.barRowLabel, { color: colors.textSecondary }]} numberOfLines={1}>{label}</Text>
          <View style={[sh.badge, { backgroundColor: color + '18', borderColor: color + '40' }]}>
            <Text style={[sh.badgeText, { color }]}>{count}</Text>
          </View>
        </View>
        <View style={[sh.barTrack, { backgroundColor: colors.border, borderRadius: borderRadius.sm }]}>
          <View style={[sh.barFill, { width: pct + '%', backgroundColor: color, borderRadius: borderRadius.sm }]} />
        </View>
      </View>
    </View>
  );
};

/* ══════════════════════════════════════════════
   USER PICKER BOTTOM SHEET
══════════════════════════════════════════════ */
const UserPickerSheet = ({ visible, users, selectedId, onSelect, onClose }) => {
  const { colors, typography } = useUISystem();

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Filter by User"
      maxHeight="60%"
    >
      <View style={[sh.pickerOptionAll, { borderBottomColor: colors.border }, selectedId === 'all' && { backgroundColor: colors.primarySoft }]}>
        <TouchableOpacity
          style={{ flexDirection: 'row', flex: 1, alignItems: 'center' }}
          onPress={() => { onSelect('all'); onClose(); }}
        >
          <Text style={[typography.body2, { color: selectedId === 'all' ? colors.primary : colors.textPrimary, fontWeight: selectedId === 'all' ? '600' : '400', flex: 1 }]}>All Users</Text>
          {selectedId === 'all' && <Icon name="check" size={14} color={colors.primary} />}
        </TouchableOpacity>
      </View>
      {users.map(u => (
        <View key={u._id} style={[sh.pickerOptionAll, { borderBottomColor: colors.border }, selectedId === u._id && { backgroundColor: colors.primarySoft }]}>
          <TouchableOpacity
            style={{ flexDirection: 'row', flex: 1, alignItems: 'center' }}
            onPress={() => { onSelect(u._id); onClose(); }}
          >
            <Text style={[typography.body2, { color: selectedId === u._id ? colors.primary : colors.textPrimary, fontWeight: selectedId === u._id ? '600' : '400', flex: 1 }]}>{u.name}</Text>
            {selectedId === u._id && <Icon name="check" size={14} color={colors.primary} />}
          </TouchableOpacity>
        </View>
      ))}
    </BottomSheet>
  );
};

/* ══════════════════════════════════════════════
   RULE MODAL
══════════════════════════════════════════════ */
const RuleModal = ({ visible, rule, onClose, onSave }) => {
  const { colors, typography, borderRadius, spacing } = useUISystem();
  const toast = useKitToast();
  const [triggerService, setTriggerService] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTriggerService(rule?.triggerService || '');
  }, [rule, visible]);

  const handleSave = async () => {
    if (!triggerService.trim()) { toast.error('Service name required'); return; }
    setSaving(true);
    try {
      const payload = { triggerService: triggerService.trim(), recommendations: [] };
      if (rule?._id) await api.put(`/cross-sell/rules/${rule._id}`, payload);
      else await api.post('/cross-sell/rules', payload);
      toast.success(rule?._id ? 'Service updated!' : 'Service created!');
      onSave();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={sh.modalOverlay}>
        <View style={[sh.modalBox, { maxHeight: 300, backgroundColor: colors.surface, borderRadius: borderRadius['2xl'] }]}>
          <View style={[sh.modalHeader, { borderColor: colors.border }]}>
            <Text style={[typography.h4, { color: colors.textPrimary, flex: 1 }]}>
              {rule?._id ? 'Edit Rule' : 'Add New Service Rule'}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Icon name="close" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
          <View style={{ padding: spacing.lg }}>
            <ImprovedTextInput
              label="Trigger Service (Lead Product Field)"
              value={triggerService}
              onChangeText={setTriggerService}
              placeholder="e.g. MSME, GST Registration..."
              size="medium"
            />
            {rule?._id && (
              <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 6 }}>
                Trigger service cannot be changed after creation.
              </Text>
            )}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.xl }}>
              <ImprovedButton title="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
              <ImprovedButton
                title="Save Rule"
                variant="primary"
                onPress={handleSave}
                loading={saving}
                style={{ flex: 1 }}
              />
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
const AnalyticsTab = ({ currentUserId, isAdmin, isTL, isManager }) => {
  const { colors, typography, borderRadius, spacing } = useUISystem();
  const toast = useKitToast();
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
    } catch { toast.error('Dashboard load failed'); }
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
        <TouchableOpacity
          style={[sh.filterBtn, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, borderRadius: borderRadius.lg }]}
          onPress={() => setShowUserPicker(true)}
        >
          <Icon name="account-group" size={13} color={colors.textSecondary} />
          <Text style={[sh.filterBtnText, { color: colors.textSecondary }]}>{selectedUserName}</Text>
          <Icon name="chevron-down" size={13} color={colors.textTertiary} />
        </TouchableOpacity>
      )}

      {/* Stat Cards */}
      <View style={sh.statGrid}>
        <StatCard iconName="account-group" label="Leads Approached" value={data.totalLeadsWithCrossSell} color="#2563eb" />
        <StatCard iconName="file-document" label="Recommendations" value={data.totalRecommendations} color="#7c3aed" />
        <StatCard iconName="check-circle" label="Interested" value={interestedCount} color="#059669" />
        <StatCard iconName="trophy" label="Converted" value={convertedCount} color="#d97706" />
      </View>

      {/* Response Breakdown */}
      <ImprovedCard variant="outline" padding="large" style={{ marginBottom: 12 }}>
        <SectionLabel iconName="chart-bar">Response Breakdown</SectionLabel>
        <BarRow label="Interested / Converted" count={interestedCount} max={data.totalRecommendations || 1} color="#059669" iconName="check-circle" />
        <BarRow label="Pending" count={pendingCount} max={data.totalRecommendations || 1} color="#d97706" iconName="clock-outline" />
        <BarRow label="Not Interested" count={notInterestedCount} max={data.totalRecommendations || 1} color="#dc2626" iconName="close-circle" />

        <View style={[sh.convRateBox, { backgroundColor: colors.successSoft, borderColor: colors.success }]}>
          <View style={sh.convRateCircle}>
            <Text style={[sh.convRatePct, { color: colors.textPrimary }]}>{data.conversionRate}%</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[sh.convRateTitle, { color: colors.textPrimary }]}>Conversion Rate</Text>
            <Text style={[sh.convRateSub, { color: colors.textTertiary }]}>{interestedCount} of {data.totalRecommendations} accepted</Text>
            <View style={[sh.badge, { backgroundColor: colors.successSoft, borderColor: '#05966930', marginTop: 6, alignSelf: 'flex-start' }]}>
              <Text style={[sh.badgeText, { color: colors.success }]}>{convertedCount} Converted</Text>
            </View>
          </View>
        </View>
      </ImprovedCard>

      {/* Top Services */}
      <ImprovedCard variant="outline" padding="large" style={{ marginBottom: 12 }}>
        <SectionLabel iconName="trophy">Top Cross-Sold Services</SectionLabel>
        {data.topServices?.length > 0
          ? data.topServices.map((s) => {
              const meta = getSvcMeta(s._id);
              return (
                <View key={s._id} style={sh.topSvcRow}>
                  <View style={[sh.svcIconBox, { backgroundColor: meta.bg, borderRadius: borderRadius.md }]}>
                    <Icon name={meta.icon} size={15} color={meta.color} />
                  </View>
                  <Text style={[sh.topSvcName, { color: colors.textPrimary }]}>{s._id}</Text>
                  <Text style={[sh.topSvcCount, { color: colors.textPrimary }]}>
                    {s.count} <Text style={{ color: colors.textTertiary, fontWeight: '400' }}>sold</Text>
                  </Text>
                </View>
              );
            })
          : <Text style={[sh.emptyText, { color: colors.textTertiary }]}>No data yet</Text>
        }
      </ImprovedCard>

      {/* Conversion by Service */}
      {data.conversionByService?.length > 0 && (
        <ImprovedCard variant="outline" padding="large" style={{ marginBottom: 12 }}>
          <SectionLabel iconName="trending-up">Conversion by Original Service</SectionLabel>
          {data.conversionByService.map(row => {
            const rate = row.total > 0 ? ((row.interested / row.total) * 100).toFixed(0) : 0;
            const rColor = rate >= 50 ? '#059669' : rate >= 25 ? '#d97706' : '#dc2626';
            const meta = getSvcMeta(row._id);
            return (
              <View key={row._id} style={[sh.convRow, { borderColor: colors.border }]}>
                <View style={[sh.svcIconBox, { backgroundColor: meta.bg, borderRadius: borderRadius.md }]}>
                  <Icon name={meta.icon} size={13} color={meta.color} />
                </View>
                <Text style={[sh.convRowName, { color: colors.textPrimary }]} numberOfLines={1}>{row._id || '—'}</Text>
                <Text style={[sh.convRowMuted, { color: colors.textTertiary }]}>{row.total} recs</Text>
                <View style={[sh.badge, { backgroundColor: rColor + '18', borderColor: rColor + '40' }]}>
                  <Text style={[sh.badgeText, { color: rColor }]}>{rate}%</Text>
                </View>
              </View>
            );
          })}
        </ImprovedCard>
      )}

      {/* Recent Activity */}
      <ImprovedCard variant="outline" padding="large" style={{ marginBottom: 20 }}>
        <SectionLabel iconName="clock-outline">Recent Activity</SectionLabel>
        {data.recentActivity?.length > 0
          ? data.recentActivity.map(rec => {
              const name = rec.leadId?.name || '?';
              const product = rec.leadId?.product || '—';
              const recCount = rec.recommendations?.length || 0;
              const intCount = rec.recommendations?.filter(r => r.status === 'Interested' || r.status === 'Converted').length || 0;
              return (
                <View key={rec._id} style={[sh.activityRow, { borderColor: colors.border }]}>
                  <Avatar name={name} size={34} rounded={17} variant="solid" />
                  <View style={{ flex: 1 }}>
                    <Text style={[sh.activityName, { color: colors.textPrimary }]} numberOfLines={1}>{name}</Text>
                    <Text style={[sh.activitySub, { color: colors.textTertiary }]} numberOfLines={1}>{product}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[sh.activityCount, { color: colors.textTertiary }]}>{recCount} recs</Text>
                    {intCount > 0 && (
                      <View style={[sh.badge, { backgroundColor: colors.successSoft, borderColor: '#05966930', marginTop: 3 }]}>
                        <Text style={[sh.badgeText, { color: colors.success }]}>{intCount} interested</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          : <Text style={[sh.emptyText, { color: colors.textTertiary }]}>No recent activity</Text>
        }
      </ImprovedCard>

      <UserPickerSheet
        visible={showUserPicker}
        users={users}
        selectedId={selectedUserId}
        onSelect={setSelectedUserId}
        onClose={() => setShowUserPicker(false)}
      />
    </ScrollView>
  );
};

/* ══════════════════════════════════════════════
   CROSS SELL DRAWER
══════════════════════════════════════════════ */
const CrossSellDrawer = ({ visible, lead, onClose, onSaved }) => {
  const insets = useSafeAreaInsets();
  const { colors, typography, borderRadius } = useUISystem();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={[sh.drawerPanel, {
          backgroundColor: colors.surface,
          borderLeftColor: colors.border,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }]}>
          <View style={[sh.drawerHeader, { borderBottomColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[sh.drawerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                {lead?.name || ''}
              </Text>
              <Text style={[sh.drawerSub, { color: colors.textTertiary }]} numberOfLines={1}>
                {lead?.product || '—'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[sh.drawerCloseBtn, { borderColor: colors.border }]}>
              <Icon name="close" size={14} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1, padding: 16 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {visible && lead && <CrossSellTab lead={lead} onSaved={onSaved} />}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

/* ══════════════════════════════════════════════
   LEADS OVERVIEW TAB
══════════════════════════════════════════════ */
const LeadsOverviewTab = ({ isAdmin, isTL, isManager, users, currentUserId }) => {
  const { colors, typography, borderRadius, spacing } = useUISystem();
  const toast = useKitToast();
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
    } catch { toast.error('Leads load failed'); }
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
          <Text style={[sh.tabTitle, { color: colors.textPrimary }]}>Leads Overview ({pagination.total})</Text>
          <Text style={[sh.tabSubtitle, { color: colors.textTertiary }]}>Cross-sell services and their status</Text>
        </View>
        {(isAdmin || isTL || isManager) && (
          <TouchableOpacity
            style={[sh.filterBtn, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, borderRadius: borderRadius.lg }]}
            onPress={() => setShowUserPicker(true)}
          >
            <Icon name="account-group" size={13} color={colors.textSecondary} />
            <Text style={[sh.filterBtnText, { color: colors.textSecondary }]}>{selectedUserName}</Text>
            <Icon name="chevron-down" size={13} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {records.length === 0 ? (
        <EmptyState icon="account-group" title="No leads found" />
      ) : (
        records.map(rec => {
          const lead = rec.leadId;
          const name = lead?.name || '?';
          const product = rec.originalService || lead?.product || '—';
          const assignedName = rec.assignedTo?.name || '—';
          const recs = rec.recommendations || [];
          return (
            <ImprovedCard key={rec._id} variant="outline" padding="medium" style={{ marginBottom: 10 }}>
              <View style={sh.leadCardTop}>
                <Avatar name={name} size={34} rounded={17} variant="solid" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[sh.leadName, { color: colors.textPrimary }]}>{name}</Text>
                  <Text style={[sh.leadPhone, { color: colors.textTertiary }]}>{lead?.phone || '—'}</Text>
                </View>
                <ImprovedButton
                  title="Cross-Sell"
                  variant="outline"
                  size="small"
                  icon="trending-up"
                  onPress={() => setDrawerLead({
                    _id: lead?._id,
                    name: lead?.name,
                    email: lead?.email,
                    product: rec.originalService || lead?.product,
                  })}
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                <View style={[sh.infoChip, { backgroundColor: colors.backgroundSecondary, borderRadius: borderRadius.md }]}>
                  <Text style={[sh.infoChipLabel, { color: colors.textTertiary }]}>SERVICE</Text>
                  <Text style={[sh.infoChipValue, { color: colors.textPrimary }]}>{product}</Text>
                </View>
                <View style={[sh.infoChip, { backgroundColor: colors.backgroundSecondary, borderRadius: borderRadius.md }]}>
                  <Text style={[sh.infoChipLabel, { color: colors.textTertiary }]}>ASSIGNED TO</Text>
                  <Text style={[sh.infoChipValue, { color: colors.textPrimary }]}>{assignedName}</Text>
                </View>
              </View>

              {recs.length > 0 && (
                <View>
                  <Text style={[sh.recLabel, { color: colors.textTertiary }]}>RECOMMENDATIONS</Text>
                  <View style={sh.recRow}>
                    {recs.map((r, idx) => {
                      const sc = STATUS_COLOR[r.status] || STATUS_COLOR['Pending'];
                      return (
                        <TouchableOpacity
                          key={idx}
                          style={[sh.recChip, { backgroundColor: sc.bg, borderColor: sc.color + '40', borderRadius: borderRadius.md }]}
                          onPress={() => setDrawerLead({
                            _id: lead?._id,
                            name: lead?.name,
                            email: lead?.email,
                            product: rec.originalService || lead?.product,
                          })}
                        >
                          <Text style={[sh.recChipSvc, { color: colors.textPrimary }]}>{r.service}</Text>
                          <Text style={[sh.recChipStatus, { color: sc.color }]}>{r.status}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
            </ImprovedCard>
          );
        })
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <View style={sh.pagination}>
          <ImprovedButton
            title="Prev"
            variant="outline"
            size="small"
            icon="chevron-left"
            onPress={() => { setPage(page - 1); load(page - 1); }}
            disabled={page === 1}
          />
          <Text style={[sh.pageInfo, { color: colors.textTertiary }]}>Page {page} of {pagination.totalPages}</Text>
          <ImprovedButton
            title="Next"
            variant="outline"
            size="small"
            icon="chevron-right"
            iconPosition="right"
            onPress={() => { setPage(page + 1); load(page + 1); }}
            disabled={page === pagination.totalPages}
          />
        </View>
      )}

      <CrossSellDrawer
        visible={!!drawerLead}
        lead={drawerLead}
        onClose={() => setDrawerLead(null)}
        onSaved={() => load(page, selectedUserId, true)}
      />

      <UserPickerSheet
        visible={showUserPicker}
        users={users}
        selectedId={selectedUserId}
        onSelect={setSelectedUserId}
        onClose={() => setShowUserPicker(false)}
      />
    </ScrollView>
  );
};

/* ══════════════════════════════════════════════
   RULES TAB
══════════════════════════════════════════════ */
const RulesTab = ({ isAdmin, isTL, isManager }) => {
  const { colors, typography, borderRadius, spacing } = useUISystem();
  const toast = useKitToast();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalRule, setModalRule] = useState(null);
  const [ruleModalVisible, setRuleModalVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadRules = async () => {
    setLoading(true);
    try {
      const res = await api.get('/cross-sell/rules');
      setRules(res.data?.data || []);
    } catch { toast.error('Rules load failed'); }
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
    } catch { toast.error('Update failed'); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/cross-sell/rules/${deleteTarget._id}`);
      setRules(p => p.filter(r => r._id !== deleteTarget._id));
      toast.success('Service deleted');
    } catch (e) { toast.error(e?.response?.data?.message || 'Delete failed'); }
    setDeleteTarget(null);
  };

  if (loading) return <Spinner />;

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={sh.tabHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[sh.tabTitle, { color: colors.textPrimary }]}>Service Rules ({rules.length})</Text>
          <Text style={[sh.tabSubtitle, { color: colors.textTertiary }]}>Recommendations auto-appear when lead product matches</Text>
        </View>
        {(isAdmin || isTL || isManager) && (
          <ImprovedButton
            title="Add"
            icon="plus"
            size="small"
            onPress={() => { setModalRule(null); setRuleModalVisible(true); }}
          />
        )}
      </View>

      {rules.length === 0 ? (
        <EmptyState icon="package" title="No rules yet" message="Add a service to get started" />
      ) : (
        rules.map(rule => {
          const meta = getSvcMeta(rule.triggerService);
          return (
            <ImprovedCard key={rule._id} variant="outline" padding="medium" style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={[sh.svcIconBox, { backgroundColor: meta.bg, width: 38, height: 38, borderRadius: 10 }]}>
                  <Icon name={meta.icon} size={17} color={meta.color} />
                </View>
                <Text style={[sh.ruleName, { color: colors.textPrimary, flex: 1 }]} numberOfLines={1}>{rule.triggerService}</Text>

                {(isAdmin || isTL || isManager) && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TouchableOpacity
                      style={[sh.ruleStatusBtn, { backgroundColor: rule.isActive ? colors.successSoft : colors.backgroundSecondary, borderRadius: borderRadius.md }]}
                      onPress={() => toggleActive(rule)}
                    >
                      <Text style={[sh.ruleStatusText, { color: rule.isActive ? colors.success : colors.textTertiary }]}>
                        {rule.isActive ? 'Active' : 'Inactive'}
                      </Text>
                    </TouchableOpacity>
                    <IconButton name="pencil" size={14} onPress={() => { setModalRule(rule); setRuleModalVisible(true); }} />
                    <IconButton name="trash-can-outline" size={14} color={colors.danger} onPress={() => setDeleteTarget(rule)} />
                  </View>
                )}
              </View>
            </ImprovedCard>
          );
        })
      )}

      <RuleModal visible={ruleModalVisible} rule={modalRule} onClose={() => setRuleModalVisible(false)} onSave={() => { setRuleModalVisible(false); loadRules(); }} />

      <ConfirmDialog
        visible={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete Service"
        message={`"${deleteTarget?.triggerService}" will be permanently deleted.`}
        variant="danger"
      />
    </ScrollView>
  );
};

/* ══════════════════════════════════════════════
   MAIN SCREEN
══════════════════════════════════════════════ */
const CrossSellDashboardScreen = () => {
  const { user } = useSelector(s => s.auth);
  const { colors, typography, borderRadius, spacing } = useUISystem();

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
    { key: 'analytics', label: 'Analytics', icon: 'chart-bar' },
    { key: 'leads',     label: 'Leads',     icon: 'account-group' },
    ...(isAdmin || isTL || isManager ? [{ key: 'rules', label: 'Rules', icon: 'package' }] : []),
  ];

  return (
    <View style={[sh.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[sh.pageHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <PageHeader
          title="Cross-Sell"
          subtitle="Manage services & track opportunities"
        />
      </View>

      {/* Tab Bar */}
      <View style={[sh.tabBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {TABS.map(tab => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[sh.tabBtn, active && { borderBottomColor: colors.primary }]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Icon name={tab.icon} size={13} color={active ? colors.primary : colors.textTertiary} />
              <Text style={[sh.tabBtnText, { color: colors.textTertiary }, active && { color: colors.primary, fontWeight: '700' }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      <View style={{ flex: 1, padding: 16 }}>
        {activeTab === 'analytics' && (
          <AnalyticsTab currentUserId={currentUserId} isAdmin={isAdmin} isTL={isTL} isManager={isManager} />
        )}
        {activeTab === 'leads' && (
          <LeadsOverviewTab isAdmin={isAdmin} isTL={isTL} isManager={isManager} users={users} currentUserId={currentUserId} />
        )}
        {activeTab === 'rules' && (
          <RulesTab isAdmin={isAdmin} isTL={isTL} isManager={isManager} />
        )}
      </View>
    </View>
  );
};

/* ══════════════════════════════════════════════
   STYLES (reduced)
══════════════════════════════════════════════ */
const sh = StyleSheet.create({
  container: { flex: 1 },
  pageHeader: {
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14,
    borderBottomWidth: 1,
  },
  tabBar: {
    flexDirection: 'row', borderBottomWidth: 1,
    paddingHorizontal: 16, gap: 4,
  },
  tabBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabBtnText: { fontSize: 13, fontWeight: '500' },

  sectionLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  sectionLabelText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  statLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  statValue: { fontSize: 22, fontWeight: '800' },
  statIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  barRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  barRowLabel: { fontSize: 12, flex: 1 },
  barTrack: { height: 8, overflow: 'hidden' },
  barFill: { height: 8 },

  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: '600' },

  convRateBox: { flexDirection: 'row', alignItems: 'center', gap: 16, borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 14 },
  convRateCircle: { width: 64, height: 64, borderRadius: 32, borderWidth: 4, borderColor: '#059669', alignItems: 'center', justifyContent: 'center' },
  convRatePct: { fontSize: 14, fontWeight: '800' },
  convRateTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  convRateSub: { fontSize: 12 },

  topSvcRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  topSvcName: { flex: 1, fontSize: 14, fontWeight: '600' },
  topSvcCount: { fontSize: 14, fontWeight: '700' },

  convRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1 },
  convRowName: { flex: 1, fontSize: 13, fontWeight: '500' },
  convRowMuted: { fontSize: 12 },

  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1 },
  activityName: { fontSize: 13, fontWeight: '600' },
  activitySub: { fontSize: 11, marginTop: 1 },
  activityCount: { fontSize: 11, fontWeight: '600' },

  tabHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, gap: 10 },
  tabTitle: { fontSize: 15, fontWeight: '700' },
  tabSubtitle: { fontSize: 12, marginTop: 2 },

  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, marginBottom: 14 },
  filterBtnText: { fontSize: 12, fontWeight: '500' },

  leadCardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  leadName: { fontSize: 14, fontWeight: '700' },
  leadPhone: { fontSize: 11, marginTop: 2 },
  infoChip: { flex: 1, padding: 8 },
  infoChipLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  infoChipValue: { fontSize: 12, fontWeight: '600' },
  recLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  recRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  recChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1 },
  recChipSvc: { fontSize: 11, fontWeight: '600' },
  recChipStatus: { fontSize: 10, fontWeight: '600' },

  ruleName: { fontSize: 14, fontWeight: '700' },
  ruleStatusBtn: { paddingHorizontal: 10, paddingVertical: 5 },
  ruleStatusText: { fontSize: 11, fontWeight: '600' },

  svcIconBox: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },

  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, paddingVertical: 16 },
  pageInfo: { fontSize: 12 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  modalBox: { width: '100%' },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1 },

  pickerOptionAll: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1 },

  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyText: { fontSize: 13, textAlign: 'center', paddingVertical: 12 },

  spinnerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 60 },

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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1,
  },
  drawerTitle: { fontSize: 14, fontWeight: '700' },
  drawerSub: { fontSize: 12, marginTop: 2 },
  drawerCloseBtn: {
    width: 28, height: 28, borderRadius: 6,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
});

export default CrossSellDashboardScreen;
