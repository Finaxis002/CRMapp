import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';

import { leadsService } from '../../services/leadsService';
import { userService } from '../../services/userService';
import { fetchSettings } from '../../store/slices/settingsSlice';
import { canUser } from '../../utils/permissions';
import { useUISystem } from '../../hooks/useUISystem';
import { useToast as useKitToast } from '../../components/ui/CustomToast';

import ImprovedButton from '../../components/ui/ImprovedButton';
import ImprovedDropdown from '../../components/ui/ImprovedDropdown';

import LeadFormModal from '../../components/common/LeadFormModal';
import KanbanSkeleton from '../../components/ui/KanbanSkeleton';

const DEFAULT_STAGES = [
  { name: 'New', color: '#6b7280' },
  { name: 'Interested', color: '#b86e00' },
  { name: 'Details Shared', color: '#6c35de' },
  { name: 'Success', color: '#2a7d4f' },
  { name: 'Closed', color: '#1a1a18' },
];
const getStatusBadgeColor = (status, fallbackColor) => {
  if (status === 'Repeat') return '#9333ea';
  return fallbackColor;
};
const SOURCE_OPTIONS = [
  'Google Ads',
  'Website',
  'Referral',
  'Walk-in',
  'Cold Call',
  'Social Media',
  'Google Sheet',
  'Other',
];

// ─── Lead Card (UNTOUCHED) ───────────────────────────────────
const MobileLeadCard = ({
  lead,
  index,
  stage,
  onOpen,
  formatCurrency,
  getAssignedName,
  colors,
}) => (
  <TouchableOpacity
    onPress={() => onOpen(lead)}
    style={[
      styles.mobileCard,
      { backgroundColor: colors.cardBg, borderColor: colors.cardBorder },
    ]}
  >
    <View style={styles.cardTopRow}>
      <Text
        style={[styles.cardName, { color: colors.primaryText }]}
        numberOfLines={1}
      >
        {index + 1}. {lead.name}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {lead.hasCrossSell && (
          <View
            style={[
              styles.crossSellBadge,
              { backgroundColor: colors.crossSellBg },
            ]}
          >
            <Text
              style={[styles.crossSellText, { color: colors.crossSellText }]}
            >
              ↗ Cross-sell
            </Text>
          </View>
        )}
        {lead.dealValue > 0 && (
          <Text style={[styles.valueText, { color: colors.valueText }]}>
            {formatCurrency(lead.dealValue)}
          </Text>
        )}
      </View>
    </View>

    <Text style={[styles.phoneText, { color: colors.secondaryText }]}>
      📞 {String(lead.phone || '').slice(-10)}
    </Text>

    {lead.alternatePhone && (
      <Text
        style={[
          styles.altPhone,
          { color: colors.altPhoneText, backgroundColor: colors.altPhoneBg },
        ]}
      >
        Alt: {String(lead.alternatePhone).replace(/\D/g, '').slice(-10)}
      </Text>
    )}

    <View style={styles.assignedRow}>
      <Text style={[styles.assignedText, { color: colors.secondaryText }]}>
        👤 {getAssignedName(lead)}
      </Text>
      <View
        style={[
          styles.stageBadge,
          { backgroundColor: getStatusBadgeColor(lead.status, stage.color) },
        ]}
      >
        <Text style={styles.stageBadgeText}>{lead.status || stage.name}</Text>
      </View>
    </View>
  </TouchableOpacity>
);

// ─── Main Screen ─────────────────────────────────────────────
const KanbanScreen = () => {
  const dispatch = useDispatch();
  const settings = useSelector(state => state.settings?.data);
  const currentUser = useSelector(state => state.auth.user);
  const globalSearch = useSelector(state => state.search?.query || '');

  const { colors: themeColors, isDark } = useUISystem();
  const toast = useKitToast();

  // Build colors object matching what MobileLeadCard/tabs/skeleton expect
  const colors = useMemo(
    () => ({
      screenBg: themeColors.background,
      headerBg: themeColors.surface,
      headerBorder: themeColors.border,
      cardBg: themeColors.surface,
      cardBorder: themeColors.borderLight,
      titleText: themeColors.textPrimary,
      subtitleText: themeColors.textSecondary,
      primaryText: themeColors.textPrimary,
      secondaryText: themeColors.textSecondary,
      btnBorder: themeColors.border,
      btnBg: themeColors.surface,
      tabBg: themeColors.surface,
      tabBorder: themeColors.border,
      tabText: themeColors.textSecondary,
      countBadgeBg: themeColors.backgroundSecondary,
      countBadgeText: themeColors.textTertiary,
      crossSellBg: themeColors.purpleSoft,
      crossSellText: themeColors.purple,
      altPhoneBg: themeColors.infoSoft || themeColors.primarySoft,
      altPhoneText: themeColors.info || themeColors.primary,
      valueText: themeColors.success,
      emptyText: themeColors.textTertiary,
    }),
    [themeColors],
  );

  const canCreateLead = canUser(currentUser, settings, 'add_leads');
  const canEditAnyLead = canUser(currentUser, settings, 'edit_any_lead');
  const canViewAllLeads = canUser(currentUser, settings, 'view_all_leads');
  const canViewTeamLeads = canUser(
    currentUser,
    settings,
    'view_team_leads_only',
  );
  const isManager = currentUser?.role === 'manager';

  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingColumns, setLoadingColumns] = useState({});
  const [columnState, setColumnState] = useState({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [activeTabOverride, setActiveTabOverride] = useState(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [mobileActiveStage, setMobileActiveStage] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(globalSearch.trim()), 400);
    return () => clearTimeout(t);
  }, [globalSearch]);

  useEffect(() => {
    dispatch(fetchSettings());
    loadUsers();
  }, []);

  useEffect(() => {
    if (!currentUser || settings === null) return;
    loadPipeline();
  }, [selectedUser, debouncedSearch, currentUser, settings]);

  const stages = useMemo(
    () =>
      settings?.pipelineStages?.length
        ? settings.pipelineStages
        : DEFAULT_STAGES,
    [settings],
  );

  useEffect(() => {
    if (stages.length && mobileActiveStage === null)
      setMobileActiveStage(stages[0].name);
  }, [stages]);

  const buildFilter = () => {
    const filter = {};
    if (debouncedSearch) filter.search = debouncedSearch;
    if (isManager && (canViewTeamLeads || canViewAllLeads)) {
      if (selectedUser) filter.assignedTo = selectedUser;
    } else if (!canViewAllLeads) {
      filter.assignedTo = currentUser?._id;
    } else if (selectedUser) {
      filter.assignedTo = selectedUser;
    }
    return filter;
  };

  const loadUsers = async () => {
    try {
      const data = await userService.getUsers(1, 100);
      const allUsers = Array.isArray(data)
        ? data
        : data.items || data.data || [];
      if (isManager) {
        setUsers(
          allUsers.filter(u => {
            const mid = u.managerId?._id || u.managerId;
            return (
              mid?.toString() === currentUser._id?.toString() ||
              u._id?.toString() === currentUser._id?.toString()
            );
          }),
        );
      } else {
        setUsers(allUsers);
      }
    } catch {
      toast.error('Unable to load users.');
    }
  };

  const getStatusFilter = status => (status === 'New' ? 'New,Repeat' : status);

  const loadColumnPage = async (status, pageNumber = 1) => {
    setLoadingColumns(prev => ({ ...prev, [status]: true }));
    try {
      const filter = { ...buildFilter(), status: getStatusFilter(status) };
      const result = await leadsService.getLeads(filter, pageNumber, 20);
      const newItems = result.data || [];
      setColumnState(prev => {
        let merged;
        if (pageNumber === 1) {
          merged = newItems;
        } else {
          const ids = new Set((prev[status]?.items || []).map(l => l._id));
          merged = [
            ...(prev[status]?.items || []),
            ...newItems.filter(l => !ids.has(l._id)),
          ];
        }
        return {
          ...prev,
          [status]: {
            items: merged,
            page: result.pagination.page,
            total: result.pagination.total,
            totalPages: result.pagination.totalPages,
            hasNextPage: result.pagination.hasNextPage,
            totalValue: result.totalValue ?? prev[status]?.totalValue ?? 0,
          },
        };
      });
    } catch {
      toast.error(`Unable to load ${status} leads.`);
    } finally {
      setLoadingColumns(prev => ({ ...prev, [status]: false }));
    }
  };

  const loadPipeline = async () => {
    setLoading(true);
    const init = {};
    stages.forEach(s => {
      init[s.name] = {
        items: [],
        page: 0,
        total: 0,
        totalPages: 1,
        hasNextPage: true,
        totalValue: 0,
      };
    });
    setColumnState(init);
    await Promise.all(stages.map(s => loadColumnPage(s.name, 1)));
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPipeline();
    setRefreshing(false);
  };

  const formatCurrency = value => {
    if (!value && value !== 0) return '—';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getAssignedName = lead => {
    if (!lead.assignedTo) return '—';
    return typeof lead.assignedTo === 'string'
      ? lead.assignedTo
      : lead.assignedTo.name || lead.assignedTo.email || '—';
  };

  const handleCardClick = async lead => {
    if (!canEditAnyLead) {
      toast.error('You do not have permission to edit leads.');
      return;
    }
    setEditingLead(lead);
    setShowCreateModal(true);
    try {
      setEditingLead(await leadsService.getLead(lead._id));
    } catch {}
  };

  const handleSaveLead = async (leadData, leadId) => {
    try {
      if (leadId) {
        await leadsService.updateLead(leadId, leadData);
        toast.success('Lead updated successfully.');
      } else {
        await leadsService.createLead(leadData);
        toast.success('Lead created successfully.');
      }
      loadPipeline();
      setShowCreateModal(false);
      setEditingLead(null);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Unable to save lead.');
    }
  };

  const activeStageFull = useMemo(
    () => stages.find(s => s.name === mobileActiveStage) || stages[0],
    [stages, mobileActiveStage],
  );
  const activeMobileData = columnState[mobileActiveStage] || {
    items: [],
    total: 0,
    totalValue: 0,
    hasNextPage: false,
  };

  return (
    <SafeAreaView
      edges={['bottom']}
      style={[styles.container, { backgroundColor: colors.screenBg }]}
    >
      {/* ══ HEADER — compact ══ */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.headerBg,
            borderBottomColor: colors.headerBorder,
          },
        ]}
      >
        <View style={styles.titleRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={[styles.headerTitle, { color: colors.titleText }]}
              numberOfLines={1}
            >
              Pipeline
            </Text>
            <Text
              style={[styles.headerSubtitle, { color: colors.subtitleText }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              Track leads stage-wise
            </Text>
          </View>
          {canCreateLead ? (
            <ImprovedButton
              title="+ Add"
              size="small"
              onPress={() => {
                setEditingLead(null);
                setShowCreateModal(true);
              }}
            />
          ) : null}
        </View>

        {/* User Filter */}
        {(canViewAllLeads || (isManager && canViewTeamLeads)) && (
          <View style={{ marginTop: 8 }}>
            <ImprovedDropdown
              placeholder="All Users"
              items={[
                { value: '', label: 'All Users' },
                ...users.map(u => ({ value: u._id, label: u.name })),
              ]}
              selectedValue={selectedUser}
              onValueChange={setSelectedUser}
              searchable
            />
          </View>
        )}

        {/* Stage Tabs — UNTOUCHED original style */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsContainer}
        >
          {stages.map(stage => {
            const stageData = columnState[stage.name] || { total: 0 };
            const isActive = mobileActiveStage === stage.name;
            return (
              <TouchableOpacity
                key={stage.name}
                onPress={() => setMobileActiveStage(stage.name)}
                style={[
                  styles.stageTab,
                  {
                    backgroundColor: colors.tabBg,
                    borderColor: colors.tabBorder,
                  },
                  isActive && {
                    backgroundColor: stage.color,
                    borderColor: stage.color,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.stageTabText,
                    { color: colors.tabText },
                    isActive && { color: '#fff' },
                  ]}
                >
                  {stage.name}
                </Text>
                <View
                  style={[
                    styles.countBadge,
                    { backgroundColor: colors.countBadgeBg },
                    isActive && { backgroundColor: 'rgba(255,255,255,0.25)' },
                  ]}
                >
                  <Text
                    style={[
                      styles.countText,
                      { color: colors.countBadgeText },
                      isActive && { color: '#fff' },
                    ]}
                  >
                    {stageData.total || 0}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Content — UNTOUCHED */}
      {loading ? (
        <KanbanSkeleton colors={colors} />
      ) : (
        <FlatList
          data={activeMobileData.items}
          keyExtractor={item => item._id}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (
              activeMobileData.hasNextPage &&
              !loadingColumns[mobileActiveStage]
            ) {
              loadColumnPage(
                mobileActiveStage,
                (activeMobileData.page || 1) + 1,
              );
            }
          }}
          renderItem={({ item, index }) => (
            <MobileLeadCard
              lead={item}
              index={index}
              stage={activeStageFull}
              onOpen={handleCardClick}
              formatCurrency={formatCurrency}
              getAssignedName={getAssignedName}
              colors={colors}
            />
          )}
          contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
          style={{ backgroundColor: colors.screenBg }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={themeColors.textSecondary}
            />
          }
          ListEmptyComponent={
            <View
              style={{
                alignItems: 'center',
                marginTop: 60,
                backgroundColor: colors.screenBg,
              }}
            >
              <Text style={{ fontSize: 40, marginBottom: 8 }}>📋</Text>
              <Text style={{ color: colors.emptyText }}>
                No leads in this stage
              </Text>
            </View>
          }
          ListFooterComponent={
            loadingColumns[mobileActiveStage] ? (
              <ActivityIndicator
                style={{ marginVertical: 20 }}
                color={themeColors.textSecondary}
              />
            ) : null
          }
        />
      )}

      {/* Lead Form Modal — UNTOUCHED */}
      <LeadFormModal
        visible={showCreateModal}
        lead={editingLead}
        initialTab={activeTabOverride}
        onClose={() => {
          setShowCreateModal(false);
          setEditingLead(null);
          setActiveTabOverride(null);
        }}
        onSubmit={handleSaveLead}
        users={users}
        currentUserId={currentUser?._id}
        settings={settings}
        canCreateLead={canCreateLead}
        canEditAnyLead={canEditAnyLead}
        statusOptions={stages.map(s => s.name)}
        sourceOptions={SOURCE_OPTIONS}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
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
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  tabsContainer: { marginTop: 10 },
  stageTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
  },
  stageTabText: { fontWeight: '700', fontSize: 13 },
  countBadge: {
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 999,
    marginLeft: 6,
  },
  countText: { fontSize: 11, fontWeight: '700' },
  mobileCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cardName: { fontSize: 15, fontWeight: '700', flex: 1 },
  crossSellBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  crossSellText: { fontSize: 10, fontWeight: '700' },
  valueText: { fontSize: 13, fontWeight: '700' },
  phoneText: { fontSize: 13, marginBottom: 2 },
  altPhone: {
    fontSize: 11,
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginBottom: 6,
  },
  assignedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  assignedText: { fontSize: 12 },
  stageBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  stageBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});

export default KanbanScreen;
