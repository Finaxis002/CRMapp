import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import DateTimePicker from '@react-native-community/datetimepicker';

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

// ─────────────────────────────────────────────────────────────
const ACCENT = '#5a7bf6';

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

// ─── toast ────────────────────────────────────────────────────
const toast = {
  success: msg => Alert.alert('Success', msg),
  error: msg => Alert.alert('Error', msg),
};

// ─── DeleteModal ──────────────────────────────────────────────
const DeleteModal = ({ isOpen, onClose, onConfirm, title, message }) => (
  <Modal
    visible={isOpen}
    transparent
    animationType="fade"
    onRequestClose={onClose}
  >
    <View style={styles.modalOverlay}>
      <View style={styles.modalCard}>
        <Text style={styles.modalTitle}>{title}</Text>
        <Text style={styles.modalMessage}>{message}</Text>
        <View style={styles.modalActions}>
          <TouchableOpacity style={styles.modalBtnCancel} onPress={onClose}>
            <Text style={styles.modalBtnCancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.modalBtnDanger}
            onPress={() => {
              onConfirm();
              onClose();
            }}
          >
            <Text style={styles.modalBtnDangerText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

// ─────────────────────────────────────────────────────────────
//  MAIN SCREEN
// ─────────────────────────────────────────────────────────────
const LeadsScreen = () => {
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

  // ── Lead modals ──
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [previewLead, setPreviewLead] = useState(null);
  const [showPreviewDrawer, setShowPreviewDrawer] = useState(false);
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

  // ── Load leads ──
  const loadLeads = async forcePage => {
    const activePage = forcePage ?? pagination.page;
    setLoading(true);
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
      setLeads(result.data || []);
      setPagination(prev => ({
        ...prev,
        page: result.pagination.page,
        total: result.pagination.total,
        totalPages: result.pagination.totalPages,
      }));
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Unable to load leads.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadLeads();
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

  const getInitials = name =>
    (name || 'U')
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

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
        if (filters.search) params.append('search', filters.search);
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
    setEditingLead(null);
    setActiveTabOverride(null);
    try {
      const l = await leadsService.getLead(previewLead._id);
      setEditingLead(l);
    } catch {
      setEditingLead(previewLead);
    }
    setShowCreateModal(true);
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

  // ── RENDER ──────────────────────────────────────────────────
  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <View style={styles.container}>
        {/* ══ HEADER ══ */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.headerTitle}>Leads</Text>
              <Text style={styles.headerSubtitle}>
                Manage and track your sales pipeline
              </Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={() => setShowSortSheet(true)}
                style={[styles.iconBtn, filters.sortBy && styles.iconBtnActive]}
              >
                <Icon
                  name="sort-variant"
                  size={20}
                  color={filters.sortBy ? '#fff' : '#374151'}
                />
              </TouchableOpacity>
              {canCreateLead && (
                <TouchableOpacity onPress={openNewLead} style={styles.addBtn}>
                  <Icon name="plus" size={16} color="#fff" />
                  <Text style={styles.addBtnText}>Add</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Search + Filter button */}
          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <Icon name="magnify" size={20} color="#9ca3af" />
              <TextInput
                value={filters.search}
                onChangeText={v => handleFilterChange('search', v)}
                placeholder="Search leads..."
                placeholderTextColor="#9ca3af"
                style={styles.searchInput}
              />
              {filters.search ? (
                <TouchableOpacity
                  onPress={() => handleFilterChange('search', '')}
                >
                  <Icon name="close-circle" size={18} color="#9ca3af" />
                </TouchableOpacity>
              ) : null}
            </View>

            <TouchableOpacity
              onPress={() => setShowFiltersSheet(true)}
              style={[
                styles.filterIconBtn,
                hasActiveFilters && styles.filterIconBtnActive,
              ]}
            >
              <Icon
                name="tune-variant"
                size={20}
                color={hasActiveFilters ? '#fff' : '#374151'}
              />
              {activeFilterCount > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>
                    {activeFilterCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* ── Active filter badges ── */}
          {hasActiveFilters && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.activeBadgesRow}
            >
              {filters.status ? (
                <TouchableOpacity
                  style={styles.activeBadge}
                  onPress={() => handleFilterChange('status', '')}
                >
                  <View
                    style={[
                      styles.badgeDot,
                      { backgroundColor: getStageColor(filters.status) },
                    ]}
                  />
                  <Text style={styles.activeBadgeText}>{filters.status}</Text>
                  <Icon name="close" size={13} color={ACCENT} />
                </TouchableOpacity>
              ) : null}

              {filters.priority ? (
                <TouchableOpacity
                  style={styles.activeBadge}
                  onPress={() => handleFilterChange('priority', '')}
                >
                  <Icon name="flag" size={13} color={ACCENT} />
                  <Text style={styles.activeBadgeText}>{filters.priority}</Text>
                  <Icon name="close" size={13} color={ACCENT} />
                </TouchableOpacity>
              ) : null}

              {filters.dateFrom || filters.dateTo ? (
                <TouchableOpacity
                  style={styles.activeBadge}
                  onPress={() => {
                    setFilters(prev => ({ ...prev, dateFrom: '', dateTo: '' }));
                    setPagination(prev => ({ ...prev, page: 1 }));
                  }}
                >
                  <Icon name="calendar-range" size={13} color={ACCENT} />
                  <Text style={styles.activeBadgeText}>
                    {filters.dateFrom
                      ? formatDateDisplay(filters.dateFrom)
                      : '...'}
                    {' → '}
                    {filters.dateTo ? formatDateDisplay(filters.dateTo) : '...'}
                  </Text>
                  <Icon name="close" size={13} color={ACCENT} />
                </TouchableOpacity>
              ) : null}

              {filters.assignedTo ? (
                <TouchableOpacity
                  style={styles.activeBadge}
                  onPress={() => handleFilterChange('assignedTo', '')}
                >
                  <Icon name="account" size={13} color={ACCENT} />
                  <Text style={styles.activeBadgeText}>
                    {getSelectedUserName(filters.assignedTo) || 'Assigned'}
                  </Text>
                  <Icon name="close" size={13} color={ACCENT} />
                </TouchableOpacity>
              ) : null}

              {filters.coAssignedTo ? (
                <TouchableOpacity
                  style={styles.activeBadge}
                  onPress={() => handleFilterChange('coAssignedTo', '')}
                >
                  <Icon name="account-multiple" size={13} color={ACCENT} />
                  <Text style={styles.activeBadgeText}>
                    {getSelectedUserName(filters.coAssignedTo) || 'Co-assigned'}
                  </Text>
                  <Icon name="close" size={13} color={ACCENT} />
                </TouchableOpacity>
              ) : null}

              {filters.sortBy ? (
                <TouchableOpacity
                  style={styles.activeBadge}
                  onPress={() => handleFilterChange('sortBy', '')}
                >
                  <Icon name="sort-variant" size={13} color={ACCENT} />
                  <Text style={styles.activeBadgeText}>
                    {SORT_OPTIONS.find(o => o.value === filters.sortBy)
                      ?.label || filters.sortBy}
                  </Text>
                  <Icon name="close" size={13} color={ACCENT} />
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                onPress={clearAllFilters}
                style={styles.clearAllBadge}
              >
                <Text style={styles.clearAllBadgeText}>Clear all</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>

        {/* ══ TOOLBAR ══ */}
        <View style={styles.toolbar}>
          {selectedIds.size > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.bulkBar}
            >
              <TouchableOpacity onPress={clearSelection}>
                <View style={styles.selectedBadge}>
                  <Text style={styles.selectedBadgeText}>
                    {selectedIds.size} selected ✕
                  </Text>
                </View>
              </TouchableOpacity>
              {canAssignLead && (
                <TouchableOpacity
                  disabled={bulkLoading}
                  onPress={() => setShowAssignModal(true)}
                  style={[styles.bulkBtn, styles.bulkBtnBlue]}
                >
                  <Text style={styles.bulkBtnBlueText}>👤 Assign</Text>
                </TouchableOpacity>
              )}
              {canDeleteLead && (
                <TouchableOpacity
                  disabled={bulkLoading}
                  onPress={() => setShowBulkDeleteModal(true)}
                  style={[styles.bulkBtn, styles.bulkBtnRed]}
                >
                  <Text style={styles.bulkBtnRedText}>🗑 Delete</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                disabled={bulkLoading}
                onPress={() => setShowStatusModal(true)}
                style={[styles.bulkBtn, styles.bulkBtnGreen]}
              >
                <Text style={styles.bulkBtnGreenText}>✏ Status</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={bulkLoading}
                onPress={() => setShowPriorityModal(true)}
                style={[styles.bulkBtn, styles.bulkBtnOrange]}
              >
                <Text style={styles.bulkBtnOrangeText}>🔥 Priority</Text>
              </TouchableOpacity>
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
                    isAllSelected && styles.checkboxSelected,
                  ]}
                >
                  {isAllSelected && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.selectAllText}>Select all</Text>
              </TouchableOpacity>
              <Text style={styles.totalText}>{pagination.total} leads</Text>
              {hasActiveFilters && (
                <TouchableOpacity onPress={clearAllFilters}>
                  <Text style={styles.clearFiltersText}>✕ Clear</Text>
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
            selectedIds={selectedIds}
            onToggleSelect={toggleSelectOne}
            onPreview={handleOpenPreview}
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
          onPageChange={p => setPagination(prev => ({ ...prev, page: p }))}
          onLimitChange={l =>
            setPagination(prev => ({ ...prev, limit: l, page: 1 }))
          }
        />
      </View>

      {/* ════════════════════════════════════════════════════════
          FILTER BOTTOM SHEET
      ════════════════════════════════════════════════════════ */}
      <Modal
        visible={showFiltersSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFiltersSheet(false)}
      >
        <View style={styles.sheetOverlay}>
          <TouchableOpacity
            style={styles.sheetBackdrop}
            activeOpacity={1}
            onPress={() => setShowFiltersSheet(false)}
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />

            {/* Header */}
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Filters</Text>
              <View style={styles.sheetHeaderRight}>
                {hasActiveFilters && (
                  <TouchableOpacity onPress={clearAllFilters}>
                    <Text style={styles.clearAllText}>Clear all</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setShowFiltersSheet(false)}>
                  <Icon name="close" size={22} color="#6b7280" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView
              style={styles.sheetBody}
              showsVerticalScrollIndicator={false}
            >
              {/* ── STATUS ── */}
              <Text style={styles.filterLabel}>STATUS</Text>
              <View style={styles.chipsWrap}>
                {/* All */}
                <TouchableOpacity
                  style={[styles.chip, !filters.status && styles.chipActive]}
                  onPress={() => handleFilterChange('status', '')}
                >
                  <Text
                    style={[
                      styles.chipText,
                      !filters.status && styles.chipTextActive,
                    ]}
                  >
                    All
                  </Text>
                </TouchableOpacity>

                {/* Active */}
                <TouchableOpacity
                  style={[
                    styles.chip,
                    filters.status === 'active' && styles.chipActive,
                  ]}
                  onPress={() => handleFilterChange('status', 'active')}
                >
                  <View
                    style={[styles.chipDot, { backgroundColor: '#22c55e' }]}
                  />
                  <Text
                    style={[
                      styles.chipText,
                      filters.status === 'active' && styles.chipTextActive,
                    ]}
                  >
                    Active
                  </Text>
                </TouchableOpacity>

                {/* Repeat */}
                <TouchableOpacity
                  style={[
                    styles.chip,
                    filters.status === 'Repeat' && styles.chipActive,
                  ]}
                  onPress={() => handleFilterChange('status', 'Repeat')}
                >
                  <View
                    style={[styles.chipDot, { backgroundColor: '#9333ea' }]}
                  />
                  <Text
                    style={[
                      styles.chipText,
                      filters.status === 'Repeat' && styles.chipTextActive,
                    ]}
                  >
                    Repeat
                  </Text>
                </TouchableOpacity>

                {/* Dynamic stages */}
                {statusOptions.map(st => {
                  const active = filters.status === st;
                  const color = getStageColor(st);
                  return (
                    <TouchableOpacity
                      key={st}
                      style={[
                        styles.chip,
                        active && {
                          backgroundColor: color + '18',
                          borderColor: color,
                        },
                      ]}
                      onPress={() => handleFilterChange('status', st)}
                    >
                      <View
                        style={[styles.chipDot, { backgroundColor: color }]}
                      />
                      <Text
                        style={[
                          styles.chipText,
                          active && { color, fontWeight: '600' },
                        ]}
                      >
                        {st}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* ── PRIORITY ── */}
              <Text style={styles.filterLabel}>PRIORITY</Text>
              <View style={styles.chipsWrap}>
                <TouchableOpacity
                  style={[styles.chip, !filters.priority && styles.chipActive]}
                  onPress={() => handleFilterChange('priority', '')}
                >
                  <Text
                    style={[
                      styles.chipText,
                      !filters.priority && styles.chipTextActive,
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
                        active && {
                          backgroundColor: pc.bg,
                          borderColor: pc.text,
                        },
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
                        color={active ? pc.text : '#9ca3af'}
                      />
                      <Text
                        style={[
                          styles.chipText,
                          active && { color: pc.text, fontWeight: '600' },
                        ]}
                      >
                        {p}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* ── DATE RANGE ── */}
              <Text style={styles.filterLabel}>DATE RANGE</Text>

              {/* Two calendar buttons */}
              <View style={styles.dateRow}>
                {/* From */}
                <TouchableOpacity
                  style={[
                    styles.dateBtn,
                    filters.dateFrom && styles.dateBtnActive,
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
                    color={filters.dateFrom ? ACCENT : '#9ca3af'}
                  />
                  <Text
                    style={[
                      styles.dateBtnText,
                      filters.dateFrom && styles.dateBtnTextActive,
                    ]}
                  >
                    {filters.dateFrom
                      ? formatDateDisplay(filters.dateFrom)
                      : 'From date'}
                  </Text>
                </TouchableOpacity>

                <Icon name="arrow-right" size={16} color="#d1d5db" />

                {/* To */}
                <TouchableOpacity
                  style={[
                    styles.dateBtn,
                    filters.dateTo && styles.dateBtnActive,
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
                    color={filters.dateTo ? ACCENT : '#9ca3af'}
                  />
                  <Text
                    style={[
                      styles.dateBtnText,
                      filters.dateTo && styles.dateBtnTextActive,
                    ]}
                  >
                    {filters.dateTo
                      ? formatDateDisplay(filters.dateTo)
                      : 'To date'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Selected range display + clear */}
              {(filters.dateFrom || filters.dateTo) && (
                <View style={styles.dateRangeInfo}>
                  <View style={styles.dateRangeDisplay}>
                    <Icon name="calendar-range" size={14} color={ACCENT} />
                    <Text style={styles.dateRangeText}>
                      {filters.dateFrom
                        ? formatDateDisplay(filters.dateFrom)
                        : '...'}
                      {'  →  '}
                      {filters.dateTo
                        ? formatDateDisplay(filters.dateTo)
                        : '...'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.clearDateBtn}
                    onPress={() => {
                      setFilters(prev => ({
                        ...prev,
                        dateFrom: '',
                        dateTo: '',
                      }));
                      setPagination(prev => ({ ...prev, page: 1 }));
                    }}
                  >
                    <Icon name="close-circle" size={16} color="#ef4444" />
                    <Text style={styles.clearDateText}>Clear</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* ── ASSIGNED TO ── */}
              {(canViewAllLeads || (isManager && canViewTeamLeads)) && (
                <>
                  <Text style={styles.filterLabel}>ASSIGNED TO</Text>
                  <View style={styles.userSearchBox}>
                    <Icon name="magnify" size={16} color="#9ca3af" />
                    <TextInput
                      value={userSearch}
                      onChangeText={setUserSearch}
                      placeholder="Search team member..."
                      placeholderTextColor="#9ca3af"
                      style={styles.userSearchInput}
                    />
                    {userSearch ? (
                      <TouchableOpacity onPress={() => setUserSearch('')}>
                        <Icon name="close" size={16} color="#9ca3af" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <View style={styles.userList}>
                    {/* All users */}
                    <TouchableOpacity
                      style={[
                        styles.userItem,
                        !filters.assignedTo && styles.userItemActive,
                      ]}
                      onPress={() => handleFilterChange('assignedTo', '')}
                    >
                      <View
                        style={[
                          styles.userAvatar,
                          !filters.assignedTo && { backgroundColor: ACCENT },
                        ]}
                      >
                        <Icon
                          name="account-group"
                          size={14}
                          color={!filters.assignedTo ? '#fff' : '#6b7280'}
                        />
                      </View>
                      <Text
                        style={[
                          styles.userItemText,
                          !filters.assignedTo && styles.userItemTextActive,
                        ]}
                      >
                        All Users
                      </Text>
                      {!filters.assignedTo && (
                        <Icon
                          name="check-circle"
                          size={18}
                          color={ACCENT}
                          style={{ marginLeft: 'auto' }}
                        />
                      )}
                    </TouchableOpacity>
                    {filteredUsers.map(u => {
                      const active = filters.assignedTo === u._id;
                      return (
                        <TouchableOpacity
                          key={u._id}
                          style={[
                            styles.userItem,
                            active && styles.userItemActive,
                          ]}
                          onPress={() =>
                            handleFilterChange('assignedTo', u._id)
                          }
                        >
                          <View
                            style={[
                              styles.userAvatar,
                              active && { backgroundColor: ACCENT },
                            ]}
                          >
                            <Text
                              style={[
                                styles.userAvatarText,
                                active && { color: '#fff' },
                              ]}
                            >
                              {getInitials(u.name)}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.userItemText,
                                active && styles.userItemTextActive,
                              ]}
                            >
                              {u.name}
                            </Text>
                            {u.email ? (
                              <Text style={styles.userItemEmail}>
                                {u.email}
                              </Text>
                            ) : null}
                          </View>
                          {active && (
                            <Icon
                              name="check-circle"
                              size={18}
                              color={ACCENT}
                            />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                    {filteredUsers.length === 0 && userSearch ? (
                      <View style={styles.emptySearch}>
                        <Text style={styles.emptySearchText}>
                          No users found
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </>
              )}

              {/* ── CO-ASSIGNEE ── */}
              {(canViewAllLeads || (isManager && canViewTeamLeads)) && (
                <>
                  <Text style={styles.filterLabel}>CO-ASSIGNEE</Text>
                  <View style={styles.userSearchBox}>
                    <Icon name="magnify" size={16} color="#9ca3af" />
                    <TextInput
                      value={coUserSearch}
                      onChangeText={setCoUserSearch}
                      placeholder="Search co-assignee..."
                      placeholderTextColor="#9ca3af"
                      style={styles.userSearchInput}
                    />
                    {coUserSearch ? (
                      <TouchableOpacity onPress={() => setCoUserSearch('')}>
                        <Icon name="close" size={16} color="#9ca3af" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <View style={styles.userList}>
                    <TouchableOpacity
                      style={[
                        styles.userItem,
                        !filters.coAssignedTo && styles.userItemActive,
                      ]}
                      onPress={() => handleFilterChange('coAssignedTo', '')}
                    >
                      <View
                        style={[
                          styles.userAvatar,
                          !filters.coAssignedTo && { backgroundColor: ACCENT },
                        ]}
                      >
                        <Icon
                          name="account-group"
                          size={14}
                          color={!filters.coAssignedTo ? '#fff' : '#6b7280'}
                        />
                      </View>
                      <Text
                        style={[
                          styles.userItemText,
                          !filters.coAssignedTo && styles.userItemTextActive,
                        ]}
                      >
                        All Co-assignees
                      </Text>
                      {!filters.coAssignedTo && (
                        <Icon
                          name="check-circle"
                          size={18}
                          color={ACCENT}
                          style={{ marginLeft: 'auto' }}
                        />
                      )}
                    </TouchableOpacity>
                    {filteredCoUsers.map(u => {
                      const active = filters.coAssignedTo === u._id;
                      return (
                        <TouchableOpacity
                          key={u._id}
                          style={[
                            styles.userItem,
                            active && styles.userItemActive,
                          ]}
                          onPress={() =>
                            handleFilterChange('coAssignedTo', u._id)
                          }
                        >
                          <View
                            style={[
                              styles.userAvatar,
                              active && { backgroundColor: ACCENT },
                            ]}
                          >
                            <Text
                              style={[
                                styles.userAvatarText,
                                active && { color: '#fff' },
                              ]}
                            >
                              {getInitials(u.name)}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.userItemText,
                                active && styles.userItemTextActive,
                              ]}
                            >
                              {u.name}
                            </Text>
                            {u.email ? (
                              <Text style={styles.userItemEmail}>
                                {u.email}
                              </Text>
                            ) : null}
                          </View>
                          {active && (
                            <Icon
                              name="check-circle"
                              size={18}
                              color={ACCENT}
                            />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                    {filteredCoUsers.length === 0 && coUserSearch ? (
                      <View style={styles.emptySearch}>
                        <Text style={styles.emptySearchText}>
                          No users found
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </>
              )}

              <View style={{ height: 24 }} />
            </ScrollView>

            {/* Footer */}
            <View style={styles.sheetFooter}>
              <TouchableOpacity
                style={styles.applyBtn}
                onPress={() => setShowFiltersSheet(false)}
              >
                <Text style={styles.applyBtnText}>
                  Apply Filters
                  {activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ════════════════════════════════════════════════════════
          NATIVE DATE PICKERS
      ════════════════════════════════════════════════════════ */}

      {/* FROM DATE — Android */}
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
            if (e.type === 'set' && date) {
              handleFilterChange('dateFrom', dateToString(date));
            }
          }}
        />
      )}

      {/* FROM DATE — iOS (modal wrapper) */}
      {showFromPicker && Platform.OS === 'ios' && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setShowFromPicker(false)}
        >
          <View style={styles.dateModalOverlay}>
            <View style={styles.dateModalCard}>
              <Text style={styles.dateModalTitle}>From Date</Text>
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
              <View style={styles.dateModalActions}>
                <TouchableOpacity
                  style={styles.dateModalBtnCancel}
                  onPress={() => setShowFromPicker(false)}
                >
                  <Text style={styles.dateModalBtnCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dateModalBtnDone}
                  onPress={() => {
                    handleFilterChange('dateFrom', dateToString(tempFromDate));
                    setShowFromPicker(false);
                  }}
                >
                  <Text style={styles.dateModalBtnDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* TO DATE — Android */}
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
            if (e.type === 'set' && date) {
              handleFilterChange('dateTo', dateToString(date));
            }
          }}
        />
      )}

      {/* TO DATE — iOS (modal wrapper) */}
      {showToPicker && Platform.OS === 'ios' && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setShowToPicker(false)}
        >
          <View style={styles.dateModalOverlay}>
            <View style={styles.dateModalCard}>
              <Text style={styles.dateModalTitle}>To Date</Text>
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
              <View style={styles.dateModalActions}>
                <TouchableOpacity
                  style={styles.dateModalBtnCancel}
                  onPress={() => setShowToPicker(false)}
                >
                  <Text style={styles.dateModalBtnCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dateModalBtnDone}
                  onPress={() => {
                    handleFilterChange('dateTo', dateToString(tempToDate));
                    setShowToPicker(false);
                  }}
                >
                  <Text style={styles.dateModalBtnDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ════════════════════════════════════════════════════════
          SORT BOTTOM SHEET
      ════════════════════════════════════════════════════════ */}
      <Modal
        visible={showSortSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSortSheet(false)}
      >
        <View style={styles.sheetOverlay}>
          <TouchableOpacity
            style={styles.sheetBackdrop}
            activeOpacity={1}
            onPress={() => setShowSortSheet(false)}
          />
          <View style={[styles.sheet, { maxHeight: 440 }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Sort By</Text>
              <TouchableOpacity onPress={() => setShowSortSheet(false)}>
                <Icon name="close" size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <ScrollView>
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
                      active && styles.sortOptionActive,
                    ]}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                      }}
                    >
                      <Icon
                        name={opt.icon}
                        size={20}
                        color={active ? ACCENT : '#6b7280'}
                      />
                      <Text
                        style={[
                          styles.sortOptionText,
                          active && styles.sortOptionTextActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </View>
                    {active && <Icon name="check" size={20} color={ACCENT} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ════════════════════════════════════════════════════════
          BULK ASSIGN MODAL
      ════════════════════════════════════════════════════════ */}
      <Modal
        visible={showAssignModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAssignModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Assign {selectedIds.size} Lead{selectedIds.size > 1 ? 's' : ''}
            </Text>
            <ScrollView
              style={{ maxHeight: 280 }}
              showsVerticalScrollIndicator={false}
            >
              {users.map(u => {
                const active = bulkAssignUserId === u._id;
                return (
                  <TouchableOpacity
                    key={u._id}
                    style={[styles.userItem, active && styles.userItemActive]}
                    onPress={() => setBulkAssignUserId(u._id)}
                  >
                    <View
                      style={[
                        styles.userAvatar,
                        active && { backgroundColor: ACCENT },
                      ]}
                    >
                      <Text
                        style={[
                          styles.userAvatarText,
                          active && { color: '#fff' },
                        ]}
                      >
                        {getInitials(u.name)}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.userItemText,
                        active && styles.userItemTextActive,
                      ]}
                    >
                      {u.name}
                    </Text>
                    {active && (
                      <Icon
                        name="check-circle"
                        size={18}
                        color={ACCENT}
                        style={{ marginLeft: 'auto' }}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => {
                  setShowAssignModal(false);
                  setBulkAssignUserId('');
                }}
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalBtnPrimary,
                  (!bulkAssignUserId || bulkLoading) && { opacity: 0.5 },
                ]}
                disabled={!bulkAssignUserId || bulkLoading}
                onPress={handleBulkAssign}
              >
                {bulkLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalBtnPrimaryText}>Assign</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ════════════════════════════════════════════════════════
          BULK STATUS MODAL
      ════════════════════════════════════════════════════════ */}
      <Modal
        visible={showStatusModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStatusModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Change Status — {selectedIds.size} Lead
              {selectedIds.size > 1 ? 's' : ''}
            </Text>
            <View style={[styles.chipsWrap, { marginTop: 4 }]}>
              {statusOptions.map(st => {
                const active = bulkStatusValue === st;
                const color = getStageColor(st);
                return (
                  <TouchableOpacity
                    key={st}
                    style={[
                      styles.chip,
                      active && {
                        backgroundColor: color + '18',
                        borderColor: color,
                      },
                    ]}
                    onPress={() => setBulkStatusValue(st)}
                  >
                    <View
                      style={[styles.chipDot, { backgroundColor: color }]}
                    />
                    <Text
                      style={[
                        styles.chipText,
                        active && { color, fontWeight: '600' },
                      ]}
                    >
                      {st}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => {
                  setShowStatusModal(false);
                  setBulkStatusValue('');
                }}
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalBtnPrimary,
                  (!bulkStatusValue || bulkLoading) && { opacity: 0.5 },
                ]}
                disabled={!bulkStatusValue || bulkLoading}
                onPress={handleBulkStatusChange}
              >
                {bulkLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalBtnPrimaryText}>Update</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ════════════════════════════════════════════════════════
          BULK PRIORITY MODAL
      ════════════════════════════════════════════════════════ */}
      <Modal
        visible={showPriorityModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPriorityModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Change Priority — {selectedIds.size} Lead
              {selectedIds.size > 1 ? 's' : ''}
            </Text>
            <View style={[styles.chipsWrap, { marginTop: 4 }]}>
              {PRIORITY_OPTIONS.map(p => {
                const active = bulkPriorityValue === p;
                const pc = getPriorityColor(p);
                return (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.chip,
                      active && {
                        backgroundColor: pc.bg,
                        borderColor: pc.text,
                      },
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
                      color={active ? pc.text : '#9ca3af'}
                    />
                    <Text
                      style={[
                        styles.chipText,
                        active && { color: pc.text, fontWeight: '600' },
                      ]}
                    >
                      {p}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => {
                  setShowPriorityModal(false);
                  setBulkPriorityValue('');
                }}
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalBtnPrimary,
                  (!bulkPriorityValue || bulkLoading) && { opacity: 0.5 },
                ]}
                disabled={!bulkPriorityValue || bulkLoading}
                onPress={handleBulkPriorityChange}
              >
                {bulkLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalBtnPrimaryText}>Update</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Delete single ── */}
      {deleteLeadModal && (
        <DeleteModal
          isOpen
          onClose={() => setDeleteLeadModal(null)}
          onConfirm={confirmDeleteLead}
          title="Delete Lead"
          message="Are you sure you want to delete this lead? This action cannot be undone."
        />
      )}

      {/* ── Bulk delete ── */}
      <DeleteModal
        isOpen={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        onConfirm={handleBulkDelete}
        title="Delete Selected Leads"
        message={`Delete ${selectedIds.size} selected lead(s)? This cannot be undone.`}
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
      />
    </SafeAreaView>
  );
};

// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f9fafb' },
  container: { flex: 1 },

  // ── Header ──
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 10,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#111827' },
  headerSubtitle: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  addBtn: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: ACCENT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },

  // ── Search ──
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 10,
    gap: 6,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#111827', paddingVertical: 0 },
  filterIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterIconBtnActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },

  // ── Active filter badges row ──
  activeBadgesRow: { gap: 8, paddingTop: 2, alignItems: 'center' },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  badgeDot: { width: 8, height: 8, borderRadius: 4 },
  activeBadgeText: { fontSize: 11, fontWeight: '600', color: ACCENT },
  clearAllBadge: { paddingHorizontal: 6, paddingVertical: 5 },
  clearAllBadgeText: { fontSize: 11, fontWeight: '600', color: '#ef4444' },

  // ── Toolbar ──
  toolbar: {
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    minHeight: 40,
    justifyContent: 'center',
  },
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
    backgroundColor: '#eef2ff',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  selectedBadgeText: { fontSize: 12, fontWeight: '600', color: ACCENT },
  bulkBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  bulkBtnBlue: { borderColor: '#c7d2fe', backgroundColor: '#eef2ff' },
  bulkBtnRed: { borderColor: '#fecaca', backgroundColor: '#fef2f2' },
  bulkBtnGreen: { borderColor: '#a7f3d0', backgroundColor: '#f0fdf4' },
  bulkBtnOrange: { borderColor: '#fed7aa', backgroundColor: '#fff7ed' },
  bulkBtnBlueText: { fontSize: 12, fontWeight: '500', color: ACCENT },
  bulkBtnRedText: { fontSize: 12, fontWeight: '500', color: '#ef4444' },
  bulkBtnGreenText: { fontSize: 12, fontWeight: '500', color: '#16a34a' },
  bulkBtnOrangeText: { fontSize: 12, fontWeight: '500', color: '#ea580c' },
  selectAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: { backgroundColor: ACCENT, borderColor: ACCENT },
  checkmark: { color: '#fff', fontSize: 11, fontWeight: '700' },
  selectAllText: { fontSize: 12, color: '#6b7280' },
  totalText: { fontSize: 12, color: '#6b7280', marginLeft: 'auto' },
  clearFiltersText: { fontSize: 12, color: '#ef4444', fontWeight: '500' },

  listContainer: { flex: 1 },

  // ── Shared modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 380,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 20,
    lineHeight: 20,
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalBtnCancel: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnCancelText: { fontSize: 13, fontWeight: '500', color: '#374151' },
  modalBtnDanger: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnDangerText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  modalBtnPrimary: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnPrimaryText: { fontSize: 13, fontWeight: '600', color: '#fff' },

  // ── Bottom sheet ──
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheetBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '88%',
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d1d5db',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sheetHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  sheetTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  clearAllText: { fontSize: 12, fontWeight: '500', color: '#ef4444' },
  sheetBody: { paddingHorizontal: 16, paddingTop: 8 },
  sheetFooter: { paddingHorizontal: 16, paddingTop: 12 },
  applyBtn: {
    height: 46,
    borderRadius: 12,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },

  filterLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9ca3af',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 20,
  },

  // ── Chips ──
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  chipActive: { borderColor: ACCENT, backgroundColor: '#eef2ff' },
  chipText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  chipTextActive: { color: ACCENT, fontWeight: '600' },
  chipDot: { width: 8, height: 8, borderRadius: 4 },

  // ── Date row inside filter sheet ──
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  dateBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  dateBtnActive: { borderColor: ACCENT, backgroundColor: '#f0f4ff' },
  dateBtnText: { fontSize: 13, color: '#9ca3af' },
  dateBtnTextActive: { fontSize: 13, color: '#111827', fontWeight: '500' },

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
    backgroundColor: '#f0f4ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  dateRangeText: { fontSize: 12, color: ACCENT, fontWeight: '500' },
  clearDateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
  },
  clearDateText: { fontSize: 12, color: '#ef4444', fontWeight: '500' },

  // ── Date picker modal (iOS) ──
  dateModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  dateModalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 340,
  },
  dateModalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  dateModalActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  dateModalBtnCancel: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateModalBtnCancelText: { fontSize: 14, fontWeight: '500', color: '#374151' },
  dateModalBtnDone: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateModalBtnDoneText: { fontSize: 14, fontWeight: '600', color: '#fff' },

  // ── User list ──
  userSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    marginBottom: 6,
  },
  userSearchInput: {
    flex: 1,
    fontSize: 13,
    color: '#111827',
    paddingVertical: 0,
  },
  userList: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    overflow: 'hidden',
    backgroundColor: '#fff',
    maxHeight: 220,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
  },
  userItemActive: { backgroundColor: '#f0f4ff' },
  userItemText: { fontSize: 13, color: '#374151' },
  userItemTextActive: { color: ACCENT, fontWeight: '600' },
  userItemEmail: { fontSize: 11, color: '#9ca3af', marginTop: 1 },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: { fontSize: 11, fontWeight: '700', color: '#6b7280' },
  emptySearch: { padding: 16, alignItems: 'center' },
  emptySearchText: { fontSize: 13, color: '#9ca3af' },

  // ── Sort sheet ──
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
  },
  sortOptionActive: { backgroundColor: '#f0f4ff' },
  sortOptionText: { fontSize: 14, color: '#374151' },
  sortOptionTextActive: { color: ACCENT, fontWeight: '600' },
});

export default LeadsScreen;
