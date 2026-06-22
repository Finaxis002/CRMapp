import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';

import { leadsService } from '../../services/leadsService';
import { userService } from '../../services/userService';
import { fetchSettings } from '../../store/slices/settingsSlice';
import { canUser } from '../../utils/permissions';

import CustomDropdown from '../../components/ui/CustomDropdown';
import LeadFormModal from '../../components/common/LeadFormModal';
import KanbanSkeleton from '../../components/ui/KanbanSkeleton';

// ─────────────────────────────────────────────────────────────
const DEFAULT_STAGES = [
  { name: 'New', color: '#6b7280' },
  { name: 'Interested', color: '#b86e00' },
  { name: 'Details Shared', color: '#6c35de' },
  { name: 'Success', color: '#2a7d4f' },
  { name: 'Closed', color: '#1a1a18' },
];

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

const toast = {
  success: msg => Alert.alert('Success', msg),
  error: msg => Alert.alert('Error', msg),
};

// ─── Mobile Lead Card ────────────────────────────────────────
const MobileLeadCard = ({
  lead,
  stage,
  onOpen,
  formatCurrency,
  getAssignedName,
}) => {
  return (
    <TouchableOpacity onPress={() => onOpen(lead)} style={styles.mobileCard}>
      <View style={styles.cardTopRow}>
        <Text style={styles.cardName} numberOfLines={1}>
          {lead.name}
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {lead.hasCrossSell && (
            <View style={styles.crossSellBadge}>
              <Text style={styles.crossSellText}>↗ Cross-sell</Text>
            </View>
          )}
          {lead.dealValue > 0 && (
            <Text style={styles.valueText}>
              {formatCurrency(lead.dealValue)}
            </Text>
          )}
        </View>
      </View>

      <Text style={styles.phoneText}>
        📞 {String(lead.phone || '').slice(-10)}
      </Text>

      {lead.alternatePhone && (
        <Text style={styles.altPhone}>
          Alt: {String(lead.alternatePhone).replace(/\D/g, '').slice(-10)}
        </Text>
      )}

      <View style={styles.assignedRow}>
        <Text style={styles.assignedText}>👤 {getAssignedName(lead)}</Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={[styles.stageBadge, { backgroundColor: stage.color }]}>
            <Text style={styles.stageBadgeText}>
              {lead.status || stage.name}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
const KanbanScreen = () => {
  const dispatch = useDispatch();
  const settings = useSelector(state => state.settings?.data);
  const currentUser = useSelector(state => state.auth.user);
  const globalSearch = useSelector(state => state.search?.query || '');

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

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedSearch(globalSearch.trim()),
      400,
    );
    return () => clearTimeout(timer);
  }, [globalSearch]);

  useEffect(() => {
    dispatch(fetchSettings());
    loadUsers();
  }, []);

  useEffect(() => {
    if (!currentUser || settings === null) return;
    loadPipeline();
  }, [selectedUser, debouncedSearch, currentUser, settings]);

  const stages = useMemo(() => {
    return settings?.pipelineStages?.length
      ? settings.pipelineStages
      : DEFAULT_STAGES;
  }, [settings]);

  // Set default mobile tab
  useEffect(() => {
    if (stages.length && mobileActiveStage === null) {
      setMobileActiveStage(stages[0].name);
    }
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
        const myTeam = allUsers.filter(u => {
          const mid = u.managerId?._id || u.managerId;
          return (
            mid?.toString() === currentUser._id?.toString() ||
            u._id?.toString() === currentUser._id?.toString()
          );
        });
        setUsers(myTeam);
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
      const filter = buildFilter();
      filter.status = getStatusFilter(status);

      const result = await leadsService.getLeads(filter, pageNumber, 20);
      const newItems = result.data || [];

      setColumnState(prev => {
        let merged;
        if (pageNumber === 1) {
          merged = newItems;
        } else {
          const existingIds = new Set(
            (prev[status]?.items || []).map(l => l._id),
          );
          const deduped = newItems.filter(l => !existingIds.has(l._id));
          merged = [...(prev[status]?.items || []), ...deduped];
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
    const initialState = {};

    stages.forEach(stage => {
      initialState[stage.name] = {
        items: [],
        page: 0,
        total: 0,
        totalPages: 1,
        hasNextPage: true,
        totalValue: 0,
      };
    });

    setColumnState(initialState);

    await Promise.all(stages.map(stage => loadColumnPage(stage.name, 1)));
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
      const fullLead = await leadsService.getLead(lead._id);
      setEditingLead(fullLead);
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

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaView edges={['bottom']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>Pipeline</Text>
            <Text style={styles.subtitle}>Track leads stage-wise</Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={loadPipeline}
              disabled={loading}
              style={styles.refreshBtn}
            >
              <Text style={{ fontSize: 16 }}>⟳</Text>
            </TouchableOpacity>

            {canCreateLead && (
              <TouchableOpacity
                onPress={() => {
                  setEditingLead(null);
                  setShowCreateModal(true);
                }}
                style={styles.addBtn}
              >
                <Text style={styles.addBtnText}>+ Add</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* User Filter */}
        {(canViewAllLeads || (isManager && canViewTeamLeads)) && (
          <View style={{ marginTop: 8 }}>
            <CustomDropdown
              placeholder="All Users"
              options={[
                { value: '', label: 'All Users' },
                ...users.map(user => ({ value: user._id, label: user.name })),
              ]}
              value={selectedUser}
              onChange={setSelectedUser}
              searchable
              style={styles.pickerWrapper}
            />
          </View>
        )}

        {/* Stage Tabs */}
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
                  isActive && {
                    backgroundColor: stage.color,
                    borderColor: stage.color,
                  },
                ]}
              >
                <Text
                  style={[styles.stageTabText, isActive && { color: '#fff' }]}
                >
                  {stage.name}
                </Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{stageData.total || 0}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Content */}
      {loading ? (
        <KanbanSkeleton />
      ) : (
        <FlatList
          data={activeMobileData.items}
          keyExtractor={item => item._id}
          renderItem={({ item }) => (
            <MobileLeadCard
              lead={item}
              stage={activeStageFull}
              onOpen={handleCardClick}
              formatCurrency={formatCurrency}
              getAssignedName={getAssignedName}
            />
          )}
          contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 60 }}>
              <Text style={{ fontSize: 40, marginBottom: 8 }}>📋</Text>
              <Text style={{ color: '#9ca3af' }}>No leads in this stage</Text>
            </View>
          }
          ListFooterComponent={
            loadingColumns[mobileActiveStage] ? (
              <ActivityIndicator style={{ marginVertical: 20 }} />
            ) : null
          }
        />
      )}

      {/* Lead Form Modal */}
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
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 22, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    backgroundColor: '#5a7bf6',
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
  },
  addBtnText: { color: '#fff', fontWeight: '700' },
  filterLabel: {
    fontSize: 10,
    color: '#9ca3af',
    marginBottom: 4,
    fontWeight: '600',
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  tabsContainer: { marginTop: 12 },
  stageTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    marginRight: 8,
  },
  stageTabText: { fontWeight: '700', fontSize: 13, color: '#374151' },
  countBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 999,
    marginLeft: 6,
  },
  countText: { fontSize: 11, fontWeight: '700', color: '#6b7280' },
  mobileCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cardName: { fontSize: 15, fontWeight: '700', flex: 1, color: '#111827' },
  crossSellBadge: {
    backgroundColor: '#f3e8ff',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  crossSellText: { fontSize: 10, color: '#7c3aed', fontWeight: '700' },
  valueText: { fontSize: 13, fontWeight: '700', color: '#16a34a' },
  phoneText: { color: '#6b7280', fontSize: 13, marginBottom: 2 },
  altPhone: {
    fontSize: 11,
    color: '#6366f1',
    backgroundColor: '#eef2ff',
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
  assignedText: { color: '#6b7280', fontSize: 12 },
  stageBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  stageBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});

export default KanbanScreen;
