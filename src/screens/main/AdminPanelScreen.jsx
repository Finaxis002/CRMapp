import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useDispatch, useSelector } from 'react-redux';
import { fetchSettings, saveSettings } from '../../store/slices/settingsSlice';
import { distributionRuleService } from '../../services/distributionRuleService';
import { userService } from '../../services/userService';
import { settingsService } from '../../services/settingsService';
import api from '../../services/api';
import { canUser } from '../../utils/permissions';
import { useTheme } from '../../contexts/ThemeContext';

// ─── Constants ───────────────────────────────────────────────────────────────

const TABS = [
  { key: 'distribution', label: 'Distribution' },
  { key: 'pipeline',     label: 'Pipeline'      },
  { key: 'rbac',         label: 'Access Control' },
  { key: 'columns',      label: 'Lead Columns'  },
  { key: 'ai',           label: 'AI Settings'   },
  { key: 'payments',     label: 'Payments'      },
  { key: 'integrations', label: 'Integrations'  },
  { key: 'general',      label: 'General'       },
];

const RULE_LABELS = {
  round_robin: 'Round Robin',
  equal_load:  'Equal Load',
  manual:      'Manual Only',
};

const ROLE_LABELS = {
  admin:   'Admin',
  manager: 'Manager',
  tl:      'Team Lead',
  exec:    'Executive',
  viewer:  'Viewer',
};

const DEFAULT_COLUMNS = [
  { key: 'name',          label: 'Name'           },
  { key: 'phone',         label: 'Phone'          },
  { key: 'email',         label: 'Email'          },
  { key: 'city',          label: 'City'           },
  { key: 'source',        label: 'Source'         },
  { key: 'value',         label: 'Deal Value'     },
  { key: 'status',        label: 'Status'         },
  { key: 'assign',        label: 'Assigned To'    },
  { key: 'coAssignees',   label: 'Co-assignees'   },
  { key: 'product',       label: 'Product'        },
  { key: 'priority',      label: 'Priority'       },
  { key: 'closeDate',     label: 'Close Date'     },
  { key: 'lastActivity',  label: 'Last Activity'  },
  { key: 'lastContacted', label: 'Last Contacted' },
];

const DEFAULT_PERMISSIONS = {
  'View all leads':       { admin: true,  manager: true,  tl: false, exec: false, viewer: false },
  'View team leads only': { admin: false, manager: true,  tl: false, exec: false, viewer: false },
  'Add leads':            { admin: true,  manager: true,  tl: true,  exec: true,  viewer: false },
  'Edit any lead':        { admin: true,  manager: true,  tl: false, exec: false, viewer: false },
  'Delete leads':         { admin: true,  manager: false, tl: false, exec: false, viewer: false },
  'Assign leads':         { admin: true,  manager: true,  tl: true,  exec: false, viewer: false },
  'Change lead owner':    { admin: true,  manager: true,  tl: false, exec: false, viewer: false },
  'Record payments':      { admin: true,  manager: true,  tl: false, exec: false, viewer: false },
  'Import from sheets':   { admin: true,  manager: true,  tl: false, exec: false, viewer: false },
  'View team':            { admin: true,  manager: true,  tl: true,  exec: false, viewer: false },
  'Manage users':         { admin: true,  manager: false, tl: false, exec: false, viewer: false },
  'Admin panel':          { admin: true,  manager: false, tl: false, exec: false, viewer: false },
};

const DEFAULT_STAGE_COLORS = ['#6b7280', '#b86e00', '#6c35de', '#2a7d4f', '#1a1a18'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const normalizeSettings = (s) => {
  if (!s) return null;
  return {
    ...s,
    distributionPool: (s.distributionPool || []).map(i => i?._id || i),
    pipelineStages:   s.pipelineStages  || [],
    customColumns:    s.customColumns   || [],
    permissions:      s.permissions     || DEFAULT_PERMISSIONS,
    gateways:         s.gateways        || {},
  };
};

const showToast = (msg, type = 'info') => {
  console.log(`[${type}] ${msg}`);
};

// ─── Theme-aware style factories ─────────────────────────────────────────────
// Insteadof using hardcoded `ui` styles, these functions return
// style objects driven by the `t` theme token.

const makeCard = (t) => ({
  backgroundColor: t.card,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: t.border,
  padding: 14,
  marginBottom: 12,
});

const makeInput = (t) => ({
  borderWidth: 1,
  borderColor: t.inputBorder,
  borderRadius: 10,
  paddingHorizontal: 12,
  paddingVertical: 10,
  fontSize: 14,
  color: t.inputText,
  backgroundColor: t.input,
  marginBottom: 12,
});

const makePickerWrap = (t) => ({
  borderWidth: 1,
  borderColor: t.inputBorder,
  borderRadius: 10,
  overflow: 'hidden',
  marginBottom: 12,
  backgroundColor: t.input,
});

const makeLabel = (t) => ({
  fontSize: 13,
  fontWeight: '600',
  color: t.label,
  marginBottom: 4,
  marginTop: 4,
});

const makeGroupLabel = (t) => ({
  fontSize: 13,
  fontWeight: '700',
  color: t.groupLabel,
  marginTop: 8,
  marginBottom: 6,
});

const makeCheckLabel = (t) => ({
  fontSize: 14,
  color: t.checkLabel,
});

const makeCardTitle = (t) => ({
  fontSize: 15,
  fontWeight: '700',
  color: t.title,
  marginBottom: 6,
});

const makeCardMeta = (t) => ({
  fontSize: 12,
  color: t.subtitle,
  marginBottom: 4,
});

const makeSectionTitle = (t) => ({
  fontSize: 18,
  fontWeight: '700',
  color: t.title,
});

const makeSectionSubtitle = (t) => ({
  fontSize: 13,
  color: t.subtitle,
  marginTop: 4,
});

const makeEmptyText = (t) => ({
  fontSize: 13,
  color: t.emptyText,
  textAlign: 'center',
});

const makeModalCard = (t) => ({
  backgroundColor: t.card,
  borderTopLeftRadius: 24,
  borderTopRightRadius: 24,
  padding: 20,
  minHeight: 200,
});

const makeModalTitle = (t) => ({
  fontSize: 17,
  fontWeight: '700',
  color: t.title,
  marginBottom: 8,
});

const makeModalMsg = (t) => ({
  fontSize: 14,
  color: t.subtitle,
  marginBottom: 20,
});

// ─── Shared UI Pieces ────────────────────────────────────────────────────────

const SectionHeader = ({ title, subtitle, t }) => (
  <View style={ui.sectionHeader}>
    <Text style={makeSectionTitle(t)}>{title}</Text>
    {subtitle ? (
      <Text style={makeSectionSubtitle(t)}>{subtitle}</Text>
    ) : null}
  </View>
);

const PrimaryButton = ({ label, onPress, disabled, style }) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    style={[ui.btnPrimary, disabled && ui.btnDisabled, style]}
    activeOpacity={0.8}
  >
    <Text style={ui.btnPrimaryText}>{label}</Text>
  </TouchableOpacity>
);

const OutlineButton = ({ label, onPress, danger, style, t }) => (
  <TouchableOpacity
    onPress={onPress}
    style={[
      ui.btnOutline,
      danger && ui.btnOutlineDanger,
      t && { borderColor: danger ? '#fca5a5' : t.border },
      style,
    ]}
    activeOpacity={0.8}
  >
    <Text style={[
      ui.btnOutlineText,
      danger && ui.btnOutlineDangerText,
      t && !danger && { color: t.label },
    ]}>
      {label}
    </Text>
  </TouchableOpacity>
);

const FormLabel = ({ text, t }) => (
  <Text style={t ? makeLabel(t) : ui.label}>{text}</Text>
);

const StyledInput = ({ value, onChange, placeholder, secureTextEntry, multiline, rows, t }) => (
  <TextInput
    value={value}
    onChangeText={onChange}
    placeholder={placeholder}
    placeholderTextColor={t?.placeholder || '#9ca3af'}
    secureTextEntry={secureTextEntry}
    multiline={multiline}
    numberOfLines={rows}
    style={[
      t ? makeInput(t) : ui.input,
      multiline && { height: rows * 24, textAlignVertical: 'top' },
    ]}
  />
);

// ─── Delete Modal ────────────────────────────────────────────────────────────

const DeleteModal = ({ visible, title, message, onClose, onConfirm, t }) => (
  <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
    <Pressable style={ui.modalBackdrop} onPress={onClose}>
      <Pressable style={t ? makeModalCard(t) : ui.modalCard} onPress={e => e.stopPropagation()}>
        <Text style={t ? makeModalTitle(t) : ui.modalTitle}>{title}</Text>
        <Text style={t ? makeModalMsg(t) : ui.modalMsg}>{message}</Text>
        <View style={ui.modalActions}>
          <OutlineButton label="Cancel" onPress={onClose} style={{ flex: 1 }} t={t} />
          <TouchableOpacity
            onPress={() => { onConfirm(); onClose(); }}
            style={[ui.btnPrimary, { flex: 1, backgroundColor: '#dc2626' }]}
          >
            <Text style={ui.btnPrimaryText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Pressable>
  </Modal>
);

// ─── Multi Select Modal ──────────────────────────────────────────────────────

const MultiSelectModal = ({ visible, title, items, selectedIds, onToggle, onClose, t }) => (
  <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
    <Pressable style={ui.modalBackdrop} onPress={onClose}>
      <View style={[t ? makeModalCard(t) : ui.modalCard, { maxHeight: '70%' }]}>
        <Text style={t ? makeModalTitle(t) : ui.modalTitle}>{title}</Text>
        <ScrollView style={{ marginVertical: 8 }}>
          {items.map(item => {
            const checked = selectedIds.includes(item.id);
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => onToggle(item.id)}
                style={ui.checkRow}
                activeOpacity={0.7}
              >
                <View style={[ui.checkbox, checked && ui.checkboxChecked]}>
                  {checked && <Text style={ui.checkmark}>✓</Text>}
                </View>
                <Text style={t ? makeCheckLabel(t) : ui.checkLabel}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <PrimaryButton label="Done" onPress={onClose} />
      </View>
    </Pressable>
  </Modal>
);

// ─── TAB: Distribution ───────────────────────────────────────────────────────

const DistributionTab = ({ users, t }) => {
  const [rules,       setRules]       = useState([]);
  const [sheets,      setSheets]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showModal,   setShowModal]   = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [deleteId,    setDeleteId]    = useState(null);
  const [saving,      setSaving]      = useState(false);
  const [sheetsOpen,  setSheetsOpen]  = useState(false);
  const [usersOpen,   setUsersOpen]   = useState(false);

  const [form, setForm] = useState({
    name:        '',
    sheetSyncIds: [],
    rule:        'round_robin',
    userPool:    [],
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rulesData, sheetsRes] = await Promise.all([
        distributionRuleService.getRules(),
        api.get('/google-sheets/connections'),
      ]);
      setRules(rulesData);
      setSheets(sheetsRes.data?.data || []);
    } catch {
      showToast('Unable to load distribution data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingRule(null);
    setForm({ name: '', sheetSyncIds: [], rule: 'round_robin', userPool: [] });
    setShowModal(true);
  };

  const openEdit = (rule) => {
    setEditingRule(rule);
    setForm({
      name:         rule.name,
      sheetSyncIds: rule.sheetSyncIds.map(s => s._id || s),
      rule:         rule.rule,
      userPool:     rule.userPool.map(u => u._id || u),
    });
    setShowModal(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await distributionRuleService.deleteRule(deleteId);
      showToast('Rule deleted.', 'success');
      loadData();
    } catch {
      showToast('Unable to delete rule.', 'error');
    } finally {
      setDeleteId(null);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim())         return showToast('Name required.', 'error');
    if (!form.sheetSyncIds.length) return showToast('Select at least one sheet.', 'error');
    if (!form.userPool.length)     return showToast('Select at least one user.', 'error');
    setSaving(true);
    try {
      if (editingRule) {
        await distributionRuleService.updateRule(editingRule._id, form);
        showToast('Rule updated.', 'success');
      } else {
        await distributionRuleService.createRule(form);
        showToast('Rule created.', 'success');
      }
      setShowModal(false);
      loadData();
    } catch {
      showToast('Unable to save rule.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleItem = (key, id) => {
    setForm(prev => {
      const set = new Set(prev[key]);
      set.has(id) ? set.delete(id) : set.add(id);
      return { ...prev, [key]: Array.from(set) };
    });
  };

  const visibleUsers = users.filter(u => u.role !== 'viewer');

  return (
    <View>
      <SectionHeader title="Lead Distribution" subtitle="Configure distribution rules for Google Sheet imports." t={t} />

      <PrimaryButton label="+ New Distribution" onPress={openCreate} style={{ alignSelf: 'flex-start', marginBottom: 16 }} />

      {loading ? (
        <ActivityIndicator color="#5a7bf5" />
      ) : rules.length === 0 ? (
        <View style={[ui.emptyBox, { borderColor: t.border }]}>
          <Text style={makeEmptyText(t)}>No distribution rules yet. Create one to get started.</Text>
        </View>
      ) : (
        rules.map(rule => (
          <View key={rule._id} style={makeCard(t)}>
            <Text style={makeCardTitle(t)}>{rule.name}</Text>
            <View style={ui.tagRow}>
              <View style={ui.tagBlue}><Text style={ui.tagBlueText}>{RULE_LABELS[rule.rule]}</Text></View>
              <View style={rule.isActive ? ui.tagGreen : ui.tagGray}>
                <Text style={rule.isActive ? ui.tagGreenText : ui.tagGrayText}>
                  {rule.isActive ? 'Active' : 'Inactive'}
                </Text>
              </View>
            </View>
            <Text style={makeCardMeta(t)}>
              <Text style={{ fontWeight: '600', color: t.label }}>Sheets: </Text>
              {rule.sheetSyncIds?.map(s => s.sheetName || s).join(', ') || '—'}
            </Text>
            <Text style={makeCardMeta(t)}>
              <Text style={{ fontWeight: '600', color: t.label }}>Users: </Text>
              {rule.userPool?.map(u => u.name || u).join(', ') || '—'}
            </Text>
            <View style={ui.cardActions}>
              <OutlineButton label="✏ Edit"   onPress={() => openEdit(rule)} style={{ flex: 1 }} t={t} />
              <OutlineButton label="🗑 Delete" onPress={() => setDeleteId(rule._id)} danger style={{ flex: 1 }} t={t} />
            </View>
          </View>
        ))
      )}

      {/* Create / Edit Modal */}
      <Modal transparent visible={showModal} animationType="slide" onRequestClose={() => setShowModal(false)}>
        <Pressable style={ui.modalBackdrop} onPress={() => setShowModal(false)}>
          <Pressable style={[makeModalCard(t), { maxHeight: '88%' }]}>
            <Text style={makeModalTitle(t)}>{editingRule ? 'Edit Distribution' : 'New Distribution'}</Text>
            <ScrollView style={{ marginVertical: 8 }}>
              <FormLabel text="Distribution Name" t={t} />
              <StyledInput
                value={form.name}
                onChange={v => setForm(p => ({ ...p, name: v }))}
                placeholder="e.g. Google Ads Rule"
                t={t}
              />

              <FormLabel text="Distribution Rule" t={t} />
              <View style={makePickerWrap(t)}>
                <Picker
                  selectedValue={form.rule}
                  onValueChange={v => setForm(p => ({ ...p, rule: v }))}
                  style={[ui.picker, { color: t.inputText, backgroundColor: t.input }]}
                  dropdownIconColor={t.inputText}
                >
                  <Picker.Item label="Round Robin" value="round_robin" color={t.inputText} />
                  <Picker.Item label="Equal Load"  value="equal_load"  color={t.inputText} />
                  <Picker.Item label="Manual Only" value="manual"      color={t.inputText} />
                </Picker>
              </View>

              <FormLabel text={`Sheets (${form.sheetSyncIds.length} selected)`} t={t} />
              <OutlineButton
                label={form.sheetSyncIds.length ? `${form.sheetSyncIds.length} sheet(s) selected — tap to change` : 'Select Sheets'}
                onPress={() => setSheetsOpen(true)}
                style={{ marginBottom: 12 }}
                t={t}
              />

              <FormLabel text={`User Pool (${form.userPool.length} selected)`} t={t} />
              <OutlineButton
                label={form.userPool.length ? `${form.userPool.length} user(s) selected — tap to change` : 'Select Users'}
                onPress={() => setUsersOpen(true)}
                style={{ marginBottom: 16 }}
                t={t}
              />
            </ScrollView>

            <View style={ui.modalActions}>
              <OutlineButton label="Cancel" onPress={() => setShowModal(false)} style={{ flex: 1 }} t={t} />
              <PrimaryButton
                label={saving ? 'Saving…' : editingRule ? 'Update' : 'Create'}
                onPress={handleSave}
                disabled={saving}
                style={{ flex: 1 }}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <MultiSelectModal
        visible={sheetsOpen}
        title="Select Sheets"
        items={sheets.map(s => ({ id: s._id, label: `${s.sheetName} (${s.tabName})` }))}
        selectedIds={form.sheetSyncIds}
        onToggle={id => toggleItem('sheetSyncIds', id)}
        onClose={() => setSheetsOpen(false)}
        t={t}
      />
      <MultiSelectModal
        visible={usersOpen}
        title="Select Users"
        items={visibleUsers.map(u => ({ id: u._id, label: `${u.name} (${u.role})` }))}
        selectedIds={form.userPool}
        onToggle={id => toggleItem('userPool', id)}
        onClose={() => setUsersOpen(false)}
        t={t}
      />

      <DeleteModal
        visible={!!deleteId}
        title="Delete Distribution Rule"
        message="Are you sure? Leads will no longer be distributed based on this rule."
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        t={t}
      />
    </View>
  );
};

// ─── TAB: Pipeline ───────────────────────────────────────────────────────────

const PipelineTab = ({ settings, updateField, t }) => {
  const stages = settings.pipelineStages || [];

  const handleChange = (index, field, value) => {
    const updated = [...stages];
    updated[index] = { ...updated[index], [field]: value };
    updateField('pipelineStages', updated);
  };

  const move = (index, dir) => {
    const s = [...stages];
    const target = index + dir;
    if (target < 0 || target >= s.length) return;
    [s[index], s[target]] = [s[target], s[index]];
    updateField('pipelineStages', s.map((st, i) => ({ ...st, order: i })));
  };

  const add = () => {
    const s = [...stages];
    s.push({ name: 'New Stage', color: DEFAULT_STAGE_COLORS[s.length % DEFAULT_STAGE_COLORS.length], order: s.length });
    updateField('pipelineStages', s);
  };

  const remove = (index) => {
    if (stages.length <= 2) return showToast('At least two pipeline stages required.', 'error');
    const s = [...stages];
    s.splice(index, 1);
    updateField('pipelineStages', s.map((st, i) => ({ ...st, order: i })));
  };

  return (
    <View>
      <SectionHeader title="Pipeline Stages" subtitle="Configure stage names, colors, and order." t={t} />
      {stages.map((stage, i) => (
        <View key={i} style={makeCard(t)}>
          <View style={ui.row}>
            <View style={[ui.colorDot, { backgroundColor: stage.color }]} />
            <TextInput
              value={stage.name}
              onChangeText={v => handleChange(i, 'name', v)}
              style={[makeInput(t), { flex: 1, marginBottom: 0 }]}
            />
          </View>
          <View style={[ui.cardActions, { marginTop: 10 }]}>
            <OutlineButton label="↑" onPress={() => move(i, -1)} style={{ flex: 1 }} t={t} />
            <OutlineButton label="↓" onPress={() => move(i, 1)}  style={{ flex: 1 }} t={t} />
            <OutlineButton label="Remove" onPress={() => remove(i)} danger style={{ flex: 1 }} t={t} />
          </View>
        </View>
      ))}
      <PrimaryButton label="+ Add Stage" onPress={add} style={{ alignSelf: 'flex-start', marginTop: 8 }} />
    </View>
  );
};

// ─── TAB: Access Control (RBAC) ──────────────────────────────────────────────

const RbacTab = ({ settings, updateField, t }) => {
  const permissions = settings.permissions || DEFAULT_PERMISSIONS;
  const permKeys    = Object.keys(permissions);
  const roleKeys    = Object.keys(ROLE_LABELS);

  const toggle = (perm, role) => {
    const current = permissions[perm]?.[role];
    updateField('permissions', {
      ...permissions,
      [perm]: { ...permissions[perm], [role]: !current },
    });
  };

  return (
    <View>
      <SectionHeader title="Access Control" subtitle="Update role permissions for your organization." t={t} />
      {roleKeys.map(role => (
        <View key={role} style={makeCard(t)}>
          <Text style={makeCardTitle(t)}>{ROLE_LABELS[role]}</Text>
          {permKeys.map(perm => {
            const checked = permissions[perm]?.[role] || false;
            return (
              <View key={perm} style={ui.checkRow}>
                <Switch
                  value={checked}
                  disabled={role === 'admin'}
                  onValueChange={() => toggle(perm, role)}
                  trackColor={{ false: '#d1d5db', true: '#5a7bf5' }}
                  thumbColor="#fff"
                />
                <Text style={[makeCheckLabel(t), { flex: 1 }]}>{perm}</Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
};

// ─── TAB: Lead Columns ───────────────────────────────────────────────────────

const ColumnsTab = ({ settings, updateField, t }) => {
  const leadColumns   = settings.leadColumns   || [];
  const customColumns = settings.customColumns || [];

  const toggleBase = (key) => {
    const cols = new Set(leadColumns);
    cols.has(key) ? cols.delete(key) : cols.add(key);
    updateField('leadColumns', Array.from(cols));
  };

  const updateCustomLabel = (index, value) => {
    const updated = [...customColumns];
    updated[index] = { ...updated[index], label: value };
    updateField('customColumns', updated);
  };

  const toggleCustomProp = (index, prop) => {
    const updated = [...customColumns];
    updated[index] = { ...updated[index], [prop]: !updated[index][prop] };
    updateField('customColumns', updated);
  };

  const removeCustom = (index) => {
    const updated = [...customColumns];
    updated.splice(index, 1);
    updateField('customColumns', updated);
  };

  return (
    <View>
      <SectionHeader title="Lead Table Columns" subtitle="Choose which columns appear in the lead table." t={t} />

      <Text style={makeGroupLabel(t)}>Base Columns</Text>
      <View style={makeCard(t)}>
        {DEFAULT_COLUMNS.map(col => {
          const checked = leadColumns.includes(col.key);
          return (
            <TouchableOpacity key={col.key} style={ui.checkRow} onPress={() => toggleBase(col.key)}>
              <View style={[ui.checkbox, checked && ui.checkboxChecked]}>
                {checked && <Text style={ui.checkmark}>✓</Text>}
              </View>
              <Text style={makeCheckLabel(t)}>{col.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 4 }}>
        <Text style={makeGroupLabel(t)}>Custom Columns</Text>
        <TouchableOpacity
          onPress={() => {
            const newCol = {
              key: `custom_${Date.now()}`,
              label: 'New Column',
              visible: true,
              formVisible: true,
            };
            updateField('customColumns', [newCol, ...customColumns]);
          }}
          style={[ui.btnPrimary, { paddingHorizontal: 12, paddingVertical: 6 }]}
          activeOpacity={0.8}
        >
          <Text style={[ui.btnPrimaryText, { fontSize: 12 }]}>+ Add Column</Text>
        </TouchableOpacity>
      </View>

      {customColumns.length === 0 ? (
        <Text style={makeEmptyText(t)}>No custom columns defined.</Text>
      ) : (
        customColumns.map((col, i) => (
          <View key={col.key || i} style={makeCard(t)}>
            <TextInput
              value={col.label}
              onChangeText={v => updateCustomLabel(i, v)}
              style={makeInput(t)}
              placeholderTextColor={t.placeholder}
            />
            <View style={ui.checkRow}>
              <Switch
                value={!!col.visible}
                onValueChange={() => toggleCustomProp(i, 'visible')}
                trackColor={{ false: '#d1d5db', true: '#5a7bf5' }}
              />
              <Text style={makeCheckLabel(t)}>Visible in lead table</Text>
            </View>
            <View style={ui.checkRow}>
              <Switch
                value={col.formVisible !== false}
                onValueChange={() => toggleCustomProp(i, 'formVisible')}
                trackColor={{ false: '#d1d5db', true: '#5a7bf5' }}
              />
              <Text style={makeCheckLabel(t)}>Visible in lead form</Text>
            </View>
            <OutlineButton label="Remove" onPress={() => removeCustom(i)} danger style={{ marginTop: 8 }} t={t} />
          </View>
        ))
      )}
    </View>
  );
};

// ─── TAB: AI Settings ────────────────────────────────────────────────────────

const AiTab = ({ settings, updateField, t }) => (
  <View>
    <SectionHeader title="AI Settings" subtitle="Configure AI provider, model, and analysis options." t={t} />

    <Text style={makeGroupLabel(t)}>Provider</Text>
    <View style={makePickerWrap(t)}>
      <Picker
        selectedValue={settings.aiProvider || ''}
        onValueChange={v => updateField('aiProvider', v)}
        style={[ui.picker, { color: t.inputText, backgroundColor: t.input }]}
        dropdownIconColor={t.inputText}
      >
        <Picker.Item label="Disabled"        value=""          color={t.inputText} />
        <Picker.Item label="OpenAI"          value="openai"    color={t.inputText} />
        <Picker.Item label="Anthropic"       value="anthropic" color={t.inputText} />
        <Picker.Item label="Google Gemini"   value="gemini"    color={t.inputText} />
        <Picker.Item label="Custom Endpoint" value="custom"    color={t.inputText} />
      </Picker>
    </View>

    <Text style={makeGroupLabel(t)}>
      {settings.aiProvider === 'custom' ? 'Endpoint URL' : 'API Key'}
    </Text>
    <StyledInput
      value={settings.aiProvider === 'custom' ? settings.aiEndpoint || '' : settings.aiKey || ''}
      onChange={v =>
        settings.aiProvider === 'custom'
          ? updateField('aiEndpoint', v)
          : updateField('aiKey', v)
      }
      placeholder={settings.aiProvider === 'custom' ? 'https://api.example.com/…' : 'sk-…'}
      secureTextEntry={settings.aiProvider !== 'custom'}
      t={t}
    />

    {(settings.aiProvider === 'openai' || settings.aiProvider === 'anthropic') && (
      <>
        <Text style={makeGroupLabel(t)}>Model</Text>
        <StyledInput
          value={settings.aiModel || ''}
          onChange={v => updateField('aiModel', v)}
          placeholder="gpt-4-turbo"
          t={t}
        />
      </>
    )}

    <Text style={makeGroupLabel(t)}>Custom Prompt</Text>
    <StyledInput
      value={settings.aiPrompt || ''}
      onChange={v => updateField('aiPrompt', v)}
      placeholder="Enter system prompt…"
      multiline
      rows={4}
      t={t}
    />

    <Text style={makeGroupLabel(t)}>Options</Text>
    <View style={makeCard(t)}>
      {[
        { key: 'aiAutoAnalyse', label: 'Auto-analyse recordings'  },
        { key: 'aiScanNotes',   label: 'Scan notes for red flags' },
        { key: 'aiIntent',      label: 'Customer intent analysis' },
      ].map(opt => (
        <View key={opt.key} style={ui.checkRow}>
          <Switch
            value={!!settings[opt.key]}
            onValueChange={v => updateField(opt.key, v)}
            trackColor={{ false: '#d1d5db', true: '#5a7bf5' }}
          />
          <Text style={makeCheckLabel(t)}>{opt.label}</Text>
        </View>
      ))}
    </View>
  </View>
);

// ─── TAB: Payment Gateways ───────────────────────────────────────────────────

const GATEWAYS = [
  {
    key: 'razorpay', label: 'Razorpay',
    fields: [
      { name: 'keyId',     label: 'Key ID',       placeholder: 'rzp_live_…' },
      { name: 'keySecret', label: 'Key Secret',    placeholder: '••••••••', secret: true },
      { name: 'biz',       label: 'Business Name', placeholder: 'Sharda Associates' },
    ],
  },
  {
    key: 'stripe', label: 'Stripe',
    fields: [
      { name: 'publicKey', label: 'Publishable Key', placeholder: 'pk_live_…' },
      { name: 'secretKey', label: 'Secret Key',      placeholder: 'sk_live_…', secret: true },
    ],
  },
  {
    key: 'payu', label: 'PayU',
    fields: [
      { name: 'key',  label: 'Merchant Key',  placeholder: 'Your Merchant Key' },
      { name: 'salt', label: 'Merchant Salt', placeholder: '••••••••', secret: true },
    ],
  },
  {
    key: 'manual', label: 'Manual / Bank Transfer',
    fields: [
      { name: 'upi',  label: 'UPI ID',         placeholder: 'yourname@upi'   },
      { name: 'acct', label: 'Account Number', placeholder: '1234567890'      },
      { name: 'ifsc', label: 'IFSC Code',       placeholder: 'ABCD0123456'    },
      { name: 'bank', label: 'Bank Name',       placeholder: 'Bank Name'      },
    ],
  },
];

const PaymentsTab = ({ settings, updateField, t }) => {
  const gateways = settings.gateways || {};

  const updateGateway = (gKey, field, value) => {
    updateField('gateways', {
      ...gateways,
      [gKey]: { ...(gateways[gKey] || {}), [field]: value, connected: true },
    });
  };

  return (
    <View>
      <SectionHeader title="Payment Gateways" subtitle="Store gateway credentials and configure payment link settings." t={t} />

      {GATEWAYS.map(gw => {
        const config = gateways[gw.key] || {};
        return (
          <View key={gw.key} style={makeCard(t)}>
            <Text style={makeCardTitle(t)}>{gw.label}</Text>
            <Text style={makeCardMeta(t)}>
              Status: {config.connected ? '✅ Connected' : '⬜ Not connected'}
            </Text>
            {gw.fields.map(field => (
              <View key={field.name}>
                <FormLabel text={field.label} t={t} />
                <StyledInput
                  value={config[field.name] || ''}
                  onChange={v => updateGateway(gw.key, field.name, v)}
                  placeholder={field.placeholder}
                  secureTextEntry={!!field.secret}
                  t={t}
                />
              </View>
            ))}
          </View>
        );
      })}

      <View style={makeCard(t)}>
        <Text style={makeGroupLabel(t)}>Default Gateway</Text>
        <View style={makePickerWrap(t)}>
          <Picker
            selectedValue={settings.defaultGateway || ''}
            onValueChange={v => updateField('defaultGateway', v)}
            style={[ui.picker, { color: t.inputText, backgroundColor: t.input }]}
            dropdownIconColor={t.inputText}
          >
            <Picker.Item label="Select gateway…"        value=""         color={t.inputText} />
            <Picker.Item label="Razorpay"               value="razorpay" color={t.inputText} />
            <Picker.Item label="Stripe"                 value="stripe"   color={t.inputText} />
            <Picker.Item label="PayU"                   value="payu"     color={t.inputText} />
            <Picker.Item label="Manual / Bank Transfer" value="manual"   color={t.inputText} />
          </Picker>
        </View>

        <Text style={makeGroupLabel(t)}>Link Expiry (hours)</Text>
        <StyledInput
          value={String(settings.paymentLinkExpiry || 48)}
          onChange={v => updateField('paymentLinkExpiry', Number(v))}
          placeholder="48"
          t={t}
        />
      </View>
    </View>
  );
};

// ─── TAB: Integrations ───────────────────────────────────────────────────────

const IntegrationsTab = ({ settings, updateField, t }) => (
  <View>
    <SectionHeader title="Integrations" subtitle="Connect Google Calendar and configure email settings." t={t} />

    <View style={makeCard(t)}>
      <Text style={makeCardTitle(t)}>🗓 Google Calendar</Text>
      <Text style={makeCardMeta(t)}>
        OAuth setup requires web redirect flow. Open the web Admin Panel to connect/disconnect Google Calendar.
      </Text>
      <View style={[ui.tagRow, { marginTop: 8 }]}>
        <View style={settings.gcalConnected ? ui.tagGreen : ui.tagGray}>
          <Text style={settings.gcalConnected ? ui.tagGreenText : ui.tagGrayText}>
            {settings.gcalConnected ? `Connected — ${settings.gcalUser || ''}` : 'Not connected'}
          </Text>
        </View>
      </View>
    </View>

    <View style={makeCard(t)}>
      <View style={ui.checkRow}>
        <Switch
          value={!!settings.gmailEnabled}
          onValueChange={v => updateField('gmailEnabled', v)}
          trackColor={{ false: '#d1d5db', true: '#5a7bf5' }}
        />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={makeCheckLabel(t)}>Send reminder emails via Gmail</Text>
          <Text style={makeCardMeta(t)}>Receive email reminders for upcoming lead follow-ups.</Text>
        </View>
      </View>
    </View>
  </View>
);

// ─── TAB: General ────────────────────────────────────────────────────────────

const GeneralTab = ({ settings, updateField, onExportData, onExportLeads, onClearLeads, t }) => (
  <View>
    <SectionHeader title="General Settings" subtitle="Update company information, currency and timezone." t={t} />

    {[
      { key: 'companyName', label: 'Company Name',    placeholder: 'Sharda Associates' },
      { key: 'currency',    label: 'Currency Symbol', placeholder: '₹'                 },
      { key: 'timezone',    label: 'Timezone',        placeholder: 'Asia/Kolkata'       },
    ].map(f => (
      <View key={f.key}>
        <FormLabel text={f.label} t={t} />
        <StyledInput
          value={settings[f.key] || ''}
          onChange={v => updateField(f.key, v)}
          placeholder={f.placeholder}
          t={t}
        />
      </View>
    ))}

    <View style={[makeCard(t), { backgroundColor: '#fef2f2', borderColor: '#fecaca', marginTop: 16 }]}>
      <Text style={[makeCardTitle(t), { color: '#dc2626' }]}>⚠ Danger Zone</Text>
      <Text style={makeCardMeta(t)}>Export your data or permanently clear all lead-related records.</Text>
      <OutlineButton label="Export Leads (JSON)"    onPress={onExportLeads} style={{ marginTop: 12 }} t={t} />
      <OutlineButton label="Export All Data (JSON)" onPress={onExportData}  style={{ marginTop: 8  }} t={t} />
      <OutlineButton label="🗑 Clear All Leads"     onPress={onClearLeads}  danger style={{ marginTop: 8 }} t={t} />
    </View>
  </View>
);

// ─── Tab Dropdown ─────────────────────────────────────────────────────────────

const TabDropdown = ({ activeTab, onSelect, t, isDark }) => {
  const [open, setOpen] = useState(false);
  const activeLabel = TABS.find(tab => tab.key === activeTab)?.label || '';

  return (
    <View style={[s.tabBar, { backgroundColor: t.tabBg, borderBottomColor: t.border }]}>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={[s.dropdownBtn, { borderColor: t.border, backgroundColor: t.card }]}
      >
        <Text style={[s.dropdownBtnText, { color: t.title }]}>{activeLabel}</Text>
        <Text style={s.dropdownArrow}>▾</Text>
      </TouchableOpacity>

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.dropdownBackdrop} onPress={() => setOpen(false)}>
          <View style={[s.dropdownMenu, { backgroundColor: t.card, borderColor: t.border }]}>
            {TABS.map(tab => (
              <TouchableOpacity
                key={tab.key}
                onPress={() => { onSelect(tab.key); setOpen(false); }}
                style={[
                  s.dropdownItem,
                  { borderBottomColor: t.border },
                  activeTab === tab.key && { backgroundColor: isDark ? '#1e3a5f' : '#eff3ff' },
                ]}
              >
                <Text style={[
                  s.dropdownItemText,
                  { color: t.label },
                  activeTab === tab.key && { color: '#5a7bf5' },
                ]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

// ─── Main Screen ─────────────────────────────────────────────────────────────

const AdminPanelScreen = () => {
  const dispatch      = useDispatch();
  const auth          = useSelector(state => state.auth);
  const settingsState = useSelector(state => state.settings);

  const [settings,  setSettings]  = useState(null);
  const [users,     setUsers]     = useState([]);
  const [activeTab, setActiveTab] = useState('distribution');
  const [saving,    setSaving]    = useState(false);
  const [dirty,     setDirty]     = useState(false);

  const { isDark } = useTheme();
  const t = isDark ? dark : light;

  useEffect(() => { dispatch(fetchSettings()); }, [dispatch]);

  useEffect(() => {
    if (settingsState.data) {
      setSettings(normalizeSettings(settingsState.data));
      setDirty(false);
    }
  }, [settingsState.data]);

  useEffect(() => {
    userService.getUsers(1, 100)
      .then(data => setUsers(data.items || data?.data || []))
      .catch(() => showToast('Unable to load users.', 'error'));
  }, []);

  const updateField = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const payload = {
        ...settings,
        distributionPool: settings.distributionPool || [],
        pipelineStages:   settings.pipelineStages   || [],
      };
      const result = await dispatch(saveSettings(payload)).unwrap();
      setSettings(normalizeSettings(result));
      setDirty(false);
      showToast('Settings saved!', 'success');
    } catch (err) {
      showToast(err || 'Unable to save settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleExportData = async () => {
    try {
      const data = await settingsService.exportData();
      showToast('Export ready (check console / share logic).', 'success');
      console.log('[Export]', JSON.stringify(data).substring(0, 200));
    } catch { showToast('Export failed.', 'error'); }
  };

  const handleExportLeads = async () => {
    try {
      const data = await settingsService.exportLeads();
      showToast('Lead export ready.', 'success');
      console.log('[LeadExport]', JSON.stringify(data).substring(0, 200));
    } catch { showToast('Lead export failed.', 'error'); }
  };

  const handleClearLeads = () => {
    Alert.alert(
      'Clear All Leads',
      'This will permanently clear leads, payments and reminders. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear', style: 'destructive', onPress: async () => {
            try {
              await settingsService.clearLeads();
              showToast('Leads and related records cleared.', 'success');
            } catch { showToast('Clear operation failed.', 'error'); }
          },
        },
      ],
    );
  };

  // ── Guards ─────────────────────────────────────────────────────────────────

  if (settingsState.loading || !settings) {
    return (
      <SafeAreaView style={[s.centered, { backgroundColor: t.screenBg }]}>
        <ActivityIndicator size="large" color="#5a7bf5" />
        <Text style={[s.loadingText, { color: t.subtitle }]}>Loading admin settings…</Text>
      </SafeAreaView>
    );
  }

  const canAccess = canUser(auth.user, settingsState.data || settings, 'admin_panel');
  if (!canAccess) {
    return (
      <SafeAreaView style={[s.centered, { backgroundColor: t.screenBg }]}>
        <Text style={[s.errorText, { color: t.title }]}>
          You do not have permission to access the admin panel.
        </Text>
      </SafeAreaView>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const renderContent = () => {
    const commonProps = { settings, updateField, t };
    switch (activeTab) {
      case 'distribution':  return <DistributionTab users={users} t={t} />;
      case 'pipeline':      return <PipelineTab      {...commonProps} />;
      case 'rbac':          return <RbacTab           {...commonProps} />;
      case 'columns':       return <ColumnsTab        {...commonProps} />;
      case 'ai':            return <AiTab             {...commonProps} />;
      case 'payments':      return <PaymentsTab       {...commonProps} />;
      case 'integrations':  return <IntegrationsTab   {...commonProps} />;
      case 'general':
        return (
          <GeneralTab
            {...commonProps}
            onExportData={handleExportData}
            onExportLeads={handleExportLeads}
            onClearLeads={handleClearLeads}
          />
        );
      default: return null;
    }
  };

  return (
    <SafeAreaView style={[s.container, { backgroundColor: t.screenBg }]}>
      <View style={[s.header, { backgroundColor: t.headerBg, borderBottomColor: t.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: t.title }]}>Admin Panel</Text>
          <Text style={[s.subtitle, { color: t.subtitle }]}>Configure organization settings and permissions.</Text>
        </View>
        <PrimaryButton
          label={saving ? 'Saving…' : 'Save'}
          onPress={handleSave}
          disabled={!dirty || saving}
          style={{ paddingHorizontal: 18 }}
        />
      </View>

      <TabDropdown activeTab={activeTab} onSelect={setActiveTab} t={t} isDark={isDark} />

      <ScrollView style={[s.content, { backgroundColor: t.screenBg }]} contentContainerStyle={{ paddingBottom: 60 }}>
        {renderContent()}
      </ScrollView>
    </SafeAreaView>
  );
};

export default AdminPanelScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────

// NOTE: `s` = screen-level layout only (flex, position, size).
// Colors are NEVER hardcoded here — always passed via `t` theme prop
// or applied inline using the `make*` factory functions above.
const s = StyleSheet.create({
  container:   { flex: 1 },
  centered:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14 },
  errorText:   { fontSize: 14, textAlign: 'center' },

  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    paddingTop:        16,
    paddingBottom:     12,
    borderBottomWidth: 1,
    gap: 12,
  },
  title:    { fontSize: 22, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 2 },

  tabBar:            { borderBottomWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  dropdownBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  dropdownBtnText:   { fontSize: 14, fontWeight: '600' },
  dropdownArrow:     { fontSize: 14, color: '#5a7bf5', marginLeft: 8 },
  dropdownBackdrop:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-start', paddingTop: 140, paddingHorizontal: 12 },
  dropdownMenu:      { borderRadius: 14, borderWidth: 1, overflow: 'hidden', elevation: 8 },
  dropdownItem:      { paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1 },
  dropdownItemText:  { fontSize: 14, fontWeight: '500' },

  content: { flex: 1, padding: 16 },
});

// `ui` = reusable component shapes — layout & structure only, NO color values.
// All coloring is done via inline styles using the `t` theme object.
const ui = StyleSheet.create({
  sectionHeader: { marginBottom: 16 },

  btnPrimary:           { backgroundColor: '#5a7bf5', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryText:       { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnDisabled:          { opacity: 0.5 },
  btnOutline:           { borderWidth: 1, borderColor: '#d1d5db', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnOutlineText:       { color: '#374151', fontWeight: '600', fontSize: 13 },
  btnOutlineDanger:     { borderColor: '#fca5a5', backgroundColor: '#fef2f2' },
  btnOutlineDangerText: { color: '#dc2626' },

  // Fallback input (used only if t is not provided)
  input: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
    color: '#111827', backgroundColor: '#fff', marginBottom: 12,
  },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4, marginTop: 4 },

  pickerWrap: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, overflow: 'hidden', marginBottom: 12, backgroundColor: '#fff' },
  picker: { 
  height: 51,  
},

  cardActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  row:         { flexDirection: 'row', alignItems: 'center', gap: 10 },

  tagRow:          { flexDirection: 'row', gap: 6, marginBottom: 6 },
  tagBlue:         { backgroundColor: '#eff6ff', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  tagBlueText:     { color: '#1d4ed8', fontSize: 11, fontWeight: '600' },
  tagGreen:        { backgroundColor: '#f0fdf4', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  tagGreenText:    { color: '#166534', fontSize: 11, fontWeight: '600' },
  tagGray:         { backgroundColor: '#f3f4f6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  tagGrayText:     { color: '#6b7280', fontSize: 11, fontWeight: '600' },

  colorDot: { width: 24, height: 24, borderRadius: 12 },

  checkRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  checkbox:        { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: '#d1d5db', alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { borderColor: '#5a7bf5', backgroundColor: '#5a7bf5' },
  checkmark:       { color: '#fff', fontSize: 12, fontWeight: '700' },
  checkLabel:      { fontSize: 14, color: '#374151' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard:     { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, minHeight: 200 },
  modalTitle:    { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 8 },
  modalMsg:      { fontSize: 14, color: '#6b7280', marginBottom: 20 },
  modalActions:  { flexDirection: 'row', gap: 10, marginTop: 16 },

  emptyBox:  { borderWidth: 1, borderColor: '#e5e7eb', borderStyle: 'dashed', borderRadius: 14, padding: 32, alignItems: 'center', backgroundColor: '#fff' },
  emptyText: { fontSize: 13, color: '#9ca3af', textAlign: 'center' },
});

// ─── Theme tokens ─────────────────────────────────────────────────────────────

const light = {
  bg:          '#f8fafc',
  card:        '#ffffff',
  border:      '#e5e7eb',
  title:       '#111827',
  subtitle:    '#6b7280',
  input:       '#ffffff',
  inputText:   '#111827',
  inputBorder: '#d1d5db',
  label:       '#374151',
  groupLabel:  '#374151',
  cardMeta:    '#6b7280',
  checkLabel:  '#374151',
  tabBg:       '#ffffff',
  headerBg:    '#ffffff',
  screenBg:    '#f8fafc',
  pickerBg:    '#ffffff',
  emptyText:   '#9ca3af',
  placeholder: '#9ca3af',
};

const dark = {
  bg:          '#0f172a',
  card:        '#1e293b',
  border:      '#334155',
  title:       '#f1f5f9',
  subtitle:    '#94a3b8',
  input:       '#1e293b',
  inputText:   '#f1f5f9',
  inputBorder: '#475569',
  label:       '#cbd5e1',
  groupLabel:  '#cbd5e1',
  cardMeta:    '#94a3b8',
  checkLabel:  '#cbd5e1',
  tabBg:       '#1e293b',
  headerBg:    '#1e293b',
  screenBg:    '#0f172a',
  pickerBg:    '#1e293b',
  emptyText:   '#64748b',
  placeholder: '#64748b',
};