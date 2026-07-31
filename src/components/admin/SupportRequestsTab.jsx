/*
 * Mobile Admin Panel — Support Requests tab
 * Admin/manager can view tickets, change status, send text/media replies,
 * and mark opened tickets as read.
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
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchCamera } from 'react-native-image-picker';
import {
  errorCodes,
  isErrorWithCode,
  pick,
  types,
} from '@react-native-documents/picker';

import { supportService } from '../../services/supportService';
import { API_BASE_URL } from '../../config';
import ImprovedButton from '../ui/ImprovedButton';
import ImprovedDropdown from '../ui/ImprovedDropdown';

const MAX_FILES = 5;
const MAX_FILE_MB = 25;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

const FILE_HOST = String(API_BASE_URL || '')
  .replace(/\/+$/, '')
  .replace(/\/api(\/v\d+)?$/, '');

const attUrl = attachment => {
  const raw =
    typeof attachment === 'string'
      ? attachment
      : attachment?.url || attachment?.path || '';

  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${FILE_HOST}${raw.startsWith('/') ? '' : '/'}${raw}`;
};

const attName = (attachment, index = 0) => {
  if (typeof attachment === 'object') {
    return (
      attachment?.originalName ||
      attachment?.filename ||
      attachment?.name ||
      `File ${index + 1}`
    );
  }
  return (
    attUrl(attachment).split('?')[0].split('/').pop() || `File ${index + 1}`
  );
};

const isImageAtt = attachment => {
  if (typeof attachment === 'object' && attachment?.fileType) {
    return attachment.fileType === 'image';
  }
  const mime =
    typeof attachment === 'object'
      ? attachment?.mimetype || attachment?.type
      : '';
  if (mime) return mime.startsWith('image/');
  return /\.(jpe?g|png|gif|webp|bmp|heic|heif)$/i.test(
    attUrl(attachment).split('?')[0],
  );
};

const isVideoAtt = attachment => {
  if (typeof attachment === 'object' && attachment?.fileType) {
    return attachment.fileType === 'video';
  }
  const mime =
    typeof attachment === 'object'
      ? attachment?.mimetype || attachment?.type
      : '';
  if (mime) return mime.startsWith('video/');
  return /\.(mp4|mov|m4v|3gp|avi|mkv|webm)$/i.test(
    attUrl(attachment).split('?')[0],
  );
};

const fmtDateTime = value =>
  new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Requests' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
];

const STATUS_CHANGE_OPTIONS = STATUS_OPTIONS.filter(
  item => item.value !== 'all',
);

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

const makeCard = theme => ({
  backgroundColor: theme.card,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: theme.border,
  padding: 12,
  marginBottom: 10,
});

const makeInput = theme => ({
  borderWidth: 1,
  borderColor: theme.inputBorder,
  borderRadius: 10,
  paddingHorizontal: 12,
  paddingVertical: 9,
  fontSize: 13,
  color: theme.inputText,
  backgroundColor: theme.input,
});

const makeTitle = theme => ({
  fontSize: 15,
  fontWeight: '700',
  color: theme.title,
  letterSpacing: -0.2,
});
const makeSubtitle = theme => ({
  fontSize: 11,
  color: theme.subtitle,
  marginTop: 2,
});
const makeCardTitle = theme => ({
  fontSize: 13.5,
  fontWeight: '700',
  color: theme.title,
  flex: 1,
});
const makeMeta = theme => ({ fontSize: 11, color: theme.subtitle });
const makeBlockLabel = theme => ({
  fontSize: 10,
  fontWeight: '700',
  letterSpacing: 0.5,
  color: theme.subtitle,
  marginBottom: 3,
});
const makeBody = theme => ({
  fontSize: 13,
  color: theme.checkLabel,
  lineHeight: 19,
});

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

const SupportRequestsTab = ({ t }) => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [replyText, setReplyText] = useState({});
  // Shape: { [ticketId]: [{ uri, name, type, isVideo }] }
  const [replyFiles, setReplyFiles] = useState({});
  const [sendingId, setSendingId] = useState(null);
  const [statusModal, setStatusModal] = useState(null);
  const [newStatus, setNewStatus] = useState('open');
  const [statusSaving, setStatusSaving] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = filter === 'all' ? {} : { status: filter };
      const data = await supportService.getAllTickets(params);
      setTickets(Array.isArray(data) ? data : []);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          'Unable to load support requests.',
      );
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const openAttachment = attachment => {
    const url = attUrl(attachment);
    if (!url) return;

    if (isImageAtt(attachment)) {
      setPreview({ uri: url, name: attName(attachment) });
      return;
    }

    Linking.openURL(url).catch(() =>
      setError('Unable to open this attachment.'),
    );
  };

  // Opening an unread ticket updates the database unread state, not only UI state.
  const handleToggleTicket = async ticket => {
    const opening = expandedId !== ticket._id;
    setExpandedId(opening ? ticket._id : null);

    if (opening && ticket.adminUnread) {
      try {
        await supportService.markRead(ticket._id);
        setTickets(previous =>
          previous.map(item =>
            item._id === ticket._id ? { ...item, adminUnread: false } : item,
          ),
        );
      } catch {
        // Ticket may still be opened even when marking it read fails.
      }
    }
  };

  const normaliseFiles = (assets, existingCount) => {
    const availableSlots = MAX_FILES - existingCount;
    const valid = [];

    for (const asset of assets || []) {
      if (valid.length >= availableSlots) break;
      const uri = asset.uri;
      const size = asset.fileSize ?? asset.size;
      const type = asset.type || 'application/octet-stream';

      if (!uri) continue;
      if (size && size > MAX_FILE_BYTES) {
        setError(
          `${asset.fileName || asset.name || 'File'} exceeds ${MAX_FILE_MB}MB.`,
        );
        continue;
      }
      if (!type.startsWith('image/') && !type.startsWith('video/')) {
        setError(
          `${asset.fileName || asset.name || 'File'} is not an image or video.`,
        );
        continue;
      }

      valid.push({
        uri,
        name: asset.fileName || asset.name || `upload-${Date.now()}`,
        type,
        isVideo: type.startsWith('video/'),
      });
    }

    return valid;
  };

  const addReplyFiles = (ticketId, assets) => {
    const existing = replyFiles[ticketId] || [];
    const incoming = normaliseFiles(assets, existing.length);
    if (!incoming.length) return;

    setReplyFiles(previous => ({
      ...previous,
      [ticketId]: [...existing, ...incoming].slice(0, MAX_FILES),
    }));
  };

  const handleReplyCamera = async ticketId => {
    setError('');
    if ((replyFiles[ticketId] || []).length >= MAX_FILES) {
      return setError(`You can attach up to ${MAX_FILES} files per reply.`);
    }

    try {
      const result = await launchCamera({
        mediaType: 'photo',
        quality: 0.7,
        maxWidth: 1920,
        maxHeight: 1920,
        saveToPhotos: false,
      });

      if (result.didCancel) return;
      if (result.errorCode) {
        setError(result.errorMessage || 'Unable to open the camera.');
        return;
      }

      addReplyFiles(ticketId, result.assets || []);
    } catch {
      setError('Unable to open the camera.');
    }
  };

  const handleReplyPicker = async ticketId => {
    setError('');
    if ((replyFiles[ticketId] || []).length >= MAX_FILES) {
      return setError(`You can attach up to ${MAX_FILES} files per reply.`);
    }

    try {
      const selected = await pick({
        allowMultiSelection: true,
        type: [types.images, types.video],
      });
      addReplyFiles(ticketId, selected || []);
    } catch (pickerError) {
      if (
        isErrorWithCode(pickerError) &&
        pickerError.code === errorCodes.OPERATION_CANCELED
      )
        return;
      setError('Unable to open the gallery or file picker.');
    }
  };

  const removeReplyFile = (ticketId, index) => {
    setReplyFiles(previous => ({
      ...previous,
      [ticketId]: (previous[ticketId] || []).filter(
        (_, fileIndex) => fileIndex !== index,
      ),
    }));
  };

  const handleSendReply = async ticketId => {
    const text = (replyText[ticketId] || '').trim();
    const attachments = replyFiles[ticketId] || [];

    if (!text && attachments.length === 0) return;

    setSendingId(ticketId);
    setError('');

    try {
      const formData = new FormData();
      formData.append('text', text);
      attachments.forEach(file => {
        formData.append('attachments', {
          uri: file.uri,
          name: file.name,
          type: file.type,
        });
      });

      const updated = await supportService.addMessage(ticketId, formData);

      setTickets(previous =>
        previous.map(item => (item._id === ticketId ? updated : item)),
      );
      setReplyText(previous => ({ ...previous, [ticketId]: '' }));
      setReplyFiles(previous => ({ ...previous, [ticketId]: [] }));
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message || 'Unable to send reply.',
      );
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
      setTickets(previous =>
        previous.map(item => (item._id === statusModal._id ? updated : item)),
      );
      setStatusModal(null);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message || 'Unable to update status.',
      );
    } finally {
      setStatusSaving(false);
    }
  };

  const counts = tickets.reduce(
    (result, ticket) => {
      result[ticket.status] = (result[ticket.status] || 0) + 1;
      return result;
    },
    { open: 0, in_progress: 0, resolved: 0 },
  );

  const renderSelectedFiles = (ticketId, files) => {
    if (!files.length) return null;

    return (
      <View>
        <Text style={[st.replyAttachmentHint, { color: t.subtitle }]}>
          Reply attachments: {files.length}/{MAX_FILES}
        </Text>
        <View style={st.attachWrap}>
          {files.map((file, index) => (
            <View
              key={`${file.uri}-${index}`}
              style={[st.attThumb, { borderColor: t.border }]}
            >
              {file.isVideo ? (
                <View
                  style={[
                    st.attThumbImg,
                    st.attThumbFallback,
                    { backgroundColor: t.bg },
                  ]}
                >
                  <Icon name="video-outline" size={24} color={t.subtitle} />
                  <Text
                    style={[st.attThumbName, { color: t.subtitle }]}
                    numberOfLines={1}
                  >
                    {file.name}
                  </Text>
                </View>
              ) : (
                <Image source={{ uri: file.uri }} style={st.attThumbImg} />
              )}
              <TouchableOpacity
                style={st.removeThumb}
                onPress={() => removeReplyFile(ticketId, index)}
              >
                <Icon name="close" size={12} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderMessageAttachments = attachments => {
    if (!attachments?.length) return null;

    return (
      <View style={st.messageAttachmentGrid}>
        {attachments.map((attachment, index) => {
          const url = attUrl(attachment);
          const image = isImageAtt(attachment);
          return (
            <TouchableOpacity
              key={`${url}-${index}`}
              style={[st.messageAttachment, { borderColor: t.border }]}
              onPress={() => openAttachment(attachment)}
            >
              {image ? (
                <Image source={{ uri: url }} style={st.messageAttachmentImg} />
              ) : (
                <View
                  style={[
                    st.messageAttachmentImg,
                    st.attThumbFallback,
                    { backgroundColor: t.bg },
                  ]}
                >
                  <Icon
                    name={
                      isVideoAtt(attachment)
                        ? 'play-circle-outline'
                        : 'file-document-outline'
                    }
                    size={24}
                    color="#5a7bf5"
                  />
                  <Text
                    style={[st.attThumbName, { color: t.subtitle }]}
                    numberOfLines={1}
                  >
                    {attName(attachment, index)}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderTicket = ticket => {
    const expanded = expandedId === ticket._id;
    const selectedFiles = replyFiles[ticket._id] || [];
    const canSend = Boolean(
      (replyText[ticket._id] || '').trim() || selectedFiles.length,
    );

    return (
      <View key={ticket._id} style={makeCard(t)}>
        <TouchableOpacity
          onPress={() => handleToggleTicket(ticket)}
          activeOpacity={0.7}
        >
          <View style={st.row}>
            {ticket.adminUnread && <View style={st.unreadDot} />}
            <Text style={makeCardTitle(t)} numberOfLines={1}>
              {ticket.subject}
            </Text>
            <StatusChip status={ticket.status} />
          </View>
          <Text style={[makeMeta(t), { marginTop: 4 }]} numberOfLines={1}>
            {ticket.contactName || ticket.createdBy?.name || 'Unknown user'}
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

            {ticket.attachments?.length > 0 && (
              <View style={{ marginTop: 10 }}>
                <Text style={makeBlockLabel(t)}>
                  ATTACHMENTS ({ticket.attachments.length})
                </Text>
                <View style={st.attachWrap}>
                  {ticket.attachments.map((attachment, index) => {
                    const url = attUrl(attachment);
                    const image = isImageAtt(attachment);
                    return (
                      <TouchableOpacity
                        key={`${url}-${index}`}
                        style={[st.attThumb, { borderColor: t.border }]}
                        onPress={() => openAttachment(attachment)}
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
                            <Icon
                              name={
                                isVideoAtt(attachment)
                                  ? 'play-circle-outline'
                                  : 'file-document-outline'
                              }
                              size={24}
                              color={t.subtitle}
                            />
                            <Text
                              style={[st.attThumbName, { color: t.subtitle }]}
                              numberOfLines={1}
                            >
                              {attName(attachment, index)}
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {ticket.messages?.length > 0 && (
              <View style={{ marginTop: 10 }}>
                <Text style={makeBlockLabel(t)}>CONVERSATION</Text>
                <View style={[st.thread, { backgroundColor: t.bg }]}>
                  {ticket.messages.map(message => {
                    const isAdmin = message.sender === 'admin';
                    return (
                      <View
                        key={message._id}
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
                          {!!message.text && (
                            <Text style={{ fontSize: 12.5, color: t.title }}>
                              {message.text}
                            </Text>
                          )}
                          {renderMessageAttachments(message.attachments)}
                          <Text style={[st.bubbleMeta, { color: t.subtitle }]}>
                            {isAdmin ? 'You' : ticket.contactName || 'User'} ·{' '}
                            {fmtDateTime(message.createdAt)}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            <View style={[st.replyRow, { marginTop: 10 }]}>
              <TouchableOpacity
                style={[
                  st.replyMediaBtn,
                  { borderColor: t.border, backgroundColor: t.bg },
                ]}
                onPress={() => handleReplyCamera(ticket._id)}
                disabled={sendingId === ticket._id}
              >
                <Icon name="camera-outline" size={18} color="#5a7bf5" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  st.replyMediaBtn,
                  { borderColor: t.border, backgroundColor: t.bg },
                ]}
                onPress={() => handleReplyPicker(ticket._id)}
                disabled={sendingId === ticket._id}
              >
                <Icon name="image-multiple-outline" size={18} color="#5a7bf5" />
              </TouchableOpacity>
              <TextInput
                value={replyText[ticket._id] || ''}
                onChangeText={value =>
                  setReplyText(previous => ({
                    ...previous,
                    [ticket._id]: value,
                  }))
                }
                placeholder="Type a reply…"
                placeholderTextColor={t.placeholder}
                style={[
                  makeInput(t),
                  {
                    flex: 1,
                    minHeight: 40,
                    maxHeight: 100,
                    paddingVertical: 8,
                  },
                ]}
                multiline
              />
              <TouchableOpacity
                style={[
                  st.sendBtn,
                  (sendingId === ticket._id || !canSend) && { opacity: 0.4 },
                ]}
                onPress={() => handleSendReply(ticket._id)}
                disabled={sendingId === ticket._id || !canSend}
              >
                {sendingId === ticket._id ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Icon name="send" size={15} color="#fff" />
                )}
              </TouchableOpacity>
            </View>

            {renderSelectedFiles(ticket._id, selectedFiles)}

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

      <View style={st.countRow}>
        {['open', 'in_progress', 'resolved'].map(key => (
          <View
            key={key}
            style={[
              st.countBox,
              { backgroundColor: t.card, borderColor: t.border },
            ]}
          >
            <Text style={[st.countValue, { color: STATUS_COLORS[key] }]}>
              {counts[key] || 0}
            </Text>
            <Text style={[makeMeta(t), { fontSize: 10 }]}>
              {STATUS_LABELS[key]}
            </Text>
          </View>
        ))}
      </View>

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
        <View style={st.errorBox}>
          <Text style={{ color: '#dc2626', fontSize: 12 }}>{error}</Text>
        </View>
      )}

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
            <TouchableOpacity onPress={() => setPreview(null)}>
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
              onPress={event => event.stopPropagation()}
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
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#dc2626',
  },
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
  removeThumb: {
    position: 'absolute',
    top: 3,
    right: 3,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 9,
    padding: 3,
  },
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
  bubbleMeta: { fontSize: 9.5, marginTop: 3 },
  messageAttachmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 7,
  },
  messageAttachment: {
    width: 100,
    height: 100,
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  messageAttachmentImg: { width: '100%', height: '100%' },
  replyRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  replyMediaBtn: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#5a7bf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyAttachmentHint: { fontSize: 10.5, marginTop: 8 },
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
