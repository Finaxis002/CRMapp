/*
 * SupportScreen — Help & Support
 *
 * New Request: text + initial image/video attachments.
 * My Requests: ticket history, conversation, and text/image/video replies.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSelector } from 'react-redux';
import { launchCamera } from 'react-native-image-picker';
import {
  errorCodes,
  isErrorWithCode,
  pick,
  types,
} from '@react-native-documents/picker';

import { supportService } from '../../services/supportService';
import { useUISystem } from '../../hooks/useUISystem';
import { API_BASE_URL } from '../../config';

const MAX_FILES = 5;
const MAX_FILE_MB = 25;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

const SUBJECT_OPTIONS = [
  'Technical Issue',
  'Billing & Payments',
  'Feature Request',
  'Bug Report',
  'Account & Access',
  'WhatsApp / Integration Issue',
  'Other',
];

const STATUS_LABELS = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
};

const STATUS_COLORS = {
  open: '#F04438',
  in_progress: '#F79009',
  resolved: '#12B76A',
};

// R2 URLs are normally absolute. The fallback supports legacy relative upload URLs.
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

const StatusChip = ({ status }) => {
  const color = STATUS_COLORS[status] || '#94A3B8';

  return (
    <View style={[styles.statusChip, { backgroundColor: `${color}1A` }]}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text style={[styles.statusChipText, { color }]}>
        {STATUS_LABELS[status] || status}
      </Text>
    </View>
  );
};

const Field = ({ label, required, icon, children, colors }) => (
  <View style={styles.field}>
    <View style={styles.fieldLabelRow}>
      {icon ? <Icon name={icon} size={13} color={colors.primary} /> : null}
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
        {label}
        {required ? <Text style={{ color: '#F04438' }}> *</Text> : null}
      </Text>
    </View>
    {children}
  </View>
);

const SupportScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useUISystem();
  const { user } = useSelector(state => state.auth);

  const [activeTab, setActiveTab] = useState('new');
  const [form, setForm] = useState({
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    subject: '',
    message: '',
  });
  const [files, setFiles] = useState([]);
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [tickets, setTickets] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [replyText, setReplyText] = useState({});
  // Shape: { [ticketId]: [{ uri, name, type, isVideo }] }
  const [replyFiles, setReplyFiles] = useState({});
  const [sendingId, setSendingId] = useState(null);

  const [preview, setPreview] = useState(null);
  const scrollRef = useRef(null);

  const setF = (key, value) =>
    setForm(previous => ({ ...previous, [key]: value }));

  useEffect(() => {
    if (!user) return;

    setForm(previous => ({
      ...previous,
      contactName: previous.contactName || user.name || '',
      contactEmail: previous.contactEmail || user.email || '',
      contactPhone:
        previous.contactPhone || user.phone || user.phoneNumber || '',
    }));
  }, [user]);

  const openAttachment = attachment => {
    const url = attUrl(attachment);
    if (!url) return;

    if (isImageAtt(attachment)) {
      setPreview({ uri: url, name: attName(attachment) });
      return;
    }

    Linking.openURL(url).catch(() =>
      setFormError('Unable to open this attachment.'),
    );
  };

  const loadTickets = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await supportService.getMyTickets();
      setTickets(Array.isArray(data) ? data : []);
    } catch (error) {
      setFormError(
        error?.response?.data?.message || 'Unable to load your requests.',
      );
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'history') loadTickets();
  }, [activeTab, loadTickets]);

  // ── File selection helpers ──────────────────────────────────────────────
  const validateAndNormaliseFiles = (assets, currentCount) => {
    const availableSlots = MAX_FILES - currentCount;
    const valid = [];

    for (const asset of assets || []) {
      if (valid.length >= availableSlots) break;

      const size = asset.fileSize ?? asset.size;
      const type = asset.type || 'application/octet-stream';
      const uri = asset.uri;

      if (!uri) continue;
      if (size && size > MAX_FILE_BYTES) {
        setFormError(
          `${asset.fileName || asset.name || 'File'} exceeds ${MAX_FILE_MB}MB.`,
        );
        continue;
      }
      if (!type.startsWith('image/') && !type.startsWith('video/')) {
        setFormError(
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

  const takePhoto = async onFiles => {
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
        setFormError(
          result.errorCode === 'camera_unavailable'
            ? 'Camera is not available on this device.'
            : result.errorMessage || 'Unable to open the camera.',
        );
        return;
      }

      onFiles(result.assets || []);
    } catch {
      setFormError('Unable to open the camera.');
    }
  };

  const chooseFiles = async onFiles => {
    try {
      const selected = await pick({
        allowMultiSelection: true,
        type: [types.images, types.video],
      });
      onFiles(selected || []);
    } catch (error) {
      if (
        isErrorWithCode(error) &&
        error.code === errorCodes.OPERATION_CANCELED
      )
        return;
      setFormError('Unable to open the gallery or file picker.');
    }
  };

  // ── Initial ticket attachments — existing feature retained ──────────────
  const addInitialFiles = assets => {
    const incoming = validateAndNormaliseFiles(assets, files.length);
    if (!incoming.length) return;
    setFiles(previous => [...previous, ...incoming].slice(0, MAX_FILES));
  };

  const handleTakePhoto = async () => {
    setFormError('');
    if (files.length >= MAX_FILES)
      return setFormError(`You can attach up to ${MAX_FILES} files.`);
    return takePhoto(addInitialFiles);
  };

  const handlePickFiles = async () => {
    setFormError('');
    if (files.length >= MAX_FILES)
      return setFormError(`You can attach up to ${MAX_FILES} files.`);
    return chooseFiles(addInitialFiles);
  };

  const removeFile = index =>
    setFiles(previous => previous.filter((_, i) => i !== index));

  // ── Reply attachments — new feature ─────────────────────────────────────
  const addReplyFiles = (ticketId, assets) => {
    const current = replyFiles[ticketId] || [];
    const incoming = validateAndNormaliseFiles(assets, current.length);
    if (!incoming.length) return;

    setReplyFiles(previous => ({
      ...previous,
      [ticketId]: [...current, ...incoming].slice(0, MAX_FILES),
    }));
  };

  const handleReplyTakePhoto = async ticketId => {
    setFormError('');
    if ((replyFiles[ticketId] || []).length >= MAX_FILES) {
      return setFormError(`You can attach up to ${MAX_FILES} files per reply.`);
    }
    return takePhoto(assets => addReplyFiles(ticketId, assets));
  };

  const handleReplyPickFiles = async ticketId => {
    setFormError('');
    if ((replyFiles[ticketId] || []).length >= MAX_FILES) {
      return setFormError(`You can attach up to ${MAX_FILES} files per reply.`);
    }
    return chooseFiles(assets => addReplyFiles(ticketId, assets));
  };

  const removeReplyFile = (ticketId, index) => {
    setReplyFiles(previous => ({
      ...previous,
      [ticketId]: (previous[ticketId] || []).filter((_, i) => i !== index),
    }));
  };

  const appendFilesToFormData = (formData, attachmentList) => {
    attachmentList.forEach(file => {
      formData.append('attachments', {
        uri: file.uri,
        name: file.name,
        type: file.type,
      });
    });
  };

  // ── Ticket creation ─────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setFormError('');

    if (!form.contactName.trim()) return setFormError('Please add your name.');
    if (!form.contactEmail.trim())
      return setFormError('Please add your email.');
    if (!form.subject)
      return setFormError('Please select what you need help with.');
    if (!form.message.trim())
      return setFormError('Please describe your query.');

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('contactName', form.contactName.trim());
      formData.append('contactEmail', form.contactEmail.trim());
      formData.append('contactPhone', form.contactPhone.trim());
      formData.append('subject', form.subject);
      formData.append('message', form.message.trim());
      appendFilesToFormData(formData, files);

      await supportService.createTicket(formData);

      setFiles([]);
      setForm(previous => ({ ...previous, subject: '', message: '' }));
      setActiveTab('history');
      loadTickets();
    } catch (error) {
      setFormError(
        error?.response?.data?.message || 'Unable to submit your query.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleTicket = async ticket => {
    const opening = expandedId !== ticket._id;
    setExpandedId(opening ? ticket._id : null);

    if (opening && ticket.userUnread) {
      try {
        await supportService.markRead(ticket._id);
        setTickets(previous =>
          previous.map(item =>
            item._id === ticket._id ? { ...item, userUnread: false } : item,
          ),
        );
      } catch {
        // Ticket may still be viewed if unread-state update fails.
      }
    }
  };

  // ── Reply send: text, media, or both ────────────────────────────────────
  const handleSendReply = async ticketId => {
    const text = (replyText[ticketId] || '').trim();
    const attachments = replyFiles[ticketId] || [];

    if (!text && attachments.length === 0) return;

    setSendingId(ticketId);
    setFormError('');

    try {
      const formData = new FormData();
      formData.append('text', text);
      appendFilesToFormData(formData, attachments);

      const updated = await supportService.addMessage(ticketId, formData);

      setTickets(previous =>
        previous.map(ticket => (ticket._id === ticketId ? updated : ticket)),
      );
      setReplyText(previous => ({ ...previous, [ticketId]: '' }));
      setReplyFiles(previous => ({ ...previous, [ticketId]: [] }));
    } catch (error) {
      setFormError(error?.response?.data?.message || 'Unable to send message.');
    } finally {
      setSendingId(null);
    }
  };

  const inputStyle = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    color: colors.textPrimary,
  };

  const renderSelectedAttachments = (attachmentList, onRemove) => {
    if (!attachmentList?.length) return null;

    return (
      <View style={styles.thumbGrid}>
        {attachmentList.map((file, index) => (
          <View
            key={`${file.uri}-${index}`}
            style={[styles.thumb, { borderColor: colors.border }]}
          >
            {file.isVideo ? (
              <View
                style={[
                  styles.thumbImg,
                  styles.thumbVideoFallback,
                  { backgroundColor: colors.backgroundSecondary },
                ]}
              >
                <Icon
                  name="video-outline"
                  size={26}
                  color={colors.textTertiary}
                />
                <Text
                  style={[
                    styles.thumbVideoName,
                    { color: colors.textTertiary },
                  ]}
                  numberOfLines={1}
                >
                  {file.name}
                </Text>
              </View>
            ) : (
              <Image source={{ uri: file.uri }} style={styles.thumbImg} />
            )}
            <TouchableOpacity
              style={styles.thumbRemove}
              onPress={() => onRemove(index)}
            >
              <Icon name="close" size={12} color="#fff" />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    );
  };

  const renderMessageAttachments = attachments => {
    if (!attachments?.length) return null;

    return (
      <View style={styles.messageAttachmentGrid}>
        {attachments.map((attachment, index) => {
          const url = attUrl(attachment);
          const image = isImageAtt(attachment);
          const video = isVideoAtt(attachment);

          return (
            <TouchableOpacity
              key={`${url}-${index}`}
              style={[styles.messageAttachment, { borderColor: colors.border }]}
              onPress={() => openAttachment(attachment)}
              activeOpacity={0.8}
            >
              {image ? (
                <Image
                  source={{ uri: url }}
                  style={styles.messageAttachmentImage}
                />
              ) : (
                <View
                  style={[
                    styles.messageAttachmentImage,
                    styles.attThumbFallback,
                    { backgroundColor: colors.backgroundSecondary },
                  ]}
                >
                  <Icon
                    name={
                      video ? 'play-circle-outline' : 'file-document-outline'
                    }
                    size={24}
                    color={colors.primary}
                  />
                  <Text
                    style={[
                      styles.attThumbName,
                      { color: colors.textTertiary },
                    ]}
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

  const renderNewRequest = () => (
    <View style={{ gap: 14 }}>
      {!!formError && (
        <View
          style={[
            styles.errorBox,
            {
              backgroundColor: colors.dangerSoft || '#fef2f2',
              borderColor: '#FCA5A5',
            },
          ]}
        >
          <Icon
            name="alert-circle-outline"
            size={15}
            color={colors.danger || '#dc2626'}
          />
          <Text
            style={{
              color: colors.danger || '#dc2626',
              fontSize: 12.5,
              flex: 1,
            }}
          >
            {formError}
          </Text>
        </View>
      )}

      <Field label="Your Name" required icon="account" colors={colors}>
        <TextInput
          style={[styles.input, inputStyle]}
          value={form.contactName}
          onChangeText={value => setF('contactName', value)}
          placeholder="Enter your full name"
          placeholderTextColor={colors.textTertiary}
        />
      </Field>

      <Field label="Email Address" required icon="email" colors={colors}>
        <TextInput
          style={[styles.input, inputStyle]}
          value={form.contactEmail}
          onChangeText={value => setF('contactEmail', value)}
          placeholder="your@email.com"
          placeholderTextColor={colors.textTertiary}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </Field>

      <Field label="Phone Number" icon="phone" colors={colors}>
        <TextInput
          style={[styles.input, inputStyle]}
          value={form.contactPhone}
          onChangeText={value => setF('contactPhone', value)}
          placeholder="Enter your phone number"
          placeholderTextColor={colors.textTertiary}
          keyboardType="phone-pad"
        />
      </Field>

      <Field label="Subject" required icon="file-document" colors={colors}>
        <TouchableOpacity
          style={[styles.select, inputStyle]}
          onPress={() => setSubjectOpen(value => !value)}
          activeOpacity={0.7}
        >
          <Text
            style={{
              flex: 1,
              fontSize: 13,
              color: form.subject ? colors.textPrimary : colors.textTertiary,
            }}
            numberOfLines={1}
          >
            {form.subject || 'What can we help you with?'}
          </Text>
          <Icon
            name={subjectOpen ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textTertiary}
          />
        </TouchableOpacity>
        {subjectOpen && (
          <View
            style={[
              styles.dropdown,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            {SUBJECT_OPTIONS.map(option => {
              const active = form.subject === option;
              return (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.dropdownRow,
                    { borderBottomColor: colors.border },
                    active && { backgroundColor: colors.primarySoft },
                  ]}
                  onPress={() => {
                    setF('subject', option);
                    setSubjectOpen(false);
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      color: active ? colors.primary : colors.textPrimary,
                      fontWeight: active ? '600' : '400',
                    }}
                  >
                    {option}
                  </Text>
                  {active && (
                    <Icon name="check" size={15} color={colors.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </Field>

      <Field label="Message" required icon="message-text" colors={colors}>
        <TextInput
          style={[styles.input, styles.textArea, inputStyle]}
          value={form.message}
          onChangeText={value => setF('message', value)}
          placeholder="Please describe your issue or question in detail…"
          placeholderTextColor={colors.textTertiary}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
        />
      </Field>

      <Field
        label="Attach Screenshots / Video (Optional)"
        icon="upload"
        colors={colors}
      >
        <View style={styles.uploadRow}>
          <TouchableOpacity
            style={[
              styles.uploadBtn,
              {
                borderColor: colors.border,
                backgroundColor: colors.backgroundSecondary,
              },
            ]}
            onPress={handleTakePhoto}
            activeOpacity={0.7}
          >
            <Icon name="camera-outline" size={22} color={colors.primary} />
            <Text style={[styles.uploadBtnText, { color: colors.textPrimary }]}>
              Take Photo
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.uploadBtn,
              {
                borderColor: colors.border,
                backgroundColor: colors.backgroundSecondary,
              },
            ]}
            onPress={handlePickFiles}
            activeOpacity={0.7}
          >
            <Icon
              name="image-multiple-outline"
              size={22}
              color={colors.primary}
            />
            <Text style={[styles.uploadBtnText, { color: colors.textPrimary }]}>
              Choose Files
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.uploadHint, { color: colors.textTertiary }]}>
          Max {MAX_FILES} files, {MAX_FILE_MB}MB each · {files.length}/
          {MAX_FILES} attached
        </Text>
        {renderSelectedAttachments(files, removeFile)}
      </Field>

      <TouchableOpacity
        style={[
          styles.submitBtn,
          { backgroundColor: colors.primary },
          submitting && { opacity: 0.6 },
        ]}
        onPress={handleSubmit}
        disabled={submitting}
        activeOpacity={0.85}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Icon name="send" size={16} color="#fff" />
            <Text style={styles.submitBtnText}>Send Message</Text>
          </>
        )}
      </TouchableOpacity>

      <View
        style={[
          styles.infoBox,
          {
            backgroundColor: colors.backgroundSecondary,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.infoRow}>
          <Icon name="clock-outline" size={14} color={colors.primary} />
          <Text style={[styles.infoLabel, { color: colors.textPrimary }]}>
            Support Information
          </Text>
        </View>
        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
          Support Hours: Mon–Sat, 10AM–7PM IST
        </Text>
        <Text
          style={[
            styles.infoText,
            { color: colors.textSecondary, marginTop: 4 },
          ]}
        >
          Response time: typically within 24 hours
        </Text>
      </View>
    </View>
  );

  const renderTicket = ({ item: ticket }) => {
    const expanded = expandedId === ticket._id;
    const currentReplyFiles = replyFiles[ticket._id] || [];
    const canSend = Boolean(
      (replyText[ticket._id] || '').trim() || currentReplyFiles.length,
    );

    return (
      <View
        style={[
          styles.ticketCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <TouchableOpacity
          style={styles.ticketHead}
          onPress={() => handleToggleTicket(ticket)}
          activeOpacity={0.7}
        >
          <View style={styles.ticketTitleRow}>
            {ticket.userUnread && <View style={styles.unreadDot} />}
            <Text
              style={[styles.ticketSubject, { color: colors.textPrimary }]}
              numberOfLines={1}
            >
              {ticket.subject}
            </Text>
            <StatusChip status={ticket.status} />
          </View>
          <View style={styles.ticketMetaRow}>
            <Text style={[styles.ticketMeta, { color: colors.textTertiary }]}>
              {fmtDateTime(ticket.createdAt)}
            </Text>
            {ticket.attachments?.length > 0 && (
              <View style={styles.attachCount}>
                <Icon name="paperclip" size={11} color={colors.textTertiary} />
                <Text
                  style={[styles.ticketMeta, { color: colors.textTertiary }]}
                >
                  {ticket.attachments.length}
                </Text>
              </View>
            )}
            <Icon
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.textTertiary}
              style={{ marginLeft: 'auto' }}
            />
          </View>
          {!expanded && (
            <Text
              style={[styles.ticketPreview, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {ticket.message}
            </Text>
          )}
        </TouchableOpacity>

        {expanded && (
          <View style={[styles.ticketBody, { borderTopColor: colors.border }]}>
            <View>
              <Text style={[styles.blockLabel, { color: colors.textTertiary }]}>
                ORIGINAL MESSAGE
              </Text>
              <Text style={[styles.blockText, { color: colors.textSecondary }]}>
                {ticket.message}
              </Text>
            </View>

            {ticket.attachments?.length > 0 && (
              <View>
                <Text
                  style={[styles.blockLabel, { color: colors.textTertiary }]}
                >
                  ATTACHMENTS ({ticket.attachments.length})
                </Text>
                <View style={styles.attGrid}>
                  {ticket.attachments.map((attachment, index) => {
                    const url = attUrl(attachment);
                    const image = isImageAtt(attachment);
                    return (
                      <TouchableOpacity
                        key={`${url}-${index}`}
                        style={[
                          styles.attThumb,
                          { borderColor: colors.border },
                        ]}
                        onPress={() => openAttachment(attachment)}
                      >
                        {image ? (
                          <Image
                            source={{ uri: url }}
                            style={styles.attThumbImg}
                          />
                        ) : (
                          <View
                            style={[
                              styles.attThumbImg,
                              styles.attThumbFallback,
                              { backgroundColor: colors.backgroundSecondary },
                            ]}
                          >
                            <Icon
                              name={
                                isVideoAtt(attachment)
                                  ? 'play-circle-outline'
                                  : 'file-document-outline'
                              }
                              size={24}
                              color={colors.textTertiary}
                            />
                            <Text
                              style={[
                                styles.attThumbName,
                                { color: colors.textTertiary },
                              ]}
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
              <View
                style={[
                  styles.thread,
                  { backgroundColor: colors.backgroundSecondary },
                ]}
              >
                {ticket.messages.map(message => {
                  const isAdmin = message.sender === 'admin';
                  return (
                    <View
                      key={message._id}
                      style={[
                        styles.bubbleRow,
                        { justifyContent: isAdmin ? 'flex-start' : 'flex-end' },
                      ]}
                    >
                      <View
                        style={[
                          styles.bubble,
                          {
                            backgroundColor: isAdmin
                              ? colors.primarySoft
                              : colors.surface,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        {!!message.text && (
                          <Text
                            style={{ fontSize: 13, color: colors.textPrimary }}
                          >
                            {message.text}
                          </Text>
                        )}
                        {renderMessageAttachments(message.attachments)}
                        <Text
                          style={[
                            styles.bubbleMeta,
                            { color: colors.textTertiary },
                          ]}
                        >
                          {isAdmin ? 'Support Team' : 'You'} ·{' '}
                          {fmtDateTime(message.createdAt)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {!ticket.messages?.length && (
              <Text style={[styles.noReply, { color: colors.textTertiary }]}>
                No reply yet — our team will get back to you soon.
              </Text>
            )}

            {/* New: camera/gallery attachments are available for every ticket reply. */}
            <View style={styles.replyRow}>
              <TouchableOpacity
                style={[
                  styles.replyMediaBtn,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.backgroundSecondary,
                  },
                ]}
                onPress={() => handleReplyTakePhoto(ticket._id)}
                disabled={sendingId === ticket._id}
              >
                <Icon name="camera-outline" size={19} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.replyMediaBtn,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.backgroundSecondary,
                  },
                ]}
                onPress={() => handleReplyPickFiles(ticket._id)}
                disabled={sendingId === ticket._id}
              >
                <Icon
                  name="image-multiple-outline"
                  size={19}
                  color={colors.primary}
                />
              </TouchableOpacity>
              <TextInput
                style={[styles.replyInput, inputStyle]}
                value={replyText[ticket._id] || ''}
                onChangeText={value =>
                  setReplyText(previous => ({
                    ...previous,
                    [ticket._id]: value,
                  }))
                }
                placeholder="Type a reply…"
                placeholderTextColor={colors.textTertiary}
                multiline
              />
              <TouchableOpacity
                style={[
                  styles.replySend,
                  { backgroundColor: colors.primary },
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

            {currentReplyFiles.length > 0 && (
              <View>
                <Text
                  style={[
                    styles.replyAttachmentHint,
                    { color: colors.textTertiary },
                  ]}
                >
                  Reply attachments: {currentReplyFiles.length}/{MAX_FILES}
                </Text>
                {renderSelectedAttachments(currentReplyFiles, index =>
                  removeReplyFile(ticket._id, index),
                )}
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderHistory = () => {
    if (historyLoading)
      return (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    if (!tickets.length)
      return (
        <View style={[styles.centerBox, { paddingVertical: 48 }]}>
          <Icon name="history" size={32} color={colors.textTertiary} />
          <Text
            style={{ fontSize: 13, color: colors.textTertiary, marginTop: 8 }}
          >
            You haven't raised any requests yet.
          </Text>
        </View>
      );

    return (
      <>
        <View style={styles.historyTop}>
          <Text style={{ fontSize: 12.5, color: colors.textTertiary, flex: 1 }}>
            Track the status of queries you've raised.
          </Text>
          <TouchableOpacity
            style={[styles.refreshBtn, { borderColor: colors.border }]}
            onPress={loadTickets}
          >
            <Icon name="refresh" size={13} color={colors.textSecondary} />
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
              Refresh
            </Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={tickets}
          keyExtractor={ticket => ticket._id}
          renderItem={renderTicket}
          scrollEnabled={false}
          contentContainerStyle={{ gap: 10 }}
        />
      </>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 12,
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={[
              styles.backBtn,
              { backgroundColor: colors.backgroundSecondary },
            ]}
            onPress={() => navigation?.goBack?.()}
          >
            <Icon name="arrow-left" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
              Support Center
            </Text>
            <Text style={[styles.headerSub, { color: colors.textTertiary }]}>
              We're here to help you
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.tabBar,
            { backgroundColor: colors.backgroundSecondary },
          ]}
        >
          {[
            { key: 'new', label: 'New Request', icon: 'plus' },
            { key: 'history', label: 'My Requests', icon: 'history' },
          ].map(tab => {
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.tab,
                  active && { backgroundColor: colors.surface },
                ]}
                onPress={() => {
                  setActiveTab(tab.key);
                  setFormError('');
                }}
              >
                <Icon
                  name={tab.icon}
                  size={14}
                  color={active ? colors.primary : colors.textTertiary}
                />
                <Text
                  style={{
                    fontSize: 12.5,
                    fontWeight: active ? '700' : '500',
                    color: active ? colors.primary : colors.textTertiary,
                  }}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.body,
          { paddingBottom: 24 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {activeTab === 'new' ? renderNewRequest() : renderHistory()}
      </ScrollView>

      <Modal
        visible={!!preview}
        transparent
        animationType="fade"
        onRequestClose={() => setPreview(null)}
      >
        <Pressable
          style={styles.previewBackdrop}
          onPress={() => setPreview(null)}
        >
          <View style={[styles.previewBar, { paddingTop: insets.top + 8 }]}>
            <Text style={styles.previewName} numberOfLines={1}>
              {preview?.name}
            </Text>
            <TouchableOpacity onPress={() => setPreview(null)}>
              <Icon name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          {!!preview && (
            <Image
              source={{ uri: preview.uri }}
              style={styles.previewImg}
              resizeMode="contain"
            />
          )}
          <TouchableOpacity
            style={styles.previewOpenBtn}
            onPress={() => preview?.uri && Linking.openURL(preview.uri)}
          >
            <Icon name="open-in-new" size={15} color="#fff" />
            <Text style={styles.previewOpenText}>Open in browser</Text>
          </TouchableOpacity>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    gap: 12,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  headerSub: { fontSize: 11.5, marginTop: 1 },
  tabBar: { flexDirection: 'row', padding: 4, borderRadius: 12, gap: 4 },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 9,
  },
  body: { padding: 14 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  field: { gap: 6 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  fieldLabel: { fontSize: 12.5, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 13,
    paddingVertical: 0,
  },
  textArea: {
    height: undefined,
    minHeight: 100,
    paddingTop: 10,
    paddingBottom: 10,
    textAlignVertical: 'top',
  },
  select: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 11,
  },
  dropdown: {
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 11,
    overflow: 'hidden',
  },
  dropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  uploadRow: { flexDirection: 'row', gap: 8 },
  uploadBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  uploadBtnText: { fontSize: 12, fontWeight: '600' },
  uploadHint: { fontSize: 11, marginTop: 6 },
  thumbGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  thumbVideoFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    gap: 2,
  },
  thumbVideoName: { fontSize: 8, textAlign: 'center' },
  thumbRemove: {
    position: 'absolute',
    top: 3,
    right: 3,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 9,
    padding: 3,
  },
  submitBtn: {
    height: 46,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  infoBox: { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoLabel: { fontSize: 12.5, fontWeight: '700' },
  infoText: { fontSize: 12, marginTop: 4 },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  historyTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  ticketCard: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  ticketHead: { paddingHorizontal: 12, paddingVertical: 11, gap: 5 },
  ticketTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#F04438',
  },
  ticketSubject: { flex: 1, fontSize: 13.5, fontWeight: '600' },
  ticketMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ticketMeta: { fontSize: 11 },
  attachCount: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ticketPreview: { fontSize: 12 },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusChipText: { fontSize: 10.5, fontWeight: '700' },
  ticketBody: {
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 10,
  },
  blockLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  blockText: { fontSize: 13, lineHeight: 19 },
  attGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  attThumb: {
    width: 76,
    height: 76,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  attThumbImg: { width: '100%', height: '100%' },
  attThumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    gap: 3,
  },
  attThumbName: { fontSize: 8, textAlign: 'center' },
  thread: { borderRadius: 10, padding: 10, gap: 8 },
  bubbleRow: { flexDirection: 'row' },
  bubble: {
    maxWidth: '82%',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  bubbleMeta: { fontSize: 10, marginTop: 4 },
  messageAttachmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 7,
  },
  messageAttachment: {
    width: 104,
    height: 104,
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  messageAttachmentImage: { width: '100%', height: '100%' },
  noReply: { fontSize: 12, fontStyle: 'italic' },
  replyRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  replyMediaBtn: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 8,
    fontSize: 13,
    textAlignVertical: 'center',
  },
  replySend: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyAttachmentHint: { fontSize: 10.5, marginTop: 2 },
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
    paddingBottom: 10,
    zIndex: 2,
  },
  previewName: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '600' },
  previewImg: { width: '100%', height: '78%' },
  previewOpenBtn: {
    position: 'absolute',
    bottom: 36,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  previewOpenText: { color: '#fff', fontSize: 12.5, fontWeight: '600' },
});

export default SupportScreen;
