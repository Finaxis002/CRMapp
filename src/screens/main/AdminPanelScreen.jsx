import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { fetchSettings, saveSettings } from '../../store/slices/settingsSlice';
import { distributionRuleService } from '../../services/distributionRuleService';
import { userService } from '../../services/userService';
import { settingsService } from '../../services/settingsService';
import { supportService } from '../../services/supportService';
import api from '../../services/api';
import { canUser } from '../../utils/permissions';
import { useTheme } from '../../contexts/ThemeContext';
import ImprovedButton from '../../components/ui/ImprovedButton';
import ImprovedDropdown from '../../components/ui/ImprovedDropdown';
import SupportRequestsTab from '../../components/admin/SupportRequestsTab';

// ─── Constants ───────────────────────────────────────────────────────────────

const TABS = [
  { key: 'distribution', label: 'Distribution' },
  { key: 'pipeline', label: 'Pipeline' },
  { key: 'rbac', label: 'Access Control' },
  { key: 'columns', label: 'Lead Columns' },
  { key: 'ai', label: 'AI Settings' },
  { key: 'payments', label: 'Payments' },
  { key: 'integrations', label: 'Integrations' },
  { key: 'support', label: 'Support Requests' },
  { key: 'general', label: 'General' },
];

const RULE_LABELS = {
  round_robin: 'Round Robin',
  equal_load: 'Equal Load',
  manual: 'Manual Only',
};

const ROLE_LABELS = {
  admin: 'Admin',
  manager: 'Manager',
  tl: 'Team Lead',
  exec: 'Executive',
  viewer: 'Viewer',
};

const DEFAULT_COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'city', label: 'City' },
  { key: 'source', label: 'Source' },
  { key: 'value', label: 'Deal Value' },
  { key: 'status', label: 'Status' },
  { key: 'assign', label: 'Assigned To' },
  { key: 'coAssignees', label: 'Co-assignees' },
  { key: 'product', label: 'Product' },
  { key: 'priority', label: 'Priority' },
  { key: 'closeDate', label: 'Close Date' },
  { key: 'lastActivity', label: 'Last Activity' },
  { key: 'lastContacted', label: 'Last Contacted' },
];

const DEFAULT_PERMISSIONS = {
  'View all leads': {
    admin: true,
    manager: true,
    tl: false,
    exec: false,
    viewer: false,
  },
  'View team leads only': {
    admin: false,
    manager: true,
    tl: false,
    exec: false,
    viewer: false,
  },
  'Add leads': {
    admin: true,
    manager: true,
    tl: true,
    exec: true,
    viewer: false,
  },
  'Edit any lead': {
    admin: true,
    manager: true,
    tl: false,
    exec: false,
    viewer: false,
  },
  'Delete leads': {
    admin: true,
    manager: false,
    tl: false,
    exec: false,
    viewer: false,
  },
  'Assign leads': {
    admin: true,
    manager: true,
    tl: true,
    exec: false,
    viewer: false,
  },
  'Change lead owner': {
    admin: true,
    manager: true,
    tl: false,
    exec: false,
    viewer: false,
  },
  'Record payments': {
    admin: true,
    manager: true,
    tl: false,
    exec: false,
    viewer: false,
  },
  'Import from sheets': {
    admin: true,
    manager: true,
    tl: false,
    exec: false,
    viewer: false,
  },
  'View team': {
    admin: true,
    manager: true,
    tl: true,
    exec: false,
    viewer: false,
  },
  'Manage users': {
    admin: true,
    manager: false,
    tl: false,
    exec: false,
    viewer: false,
  },
  'Admin panel': {
    admin: true,
    manager: false,
    tl: false,
    exec: false,
    viewer: false,
  },
};

const DEFAULT_STAGE_COLORS = [
  '#6b7280',
  '#b86e00',
  '#6c35de',
  '#2a7d4f',
  '#1a1a18',
];

const DEFAULT_AI_PROMPT = `
You are an expert sales call analyst for a CRM system used by a financial services / CA firm in India.
Listen to the audio carefully and respond with ONLY a valid JSON object
(no markdown, no code fences, no extra text) in exactly this shape:

{
  "transcript": "Full verbatim transcript, speaker-labelled as Agent: and Customer: where possible",
  "summary": "A detailed 4-6 sentence summary",
  "intent": "Customer intent + interest level",
  "redFlags": [],
  "objections": [],
  "nextSteps": []
}
`;

const GEMINI_MODELS = [
  { value: 'gemini-2.5-flash', label: 'gemini-2.5-flash (fast)' },
  { value: 'gemini-2.5-flash-lite', label: 'gemini-2.5-flash-lite (fallback)' },
  { value: 'gemini-2.0-flash', label: 'gemini-2.0-flash' },
  { value: 'gemini-1.5-flash', label: 'gemini-1.5-flash' },
  { value: 'gemini-1.5-pro', label: 'gemini-1.5-pro (heavy)' },
];

const GROQ_MODELS = [
  { value: 'whisper-large-v3', label: 'whisper-large-v3' },
  { value: 'whisper-large-v3-turbo', label: 'whisper-large-v3-turbo (faster)' },
];

const RULE_OPTIONS = [
  { value: 'round_robin', label: 'Round Robin' },
  { value: 'equal_load', label: 'Equal Load' },
  { value: 'manual', label: 'Manual Only' },
];

const GATEWAY_OPTIONS = [
  { value: 'razorpay', label: 'Razorpay' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'payu', label: 'PayU' },
  { value: 'manual', label: 'Manual / Bank Transfer' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const normalizeSettings = s => {
  if (!s) return null;

  const defaultAi = {
    gemini: {
      enabled: false,
      key: '',
      hasKey: false,
      model: 'gemini-2.5-flash',
      ...(s.ai?.gemini || {}),
    },
    groq: {
      enabled: false,
      key: '',
      hasKey: false,
      model: 'whisper-large-v3',
      ...(s.ai?.groq || {}),
    },
    autoAnalyse: s.ai?.autoAnalyse ?? false,
    autoAnalyseCallLogs: s.ai?.autoAnalyseCallLogs ?? true,
    scanNotes: s.ai?.scanNotes ?? true,
    prompt: s.ai?.prompt || '',
  };

  return {
    ...s,
    distributionPool: (s.distributionPool || []).map(i => i?._id || i),
    pipelineStages: s.pipelineStages || [],
    customColumns: s.customColumns || [],
    permissions: s.permissions || DEFAULT_PERMISSIONS,
    gateways: s.gateways || {},
    ai: {
      ...defaultAi,
      ...(s.ai || {}),
      gemini: { ...defaultAi.gemini, ...(s.ai?.gemini || {}) },
      groq: { ...defaultAi.groq, ...(s.ai?.groq || {}) },
    },
  };
};

const showToast = (msg, type = 'info') => {
  console.log(`[${type}] ${msg}`);
};

const isDarkMode = t => t.bg === '#0f172a' || t.screenBg === '#0f172a';

// ─── Theme-aware factories - compact like KanbanScreen ───────────────────────

const makeCard = t => ({
  backgroundColor: t.card,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: t.border,
  padding: 12,
  marginBottom: 10,
});

const makeInput = t => ({
  borderWidth: 1,
  borderColor: t.inputBorder,
  borderRadius: 10,
  paddingHorizontal: 12,
  paddingVertical: 9,
  fontSize: 13,
  color: t.inputText,
  backgroundColor: t.input,
  marginBottom: 10,
});

const makeLabel = t => ({
  fontSize: 12,
  fontWeight: '600',
  color: t.label,
  marginBottom: 4,
  marginTop: 6,
});

const makeGroupLabel = t => ({
  fontSize: 12,
  fontWeight: '700',
  color: t.groupLabel,
  marginTop: 10,
  marginBottom: 6,
});

const makeCheckLabel = t => ({
  fontSize: 13,
  color: t.checkLabel,
});

const makeCardTitle = t => ({
  fontSize: 14,
  fontWeight: '700',
  color: t.title,
  marginBottom: 4,
  letterSpacing: -0.2,
});

const makeCardMeta = t => ({
  fontSize: 11,
  color: t.subtitle,
  marginBottom: 3,
});

const makeSectionTitle = t => ({
  fontSize: 15,
  fontWeight: '700',
  color: t.title,
  letterSpacing: -0.2,
});

const makeSectionSubtitle = t => ({
  fontSize: 11,
  color: t.subtitle,
  marginTop: 2,
});

const makeEmptyText = t => ({
  fontSize: 12,
  color: t.emptyText,
  textAlign: 'center',
});

const makeModalCard = t => ({
  backgroundColor: t.card,
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20,
  padding: 16,
  minHeight: 180,
});

const makeModalTitle = t => ({
  fontSize: 15,
  fontWeight: '700',
  color: t.title,
  marginBottom: 6,
  letterSpacing: -0.2,
});

const makeModalMsg = t => ({
  fontSize: 12,
  color: t.subtitle,
  marginBottom: 16,
});

// ─── Shared UI ───────────────────────────────────────────────────────────────

const SectionHeader = ({ title, subtitle, t }) => (
  <View style={{ marginBottom: 12, marginTop: 2 }}>
    <Text style={makeSectionTitle(t)}>{title}</Text>
    {subtitle ? <Text style={makeSectionSubtitle(t)}>{subtitle}</Text> : null}
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
    <Text
      style={[
        ui.btnOutlineText,
        danger && ui.btnOutlineDangerText,
        t && !danger && { color: t.label },
      ]}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

const FormLabel = ({ text, t }) => (
  <Text style={t ? makeLabel(t) : ui.label}>{text}</Text>
);

const StyledInput = ({
  value,
  onChange,
  placeholder,
  secureTextEntry,
  multiline,
  rows,
  t,
}) => (
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
      multiline && { height: rows * 22, textAlignVertical: 'top' },
    ]}
    returnKeyType="next"
  />
);

// ─── Delete Modal ────────────────────────────────────────────────────────────

const DeleteModal = ({ visible, title, message, onClose, onConfirm, t }) => (
  <Modal
    transparent
    visible={visible}
    animationType="fade"
    onRequestClose={onClose}
  >
    <Pressable style={ui.modalBackdrop} onPress={onClose}>
      <Pressable
        style={t ? makeModalCard(t) : ui.modalCard}
        onPress={e => e.stopPropagation()}
      >
        <Text style={t ? makeModalTitle(t) : ui.modalTitle}>{title}</Text>
        <Text style={t ? makeModalMsg(t) : ui.modalMsg}>{message}</Text>
        <View style={ui.modalActions}>
          <OutlineButton
            label="Cancel"
            onPress={onClose}
            style={{ flex: 1 }}
            t={t}
          />
          <TouchableOpacity
            onPress={() => {
              onConfirm();
              onClose();
            }}
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

const MultiSelectModal = ({
  visible,
  title,
  items,
  selectedIds,
  onToggle,
  onClose,
  t,
}) => (
  <Modal
    transparent
    visible={visible}
    animationType="slide"
    onRequestClose={onClose}
  >
    <Pressable style={ui.modalBackdrop} onPress={onClose}>
      <View style={[t ? makeModalCard(t) : ui.modalCard, { maxHeight: '70%' }]}>
        <Text style={t ? makeModalTitle(t) : ui.modalTitle}>{title}</Text>
        <ScrollView
          style={{ marginVertical: 8 }}
          keyboardShouldPersistTaps="handled"
        >
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
                <Text style={t ? makeCheckLabel(t) : ui.checkLabel}>
                  {item.label}
                </Text>
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
  const [rules, setRules] = useState([]);
  const [sheets, setSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sheetsOpen, setSheetsOpen] = useState(false);
  const [usersOpen, setUsersOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    sheetSyncIds: [],
    rule: 'round_robin',
    userPool: [],
  });

  useEffect(() => {
    loadData();
  }, []);

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

  const openEdit = rule => {
    setEditingRule(rule);
    setForm({
      name: rule.name,
      sheetSyncIds: rule.sheetSyncIds.map(s => s._id || s),
      rule: rule.rule,
      userPool: rule.userPool.map(u => u._id || u),
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
    if (!form.name.trim()) return showToast('Name required.', 'error');
    if (!form.sheetSyncIds.length)
      return showToast('Select at least one sheet.', 'error');
    if (!form.userPool.length)
      return showToast('Select at least one user.', 'error');

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
      <SectionHeader
        title="Lead Distribution"
        subtitle="Configure distribution rules for Google Sheet imports."
        t={t}
      />

      <ImprovedButton
        title="+ New Distribution"
        size="small"
        onPress={openCreate}
        style={{ alignSelf: 'flex-start', marginBottom: 12 }}
      />

      {loading ? (
        <ActivityIndicator color="#5a7bf5" />
      ) : rules.length === 0 ? (
        <View
          style={[
            ui.emptyBox,
            { borderColor: t.border, backgroundColor: t.card },
          ]}
        >
          <Text style={makeEmptyText(t)}>
            No distribution rules yet. Create one to get started.
          </Text>
        </View>
      ) : (
        rules.map(rule => (
          <View key={rule._id} style={makeCard(t)}>
            <Text style={makeCardTitle(t)}>{rule.name}</Text>
            <View style={ui.tagRow}>
              <View style={ui.tagBlue}>
                <Text style={ui.tagBlueText}>{RULE_LABELS[rule.rule]}</Text>
              </View>
              <View style={rule.isActive ? ui.tagGreen : ui.tagGray}>
                <Text style={rule.isActive ? ui.tagGreenText : ui.tagGrayText}>
                  {rule.isActive ? 'Active' : 'Inactive'}
                </Text>
              </View>
            </View>
            <Text style={makeCardMeta(t)}>
              <Text style={{ fontWeight: '600', color: t.label }}>
                Sheets:{' '}
              </Text>
              {rule.sheetSyncIds?.map(s => s.sheetName || s).join(', ') || '—'}
            </Text>
            <Text style={makeCardMeta(t)}>
              <Text style={{ fontWeight: '600', color: t.label }}>Users: </Text>
              {rule.userPool?.map(u => u.name || u).join(', ') || '—'}
            </Text>
            <View style={ui.cardActions}>
              <OutlineButton
                label="✏ Edit"
                onPress={() => openEdit(rule)}
                style={{ flex: 1 }}
                t={t}
              />
              <OutlineButton
                label="🗑 Delete"
                onPress={() => setDeleteId(rule._id)}
                danger
                style={{ flex: 1 }}
                t={t}
              />
            </View>
          </View>
        ))
      )}

      <Modal
        transparent
        visible={showModal}
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <Pressable
            style={ui.modalBackdrop}
            onPress={() => setShowModal(false)}
          >
            <Pressable
              style={[makeModalCard(t), { maxHeight: '90%' }]}
              onPress={e => e.stopPropagation()}
            >
              <Text style={makeModalTitle(t)}>
                {editingRule ? 'Edit Distribution' : 'New Distribution'}
              </Text>

              <ScrollView
                style={{ marginVertical: 8 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <FormLabel text="Distribution Name" t={t} />
                <StyledInput
                  value={form.name}
                  onChange={v => setForm(p => ({ ...p, name: v }))}
                  placeholder="e.g. Google Ads Rule"
                  t={t}
                />

                <FormLabel text="Distribution Rule" t={t} />
                <ImprovedDropdown
                  placeholder="Select Rule"
                  items={RULE_OPTIONS}
                  selectedValue={form.rule}
                  onValueChange={v => setForm(p => ({ ...p, rule: v }))}
                />

                <FormLabel
                  text={`Sheets (${form.sheetSyncIds.length} selected)`}
                  t={t}
                />
                <OutlineButton
                  label={
                    form.sheetSyncIds.length
                      ? `${form.sheetSyncIds.length} sheet(s) selected — tap to change`
                      : 'Select Sheets'
                  }
                  onPress={() => setSheetsOpen(true)}
                  style={{ marginBottom: 10 }}
                  t={t}
                />

                <FormLabel
                  text={`User Pool (${form.userPool.length} selected)`}
                  t={t}
                />
                <OutlineButton
                  label={
                    form.userPool.length
                      ? `${form.userPool.length} user(s) selected — tap to change`
                      : 'Select Users'
                  }
                  onPress={() => setUsersOpen(true)}
                  style={{ marginBottom: 12 }}
                  t={t}
                />
              </ScrollView>

              <View style={ui.modalActions}>
                <OutlineButton
                  label="Cancel"
                  onPress={() => setShowModal(false)}
                  style={{ flex: 1 }}
                  t={t}
                />
                <ImprovedButton
                  title={saving ? 'Saving…' : editingRule ? 'Update' : 'Create'}
                  size="small"
                  onPress={handleSave}
                  disabled={saving}
                  style={{ flex: 1 }}
                />
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <MultiSelectModal
        visible={sheetsOpen}
        title="Select Sheets"
        items={sheets.map(s => ({
          id: s._id,
          label: `${s.sheetName} (${s.tabName})`,
        }))}
        selectedIds={form.sheetSyncIds}
        onToggle={id => toggleItem('sheetSyncIds', id)}
        onClose={() => setSheetsOpen(false)}
        t={t}
      />

      <MultiSelectModal
        visible={usersOpen}
        title="Select Users"
        items={visibleUsers.map(u => ({
          id: u._id,
          label: `${u.name} (${u.role})`,
        }))}
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
    updateField(
      'pipelineStages',
      s.map((st, i) => ({ ...st, order: i })),
    );
  };

  const add = () => {
    const s = [...stages];
    s.push({
      name: 'New Stage',
      color: DEFAULT_STAGE_COLORS[s.length % DEFAULT_STAGE_COLORS.length],
      order: s.length,
    });
    updateField('pipelineStages', s);
  };

  const remove = index => {
    if (stages.length <= 2)
      return showToast('At least two pipeline stages required.', 'error');
    const s = [...stages];
    s.splice(index, 1);
    updateField(
      'pipelineStages',
      s.map((st, i) => ({ ...st, order: i })),
    );
  };

  return (
    <View>
      <SectionHeader
        title="Pipeline Stages"
        subtitle="Configure stage names, colors, and order."
        t={t}
      />

      {stages.map((stage, i) => (
        <View key={i} style={makeCard(t)}>
          <View style={ui.row}>
            <View style={[ui.colorDot, { backgroundColor: stage.color }]} />
            <TextInput
              value={stage.name}
              onChangeText={v => handleChange(i, 'name', v)}
              style={[makeInput(t), { flex: 1, marginBottom: 0, fontSize: 13 }]}
            />
          </View>

          <View style={[ui.cardActions, { marginTop: 8 }]}>
            <OutlineButton
              label="↑"
              onPress={() => move(i, -1)}
              style={{ flex: 1 }}
              t={t}
            />
            <OutlineButton
              label="↓"
              onPress={() => move(i, 1)}
              style={{ flex: 1 }}
              t={t}
            />
            <OutlineButton
              label="Remove"
              onPress={() => remove(i)}
              danger
              style={{ flex: 1 }}
              t={t}
            />
          </View>
        </View>
      ))}

      <ImprovedButton
        title="+ Add Stage"
        size="small"
        onPress={add}
        style={{ alignSelf: 'flex-start', marginTop: 6 }}
      />
    </View>
  );
};

// ─── TAB: RBAC ───────────────────────────────────────────────────────────────

const RbacTab = ({ settings, updateField, t }) => {
  const permissions = settings.permissions || DEFAULT_PERMISSIONS;
  const permKeys = Object.keys(permissions);
  const roleKeys = Object.keys(ROLE_LABELS);

  const toggle = (perm, role) => {
    const current = permissions[perm]?.[role];
    updateField('permissions', {
      ...permissions,
      [perm]: { ...permissions[perm], [role]: !current },
    });
  };

  return (
    <View>
      <SectionHeader
        title="Access Control"
        subtitle="Update role permissions for your organization."
        t={t}
      />

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
                <Text style={[makeCheckLabel(t), { flex: 1, fontSize: 13 }]}>
                  {perm}
                </Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
};

// ─── TAB: Columns ────────────────────────────────────────────────────────────

const ColumnsTab = ({ settings, updateField, t }) => {
  const leadColumns = settings.leadColumns || [];
  const customColumns = settings.customColumns || [];

  const toggleBase = key => {
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

  const removeCustom = index => {
    const updated = [...customColumns];
    updated.splice(index, 1);
    updateField('customColumns', updated);
  };

  return (
    <View>
      <SectionHeader
        title="Lead Table Columns"
        subtitle="Choose which columns appear in the lead table."
        t={t}
      />

      <Text style={makeGroupLabel(t)}>Base Columns</Text>
      <View style={makeCard(t)}>
        {DEFAULT_COLUMNS.map(col => {
          const checked = leadColumns.includes(col.key);
          return (
            <TouchableOpacity
              key={col.key}
              style={ui.checkRow}
              onPress={() => toggleBase(col.key)}
            >
              <View style={[ui.checkbox, checked && ui.checkboxChecked]}>
                {checked && <Text style={ui.checkmark}>✓</Text>}
              </View>
              <Text style={makeCheckLabel(t)}>{col.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 8,
          marginBottom: 4,
        }}
      >
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
          style={[ui.btnPrimary, { paddingHorizontal: 10, paddingVertical: 5 }]}
          activeOpacity={0.8}
        >
          <Text style={[ui.btnPrimaryText, { fontSize: 11 }]}>
            + Add Column
          </Text>
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
            <OutlineButton
              label="Remove"
              onPress={() => removeCustom(i)}
              danger
              style={{ marginTop: 8 }}
              t={t}
            />
          </View>
        ))
      )}
    </View>
  );
};

// ─── TAB: AI Settings ────────────────────────────────────────────────────────

const AiTab = ({ settings, updateField, t, users = [], onRefreshUsers }) => {
  const ai = settings.ai || {};
  const gemini = ai.gemini || {
    enabled: false,
    key: '',
    hasKey: false,
    model: 'gemini-2.5-flash',
  };
  const groq = ai.groq || {
    enabled: false,
    key: '',
    hasKey: false,
    model: 'whisper-large-v3',
  };

  const [aiKeyModal, setAiKeyModal] = useState(null);
  const [aiKeyForm, setAiKeyForm] = useState({
    geminiKey: '',
    geminiModel: '',
    groqKey: '',
    groqModel: '',
  });
  const [aiKeyOriginal, setAiKeyOriginal] = useState({
    geminiKey: '',
    geminiModel: '',
    groqKey: '',
    groqModel: '',
  });
  const [showKeys, setShowKeys] = useState(false);
  const [showOrgKeys, setShowOrgKeys] = useState(false);
  const [showDefaultPrompt, setShowDefaultPrompt] = useState(false);
  const [aiKeySaving, setAiKeySaving] = useState(false);
  const [loadingUserKeys, setLoadingUserKeys] = useState(false);

  const keysDirty =
    aiKeyForm.geminiKey !== aiKeyOriginal.geminiKey ||
    aiKeyForm.geminiModel !== aiKeyOriginal.geminiModel ||
    aiKeyForm.groqKey !== aiKeyOriginal.groqKey ||
    aiKeyForm.groqModel !== aiKeyOriginal.groqModel;

  const updateAi = newAi => updateField('ai', newAi);
  const updateGemini = (field, value) =>
    updateAi({ ...ai, gemini: { ...gemini, [field]: value } });
  const updateGroq = (field, value) =>
    updateAi({ ...ai, groq: { ...groq, [field]: value } });

  const handleOrgKeyChange = (provider, value) => {
    if (provider === 'gemini')
      updateAi({ ...ai, gemini: { ...gemini, key: value, hasKey: !!value } });
    else updateAi({ ...ai, groq: { ...groq, key: value, hasKey: !!value } });
  };

  const handleRemoveOrgKey = provider => {
    if (provider === 'gemini')
      updateAi({ ...ai, gemini: { ...gemini, key: '', hasKey: false } });
    else updateAi({ ...ai, groq: { ...groq, key: '', hasKey: false } });
  };

  const openUserAiKeyModal = async user => {
    setLoadingUserKeys(true);
    try {
      const res = await api.get(`/users/${user._id}/ai-keys`);
      const data = res.data?.data || res.data || {};
      const formVals = {
        geminiKey: data.ai?.gemini?.key || '',
        geminiModel: data.ai?.gemini?.model || 'gemini-2.5-flash',
        groqKey: data.ai?.groq?.key || '',
        groqModel: data.ai?.groq?.model || 'whisper-large-v3',
      };
      setAiKeyForm(formVals);
      setAiKeyOriginal(formVals);
      setShowKeys(false);
      setAiKeyModal({
        _id: data._id || user._id,
        name: data.name || user.name,
        email: data.email || user.email,
        ai: data.ai || user.ai,
      });
    } catch {
      showToast('Could not load AI keys', 'error');
    } finally {
      setLoadingUserKeys(false);
    }
  };

  const handleSaveUserAiKeys = async () => {
    if (!aiKeyModal) return;
    setAiKeySaving(true);
    try {
      await api.patch(`/users/${aiKeyModal._id}/ai-keys`, {
        geminiKey: aiKeyForm.geminiKey,
        geminiModel: aiKeyForm.geminiModel,
        groqKey: aiKeyForm.groqKey,
        groqModel: aiKeyForm.groqModel,
      });
      showToast(`AI keys updated for ${aiKeyModal.name}`, 'success');
      setAiKeyModal(null);
      if (onRefreshUsers) onRefreshUsers();
    } catch {
      showToast('Failed to update AI keys', 'error');
    } finally {
      setAiKeySaving(false);
    }
  };

  const removeKey = provider => {
    if (provider === 'gemini') setAiKeyForm(p => ({ ...p, geminiKey: '' }));
    else setAiKeyForm(p => ({ ...p, groqKey: '' }));
  };

  return (
    <View>
      <SectionHeader
        title="AI Settings"
        subtitle="Configure Gemini & Groq providers. Keys set here are the default for all users."
        t={t}
      />

      {/* Gemini */}
      <View style={makeCard(t)}>
        <View style={ui.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={makeCardTitle(t)}>🔵 Gemini</Text>
            <Text style={makeCardMeta(t)}>
              Primary — audio-native, best accuracy
            </Text>
          </View>
          <Switch
            value={!!gemini.enabled}
            onValueChange={v => updateGemini('enabled', v)}
            trackColor={{ false: '#d1d5db', true: '#5a7bf5' }}
          />
        </View>

        {gemini.enabled && (
          <View style={{ marginTop: 10 }}>
            <View style={ui.rowBetween}>
              <FormLabel text="API Key" t={t} />
              <TouchableOpacity onPress={() => setShowOrgKeys(!showOrgKeys)}>
                <Text
                  style={{ fontSize: 11, color: '#5a7bf5', fontWeight: '600' }}
                >
                  {showOrgKeys ? '🙈 Hide' : '👁 Show'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={ui.row}>
              <TextInput
                value={gemini.key || ''}
                onChangeText={v => handleOrgKeyChange('gemini', v)}
                placeholder="AIza..."
                placeholderTextColor={t.placeholder}
                secureTextEntry={!showOrgKeys}
                style={[makeInput(t), { flex: 1, fontFamily: 'monospace' }]}
              />
              {gemini.hasKey && (
                <TouchableOpacity
                  onPress={() => handleRemoveOrgKey('gemini')}
                  style={[ui.iconBtn, { marginLeft: 8, marginBottom: 10 }]}
                >
                  <Text>🗑</Text>
                </TouchableOpacity>
              )}
            </View>

            <FormLabel text="Model" t={t} />
            <ImprovedDropdown
              placeholder="Select Model"
              items={GEMINI_MODELS}
              selectedValue={gemini.model}
              onValueChange={v => updateGemini('model', v)}
            />

            <View
              style={[
                ui.infoBox,
                {
                  backgroundColor: isDarkMode(t) ? '#052e16' : '#f0fdf4',
                  borderColor: '#bbf7d0',
                  marginTop: 8,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 10,
                  color: isDarkMode(t) ? '#86efac' : '#166534',
                }}
              >
                ✅ Audio-native — transcription + analysis in one call
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Groq */}
      <View style={makeCard(t)}>
        <View style={ui.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={makeCardTitle(t)}>🟠 Groq</Text>
            <Text style={makeCardMeta(t)}>
              Fallback — Whisper STT + LLaMA analysis
            </Text>
          </View>
          <Switch
            value={!!groq.enabled}
            onValueChange={v => updateGroq('enabled', v)}
            trackColor={{ false: '#d1d5db', true: '#f97316' }}
          />
        </View>

        {groq.enabled && (
          <View style={{ marginTop: 10 }}>
            <FormLabel text="API Key" t={t} />
            <View style={ui.row}>
              <TextInput
                value={groq.key || ''}
                onChangeText={v => handleOrgKeyChange('groq', v)}
                placeholder="gsk_..."
                placeholderTextColor={t.placeholder}
                secureTextEntry={!showOrgKeys}
                style={[makeInput(t), { flex: 1, fontFamily: 'monospace' }]}
              />
              {groq.hasKey && (
                <TouchableOpacity
                  onPress={() => handleRemoveOrgKey('groq')}
                  style={[ui.iconBtn, { marginLeft: 8, marginBottom: 10 }]}
                >
                  <Text>🗑</Text>
                </TouchableOpacity>
              )}
            </View>

            <FormLabel text="Whisper Model" t={t} />
            <ImprovedDropdown
              placeholder="Select Whisper Model"
              items={GROQ_MODELS}
              selectedValue={groq.model}
              onValueChange={v => updateGroq('model', v)}
            />

            <View
              style={[
                ui.infoBox,
                {
                  backgroundColor: isDarkMode(t) ? '#431407' : '#fff7ed',
                  borderColor: '#fed7aa',
                  marginTop: 8,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 10,
                  color: isDarkMode(t) ? '#fdba74' : '#9a3412',
                }}
              >
                ⚡ Whisper → LLaMA (2-step, very fast)
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Common */}
      <View style={makeCard(t)}>
        <Text style={makeCardTitle(t)}>Common Settings</Text>

        <View style={ui.checkRow}>
          <Switch
            value={!!ai.autoAnalyse}
            onValueChange={v => updateAi({ ...ai, autoAnalyse: v })}
            trackColor={{ false: '#d1d5db', true: '#5a7bf5' }}
          />
          <Text style={[makeCheckLabel(t), { flex: 1 }]}>
            Auto-analyze lead recordings
          </Text>
        </View>

        <View style={ui.checkRow}>
          <Switch
            value={ai.autoAnalyseCallLogs !== false}
            onValueChange={v => updateAi({ ...ai, autoAnalyseCallLogs: v })}
            trackColor={{ false: '#d1d5db', true: '#5a7bf5' }}
          />
          <Text style={[makeCheckLabel(t), { flex: 1 }]}>
            Auto-analyze call log recordings
          </Text>
        </View>

        <View style={ui.checkRow}>
          <Switch
            value={ai.scanNotes !== false}
            onValueChange={v => updateAi({ ...ai, scanNotes: v })}
            trackColor={{ false: '#d1d5db', true: '#5a7bf5' }}
          />
          <Text style={[makeCheckLabel(t), { flex: 1 }]}>
            Scan notes for red flags
          </Text>
        </View>

        <Text style={[makeGroupLabel(t), { marginTop: 12 }]}>
          Custom Prompt
        </Text>
        <TextInput
          value={ai.prompt || ''}
          onChangeText={v => updateAi({ ...ai, prompt: v })}
          placeholder="Enter custom prompt or leave empty to use default..."
          placeholderTextColor={t.placeholder}
          multiline
          numberOfLines={6}
          style={[makeInput(t), { height: 110, textAlignVertical: 'top' }]}
        />

        <TouchableOpacity
          onPress={() => setShowDefaultPrompt(!showDefaultPrompt)}
          style={{ marginTop: 4 }}
        >
          <Text style={{ fontSize: 11, color: '#5a7bf5', fontWeight: '600' }}>
            {showDefaultPrompt
              ? 'Hide Default Prompt ▲'
              : 'Show Default Prompt ▼'}
          </Text>
        </TouchableOpacity>

        {showDefaultPrompt && (
          <View
            style={[
              ui.codeBox,
              { backgroundColor: t.bg, borderColor: t.border, marginTop: 8 },
            ]}
          >
            <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
              <Text
                style={{
                  fontSize: 10,
                  color: t.subtitle,
                  fontFamily: 'monospace',
                }}
              >
                {DEFAULT_AI_PROMPT}
              </Text>
            </ScrollView>
          </View>
        )}
      </View>

      {/* Per-User */}
      <View style={[makeCard(t), { padding: 0, overflow: 'hidden' }]}>
        <View
          style={{
            padding: 12,
            borderBottomWidth: 1,
            borderBottomColor: t.border,
          }}
        >
          <Text style={makeCardTitle(t)}>Per-User API Keys</Text>
          <Text style={makeCardMeta(t)}>
            Users can override org-level keys.
          </Text>
        </View>

        {users.length === 0 ? (
          <Text style={[makeEmptyText(t), { padding: 14 }]}>
            No users found.
          </Text>
        ) : (
          users.map(user => (
            <View
              key={user._id}
              style={[ui.userRow, { borderBottomColor: t.border }]}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{ fontSize: 13, fontWeight: '600', color: t.title }}
                >
                  {user.name}
                </Text>
                <Text style={{ fontSize: 10, color: t.subtitle }}>
                  {user.email}
                </Text>
                <View style={[ui.tagRow, { marginTop: 5 }]}>
                  <View style={ui.tagGray}>
                    <Text style={ui.tagGrayText}>
                      {ROLE_LABELS[user.role] || user.role}
                    </Text>
                  </View>
                  {user.ai?.gemini?.hasKey ? (
                    <View style={ui.tagBlue}>
                      <Text style={ui.tagBlueText}>Gemini ✓</Text>
                    </View>
                  ) : (
                    <Text style={{ fontSize: 10, color: t.emptyText }}>
                      — Org —
                    </Text>
                  )}
                  {user.ai?.groq?.hasKey && (
                    <View
                      style={[
                        ui.tagGray,
                        {
                          backgroundColor: '#fff7ed',
                          borderColor: '#fed7aa',
                          borderWidth: 1,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: '#c2410c',
                          fontSize: 10,
                          fontWeight: '600',
                        }}
                      >
                        Groq ✓
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              <ImprovedButton
                title="Edit"
                size="small"
                onPress={() => openUserAiKeyModal(user)}
              />
            </View>
          ))
        )}
      </View>

      {/* Per-user key modal */}
      <Modal
        transparent
        visible={!!aiKeyModal}
        animationType="slide"
        onRequestClose={() => setAiKeyModal(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <Pressable
            style={ui.modalBackdrop}
            onPress={() => setAiKeyModal(null)}
          >
            <Pressable
              style={[makeModalCard(t), { maxHeight: '90%' }]}
              onPress={e => e.stopPropagation()}
            >
              <View style={ui.rowBetween}>
                <Text style={makeModalTitle(t)}>
                  AI Keys — {aiKeyModal?.name}
                </Text>
                <TouchableOpacity onPress={() => setAiKeyModal(null)}>
                  <Text style={{ fontSize: 16, color: t.subtitle }}>✕</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={() => setShowKeys(!showKeys)}
                style={[
                  ui.btnOutline,
                  { alignSelf: 'flex-start', marginBottom: 10 },
                ]}
              >
                <Text style={{ fontSize: 11, color: t.label }}>
                  {showKeys ? '🙈 Hide' : '👁 Show'}
                </Text>
              </TouchableOpacity>

              {loadingUserKeys ? (
                <ActivityIndicator
                  color="#5a7bf5"
                  style={{ marginVertical: 20 }}
                />
              ) : (
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  <View
                    style={[
                      ui.innerCard,
                      {
                        borderColor: '#bfdbfe',
                        backgroundColor: isDarkMode(t) ? '#0c1a2a' : '#eff6ff',
                      },
                    ]}
                  >
                    <View style={ui.rowBetween}>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '700',
                          color: '#1d4ed8',
                        }}
                      >
                        🔵 Gemini
                      </Text>
                      {aiKeyModal?.ai?.gemini?.hasKey && (
                        <TouchableOpacity onPress={() => removeKey('gemini')}>
                          <Text style={{ fontSize: 11, color: '#dc2626' }}>
                            🗑 Delete
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <TextInput
                      value={aiKeyForm.geminiKey}
                      onChangeText={v =>
                        setAiKeyForm(p => ({ ...p, geminiKey: v }))
                      }
                      placeholder="AIza..."
                      placeholderTextColor={t.placeholder}
                      secureTextEntry={!showKeys}
                      style={[makeInput(t), { marginTop: 8 }]}
                    />
                    <ImprovedDropdown
                      placeholder="Gemini Model"
                      items={GEMINI_MODELS}
                      selectedValue={aiKeyForm.geminiModel}
                      onValueChange={v =>
                        setAiKeyForm(p => ({ ...p, geminiModel: v }))
                      }
                    />
                  </View>

                  <View
                    style={[
                      ui.innerCard,
                      {
                        borderColor: '#fed7aa',
                        backgroundColor: isDarkMode(t) ? '#2a1a0a' : '#fff7ed',
                        marginTop: 10,
                      },
                    ]}
                  >
                    <View style={ui.rowBetween}>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '700',
                          color: '#c2410c',
                        }}
                      >
                        🟠 Groq
                      </Text>
                      {aiKeyModal?.ai?.groq?.hasKey && (
                        <TouchableOpacity onPress={() => removeKey('groq')}>
                          <Text style={{ fontSize: 11, color: '#dc2626' }}>
                            🗑 Delete
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <TextInput
                      value={aiKeyForm.groqKey}
                      onChangeText={v =>
                        setAiKeyForm(p => ({ ...p, groqKey: v }))
                      }
                      placeholder="gsk_..."
                      placeholderTextColor={t.placeholder}
                      secureTextEntry={!showKeys}
                      style={[makeInput(t), { marginTop: 8 }]}
                    />
                    <ImprovedDropdown
                      placeholder="Whisper Model"
                      items={GROQ_MODELS}
                      selectedValue={aiKeyForm.groqModel}
                      onValueChange={v =>
                        setAiKeyForm(p => ({ ...p, groqModel: v }))
                      }
                    />
                  </View>
                </ScrollView>
              )}

              <View style={ui.modalActions}>
                <OutlineButton
                  label="Cancel"
                  onPress={() => setAiKeyModal(null)}
                  style={{ flex: 1 }}
                  t={t}
                />
                <ImprovedButton
                  title={aiKeySaving ? 'Saving...' : 'Save Keys'}
                  size="small"
                  onPress={handleSaveUserAiKeys}
                  disabled={aiKeySaving || !keysDirty}
                  style={{ flex: 1 }}
                />
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

// ─── TAB: Payments ───────────────────────────────────────────────────────────

const GATEWAYS = [
  {
    key: 'razorpay',
    label: 'Razorpay',
    fields: [
      { name: 'keyId', label: 'Key ID', placeholder: 'rzp_live_…' },
      {
        name: 'keySecret',
        label: 'Key Secret',
        placeholder: '••••••••',
        secret: true,
      },
      { name: 'biz', label: 'Business Name', placeholder: 'Sharda Associates' },
    ],
  },
  {
    key: 'stripe',
    label: 'Stripe',
    fields: [
      { name: 'publicKey', label: 'Publishable Key', placeholder: 'pk_live_…' },
      {
        name: 'secretKey',
        label: 'Secret Key',
        placeholder: 'sk_live_…',
        secret: true,
      },
    ],
  },
  {
    key: 'payu',
    label: 'PayU',
    fields: [
      { name: 'key', label: 'Merchant Key', placeholder: 'Your Merchant Key' },
      {
        name: 'salt',
        label: 'Merchant Salt',
        placeholder: '••••••••',
        secret: true,
      },
    ],
  },
  {
    key: 'manual',
    label: 'Manual / Bank Transfer',
    fields: [
      { name: 'upi', label: 'UPI ID', placeholder: 'yourname@upi' },
      { name: 'acct', label: 'Account Number', placeholder: '1234567890' },
      { name: 'ifsc', label: 'IFSC Code', placeholder: 'ABCD0123456' },
      { name: 'bank', label: 'Bank Name', placeholder: 'Bank Name' },
    ],
  },
];

const PaymentsTab = ({ settings, updateField, t }) => {
  const gateways = settings.gateways || {};

  const updateGateway = (gKey, field, value) =>
    updateField('gateways', {
      ...gateways,
      [gKey]: { ...(gateways[gKey] || {}), [field]: value, connected: true },
    });

  return (
    <View>
      <SectionHeader
        title="Payment Gateways"
        subtitle="Store gateway credentials and configure payment link settings."
        t={t}
      />

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
        <FormLabel text="Default Gateway" t={t} />
        <ImprovedDropdown
          placeholder="Select gateway..."
          items={[
            { value: '', label: 'Select gateway...' },
            ...GATEWAY_OPTIONS,
          ]}
          selectedValue={settings.defaultGateway || ''}
          onValueChange={v => updateField('defaultGateway', v)}
        />

        <FormLabel text="Link Expiry (hours)" t={t} />
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
    <SectionHeader
      title="Integrations"
      subtitle="Connect Google Calendar and configure email settings."
      t={t}
    />

    <View style={makeCard(t)}>
      <Text style={makeCardTitle(t)}>🗓 Google Calendar</Text>
      <Text style={makeCardMeta(t)}>
        OAuth setup requires web redirect flow. Open the web Admin Panel to
        connect/disconnect Google Calendar.
      </Text>
      <View style={[ui.tagRow, { marginTop: 6 }]}>
        <View style={settings.gcalConnected ? ui.tagGreen : ui.tagGray}>
          <Text
            style={settings.gcalConnected ? ui.tagGreenText : ui.tagGrayText}
          >
            {settings.gcalConnected
              ? `Connected — ${settings.gcalUser || ''}`
              : 'Not connected'}
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
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={makeCheckLabel(t)}>Send reminder emails via Gmail</Text>
          <Text style={makeCardMeta(t)}>
            Receive email reminders for upcoming lead follow-ups.
          </Text>
        </View>
      </View>
    </View>
  </View>
);

// ─── TAB: General ────────────────────────────────────────────────────────────

const GeneralTab = ({ settings, t }) => (
  <View>
    <SectionHeader
      title="General Settings"
      subtitle="View company information, currency and timezone (managed from web)."
      t={t}
    />

    <View style={makeCard(t)}>
      {[
        {
          key: 'companyName',
          label: 'Company Name',
          placeholder: 'Sharda Associates',
        },
        { key: 'currency', label: 'Currency Symbol', placeholder: '₹' },
        { key: 'timezone', label: 'Timezone', placeholder: 'Asia/Kolkata' },
      ].map(f => (
        <View key={f.key} style={{ marginBottom: 4 }}>
          <FormLabel text={f.label} t={t} />
          {/* Non-editable like web - disabled, gray bg */}
          <View
            style={[
              makeInput(t),
              {
                backgroundColor: isDarkMode(t) ? '#0f172a' : '#f3f4f6',
                borderColor: isDarkMode(t) ? '#334155' : '#e5e7eb',
                opacity: 0.9,
              },
            ]}
          >
            <Text
              style={{ fontSize: 13, color: t.subtitle || '#6b7280' }}
              numberOfLines={1}
            >
              {settings[f.key] || f.placeholder}
            </Text>
          </View>
        </View>
      ))}

      <View
        style={[
          ui.infoBox,
          {
            backgroundColor: isDarkMode(t) ? '#1e293b' : '#f8fafc',
            borderColor: t.border,
            marginTop: 12,
          },
        ]}
      >
        <Text style={{ fontSize: 11, color: t.subtitle }}>
          ℹ️ These fields are non-editable in app. Please use Web Admin Panel to
          update company info. Export &amp; Delete actions are also web-only.
        </Text>
      </View>
    </View>
  </View>
);

// ─── Main Screen ─────────────────────────────────────────────────────────────

const AdminPanelScreen = () => {
  const dispatch = useDispatch();
  const auth = useSelector(state => state.auth);
  const settingsState = useSelector(state => state.settings);

  const [settings, setSettings] = useState(null);
  const [users, setUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('distribution');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [supportUnread, setSupportUnread] = useState(0);

  const { isDark } = useTheme();
  const t = isDark ? dark : light;

  useEffect(() => {
    dispatch(fetchSettings());
  }, [dispatch]);

  useEffect(() => {
    if (settingsState.data) {
      setSettings(normalizeSettings(settingsState.data));
      setDirty(false);
    }
  }, [settingsState.data]);

  useEffect(() => {
    reloadUsers();
  }, []);

  useEffect(() => {
    supportService
      .getUnreadCount()
      .then(setSupportUnread)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTab === 'support') setSupportUnread(0);
  }, [activeTab]);

  const reloadUsers = async () => {
    try {
      const data = await userService.getUsers(1, 100);
      setUsers(data.items || data?.data || []);
    } catch {
      showToast('Unable to load users.', 'error');
    }
  };

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
        pipelineStages: settings.pipelineStages || [],
      };

      if (payload.ai) {
        const ai = { ...payload.ai };
        if (ai.gemini) {
          ai.gemini = { ...ai.gemini };
          if (ai.gemini.hasKey === false) ai.gemini.key = '';
          else if (!ai.gemini.key) delete ai.gemini.key;
        }
        if (ai.groq) {
          ai.groq = { ...ai.groq };
          if (ai.groq.hasKey === false) ai.groq.key = '';
          else if (!ai.groq.key) delete ai.groq.key;
        }
        payload.ai = ai;
      }

      const result = await dispatch(saveSettings(payload)).unwrap();
      setSettings(normalizeSettings(result));
      setDirty(false);
      showToast('Settings saved!', 'success');
    } catch (err) {
      showToast(
        typeof err === 'string'
          ? err
          : err?.message || 'Unable to save settings.',
        'error',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleExportData = async () => {
    try {
      const data = await settingsService.exportData();
      showToast('Export ready.', 'success');
      console.log('[Export]', JSON.stringify(data).substring(0, 200));
    } catch {
      showToast('Export failed.', 'error');
    }
  };

  const handleExportLeads = async () => {
    try {
      const data = await settingsService.exportLeads();
      showToast('Lead export ready.', 'success');
      console.log('[LeadExport]', JSON.stringify(data).substring(0, 200));
    } catch {
      showToast('Lead export failed.', 'error');
    }
  };

  const handleClearLeads = () => {
    Alert.alert(
      'Clear All Leads',
      'This will permanently clear leads, payments and reminders. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await settingsService.clearLeads();
              showToast('Leads and related records cleared.', 'success');
            } catch {
              showToast('Clear operation failed.', 'error');
            }
          },
        },
      ],
    );
  };

  if (settingsState.loading || !settings) {
    return (
      <SafeAreaView
        style={[s.centered, { backgroundColor: t.screenBg }]}
        edges={['bottom']}
      >
        <ActivityIndicator size="large" color="#5a7bf5" />
        <Text style={[s.loadingText, { color: t.subtitle }]}>
          Loading admin settings…
        </Text>
      </SafeAreaView>
    );
  }

  const canAccess = canUser(
    auth.user,
    settingsState.data || settings,
    'admin_panel',
  );

  if (!canAccess) {
    return (
      <SafeAreaView
        style={[s.centered, { backgroundColor: t.screenBg }]}
        edges={['bottom']}
      >
        <Text style={[s.errorText, { color: t.title }]}>
          You do not have permission to access the admin panel.
        </Text>
      </SafeAreaView>
    );
  }

  const renderContent = () => {
    const commonProps = { settings, updateField, t };
    switch (activeTab) {
      case 'distribution':
        return <DistributionTab users={users} t={t} />;
      case 'pipeline':
        return <PipelineTab {...commonProps} />;
      case 'rbac':
        return <RbacTab {...commonProps} />;
      case 'columns':
        return <ColumnsTab {...commonProps} />;
      case 'ai':
        return (
          <AiTab {...commonProps} users={users} onRefreshUsers={reloadUsers} />
        );
      case 'payments':
        return <PaymentsTab {...commonProps} />;
      case 'integrations':
        return <IntegrationsTab {...commonProps} />;
      case 'support':
        return <SupportRequestsTab t={t} />;
      case 'general':
        return (
          <GeneralTab
            {...commonProps}
            onExportData={handleExportData}
            onExportLeads={handleExportLeads}
            onClearLeads={handleClearLeads}
          />
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView
      style={[s.container, { backgroundColor: t.screenBg }]}
      edges={['bottom']}
    >
      {/* Header — OUTSIDE KeyboardAvoidingView so it never moves */}
      <View
        style={[
          s.header,
          { backgroundColor: t.headerBg, borderBottomColor: t.border },
        ]}
      >
        <View style={s.titleRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[s.title, { color: t.title }]} numberOfLines={1}>
              Admin Panel
            </Text>
            <Text
              style={[s.subtitle, { color: t.subtitle }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              Configure organization settings and permissions.
            </Text>
          </View>
          <ImprovedButton
            title={saving ? 'Saving…' : 'Save'}
            size="small"
            onPress={handleSave}
            disabled={!dirty || saving}
            style={{ paddingHorizontal: 2 }}
          />
        </View>

        <View style={{ marginTop: 10 }}>
          <ImprovedDropdown
            placeholder="Select Tab"
            items={TABS.map(tab => ({
              value: tab.key,
              label:
                tab.key === 'support' && supportUnread > 0
                  ? `${tab.label} (${supportUnread > 9 ? '9+' : supportUnread})`
                  : tab.label,
            }))}
            selectedValue={activeTab}
            onValueChange={setActiveTab}
          />
        </View>
      </View>

      {/* Only the content scrolls and avoids keyboard */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          style={[s.content, { backgroundColor: t.screenBg }]}
          contentContainerStyle={{ padding: 12, paddingBottom: 350 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets={true}
        >
          {renderContent()}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default AdminPanelScreen;

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: { marginTop: 12, fontSize: 12 },
  errorText: { fontSize: 13, textAlign: 'center' },
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
  title: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  subtitle: { fontSize: 11, marginTop: 1 },
  content: { flex: 1 },
});

const ui = StyleSheet.create({
  btnPrimary: {
    backgroundColor: '#5a7bf5',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  btnDisabled: { opacity: 0.5 },
  btnOutline: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOutlineText: { color: '#374151', fontWeight: '600', fontSize: 11 },
  btnOutlineDanger: { borderColor: '#fca5a5', backgroundColor: '#fef2f2' },
  btnOutlineDangerText: { color: '#dc2626' },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#111827',
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
    marginTop: 6,
  },
  cardActions: { flexDirection: 'row', gap: 6, marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  tagRow: { flexDirection: 'row', gap: 5, marginBottom: 5, flexWrap: 'wrap' },
  tagBlue: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 20,
  },
  tagBlueText: { color: '#1d4ed8', fontSize: 10, fontWeight: '600' },
  tagGreen: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 20,
  },
  tagGreenText: { color: '#166534', fontSize: 10, fontWeight: '600' },
  tagGray: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 20,
  },
  tagGrayText: { color: '#6b7280', fontSize: 10, fontWeight: '600' },
  colorDot: { width: 20, height: 20, borderRadius: 10 },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { borderColor: '#5a7bf5', backgroundColor: '#5a7bf5' },
  checkmark: { color: '#fff', fontSize: 10, fontWeight: '700' },
  checkLabel: { fontSize: 13, color: '#374151' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    minHeight: 180,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  modalMsg: { fontSize: 12, color: '#6b7280', marginBottom: 16 },
  modalActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  emptyBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginTop: 8,
  },
  emptyText: { fontSize: 12, color: '#9ca3af', textAlign: 'center' },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  infoBox: { borderWidth: 1, borderRadius: 8, padding: 6, marginTop: 4 },
  codeBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 8,
  },
  innerCard: { borderWidth: 1, borderRadius: 12, padding: 10 },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 8,
  },
});

const light = {
  bg: '#f8fafc',
  card: '#ffffff',
  border: '#e5e7eb',
  title: '#111827',
  subtitle: '#6b7280',
  input: '#ffffff',
  inputText: '#111827',
  inputBorder: '#d1d5db',
  label: '#374151',
  groupLabel: '#374151',
  cardMeta: '#6b7280',
  checkLabel: '#374151',
  tabBg: '#ffffff',
  headerBg: '#ffffff',
  screenBg: '#f8fafc',
  emptyText: '#9ca3af',
  placeholder: '#9ca3af',
};

const dark = {
  bg: '#0f172a',
  card: '#1e293b',
  border: '#334155',
  title: '#f1f5f9',
  subtitle: '#94a3b8',
  input: '#1e293b',
  inputText: '#f1f5f9',
  inputBorder: '#475569',
  label: '#cbd5e1',
  groupLabel: '#cbd5e1',
  cardMeta: '#94a3b8',
  checkLabel: '#cbd5e1',
  tabBg: '#1e293b',
  headerBg: '#1e293b',
  screenBg: '#0f172a',
  emptyText: '#64748b',
  placeholder: '#64748b',
};
