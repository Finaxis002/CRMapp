/**
 * SupportRequestsTab — AdminPanelScreen ka "Support Requests" tab
 *
 * Web ke SupportRequestsTab.jsx ka mobile port.
 * Admin sabhi tickets dekh sakta hai, status badal sakta hai, reply kar sakta hai.
 *
 * Usage (AdminPanelScreen mein):
 *   import SupportRequestsTab from '../../components/admin/SupportRequestsTab';
 *   case 'support':
 *     return <SupportRequestsTab t={t} />;
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { supportService } from '../../services/supportService';
import { API_BASE_URL } from '../../config';
import ImprovedButton from '../ui/ImprovedButton';
import ImprovedDropdown from '../ui/ImprovedDropdown';

/* Backend relative url bhejta hai ("/uploads/support/x.jpg") — RN ko absolute
   chahiye, isliye API host prepend karo. */
const FILE_HOST = String(API_BASE_URL || '')
  .replace(/\/+$/, '')
  .replace(/\/api(\/v\d+)?$/, '');

const attUrl = a => {
  const raw = typeof a === 'string' ? a : a?.url || a?.path || '';
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${FILE_HOST}${raw.startsWith('/') ? '' : '/'}${raw}`;
};

const attName = (a, i) =>
  (typeof a === 'object' && (a?.originalName || a?.filename)) ||
  attUrl(a).split('?')[0].split('/').pop() ||
  `File ${i + 1}`;

const isImageAtt = a => {
  if (typeof a === 'object' && a?.fileType) return a.fileType === 'image';
  return /\.(jpe?g|png|gif|webp|bmp|heic)$/i.test(attUrl(a).split('?')[0]);
};

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Requests' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
];

const STATUS_CHANGE_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
];

const STATUS_LABELS = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
};

const STATUS_COLORS = {
  open: '#dc2626',
  in_progress: '#d97706',
  resolved: '#16a34a',
};

const fmtDateTime = d =>
  new Date(d).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

/* ─── Theme-aware style factories (AdminPanelScreen jaise) ────────────── */

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
});

const makeTitle = t => ({
  fontSize: 15,
  fontWeight: '700',
  color: t.title,
  letterSpacing: -0.2,
});

const makeSubtitle = t => ({ fontSize: 11, color: t.subtitle, marginTop: 2 });

const makeCardTitle = t => ({
  fontSize: 13.5,
  fontWeight: '700',
  color: t.title,
  flex: 1,
});

const makeMeta = t => ({ fontSize: 11, color: t.subtitle });

const makeBlockLabel = t => ({
  fontSize: 10,
  fontWeight: '700',
  letterSpacing: 0.5,
  color: t.subtitle,
  marginBottom: 3,
});

const makeBody = t => ({ fontSize: 13, color: t.checkLabel, lineHeight: 19 });

/* ─── Status chip ─────────────────────────────────────────────────────── */

const StatusChip = ({ status }) => {
  const color = STATUS_COLORS[status] || '#6b7280';
  return (
    <View style={[st.chip, { backgroundColor: `${color}1A` }]}>
      <View style={[st.chipDot, { backgroundColor: color }]} />
      <Text style={[st.chipText, { color }]}>
        {STATUS_LABELS[status] || status}
      </Text>
    </View>
  );
};

/* ─── Main ────────────────────────────────────────────────────────────── */

const SupportRequestsTab = ({ t }) => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [replyText, setReplyText] = useState({});
  const [sendingId, setSendingId] = useState(null);
  const [statusModal, setStatusModal] = useState(null); // ticket object
  const [newStatus, setNewStatus] = useState('open');
  const [statusSaving, setStatusSaving] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null); // { uri, name }

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = filter === 'all' ? {} : { status: filter };
      const data = await supportService.getAllTickets(params);
      setTickets(Array.isArray(data) ? data : []);
    } catch {
      setError('Unable to load support requests.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const handleSendReply = async ticketId => {
    const text = (replyText[ticketId] || '').trim();
    if (!text) return;
    setSendingId(ticketId);
    try {
      const updated = await supportService.addMessage(ticketId, text);
      setTickets(prev => prev.map(x => (x._id === ticketId ? updated : x)));
      setReplyText(prev => ({ ...prev, [ticketId]: '' }));
    } catch {
      setError('Unable to send reply.');
    } finally {
      setSendingId(null);
    }
  };

  const openStatusModal = ticket => {
    setNewStatus(ticket.status);
    setStatusModal(ticket);
  };

  const handleSaveStatus = async () => {
    if (!statusModal) return;
    setStatusSaving(true);
    try {
      const updated = await supportService.updateTicket(statusModal._id, {
        status: newStatus,
      });
      setTickets(prev =>
        prev.map(x => (x._id === statusModal._id ? updated : x)),
      );
      setStatusModal(null);
    } catch {
      setError('Unable to update status.');
    } finally {
      setStatusSaving(false);
    }
  };

  const counts = tickets.reduce(
    (acc, x) => {
      acc[x.status] = (acc[x.status] || 0) + 1;
      return acc;
    },
    { open: 0, in_progress: 0, resolved: 0 },
  );

  /* ── Render one ticket ── */
  const renderTicket = ticket => {
    const expanded = expandedId === ticket._id;

    return (
      <View key={ticket._id} style={makeCard(t)}>
        {/* Head */}
        <TouchableOpacity
          onPress={() => setExpandedId(expanded ? null : ticket._id)}
          activeOpacity={0.7}
        >
          <View style={st.row}>
            <Text style={makeCardTitle(t)} numberOfLines={1}>
              {ticket.subject}
            </Text>
            <StatusChip status={ticket.status} />
          </View>

          <Text style={[makeMeta(t), { marginTop: 4 }]} numberOfLines={1}>
            {ticket.contactName}
            {ticket.contactEmail ? ` · ${ticket.contactEmail}` : ''}
          </Text>

          <View style={[st.row, { marginTop: 3 }]}>
            <Text style={makeMeta(t)}>{fmtDateTime(ticket.createdAt)}</Text>
            {ticket.attachments?.length > 0 && (
              <Text style={[makeMeta(t), { marginLeft: 8 }]}>
                📎 {ticket.attachments.length}
              </Text>
            )}
            <Text style={[makeMeta(t), { marginLeft: 'auto' }]}>
              {expanded ? '▲' : '▼'}
            </Text>
          </View>

          {!expanded && (
            <Text
              style={[makeBody(t), { marginTop: 6, fontSize: 12 }]}
              numberOfLines={1}
            >
              {ticket.message}
            </Text>
          )}
        </TouchableOpacity>

        {/* Body */}
        {expanded && (
          <View style={[st.body, { borderTopColor: t.border }]}>
            {!!ticket.contactPhone && (
              <TouchableOpacity
                onPress={() => Linking.openURL(`tel:${ticket.contactPhone}`)}
                style={[st.linkRow, { borderColor: t.border }]}
              >
                <Text style={{ fontSize: 12, color: '#5a7bf5' }}>
                  📞 {ticket.contactPhone}
                </Text>
              </TouchableOpacity>
            )}

            <View style={{ marginTop: 10 }}>
              <Text style={makeBlockLabel(t)}>MESSAGE</Text>
              <Text style={makeBody(t)}>{ticket.message}</Text>
            </View>

            {/* Attachments */}
            {ticket.attachments?.length > 0 && (
              <View style={{ marginTop: 10 }}>
                <Text style={makeBlockLabel(t)}>
                  ATTACHMENTS ({ticket.attachments.length})
                </Text>
                <View style={st.attachWrap}>
                  {ticket.attachments.map((a, i) => {
                    const url = attUrl(a);
                    const image = isImageAtt(a);
                    return (
                      <TouchableOpacity
                        key={`${url}-${i}`}
                        style={[st.attThumb, { borderColor: t.border }]}
                        onPress={() =>
                          image
                            ? setPreview({ uri: url, name: attName(a, i) })
                            : Linking.openURL(url)
                        }
                        activeOpacity={0.8}
                      >
                        {image ? (
                          <Image source={{ uri: url }} style={st.attThumbImg} />
                        ) : (
                          <View
                            style={[
                              st.attThumbImg,
                              st.attThumbFallback,
                              { backgroundColor: t.bg },
                            ]}
                          >
                            <Text style={{ fontSize: 20 }}>🎬</Text>
                            <Text
                              style={[st.attThumbName, { color: t.subtitle }]}
                              numberOfLines={1}
                            >
                              {attName(a, i)}
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Conversation */}
            {ticket.messages?.length > 0 && (
              <View style={{ marginTop: 10 }}>
                <Text style={makeBlockLabel(t)}>CONVERSATION</Text>
                <View style={[st.thread, { backgroundColor: t.bg }]}>
                  {ticket.messages.map(m => {
                    const isAdmin = m.sender === 'admin';
                    return (
                      <View
                        key={m._id}
                        style={[
                          st.bubbleRow,
                          {
                            justifyContent: isAdmin ? 'flex-end' : 'flex-start',
                          },
                        ]}
                      >
                        <View
                          style={[
                            st.bubble,
                            {
                              backgroundColor: isAdmin ? '#eef2ff' : t.card,
                              borderColor: t.border,
                            },
                          ]}
                        >
                          <Text style={{ fontSize: 12.5, color: '#111827' }}>
                            {m.text}
                          </Text>
                          <Text style={st.bubbleMeta}>
                            {isAdmin ? 'You' : ticket.contactName} ·{' '}
                            {fmtDateTime(m.createdAt)}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Reply */}
            <View style={[st.replyRow, { marginTop: 10 }]}>
              <TextInput
                value={replyText[ticket._id] || ''}
                onChangeText={v =>
                  setReplyText(prev => ({ ...prev, [ticket._id]: v }))
                }
                placeholder="Type a reply…"
                placeholderTextColor={t.placeholder}
                style={[makeInput(t), { flex: 1 }]}
                onSubmitEditing={() => handleSendReply(ticket._id)}
                returnKeyType="send"
              />
              <TouchableOpacity
                style={[
                  st.sendBtn,
                  (sendingId === ticket._id ||
                    !replyText[ticket._id]?.trim()) && { opacity: 0.4 },
                ]}
                onPress={() => handleSendReply(ticket._id)}
                disabled={
                  sendingId === ticket._id || !replyText[ticket._id]?.trim()
                }
              >
                {sendingId === ticket._id ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontSize: 15 }}>➤</Text>
                )}
              </TouchableOpacity>
            </View>

            <ImprovedButton
              title="Change Status"
              size="small"
              onPress={() => openStatusModal(ticket)}
              style={{ alignSelf: 'flex-start', marginTop: 10 }}
            />
          </View>
        )}
      </View>
    );
  };

  return (
    <View>
      <View style={{ marginBottom: 12, marginTop: 2 }}>
        <Text style={makeTitle(t)}>Support Requests</Text>
        <Text style={makeSubtitle(t)}>
          View and respond to queries raised by users.
        </Text>
      </View>

      {/* Counts */}
      <View style={st.countRow}>
        {['open', 'in_progress', 'resolved'].map(k => (
          <View
            key={k}
            style={[
              st.countBox,
              { backgroundColor: t.card, borderColor: t.border },
            ]}
          >
            <Text style={[st.countValue, { color: STATUS_COLORS[k] }]}>
              {counts[k] || 0}
            </Text>
            <Text style={[makeMeta(t), { fontSize: 10 }]}>
              {STATUS_LABELS[k]}
            </Text>
          </View>
        ))}
      </View>

      {/* Filter + refresh */}
      <View style={{ marginBottom: 10 }}>
        <ImprovedDropdown
          placeholder="Filter by status"
          items={STATUS_OPTIONS}
          selectedValue={filter}
          onValueChange={setFilter}
        />
      </View>

      <ImprovedButton
        title="↻ Refresh"
        size="small"
        onPress={loadTickets}
        style={{ alignSelf: 'flex-start', marginBottom: 12 }}
      />

      {!!error && (
        <View style={[st.errorBox]}>
          <Text style={{ color: '#dc2626', fontSize: 12 }}>{error}</Text>
        </View>
      )}

      {/* List */}
      {loading ? (
        <ActivityIndicator color="#5a7bf5" style={{ marginVertical: 24 }} />
      ) : tickets.length === 0 ? (
        <View
          style={[
            st.emptyBox,
            { borderColor: t.border, backgroundColor: t.card },
          ]}
        >
          <Text style={{ fontSize: 12, color: t.emptyText }}>
            No support requests found.
          </Text>
        </View>
      ) : (
        tickets.map(renderTicket)
      )}

      {/* Image preview */}
      <Modal
        visible={!!preview}
        transparent
        animationType="fade"
        onRequestClose={() => setPreview(null)}
      >
        <Pressable style={st.previewBackdrop} onPress={() => setPreview(null)}>
          <View style={st.previewBar}>
            <Text style={st.previewName} numberOfLines={1}>
              {preview?.name}
            </Text>
            <TouchableOpacity
              onPress={() => setPreview(null)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={{ color: '#fff', fontSize: 20 }}>✕</Text>
            </TouchableOpacity>
          </View>
          {!!preview && (
            <Image
              source={{ uri: preview.uri }}
              style={st.previewImg}
              resizeMode="contain"
            />
          )}
        </Pressable>
      </Modal>

      {/* Status modal */}
      <Modal
        transparent
        visible={!!statusModal}
        animationType="slide"
        onRequestClose={() => setStatusModal(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <Pressable style={st.backdrop} onPress={() => setStatusModal(null)}>
            <Pressable
              style={[st.modalCard, { backgroundColor: t.card }]}
              onPress={e => e.stopPropagation()}
            >
              <Text style={[makeTitle(t), { marginBottom: 4 }]}>
                Change Status
              </Text>
              <Text style={[makeSubtitle(t), { marginBottom: 14 }]}>
                {statusModal?.subject}
              </Text>

              <ImprovedDropdown
                placeholder="Select status"
                items={STATUS_CHANGE_OPTIONS}
                selectedValue={newStatus}
                onValueChange={setNewStatus}
              />

              <View style={st.modalActions}>
                <TouchableOpacity
                  style={[st.cancelBtn, { borderColor: t.border }]}
                  onPress={() => setStatusModal(null)}
                >
                  <Text style={{ fontSize: 12, color: t.label }}>Cancel</Text>
                </TouchableOpacity>
                <ImprovedButton
                  title={statusSaving ? 'Saving…' : 'Save'}
                  size="small"
                  onPress={handleSaveStatus}
                  disabled={statusSaving}
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

/* ─── Static styles ───────────────────────────────────────────────────── */

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontSize: 10, fontWeight: '700' },

  countRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  countBox: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  countValue: { fontSize: 20, fontWeight: '800' },

  body: { borderTopWidth: 1, marginTop: 10, paddingTop: 10 },
  linkRow: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  attachWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  attThumb: {
    width: 74,
    height: 74,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  attThumbImg: { width: '100%', height: '100%' },
  attThumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    gap: 2,
  },
  attThumbName: { fontSize: 8, textAlign: 'center' },

  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.94)',
    justifyContent: 'center',
  },
  previewBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 44,
    paddingBottom: 10,
    zIndex: 2,
  },
  previewName: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '600' },
  previewImg: { width: '100%', height: '78%' },

  thread: { borderRadius: 10, padding: 8, gap: 7 },
  bubbleRow: { flexDirection: 'row' },
  bubble: {
    maxWidth: '85%',
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  bubbleMeta: { fontSize: 9.5, color: '#94a3b8', marginTop: 3 },

  replyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#5a7bf5',
    alignItems: 'center',
    justifyContent: 'center',
  },

  errorBox: {
    borderWidth: 1,
    borderColor: '#fca5a5',
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },

  emptyBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    minHeight: 200,
  },
  modalActions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default SupportRequestsTab;
