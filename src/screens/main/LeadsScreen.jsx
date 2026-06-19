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
import { Picker } from '@react-native-picker/picker';

import { leadsService } from '../../services/leadsService.js';
import { userService } from '../../services/userService.js';
import { fetchSettings } from '../../store/slices/settingsSlice.js';
import { canUser } from '../../utils/permissions.js';
import api from '../../services/api.js';

import LeadFormModal from '../../components/common/LeadFormModal.jsx';
import LeadPreviewDrawer from '../../components/common/LeadPreviewDrawer.jsx';
import LeadsListMobile from '../../components/common/LeadsListMobile.jsx';
import Pagination from '../../components/common/Pagination.jsx';

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
  { value: 'newest', label: 'Newest' },
  { value: 'active', label: 'Active (Recently Contacted)' },
  { value: 'stale', label: 'Stale (Not Recently Contacted)' },
  { value: 'hottest', label: 'Hottest (High Priority)' },
  { value: 'largest', label: 'Largest (Deal Value)' },
  { value: 'upcoming', label: 'Upcoming (No Activity Yet)' },
];

const DEFAULT_STATUS_OPTIONS = [
  'New',
  'Interested',
  'Details Shared',
  'Success',
  'Closed',
  'Repeat',
];

// ─── Helper: toast via Alert ──────────────────────────────────
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

// ─── PickerModal (replaces <select>) ─────────────────────────
const PickerModal = ({ visible, onClose, title, value, onChange, options }) => (
  <Modal
    visible={visible}
    transparent
    animationType="slide"
    onRequestClose={onClose}
  >
    <View style={styles.modalOverlay}>
      <View style={styles.pickerModalCard}>
        <Text style={styles.pickerModalTitle}>{title}</Text>
        <ScrollView style={styles.pickerModalScroll}>
          {options.map(opt => {
            const val = opt.value ?? opt;
            const lbl = opt.label ?? opt;
            const active = val === value;
            return (
              <TouchableOpacity
                key={val}
                onPress={() => {
                  onChange(val);
                  onClose();
                }}
                style={[
                  styles.pickerOption,
                  active && styles.pickerOptionActive,
                ]}
              >
                <Text
                  style={[
                    styles.pickerOptionText,
                    active && styles.pickerOptionTextActive,
                  ]}
                >
                  {lbl}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <TouchableOpacity style={styles.pickerModalClose} onPress={onClose}>
          <Text style={styles.pickerModalCloseText}>Cancel</Text>
        </TouchableOpacity>
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

  // ── Data state ──
  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ── Modals ──
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [previewLead, setPreviewLead] = useState(null);
  const [showPreviewDrawer, setShowPreviewDrawer] = useState(false);
  const [activeTabOverride, setActiveTabOverride] = useState(null);
  const [activityRefreshTrigger, setActivityRefreshTrigger] = useState(0);

  const [deleteLeadModal, setDeleteLeadModal] = useState(null);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showPriorityModal, setShowPriorityModal] = useState(false);
  const [showFiltersSheet, setShowFiltersSheet] = useState(false);
  const [showSortSheet, setShowSortSheet] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);

  // ── Bulk action state ──
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkAssignUserId, setBulkAssignUserId] = useState('');
  const [bulkStatusValue, setBulkStatusValue] = useState('');
  const [bulkPriorityValue, setBulkPriorityValue] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);

  // ── Picker modal for bulk assign/status/priority ──
  const [showAssignPicker, setShowAssignPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);

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
  const [tempDateFrom, setTempDateFrom] = useState('');
  const [tempDateTo, setTempDateTo] = useState('');

  // ── Pagination ──
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  const skipLoadAfterSearchRef = useRef(false);

  // ── Settings-derived ──
  const statusOptions = useMemo(
    () => settings?.pipelineStages?.map(s => s.name) || DEFAULT_STATUS_OPTIONS,
    [settings],
  );

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

  // ── Pull-to-refresh handler ──
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

  // ── Date modal ──
  const openDateModal = () => {
    setTempDateFrom(filters.dateFrom);
    setTempDateTo(filters.dateTo);
    setShowDateModal(true);
  };

  const applyDateFilter = () => {
    if (tempDateFrom && tempDateTo && tempDateFrom > tempDateTo) {
      toast.error('From Date cannot be after To Date');
      return;
    }
    setFilters(prev => ({
      ...prev,
      dateFrom: tempDateFrom,
      dateTo: tempDateTo,
    }));
    setPagination(prev => ({ ...prev, page: 1 }));
    setShowDateModal(false);
  };

  const clearDateFilter = () => {
    setTempDateFrom('');
    setTempDateTo('');
    setFilters(prev => ({ ...prev, dateFrom: '', dateTo: '' }));
    setPagination(prev => ({ ...prev, page: 1 }));
    setShowDateModal(false);
  };

  const getDateLabel = () => {
    if (!filters.dateFrom && !filters.dateTo) return 'Date';
    if (filters.dateFrom && filters.dateTo)
      return `${filters.dateFrom} → ${filters.dateTo}`;
    if (filters.dateFrom) return `From ${filters.dateFrom}`;
    return `Till ${filters.dateTo}`;
  };

  // ── Formatting helpers ──
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

  // ── Selection helpers ──
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

  const handleOpenPreview = (lead, _e) => {
    setPreviewLead(lead);
    setShowPreviewDrawer(true);
  };

  const handleDrawerRefresh = async () => {
    await loadLeads();
    if (previewLead?._id) {
      try {
        const fresh = await leadsService.getLead(previewLead._id);
        setPreviewLead(fresh);
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
      const loaded = await leadsService.getLead(previewLead._id);
      setEditingLead(loaded);
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
            const fresh = await leadsService.getLead(leadId);
            setPreviewLead(fresh);
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

  // ── Render ──
  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <View style={styles.container}>
        {/* ══ HEADER ══════════════════════════════════════════ */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.headerTitle}>Leads</Text>
              <Text style={styles.headerSubtitle}>
                Manage and track your sales pipeline
              </Text>
            </View>
            <View style={styles.headerActions}>
              {/* Sort */}
              <TouchableOpacity
                onPress={() => setShowSortSheet(true)}
                style={[styles.iconBtn, filters.sortBy && styles.iconBtnActive]}
              >
                <Text
                  style={[
                    styles.iconBtnText,
                    filters.sortBy && { color: '#fff' },
                  ]}
                >
                  ≡
                </Text>
              </TouchableOpacity>

              {/* Add Lead */}
              {canCreateLead && (
                <TouchableOpacity onPress={openNewLead} style={styles.addBtn}>
                  <Text style={styles.addBtnText}>+ Add</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Search + Filter row */}
          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <Text style={styles.searchIcon}>🔍</Text>
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
                  <Text style={styles.searchClear}>✕</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Date */}
            <TouchableOpacity
              onPress={openDateModal}
              style={[
                styles.filterChip,
                (filters.dateFrom || filters.dateTo) && styles.filterChipActive,
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  (filters.dateFrom || filters.dateTo) &&
                    styles.filterChipTextActive,
                ]}
              >
                📅
              </Text>
            </TouchableOpacity>

            {/* Filters */}
            <TouchableOpacity
              onPress={() => setShowFiltersSheet(true)}
              style={[
                styles.filterChip,
                hasActiveFilters && styles.filterChipActive,
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  hasActiveFilters && styles.filterChipTextActive,
                ]}
              >
                ⚙ Filters
                {activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ══ TOOLBAR (selected / total) ════════════════════════ */}
        <View style={styles.toolbar}>
          {selectedIds.size > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.bulkBar}
            >
              {/* Select count */}
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
              {/* Select all */}
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

        {/* ══ LEAD CARDS ════════════════════════════════════════ */}
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

        {/* ══ PAGINATION ════════════════════════════════════════ */}
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

      {/* ══════════════════════════════════════════════════════════
          MODALS
      ══════════════════════════════════════════════════════════ */}

      {/* ── Filters Bottom Sheet ── */}
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
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Filters</Text>
              <View style={styles.sheetHeaderRight}>
                {hasActiveFilters && (
                  <TouchableOpacity onPress={clearAllFilters}>
                    <Text style={styles.clearAllText}>Clear all</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setShowFiltersSheet(false)}>
                  <Text style={styles.sheetClose}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={styles.sheetBody}>
              {/* Status */}
              <Text style={styles.filterLabel}>STATUS</Text>
              <View style={styles.pickerWrap}>
                <Picker
                  selectedValue={filters.status}
                  onValueChange={v => handleFilterChange('status', v)}
                  style={styles.sheetPicker}
                >
                  <Picker.Item label="All Status" value="" />
                  <Picker.Item label="Active Leads" value="active" />
                  <Picker.Item label="Repeat" value="Repeat" />
                  {statusOptions.map(s => (
                    <Picker.Item key={s} label={s} value={s} />
                  ))}
                </Picker>
              </View>

              {/* Priority */}
              <Text style={styles.filterLabel}>PRIORITY</Text>
              <View style={styles.pickerWrap}>
                <Picker
                  selectedValue={filters.priority}
                  onValueChange={v => handleFilterChange('priority', v)}
                  style={styles.sheetPicker}
                >
                  <Picker.Item label="All Priorities" value="" />
                  {PRIORITY_OPTIONS.map(p => (
                    <Picker.Item key={p} label={p} value={p} />
                  ))}
                </Picker>
              </View>

              {/* Assigned To */}
              {(canViewAllLeads || (isManager && canViewTeamLeads)) && (
                <>
                  <Text style={styles.filterLabel}>ASSIGNED TO</Text>
                  <View style={styles.pickerWrap}>
                    <Picker
                      selectedValue={filters.assignedTo}
                      onValueChange={v => handleFilterChange('assignedTo', v)}
                      style={styles.sheetPicker}
                    >
                      <Picker.Item label="All Users" value="" />
                      {users.map(u => (
                        <Picker.Item key={u._id} label={u.name} value={u._id} />
                      ))}
                    </Picker>
                  </View>
                </>
              )}

              {/* Co-Assignee */}
              {(canViewAllLeads || (isManager && canViewTeamLeads)) && (
                <>
                  <Text style={styles.filterLabel}>CO-ASSIGNEE</Text>
                  <View style={styles.pickerWrap}>
                    <Picker
                      selectedValue={filters.coAssignedTo}
                      onValueChange={v => handleFilterChange('coAssignedTo', v)}
                      style={styles.sheetPicker}
                    >
                      <Picker.Item label="All Co-assignees" value="" />
                      {users.map(u => (
                        <Picker.Item key={u._id} label={u.name} value={u._id} />
                      ))}
                    </Picker>
                  </View>
                </>
              )}
            </ScrollView>

            <View style={styles.sheetFooter}>
              <TouchableOpacity
                style={styles.applyBtn}
                onPress={() => setShowFiltersSheet(false)}
              >
                <Text style={styles.applyBtnText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Sort Bottom Sheet ── */}
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
          <View style={[styles.sheet, { maxHeight: 420 }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Sort By</Text>
              <TouchableOpacity onPress={() => setShowSortSheet(false)}>
                <Text style={styles.sheetClose}>✕</Text>
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
                    <Text
                      style={[
                        styles.sortOptionText,
                        active && styles.sortOptionTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                    {active && <Text style={{ color: ACCENT }}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Date Filter Modal ── */}
      <Modal
        visible={showDateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Filter by Date</Text>
            <Text style={styles.filterLabel}>FROM DATE</Text>
            <TextInput
              value={tempDateFrom}
              onChangeText={setTempDateFrom}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#9ca3af"
              style={styles.dateInput}
            />
            <Text style={[styles.filterLabel, { marginTop: 12 }]}>TO DATE</Text>
            <TextInput
              value={tempDateTo}
              onChangeText={setTempDateTo}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#9ca3af"
              style={styles.dateInput}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => setShowDateModal(false)}
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={clearDateFilter}
              >
                <Text style={styles.modalBtnCancelText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalBtnPrimary}
                onPress={applyDateFilter}
              >
                <Text style={styles.modalBtnPrimaryText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Bulk Assign Modal ── */}
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
            <View style={styles.pickerWrap}>
              <Picker
                selectedValue={bulkAssignUserId}
                onValueChange={setBulkAssignUserId}
                style={styles.sheetPicker}
              >
                <Picker.Item label="— Select team member —" value="" />
                {users.map(u => (
                  <Picker.Item key={u._id} label={u.name} value={u._id} />
                ))}
              </Picker>
            </View>
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

      {/* ── Bulk Status Modal ── */}
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
            <View style={styles.pickerWrap}>
              <Picker
                selectedValue={bulkStatusValue}
                onValueChange={setBulkStatusValue}
                style={styles.sheetPicker}
              >
                <Picker.Item label="— Select status —" value="" />
                {statusOptions.map(s => (
                  <Picker.Item key={s} label={s} value={s} />
                ))}
              </Picker>
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

      {/* ── Bulk Priority Modal ── */}
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
            <View style={styles.pickerWrap}>
              <Picker
                selectedValue={bulkPriorityValue}
                onValueChange={setBulkPriorityValue}
                style={styles.sheetPicker}
              >
                <Picker.Item label="— Select priority —" value="" />
                {PRIORITY_OPTIONS.map(p => (
                  <Picker.Item key={p} label={p} value={p} />
                ))}
              </Picker>
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

      {/* ── Delete single lead ── */}
      {deleteLeadModal && (
        <DeleteModal
          isOpen={!!deleteLeadModal}
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

      {/* ── Lead Form Modal ── */}
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

      {/* ── Lead Preview Drawer ── */}
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
  container: { flex: 1, flexDirection: 'column' },

  // Header
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
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  iconBtnText: {
    fontSize: 18,
    color: '#374151',
  },
  addBtn: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },

  // Search
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 10,
    gap: 6,
  },
  searchIcon: { fontSize: 14 },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#111827',
    paddingVertical: 0,
  },
  searchClear: { fontSize: 14, color: '#9ca3af' },
  filterChip: {
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipActive: {
    borderColor: ACCENT,
    backgroundColor: '#eef2ff',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
  },
  filterChipTextActive: {
    color: ACCENT,
  },

  // Toolbar
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
  selectedBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: ACCENT,
  },
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

  selectAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  checkmark: { color: '#fff', fontSize: 11, fontWeight: '700' },
  selectAllText: { fontSize: 12, color: '#6b7280' },
  totalText: { fontSize: 12, color: '#6b7280', marginLeft: 'auto' },
  clearFiltersText: { fontSize: 12, color: '#ef4444', fontWeight: '500' },

  // List
  listContainer: { flex: 1 },

  // Modal shared
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
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  modalBtnCancel: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnCancelText: { fontSize: 13, fontWeight: '500', color: '#374151' },
  modalBtnDanger: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnDangerText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  modalBtnPrimary: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnPrimaryText: { fontSize: 13, fontWeight: '600', color: '#fff' },

  // Date input
  dateInput: {
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#111827',
    backgroundColor: '#f9fafb',
    marginTop: 4,
  },

  // Bottom sheet
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheetBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
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
  sheetTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  sheetClose: { fontSize: 18, color: '#6b7280' },
  clearAllText: { fontSize: 12, fontWeight: '500', color: '#ef4444' },
  sheetBody: { paddingHorizontal: 16, paddingTop: 12 },
  sheetFooter: { paddingHorizontal: 16, paddingTop: 12 },
  applyBtn: {
    height: 44,
    borderRadius: 12,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },

  // Filter labels + pickers inside sheet
  filterLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9ca3af',
    letterSpacing: 0.5,
    marginBottom: 4,
    marginTop: 14,
  },
  pickerWrap: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#f9fafb',
  },
  sheetPicker: {
    height: Platform.OS === 'ios' ? 160 : 48,
    color: '#111827',
  },

  // Sort sheet
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

  // Picker modal (PickerModal component — not used directly but kept for reference)
  pickerModalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 0,
    width: '100%',
    maxWidth: 380,
    overflow: 'hidden',
  },
  pickerModalTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  pickerModalScroll: { maxHeight: 260 },
  pickerOption: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
  },
  pickerOptionActive: { backgroundColor: ACCENT },
  pickerOptionText: { fontSize: 14, color: '#374151' },
  pickerOptionTextActive: { color: '#fff', fontWeight: '600' },
  pickerModalClose: {
    padding: 14,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  pickerModalCloseText: { fontSize: 14, fontWeight: '500', color: '#6b7280' },
});

export default LeadsScreen;
