import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useUISystem } from '../../hooks/useUISystem';
import { leadsService } from '../../services/leadsService.js';
import { userService } from '../../services/userService.js';
import { fetchSettings } from '../../store/slices/settingsSlice.js';
import { canUser } from '../../utils/permissions.js';
import api from '../../services/api.js';
import LeadFormModal from '../../components/common/LeadFormModal.jsx';
import LeadPreviewDrawer from '../../components/common/LeadPreviewDrawer.jsx';
import LeadsListMobile from '../../components/common/LeadsListMobile.jsx';
import Pagination from '../../components/common/Pagination.jsx';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useToast as useKitToast } from '../../components/ui/CustomToast';

// ─── UI Kit imports ────────────────────────────────────────────────────────
import ImprovedButton from '../../components/ui/ImprovedButton';
import IconButton from '../../components/ui/IconButton';
import ActiveFilterBadge from '../../components/ui/ActiveFilterBadge';
import BottomSheet from '../../components/ui/BottomSheet';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Avatar from '../../components/ui/Avatar';
import EmptyState from '../../components/ui/EmptyState';

// ─────────────────────────────────────────────────────────────
const SOURCE_OPTIONS = [
  'Google Ads',
  'Website',
  'Referral',
  'Walk-in',
  'Cold Call',
  'Social Media',
  'Google Sheet',
  'Meta Ads',
  'Other',
];
const PRIORITY_OPTIONS = ['Urgent', 'High', 'Normal'];
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest', icon: 'clock-outline' },
  {
    value: 'active',
    label: 'Active (Recently Contacted)',
    icon: 'lightning-bolt',
  },
  { value: 'stale', label: 'Stale (Not Recently Contacted)', icon: 'sleep' },
  { value: 'hottest', label: 'Hottest (High Priority)', icon: 'fire' },
  { value: 'largest', label: 'Largest (Deal Value)', icon: 'cash' },
  {
    value: 'upcoming',
    label: 'Upcoming (No Activity Yet)',
    icon: 'calendar-clock',
  },
];
const DEFAULT_STATUS_OPTIONS = [
  'New',
  'Interested',
  'Details Shared',
  'Success',
  'Closed',
  'Repeat',
];

// ─────────────────────────────────────────────────────────────
//  MAIN SCREEN
// ─────────────────────────────────────────────────────────────
const LeadsScreen = () => {
  const { colors, typography, spacing, borderRadius, isDark } = useUISystem();
  const toast = useKitToast();
  const dispatch = useDispatch();
  const settings = useSelector(s => s.settings?.data || s.settings);
  const currentUser = useSelector(s => s.auth.user);
  const globalSearch = useSelector(s => s.search?.query || '');

  // ── Permissions ──
  const canCreateLead = canUser(currentUser, settings, 'add_leads');
  const canViewAllLeads = canUser(currentUser, settings, 'view_all_leads');
  const canViewTeamLeads = canUser(
    currentUser,
    settings,
    'view_team_leads_only',
  );
  const isManager = currentUser?.role === 'manager';
  const canEditAnyLead = canUser(currentUser, settings, 'edit_any_lead');
  const canDeleteLead = canUser(currentUser, settings, 'delete_leads');
  const canAssignLead = canUser(currentUser, settings, 'assign_leads');
  const canChangeLeadOwner = canUser(
    currentUser,
    settings,
    'change_lead_owner',
  );

  // ── Data ──
  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // ── Lead modals ──
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [previewLead, setPreviewLead] = useState(null);
  const [showPreviewDrawer, setShowPreviewDrawer] = useState(false);

  const [previewMode, setPreviewMode] = useState('details');
  const [activeTabOverride, setActiveTabOverride] = useState(null);
  const [activityRefreshTrigger, setActivityRefreshTrigger] = useState(0);

  // ── Delete modals ──
  const [deleteLeadModal, setDeleteLeadModal] = useState(null);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  // ── Bulk action modals ──
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showPriorityModal, setShowPriorityModal] = useState(false);

  // ── Filter / Sort sheets ──
  const [showFiltersSheet, setShowFiltersSheet] = useState(false);
  const [showSortSheet, setShowSortSheet] = useState(false);

  // ── Bulk state ──
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkAssignUserId, setBulkAssignUserId] = useState('');
  const [bulkStatusValue, setBulkStatusValue] = useState('');
  const [bulkPriorityValue, setBulkPriorityValue] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);

  // ── Filters ──
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    dateFrom: '',
    dateTo: '',
    assignedTo: '',
    coAssignedTo: '',
    search: '',
    sortBy: '',
  });
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // ── Native date picker state ──
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [tempFromDate, setTempFromDate] = useState(new Date());
  const [tempToDate, setTempToDate] = useState(new Date());

  // ── User search (inside filter sheet) ──
  const [userSearch, setUserSearch] = useState('');
  const [coUserSearch, setCoUserSearch] = useState('');

  // ── Pagination ──
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const skipLoadAfterSearchRef = useRef(false);

  const skipLoadAfterAppendRef = useRef(false);

  const firstPageRef = useRef(1);

  const [listResetSignal, setListResetSignal] = useState(0);

  // ── Status options from settings ──
  const statusOptions = useMemo(
    () => settings?.pipelineStages?.map(s => s.name) || DEFAULT_STATUS_OPTIONS,
    [settings],
  );

  // ── Filtered user lists ──
  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return users;
    const q = userSearch.toLowerCase();
    return users.filter(u => (u.name || '').toLowerCase().includes(q));
  }, [users, userSearch]);

  const filteredCoUsers = useMemo(() => {
    if (!coUserSearch.trim()) return users;
    const q = coUserSearch.toLowerCase();
    return users.filter(u => (u.name || '').toLowerCase().includes(q));
  }, [users, coUserSearch]);

  // ── Init ──
  useEffect(() => {
    dispatch(fetchSettings());
    loadUsers();
  }, []);

  // ── Global search debounce ──
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(globalSearch.trim()), 400);
    return () => clearTimeout(t);
  }, [globalSearch]);

  useEffect(() => {
    if (!currentUser || settings === null) return;
    setPagination(prev => (prev.page === 1 ? prev : { ...prev, page: 1 }));
    skipLoadAfterSearchRef.current = true;
    loadLeads(1);
  }, [debouncedSearch, currentUser, settings]);

  useEffect(() => {
    if (!currentUser || settings === null) return;
    if (skipLoadAfterSearchRef.current) {
      skipLoadAfterSearchRef.current = false;
      return;
    }
    if (skipLoadAfterAppendRef.current) {
      skipLoadAfterAppendRef.current = false;
      return;
    }
    loadLeads();
  }, [
    pagination.page,
    pagination.limit,
    filters.status,
    filters.priority,
    filters.dateFrom,
    filters.dateTo,
    filters.assignedTo,
    filters.coAssignedTo,
    filters.search,
    filters.sortBy,
    currentUser,
    settings,
  ]);

  // ── Load users ──
  const loadUsers = async () => {
    try {
      const data = await userService.getUsers(1, 100);
      const all = data.items || data.data || [];
      if (isManager) {
        setUsers(
          all.filter(u => {
            const mid = u.managerId?._id || u.managerId;
            return (
              mid?.toString() === currentUser._id?.toString() ||
              u._id?.toString() === currentUser._id?.toString()
            );
          }),
        );
      } else {
        setUsers(all);
      }
    } catch (_) {}
  };

  const loadLeads = async (forcePage, { append = false } = {}) => {
    const activePage = forcePage ?? pagination.page;
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const fp = {};
      if (filters.status) fp.status = filters.status;
      if (filters.sortBy) fp.sortBy = filters.sortBy;
      if (filters.priority) fp.priority = filters.priority;
      if (filters.dateFrom) fp.dateFrom = filters.dateFrom;
      if (filters.dateTo) fp.dateTo = filters.dateTo;
      if (filters.dateFrom || filters.dateTo) {
        fp.dateFilterType =
          filters.status === 'Closed' || filters.status === 'Success'
            ? 'updatedAt'
            : 'createdAt';
      }
      const activeSearch = filters.search || debouncedSearch;
      if (activeSearch) fp.search = activeSearch;
      if (isManager && (canViewTeamLeads || canViewAllLeads)) {
        if (filters.assignedTo) fp.assignedTo = filters.assignedTo;
      } else if (canViewAllLeads) {
        if (filters.assignedTo) fp.assignedTo = filters.assignedTo;
        if (filters.coAssignedTo) fp.coAssignedTo = filters.coAssignedTo;
      } else if (currentUser?._id) {
        fp.assignedTo = currentUser._id;
      }

      const result = await leadsService.getLeads(
        fp,
        activePage,
        pagination.limit,
      );
      const items = result.data || [];
      if (append) {
        skipLoadAfterAppendRef.current = true;

        setLeads(prev => {
          const seen = new Set(prev.map(l => l?._id));
          return [...prev, ...items.filter(l => l && !seen.has(l._id))];
        });
      } else {
        firstPageRef.current = result.pagination?.page ?? activePage;
        setLeads(items);

        setListResetSignal(s => s + 1);
      }
      setPagination(prev => ({
        ...prev,
        page: result.pagination.page,
        total: result.pagination.total,
        totalPages: result.pagination.totalPages,
      }));
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Unable to load leads.');
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  };

  const handleLoadMore = () => {
    if (loading || loadingMore) return;
    if (pagination.page >= pagination.totalPages) return;
    loadLeads(pagination.page + 1, { append: true });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (pagination.page !== 1) {
        skipLoadAfterSearchRef.current = true;
        setPagination(prev => ({ ...prev, page: 1 }));
      }
      await loadLeads(1);
    } finally {
      setRefreshing(false);
    }
  };

  // ── Filter helpers ──
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const clearAllFilters = () => {
    setFilters({
      status: '',
      priority: '',
      dateFrom: '',
      dateTo: '',
      assignedTo: '',
      coAssignedTo: '',
      search: '',
      sortBy: '',
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const hasActiveFilters =
    filters.status ||
    filters.priority ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.assignedTo ||
    filters.coAssignedTo ||
    filters.search ||
    filters.sortBy;

  const activeFilterCount = [
    filters.status,
    filters.priority,
    filters.dateFrom || filters.dateTo,
    filters.assignedTo,
    filters.coAssignedTo,
  ].filter(Boolean).length;

  // ── Date helpers ──
  const dateToString = d => {
    if (!d) return '';
    const date = d instanceof Date ? d : new Date(d);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const formatDateDisplay = str => {
    if (!str) return '';
    const d = new Date(str + 'T00:00:00');
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  // ── Format helpers ──
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

  const getStageColor = status => {
    const name = status || 'New';
    const stage = (settings?.pipelineStages || []).find(s => s.name === name);
    if (stage?.color) return stage.color;
    if (name === 'Repeat') return '#9333ea';
    if (name === 'New') return '#60a5fa';
    return '#94a3b8';
  };

  const getContrastTextColor = hex => {
    if (!hex) return '#111';
    const h = hex.replace('#', '');
    const norm =
      h.length === 3
        ? h
            .split('')
            .map(c => c + c)
            .join('')
        : h;
    const val = parseInt(norm, 16);
    const r = (val >> 16) & 255;
    const g = (val >> 8) & 255;
    const b = val & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.65 ? '#111' : '#fff';
  };

  const getPriorityColor = priority => {
    if (priority === 'Urgent') return { bg: '#fee2e2', text: '#dc2626' };
    if (priority === 'High') return { bg: '#ffedd5', text: '#ea580c' };
    return { bg: '#dbeafe', text: '#2563eb' };
  };

  const getSelectedUserName = id =>
    id ? users.find(u => u._id === id)?.name || null : null;

  // ── Selection ──
  const allPageIds = leads.map(l => l._id);
  const isAllSelected =
    allPageIds.length > 0 && allPageIds.every(id => selectedIds.has(id));

  const toggleSelectAll = async () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      try {
        const params = new URLSearchParams();
        if (filters.status) params.append('status', filters.status);
        if (filters.priority) params.append('priority', filters.priority);
        if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
        if (filters.dateTo) params.append('dateTo', filters.dateTo);
        if (filters.dateFrom || filters.dateTo)
          params.append('dateFilterType', 'createdAt');
        if (debouncedSearch) params.append('search', debouncedSearch);
        if (
          (canViewAllLeads || (isManager && canViewTeamLeads)) &&
          filters.assignedTo
        )
          params.append('assignedTo', filters.assignedTo);
        const res = await api.get(`/leads/ids?${params.toString()}`);
        setSelectedIds(new Set(res.data?.data?.ids || []));
      } catch {
        setSelectedIds(new Set(allPageIds));
      }
    }
  };

  const toggleSelectOne = id =>
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const clearSelection = () => setSelectedIds(new Set());

  // ── Bulk actions ──
  const handleBulkDelete = async () => {
    if (!selectedIds.size) return;
    setBulkLoading(true);
    try {
      await api.delete('/leads/bulk', { data: { ids: [...selectedIds] } });
      toast.success(`${selectedIds.size} leads deleted.`);
      clearSelection();
      await loadLeads();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Bulk delete failed.');
    } finally {
      setBulkLoading(false);
      setShowBulkDeleteModal(false);
    }
  };

  const handleBulkAssign = async () => {
    if (!bulkAssignUserId) {
      toast.error('Please select a user.');
      return;
    }
    setBulkLoading(true);
    try {
      await api.patch('/leads/bulk/assign', {
        ids: [...selectedIds],
        assignedTo: bulkAssignUserId,
      });
      const name = users.find(u => u._id === bulkAssignUserId)?.name;
      toast.success(`${selectedIds.size} leads assigned to ${name}.`);
      setShowAssignModal(false);
      setBulkAssignUserId('');
      clearSelection();
      await loadLeads();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Bulk assign failed.');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkStatusChange = async () => {
    if (!bulkStatusValue) {
      toast.error('Please select a status.');
      return;
    }
    setBulkLoading(true);
    try {
      await api.patch('/leads/bulk/status', {
        ids: [...selectedIds],
        status: bulkStatusValue,
      });
      toast.success(
        `${selectedIds.size} leads updated to "${bulkStatusValue}".`,
      );
      setShowStatusModal(false);
      setBulkStatusValue('');
      clearSelection();
      await loadLeads();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Bulk status update failed.');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkPriorityChange = async () => {
    if (!bulkPriorityValue) {
      toast.error('Please select a priority.');
      return;
    }
    setBulkLoading(true);
    try {
      await api.patch('/leads/bulk/priority', {
        ids: [...selectedIds],
        priority: bulkPriorityValue,
      });
      toast.success(
        `${selectedIds.size} leads updated to "${bulkPriorityValue}" priority.`,
      );
      setShowPriorityModal(false);
      setBulkPriorityValue('');
      clearSelection();
      await loadLeads();
    } catch (err) {
      toast.error(
        err?.response?.data?.message || 'Bulk priority update failed.',
      );
    } finally {
      setBulkLoading(false);
    }
  };

  // ── Lead actions ──
  const triggerDeleteLead = id => setDeleteLeadModal(id);

  const confirmDeleteLead = async () => {
    if (!deleteLeadModal) return;
    try {
      await leadsService.deleteLead(deleteLeadModal);
      toast.success('Lead deleted successfully.');
      await loadLeads();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Unable to delete lead.');
    }
  };

  const handleOpenPreview = lead => {
    setPreviewLead(lead);
    setPreviewMode('both');
    setShowPreviewDrawer(true);
  };

  const handleOpenDetails = lead => {
    setPreviewLead(lead);
    setPreviewMode('details');
    setShowPreviewDrawer(true);
  };

  const handleDrawerRefresh = async () => {
    await loadLeads();
    if (previewLead?._id) {
      try {
        const f = await leadsService.getLead(previewLead._id);
        setPreviewLead(f);
      } catch (_) {}
    }
  };

  const handlePreviewOpenFull = async () => {
    setShowPreviewDrawer(false);
    if (!previewLead) return;
    if (!canEditAnyLead) {
      toast.error('No permission to edit.');
      return;
    }
    setEditingLead(previewLead);
    setActiveTabOverride(null);
    setShowCreateModal(true);
    try {
      const l = await leadsService.getLead(previewLead._id);
      setEditingLead(l);
    } catch {}
  };

  const openNewLead = () => {
    if (!canCreateLead) return;
    setEditingLead(null);
    setShowCreateModal(true);
  };

  const openEditLead = async lead => {
    if (!canEditAnyLead) {
      toast.error('No permission to edit.');
      return;
    }
    setActiveTabOverride('Profile');
    setEditingLead(lead);
    setShowCreateModal(true);
    try {
      const full = await leadsService.getLead(lead._id);
      setEditingLead(full);
    } catch (_) {}
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setEditingLead(null);
    setActiveTabOverride(null);
  };

  const handleSaveLead = async (leadData, leadId) => {
    try {
      if (leadId) {
        const saved = await leadsService.updateLead(leadId, leadData);
        toast.success('Lead updated successfully.');
        setActivityRefreshTrigger(p => p + 1);
        const wasSuccess = editingLead?.status === 'Success';
        if (leadData.status === 'Success' && !wasSuccess) {
          setActiveTabOverride('Cross-Sell');
          setEditingLead(saved || { ...editingLead, ...leadData });
        } else {
          handleCloseModal();
        }
        await loadLeads();
        if (previewLead?._id === leadId) {
          try {
            const f = await leadsService.getLead(leadId);
            setPreviewLead(f);
          } catch (_) {}
        }
      } else {
        const res = await leadsService.createLead(leadData);
        toast.success('Lead created successfully.');
        handleCloseModal();
        await loadLeads();
        return res;
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Unable to save lead.');
    }
  };

  // ── User list item (reused in filter & bulk modals) ──
  const UserListItem = ({ user: u, active, onPress }) => (
    <TouchableOpacity
      style={[
        styles.userItem,
        { borderBottomColor: colors.borderLight },
        active && { backgroundColor: colors.primarySoft },
      ]}
      onPress={onPress}
    >
      <Avatar
        name={u.name}
        size={32}
        rounded={16}
        variant={active ? 'solid' : 'soft'}
      />
      <View style={{ flex: 1 }}>
        <Text
          style={[
            typography.body2,
            {
              color: active ? colors.primary : colors.textPrimary,
              fontWeight: active ? '600' : '400',
            },
          ]}
        >
          {u.name}
        </Text>
        {u.email ? (
          <Text
            style={[
              typography.caption,
              { color: colors.textTertiary, marginTop: 1 },
            ]}
          >
            {u.email}
          </Text>
        ) : null}
      </View>
      {active && <Icon name="check-circle" size={18} color={colors.primary} />}
    </TouchableOpacity>
  );

  // ── RENDER ──────────────────────────────────────────────────
  return (
    <SafeAreaView
      edges={['bottom']}
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.surface,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <View style={styles.actionRow}>
            <View style={styles.titleBlock}>
              <Text
                style={[styles.headerTitle, { color: colors.textPrimary }]}
                numberOfLines={1}
              >
                Leads
              </Text>
              <Text
                style={[styles.headerSubtitle, { color: colors.textTertiary }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                Manage and track your sales pipeline
              </Text>
            </View>

            <View style={styles.headerActions}>
              <IconButton
                name="sort-variant"
                onPress={() => setShowSortSheet(true)}
                color={
                  filters.sortBy ? colors.textInverse : colors.textSecondary
                }
                backgroundColor={
                  filters.sortBy ? colors.primary : 'transparent'
                }
              />
              <TouchableOpacity
                onPress={() => setShowFiltersSheet(true)}
                style={[
                  styles.filterIconBtn,
                  {
                    backgroundColor: hasActiveFilters
                      ? colors.primary
                      : 'transparent',
                    borderRadius: borderRadius.md,
                  },
                ]}
              >
                <Icon
                  name="tune-variant"
                  size={20}
                  color={
                    hasActiveFilters ? colors.textInverse : colors.textSecondary
                  }
                />
                {activeFilterCount > 0 && (
                  <View
                    style={[
                      styles.filterBadge,
                      { backgroundColor: colors.danger },
                    ]}
                  >
                    <Text style={styles.filterBadgeText}>
                      {activeFilterCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              {canCreateLead && (
                <ImprovedButton
                  title="Add"
                  icon="plus"
                  size="small"
                  onPress={openNewLead}
                />
              )}
            </View>
          </View>

          {/* ── Active filter badges ── */}
          {hasActiveFilters && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.activeBadgesRow}
            >
              {filters.status ? (
                <ActiveFilterBadge
                  label={filters.status}
                  dotColor={getStageColor(filters.status)}
                  onRemove={() => handleFilterChange('status', '')}
                />
              ) : null}
              {filters.priority ? (
                <ActiveFilterBadge
                  label={filters.priority}
                  icon="flag"
                  onRemove={() => handleFilterChange('priority', '')}
                />
              ) : null}
              {filters.dateFrom || filters.dateTo ? (
                <ActiveFilterBadge
                  label={`${
                    filters.dateFrom
                      ? formatDateDisplay(filters.dateFrom)
                      : '...'
                  } → ${
                    filters.dateTo ? formatDateDisplay(filters.dateTo) : '...'
                  }`}
                  icon="calendar-range"
                  onRemove={() => {
                    setFilters(prev => ({ ...prev, dateFrom: '', dateTo: '' }));
                    setPagination(prev => ({ ...prev, page: 1 }));
                  }}
                />
              ) : null}
              {filters.assignedTo ? (
                <ActiveFilterBadge
                  label={getSelectedUserName(filters.assignedTo) || 'Assigned'}
                  icon="account"
                  onRemove={() => handleFilterChange('assignedTo', '')}
                />
              ) : null}
              {filters.coAssignedTo ? (
                <ActiveFilterBadge
                  label={
                    getSelectedUserName(filters.coAssignedTo) || 'Co-assigned'
                  }
                  icon="account-multiple"
                  onRemove={() => handleFilterChange('coAssignedTo', '')}
                />
              ) : null}
              {filters.sortBy ? (
                <ActiveFilterBadge
                  label={
                    SORT_OPTIONS.find(o => o.value === filters.sortBy)?.label ||
                    filters.sortBy
                  }
                  icon="sort-variant"
                  onRemove={() => handleFilterChange('sortBy', '')}
                />
              ) : null}
              <TouchableOpacity
                onPress={clearAllFilters}
                style={{ paddingHorizontal: 6, paddingVertical: 5 }}
              >
                <Text
                  style={[
                    typography.caption,
                    { color: colors.danger, fontWeight: '600' },
                  ]}
                >
                  Clear all
                </Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>

        {/* ══ TOOLBAR ══ */}
        <View
          style={[
            styles.toolbar,
            {
              backgroundColor: colors.backgroundSecondary,
              borderBottomColor: colors.border,
            },
          ]}
        >
          {selectedIds.size > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.bulkBar}
            >
              <TouchableOpacity onPress={clearSelection}>
                <View
                  style={[
                    styles.selectedBadge,
                    { backgroundColor: colors.primarySoft },
                  ]}
                >
                  <Text
                    style={[
                      typography.caption,
                      { color: colors.primary, fontWeight: '600' },
                    ]}
                  >
                    {selectedIds.size} selected ✕
                  </Text>
                </View>
              </TouchableOpacity>
              {canAssignLead && (
                <ImprovedButton
                  title="👤 Assign"
                  variant="outline"
                  size="small"
                  disabled={bulkLoading}
                  onPress={() => setShowAssignModal(true)}
                />
              )}
              {canDeleteLead && (
                <ImprovedButton
                  title="🗑 Delete"
                  variant="danger"
                  size="small"
                  disabled={bulkLoading}
                  onPress={() => setShowBulkDeleteModal(true)}
                />
              )}
              <ImprovedButton
                title="✏ Status"
                variant="outline"
                size="small"
                disabled={bulkLoading}
                onPress={() => setShowStatusModal(true)}
              />
              <ImprovedButton
                title="🔥 Priority"
                variant="outline"
                size="small"
                disabled={bulkLoading}
                onPress={() => setShowPriorityModal(true)}
              />
            </ScrollView>
          ) : (
            <View style={styles.toolbarNormal}>
              <TouchableOpacity
                onPress={toggleSelectAll}
                style={styles.selectAllBtn}
              >
                <View
                  style={[
                    styles.checkbox,
                    { borderColor: colors.borderSolid },
                    isAllSelected && {
                      backgroundColor: colors.primary,
                      borderColor: colors.primary,
                    },
                  ]}
                >
                  {isAllSelected && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text
                  style={[typography.caption, { color: colors.textSecondary }]}
                >
                  Select all
                </Text>
              </TouchableOpacity>
              <Text
                style={[
                  typography.caption,
                  { color: colors.textSecondary, marginLeft: 'auto' },
                ]}
              >
                {pagination.total} leads
              </Text>
              {hasActiveFilters && (
                <TouchableOpacity onPress={clearAllFilters}>
                  <Text
                    style={[
                      typography.caption,
                      { color: colors.danger, fontWeight: '500' },
                    ]}
                  >
                    ✕ Clear
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* ══ LIST ══ */}
        <View style={styles.listContainer}>
          <LeadsListMobile
            leads={leads}
            loading={loading}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            onLoadMore={handleLoadMore}
            loadingMore={loadingMore}
            hasMore={pagination.page < pagination.totalPages}
            resetScrollSignal={listResetSignal}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelectOne}
            onPreview={handleOpenPreview}
            onOpenDetails={handleOpenDetails}
            onEdit={openEditLead}
            onDelete={id => triggerDeleteLead(id)}
            canEditAnyLead={canEditAnyLead}
            canDeleteLead={canDeleteLead}
            getStageColor={getStageColor}
            getContrastTextColor={getContrastTextColor}
            getPriorityColor={getPriorityColor}
            getAssignedName={getAssignedName}
            formatCurrency={formatCurrency}
          />
        </View>

        {/* ══ PAGINATION ══ */}
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          limit={pagination.limit}
          loading={loading}
          from={
            leads.length === 0
              ? 0
              : (firstPageRef.current - 1) * pagination.limit + 1
          }
          to={
            leads.length === 0
              ? 0
              : (firstPageRef.current - 1) * pagination.limit + leads.length
          }
          onPageChange={p => setPagination(prev => ({ ...prev, page: p }))}
          onLimitChange={l =>
            setPagination(prev => ({ ...prev, limit: l, page: 1 }))
          }
        />
      </View>

      {/* ════════════════════════════════════════════════════════
          FILTER BOTTOM SHEET
      ════════════════════════════════════════════════════════ */}
      <BottomSheet
        visible={showFiltersSheet}
        onClose={() => setShowFiltersSheet(false)}
        title="Filters"
        footerLabel={`Apply Filters${
          activeFilterCount > 0 ? ` (${activeFilterCount})` : ''
        }`}
        onFooterPress={() => setShowFiltersSheet(false)}
        rightHeader={
          hasActiveFilters ? (
            <TouchableOpacity onPress={clearAllFilters}>
              <Text
                style={[
                  typography.caption,
                  { color: colors.danger, fontWeight: '500' },
                ]}
              >
                Clear all
              </Text>
            </TouchableOpacity>
          ) : null
        }
      >
        {/* ── STATUS ── */}
        <Text style={[styles.filterLabel, { color: colors.textTertiary }]}>
          STATUS
        </Text>
        <View style={styles.chipsWrap}>
          <TouchableOpacity
            style={[
              styles.chip,
              {
                borderColor: colors.border,
                backgroundColor: !filters.status
                  ? colors.primary
                  : colors.surface,
              },
            ]}
            onPress={() => handleFilterChange('status', '')}
          >
            <Text
              style={[
                styles.chipText,
                {
                  color: !filters.status
                    ? colors.textInverse
                    : colors.textSecondary,
                },
              ]}
            >
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.chip,
              { borderColor: colors.border },
              filters.status === 'active' && {
                backgroundColor: colors.primarySoft,
                borderColor: colors.primary,
              },
            ]}
            onPress={() => handleFilterChange('status', 'active')}
          >
            <View style={[styles.chipDot, { backgroundColor: '#22c55e' }]} />
            <Text
              style={[
                styles.chipText,
                {
                  color:
                    filters.status === 'active'
                      ? colors.primary
                      : colors.textSecondary,
                },
              ]}
            >
              Active
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.chip,
              { borderColor: colors.border },
              filters.status === 'Repeat' && {
                backgroundColor: colors.purpleSoft,
                borderColor: colors.purple,
              },
            ]}
            onPress={() => handleFilterChange('status', 'Repeat')}
          >
            <View style={[styles.chipDot, { backgroundColor: '#9333ea' }]} />
            <Text
              style={[
                styles.chipText,
                {
                  color:
                    filters.status === 'Repeat'
                      ? colors.purple
                      : colors.textSecondary,
                },
              ]}
            >
              Repeat
            </Text>
          </TouchableOpacity>
          {statusOptions.map(st => {
            const active = filters.status === st;
            const color = getStageColor(st);
            return (
              <TouchableOpacity
                key={st}
                style={[
                  styles.chip,
                  { borderColor: colors.border },
                  active && {
                    backgroundColor: color + '18',
                    borderColor: color,
                  },
                ]}
                onPress={() => handleFilterChange('status', st)}
              >
                <View style={[styles.chipDot, { backgroundColor: color }]} />
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: active ? color : colors.textSecondary,
                      fontWeight: active ? '600' : '500',
                    },
                  ]}
                >
                  {st}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── PRIORITY ── */}
        <Text style={[styles.filterLabel, { color: colors.textTertiary }]}>
          PRIORITY
        </Text>
        <View style={styles.chipsWrap}>
          <TouchableOpacity
            style={[
              styles.chip,
              {
                borderColor: colors.border,
                backgroundColor: !filters.priority
                  ? colors.primary
                  : colors.surface,
              },
            ]}
            onPress={() => handleFilterChange('priority', '')}
          >
            <Text
              style={[
                styles.chipText,
                {
                  color: !filters.priority
                    ? colors.textInverse
                    : colors.textSecondary,
                },
              ]}
            >
              All
            </Text>
          </TouchableOpacity>
          {PRIORITY_OPTIONS.map(p => {
            const active = filters.priority === p;
            const pc = getPriorityColor(p);
            return (
              <TouchableOpacity
                key={p}
                style={[
                  styles.chip,
                  { borderColor: colors.border },
                  active && { backgroundColor: pc.bg, borderColor: pc.text },
                ]}
                onPress={() => handleFilterChange('priority', p)}
              >
                <Icon
                  name={
                    p === 'Urgent'
                      ? 'alert-circle'
                      : p === 'High'
                      ? 'arrow-up-circle'
                      : 'minus-circle'
                  }
                  size={14}
                  color={active ? pc.text : colors.textTertiary}
                />
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: active ? pc.text : colors.textSecondary,
                      fontWeight: active ? '600' : '500',
                    },
                  ]}
                >
                  {p}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── DATE RANGE ── */}
        <Text style={[styles.filterLabel, { color: colors.textTertiary }]}>
          DATE RANGE
        </Text>
        <View style={styles.dateRow}>
          <TouchableOpacity
            style={[
              styles.dateBtn,
              {
                borderColor: filters.dateFrom ? colors.primary : colors.border,
                backgroundColor: colors.backgroundSecondary,
                borderRadius: borderRadius.md,
              },
            ]}
            onPress={() => {
              setTempFromDate(
                filters.dateFrom
                  ? new Date(filters.dateFrom + 'T00:00:00')
                  : new Date(),
              );
              setShowFromPicker(true);
            }}
          >
            <Icon
              name="calendar-start"
              size={16}
              color={filters.dateFrom ? colors.primary : colors.textTertiary}
            />
            <Text
              style={[
                typography.body2,
                {
                  color: filters.dateFrom
                    ? colors.textPrimary
                    : colors.placeholder,
                  fontSize: 13,
                },
              ]}
            >
              {filters.dateFrom
                ? formatDateDisplay(filters.dateFrom)
                : 'From date'}
            </Text>
          </TouchableOpacity>
          <Icon name="arrow-right" size={16} color={colors.borderSolid} />
          <TouchableOpacity
            style={[
              styles.dateBtn,
              {
                borderColor: filters.dateTo ? colors.primary : colors.border,
                backgroundColor: colors.backgroundSecondary,
                borderRadius: borderRadius.md,
              },
            ]}
            onPress={() => {
              setTempToDate(
                filters.dateTo
                  ? new Date(filters.dateTo + 'T00:00:00')
                  : new Date(),
              );
              setShowToPicker(true);
            }}
          >
            <Icon
              name="calendar-end"
              size={16}
              color={filters.dateTo ? colors.primary : colors.textTertiary}
            />
            <Text
              style={[
                typography.body2,
                {
                  color: filters.dateTo
                    ? colors.textPrimary
                    : colors.placeholder,
                  fontSize: 13,
                },
              ]}
            >
              {filters.dateTo ? formatDateDisplay(filters.dateTo) : 'To date'}
            </Text>
          </TouchableOpacity>
        </View>

        {(filters.dateFrom || filters.dateTo) && (
          <View style={styles.dateRangeInfo}>
            <View
              style={[
                styles.dateRangeDisplay,
                {
                  backgroundColor: colors.primarySoft,
                  borderColor: colors.primaryBorder,
                  borderRadius: borderRadius.sm,
                },
              ]}
            >
              <Icon name="calendar-range" size={14} color={colors.primary} />
              <Text
                style={[
                  typography.caption,
                  { color: colors.primary, fontWeight: '500' },
                ]}
              >
                {filters.dateFrom ? formatDateDisplay(filters.dateFrom) : '...'}
                {'  →  '}
                {filters.dateTo ? formatDateDisplay(filters.dateTo) : '...'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.clearDateBtn}
              onPress={() => {
                setFilters(prev => ({ ...prev, dateFrom: '', dateTo: '' }));
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
            >
              <Icon name="close-circle" size={16} color={colors.danger} />
              <Text
                style={[
                  typography.caption,
                  { color: colors.danger, fontWeight: '500' },
                ]}
              >
                Clear
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── ASSIGNED TO ── */}
        {(canViewAllLeads || (isManager && canViewTeamLeads)) && (
          <>
            <Text style={[styles.filterLabel, { color: colors.textTertiary }]}>
              ASSIGNED TO
            </Text>
            <View
              style={[
                styles.userSearchBox,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.backgroundSecondary,
                  borderRadius: borderRadius.md,
                },
              ]}
            >
              <Icon name="magnify" size={16} color={colors.textTertiary} />
              <TextInput
                value={userSearch}
                onChangeText={setUserSearch}
                placeholder="Search team member..."
                placeholderTextColor={colors.placeholder}
                style={[styles.userSearchInput, { color: colors.textPrimary }]}
              />
              {userSearch ? (
                <TouchableOpacity onPress={() => setUserSearch('')}>
                  <Icon name="close" size={16} color={colors.textTertiary} />
                </TouchableOpacity>
              ) : null}
            </View>
            <View
              style={[
                styles.userList,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  borderRadius: borderRadius.lg,
                },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.userItem,
                  { borderBottomColor: colors.borderLight },
                  !filters.assignedTo && {
                    backgroundColor: colors.primarySoft,
                  },
                ]}
                onPress={() => handleFilterChange('assignedTo', '')}
              >
                <Avatar
                  name="All"
                  size={32}
                  rounded={16}
                  variant={!filters.assignedTo ? 'solid' : 'soft'}
                />
                <Text
                  style={[
                    typography.body2,
                    {
                      color: !filters.assignedTo
                        ? colors.primary
                        : colors.textPrimary,
                      fontWeight: !filters.assignedTo ? '600' : '400',
                    },
                  ]}
                >
                  All Users
                </Text>
                {!filters.assignedTo && (
                  <Icon
                    name="check-circle"
                    size={18}
                    color={colors.primary}
                    style={{ marginLeft: 'auto' }}
                  />
                )}
              </TouchableOpacity>
              {filteredUsers.map(u => (
                <UserListItem
                  key={u._id}
                  user={u}
                  active={filters.assignedTo === u._id}
                  onPress={() => handleFilterChange('assignedTo', u._id)}
                />
              ))}
              {filteredUsers.length === 0 && userSearch ? (
                <EmptyState
                  icon="account-search-outline"
                  message="No users found"
                  style={{ paddingVertical: 16 }}
                />
              ) : null}
            </View>
          </>
        )}

        {/* ── CO-ASSIGNEE ── */}
        {(canViewAllLeads || (isManager && canViewTeamLeads)) && (
          <>
            <Text style={[styles.filterLabel, { color: colors.textTertiary }]}>
              CO-ASSIGNEE
            </Text>
            <View
              style={[
                styles.userSearchBox,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.backgroundSecondary,
                  borderRadius: borderRadius.md,
                },
              ]}
            >
              <Icon name="magnify" size={16} color={colors.textTertiary} />
              <TextInput
                value={coUserSearch}
                onChangeText={setCoUserSearch}
                placeholder="Search co-assignee..."
                placeholderTextColor={colors.placeholder}
                style={[styles.userSearchInput, { color: colors.textPrimary }]}
              />
              {coUserSearch ? (
                <TouchableOpacity onPress={() => setCoUserSearch('')}>
                  <Icon name="close" size={16} color={colors.textTertiary} />
                </TouchableOpacity>
              ) : null}
            </View>
            <View
              style={[
                styles.userList,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  borderRadius: borderRadius.lg,
                },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.userItem,
                  { borderBottomColor: colors.borderLight },
                  !filters.coAssignedTo && {
                    backgroundColor: colors.primarySoft,
                  },
                ]}
                onPress={() => handleFilterChange('coAssignedTo', '')}
              >
                <Avatar
                  name="All"
                  size={32}
                  rounded={16}
                  variant={!filters.coAssignedTo ? 'solid' : 'soft'}
                />
                <Text
                  style={[
                    typography.body2,
                    {
                      color: !filters.coAssignedTo
                        ? colors.primary
                        : colors.textPrimary,
                      fontWeight: !filters.coAssignedTo ? '600' : '400',
                    },
                  ]}
                >
                  All Co-assignees
                </Text>
                {!filters.coAssignedTo && (
                  <Icon
                    name="check-circle"
                    size={18}
                    color={colors.primary}
                    style={{ marginLeft: 'auto' }}
                  />
                )}
              </TouchableOpacity>
              {filteredCoUsers.map(u => (
                <UserListItem
                  key={u._id}
                  user={u}
                  active={filters.coAssignedTo === u._id}
                  onPress={() => handleFilterChange('coAssignedTo', u._id)}
                />
              ))}
              {filteredCoUsers.length === 0 && coUserSearch ? (
                <EmptyState
                  icon="account-search-outline"
                  message="No users found"
                  style={{ paddingVertical: 16 }}
                />
              ) : null}
            </View>
          </>
        )}
      </BottomSheet>

      {/* ════════════════════════════════════════════════════════
          NATIVE DATE PICKERS
      ════════════════════════════════════════════════════════ */}
      {showFromPicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={tempFromDate}
          mode="date"
          display="default"
          maximumDate={
            filters.dateTo ? new Date(filters.dateTo + 'T00:00:00') : undefined
          }
          onChange={(e, date) => {
            setShowFromPicker(false);
            if (e.type === 'set' && date)
              handleFilterChange('dateFrom', dateToString(date));
          }}
        />
      )}
      {showFromPicker && Platform.OS === 'ios' && (
        <ConfirmDialog
          visible
          onClose={() => setShowFromPicker(false)}
          title="From Date"
          variant="primary"
          confirmLabel="Done"
          cancelLabel="Cancel"
          onConfirm={() => {
            handleFilterChange('dateFrom', dateToString(tempFromDate));
            setShowFromPicker(false);
          }}
          message={
            <DateTimePicker
              value={tempFromDate}
              mode="date"
              display="spinner"
              maximumDate={
                filters.dateTo
                  ? new Date(filters.dateTo + 'T00:00:00')
                  : undefined
              }
              onChange={(e, date) => {
                if (date) setTempFromDate(date);
              }}
              style={{ height: 180 }}
            />
          }
        />
      )}
      {showToPicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={tempToDate}
          mode="date"
          display="default"
          minimumDate={
            filters.dateFrom
              ? new Date(filters.dateFrom + 'T00:00:00')
              : undefined
          }
          onChange={(e, date) => {
            setShowToPicker(false);
            if (e.type === 'set' && date)
              handleFilterChange('dateTo', dateToString(date));
          }}
        />
      )}
      {showToPicker && Platform.OS === 'ios' && (
        <ConfirmDialog
          visible
          onClose={() => setShowToPicker(false)}
          title="To Date"
          variant="primary"
          confirmLabel="Done"
          cancelLabel="Cancel"
          onConfirm={() => {
            handleFilterChange('dateTo', dateToString(tempToDate));
            setShowToPicker(false);
          }}
          message={
            <DateTimePicker
              value={tempToDate}
              mode="date"
              display="spinner"
              minimumDate={
                filters.dateFrom
                  ? new Date(filters.dateFrom + 'T00:00:00')
                  : undefined
              }
              onChange={(e, date) => {
                if (date) setTempToDate(date);
              }}
              style={{ height: 180 }}
            />
          }
        />
      )}

      {/* ════════════════════════════════════════════════════════
          SORT BOTTOM SHEET
      ════════════════════════════════════════════════════════ */}
      <BottomSheet
        visible={showSortSheet}
        onClose={() => setShowSortSheet(false)}
        title="Sort By"
        maxHeight={440}
      >
        {SORT_OPTIONS.map(opt => {
          const active = filters.sortBy === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              onPress={() => {
                handleFilterChange('sortBy', active ? '' : opt.value);
                setShowSortSheet(false);
              }}
              style={[
                styles.sortOption,
                { borderBottomColor: colors.borderLight },
                active && { backgroundColor: colors.primarySoft },
              ]}
            >
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
              >
                <Icon
                  name={opt.icon}
                  size={20}
                  color={active ? colors.primary : colors.textSecondary}
                />
                <Text
                  style={[
                    typography.body2,
                    {
                      color: active ? colors.primary : colors.textPrimary,
                      fontWeight: active ? '600' : '400',
                    },
                  ]}
                >
                  {opt.label}
                </Text>
              </View>
              {active && <Icon name="check" size={20} color={colors.primary} />}
            </TouchableOpacity>
          );
        })}
      </BottomSheet>

      {/* ════════════════════════════════════════════════════════
          BULK ASSIGN MODAL
      ════════════════════════════════════════════════════════ */}
      <BottomSheet
        visible={showAssignModal}
        onClose={() => {
          setShowAssignModal(false);
          setBulkAssignUserId('');
        }}
        title={`Assign ${selectedIds.size} Lead${
          selectedIds.size > 1 ? 's' : ''
        }`}
        footerLabel="Assign"
        onFooterPress={handleBulkAssign}
      >
        <ScrollView
          style={{ maxHeight: 280 }}
          showsVerticalScrollIndicator={false}
        >
          {users.map(u => (
            <UserListItem
              key={u._id}
              user={u}
              active={bulkAssignUserId === u._id}
              onPress={() => setBulkAssignUserId(u._id)}
            />
          ))}
        </ScrollView>
      </BottomSheet>

      {/* ════════════════════════════════════════════════════════
          BULK STATUS MODAL
      ════════════════════════════════════════════════════════ */}
      <BottomSheet
        visible={showStatusModal}
        onClose={() => {
          setShowStatusModal(false);
          setBulkStatusValue('');
        }}
        title={`Change Status — ${selectedIds.size} Lead${
          selectedIds.size > 1 ? 's' : ''
        }`}
        footerLabel="Update"
        onFooterPress={handleBulkStatusChange}
      >
        <View style={[styles.chipsWrap, { marginTop: 4 }]}>
          {statusOptions.map(st => {
            const active = bulkStatusValue === st;
            const color = getStageColor(st);
            return (
              <TouchableOpacity
                key={st}
                style={[
                  styles.chip,
                  { borderColor: colors.border },
                  active && {
                    backgroundColor: color + '18',
                    borderColor: color,
                  },
                ]}
                onPress={() => setBulkStatusValue(st)}
              >
                <View style={[styles.chipDot, { backgroundColor: color }]} />
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: active ? color : colors.textSecondary,
                      fontWeight: active ? '600' : '500',
                    },
                  ]}
                >
                  {st}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </BottomSheet>

      {/* ════════════════════════════════════════════════════════
          BULK PRIORITY MODAL
      ════════════════════════════════════════════════════════ */}
      <BottomSheet
        visible={showPriorityModal}
        onClose={() => {
          setShowPriorityModal(false);
          setBulkPriorityValue('');
        }}
        title={`Change Priority — ${selectedIds.size} Lead${
          selectedIds.size > 1 ? 's' : ''
        }`}
        footerLabel="Update"
        onFooterPress={handleBulkPriorityChange}
      >
        <View style={[styles.chipsWrap, { marginTop: 4 }]}>
          {PRIORITY_OPTIONS.map(p => {
            const active = bulkPriorityValue === p;
            const pc = getPriorityColor(p);
            return (
              <TouchableOpacity
                key={p}
                style={[
                  styles.chip,
                  { borderColor: colors.border },
                  active && { backgroundColor: pc.bg, borderColor: pc.text },
                ]}
                onPress={() => setBulkPriorityValue(p)}
              >
                <Icon
                  name={
                    p === 'Urgent'
                      ? 'alert-circle'
                      : p === 'High'
                      ? 'arrow-up-circle'
                      : 'minus-circle'
                  }
                  size={14}
                  color={active ? pc.text : colors.textTertiary}
                />
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: active ? pc.text : colors.textSecondary,
                      fontWeight: active ? '600' : '500',
                    },
                  ]}
                >
                  {p}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </BottomSheet>

      {/* ── Delete single ── */}
      <ConfirmDialog
        visible={!!deleteLeadModal}
        onClose={() => setDeleteLeadModal(null)}
        onConfirm={confirmDeleteLead}
        title="Delete Lead"
        message="Are you sure you want to delete this lead? This action cannot be undone."
        loading={bulkLoading}
      />

      {/* ── Bulk delete ── */}
      <ConfirmDialog
        visible={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        onConfirm={handleBulkDelete}
        title="Delete Selected Leads"
        message={`Delete ${selectedIds.size} selected lead(s)? This cannot be undone.`}
        loading={bulkLoading}
      />

      {/* ── Lead Form ── */}
      <LeadFormModal
        visible={showCreateModal}
        lead={editingLead}
        initialTab={activeTabOverride}
        onClose={handleCloseModal}
        onSubmit={handleSaveLead}
        users={users}
        currentUserId={currentUser?._id}
        settings={settings}
        canCreateLead={canCreateLead}
        canEditAnyLead={canEditAnyLead}
        canAssignLead={canAssignLead}
        canChangeLeadOwner={canChangeLeadOwner}
        statusOptions={statusOptions}
        sourceOptions={SOURCE_OPTIONS}
      />

      {/* ── Preview Drawer ── */}
      <LeadPreviewDrawer
        lead={previewLead}
        visible={showPreviewDrawer}
        onClose={() => setShowPreviewDrawer(false)}
        onOpenFull={handlePreviewOpenFull}
        users={users}
        activityRefreshTrigger={activityRefreshTrigger}
        onRefresh={handleDrawerRefresh}
        canEditAnyLead={canEditAnyLead}
        mode={previewMode}
      />
    </SafeAreaView>
  );
};

// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  header: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleBlock: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  headerSubtitle: { fontSize: 11, marginTop: 1 },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  filterIconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  activeBadgesRow: { gap: 8, paddingTop: 2, alignItems: 'center' },
  toolbar: { borderBottomWidth: 1, minHeight: 40, justifyContent: 'center' },
  toolbarNormal: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 10,
  },
  bulkBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 8,
  },
  selectedBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  selectAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: { color: '#fff', fontSize: 11, fontWeight: '700' },
  listContainer: { flex: 1 },
  filterLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 20,
  },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: '500' },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  dateBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  dateRangeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  dateRangeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
  },
  clearDateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
  },
  userSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 10,
    borderWidth: 1,
    marginBottom: 6,
  },
  userSearchInput: { flex: 1, fontSize: 13, paddingVertical: 0 },
  userList: { borderWidth: 1, overflow: 'hidden', maxHeight: 220 },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
});

export default LeadsScreen;
