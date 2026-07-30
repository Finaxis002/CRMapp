/**
 * SupportScreen — Help & Support
 *
 * Web ke SupportWidget ka mobile port. Do tabs:
 *   New Request  — form + attachments
 *   My Requests  — ticket history, expand karke chat thread + reply
 *
 * Navigator mein:
 *   <Stack.Screen name="Support" component={SupportScreen} />
 * Aur Topbar ke HIDDEN_ROUTES_MOBILE mein 'Support' add karo.
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

// Attachments — do source:
//   Camera  → react-native-image-picker (npm i react-native-image-picker)
//   Files   → @react-native-documents/picker (project mein pehle se hai)
import { launchCamera } from 'react-native-image-picker';
import {
  pick,
  types,
  errorCodes,
  isErrorWithCode,
} from '@react-native-documents/picker';

import { supportService } from '../../services/supportService';
import { useUISystem } from '../../hooks/useUISystem';
import { API_BASE_URL } from '../../config';

const MAX_FILES = 5;
const MAX_FILE_MB = 25;

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

/* ─── Attachment helpers ──────────────────────────────────────────────────
 * Backend `{ url: "/uploads/support/xyz.jpg", fileType: "image"|"video",
 * originalName }` bhejta hai — url RELATIVE hai. Web pe browser resolve kar
 * leta hai, par RN ke <Image> ko absolute URL chahiye, isliye API host jodo.
 * ------------------------------------------------------------------------ */

// API_BASE_URL kabhi ".../api/v1" hota hai — static files root pe serve hoti
// hain, isliye /api/... suffix hata do.
const FILE_HOST = String(API_BASE_URL || '')
  .replace(/\/+$/, '')
  .replace(/\/api(\/v\d+)?$/, '');

const attUrl = a => {
  const raw = typeof a === 'string' ? a : a?.url || a?.path || '';
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${FILE_HOST}${raw.startsWith('/') ? '' : '/'}${raw}`;
};

const attName = (a, i) => {
  if (typeof a === 'object' && (a?.originalName || a?.filename || a?.name)) {
    return a.originalName || a.filename || a.name;
  }
  const last = attUrl(a).split('?')[0].split('/').pop();
  return last || `File ${i + 1}`;
};

const isImageAtt = a => {
  if (typeof a === 'object' && a?.fileType) return a.fileType === 'image';
  const mime = typeof a === 'object' ? a?.mimetype || a?.type || '' : '';
  if (mime) return mime.startsWith('image');
  return /\.(jpe?g|png|gif|webp|bmp|heic)$/i.test(attUrl(a).split('?')[0]);
};

const isVideoAtt = a => {
  if (typeof a === 'object' && a?.fileType) return a.fileType === 'video';
  const mime = typeof a === 'object' ? a?.mimetype || a?.type || '' : '';
  if (mime) return mime.startsWith('video');
  return /\.(mp4|mov|m4v|3gp|avi|mkv)$/i.test(attUrl(a).split('?')[0]);
};

const fmtDateTime = d =>
  new Date(d).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

/* ─── Small pieces ────────────────────────────────────────────────────── */

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

/* ─── Main ────────────────────────────────────────────────────────────── */

const SupportScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, borderRadius } = useUISystem();
  const { user } = useSelector(state => state.auth);

  const [activeTab, setActiveTab] = useState('new'); // 'new' | 'history'

  /* ── New request form ── */
  const [form, setForm] = useState({
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    subject: '',
    message: '',
  });
  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const [files, setFiles] = useState([]);
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  /* ── History ── */
  const [tickets, setTickets] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [replyText, setReplyText] = useState({});
  const [sendingId, setSendingId] = useState(null);

  // Full-screen image preview
  const [preview, setPreview] = useState(null); // { uri, name }

  const scrollRef = useRef(null);

  // Image → in-app preview, baaki (video/pdf) → system app mein khol do
  const openAttachment = a => {
    const url = attUrl(a);
    if (!url) return;
    if (isImageAtt(a)) {
      setPreview({ uri: url, name: attName(a, 0) });
    } else {
      Linking.openURL(url).catch(() =>
        setFormError('Unable to open this attachment.'),
      );
    }
  };

  /* ── Prefill from logged-in user ── */
  useEffect(() => {
    if (!user) return;
    setForm(prev => ({
      ...prev,
      contactName: prev.contactName || user.name || '',
      contactEmail: prev.contactEmail || user.email || '',
      contactPhone: prev.contactPhone || user.phone || user.phoneNumber || '',
    }));
  }, [user]);

  /* ── Load history ── */
  const loadTickets = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await supportService.getMyTickets();
      setTickets(Array.isArray(data) ? data : []);
    } catch {
      setFormError('Unable to load your requests.');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'history') loadTickets();
  }, [activeTab, loadTickets]);

  /* ── Attachments ── */

  // Slot bacha hai ya nahi — dono pickers isse check karte hain
  const canAddMore = () => {
    if (files.length >= MAX_FILES) {
      setFormError(`You can attach up to ${MAX_FILES} files.`);
      return false;
    }
    return true;
  };

  const addFiles = incoming => {
    setFiles(prev => [...prev, ...incoming].slice(0, MAX_FILES));
  };

  /* 📷 Camera — sidha photo khinch ke attach */
  const handleTakePhoto = async () => {
    setFormError('');
    if (!canAddMore()) return;

    try {
      const res = await launchCamera({
        mediaType: 'photo',
        quality: 0.7,
        maxWidth: 1920,
        maxHeight: 1920,
        saveToPhotos: false,
      });

      if (res.didCancel) return;
      if (res.errorCode) {
        setFormError(
          res.errorCode === 'camera_unavailable'
            ? 'Camera is not available on this device.'
            : res.errorMessage || 'Unable to open the camera.',
        );
        return;
      }

      const a = res.assets?.[0];
      if (!a) return;

      if (a.fileSize && a.fileSize > MAX_FILE_MB * 1024 * 1024) {
        setFormError(`Photo exceeds ${MAX_FILE_MB}MB.`);
        return;
      }

      addFiles([
        {
          uri: a.uri,
          name: a.fileName || `photo-${Date.now()}.jpg`,
          type: a.type || 'image/jpeg',
          isVideo: false,
        },
      ]);
    } catch {
      setFormError('Unable to open the camera.');
    }
  };

  /* 📁 Files — gallery / file browser se choose */
  const handlePickFiles = async () => {
    setFormError('');
    if (!canAddMore()) return;

    try {
      const picked = await pick({
        allowMultiSelection: true,
        type: [types.images, types.video],
      });

      const valid = [];
      for (const a of picked) {
        if (a.size && a.size > MAX_FILE_MB * 1024 * 1024) {
          setFormError(`${a.name || 'File'} exceeds ${MAX_FILE_MB}MB.`);
          continue;
        }
        valid.push({
          uri: a.uri,
          name: a.name || `upload-${Date.now()}`,
          type: a.type || 'application/octet-stream',
          isVideo: (a.type || '').startsWith('video'),
        });
      }

      addFiles(valid);
    } catch (err) {
      // User ne cancel kiya — error mat dikhao
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) {
        return;
      }
      setFormError('Unable to open the file picker.');
    }
  };

  const removeFile = idx => setFiles(prev => prev.filter((_, i) => i !== idx));

  /* ── Submit ── */
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
      const fd = new FormData();
      fd.append('contactName', form.contactName.trim());
      fd.append('contactEmail', form.contactEmail.trim());
      fd.append('contactPhone', form.contactPhone.trim());
      fd.append('subject', form.subject);
      fd.append('message', form.message.trim());
      files.forEach(f =>
        fd.append('attachments', {
          uri: f.uri,
          name: f.name,
          type: f.type,
        }),
      );

      await supportService.createTicket(fd);

      setFiles([]);
      setForm(prev => ({ ...prev, subject: '', message: '' }));
      setActiveTab('history');
      loadTickets();
    } catch (err) {
      setFormError(
        err?.response?.data?.message || 'Unable to submit your query.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Ticket expand / mark read ── */
  const handleToggleTicket = async ticket => {
    const opening = expandedId !== ticket._id;
    setExpandedId(opening ? ticket._id : null);

    if (opening && ticket.userUnread) {
      try {
        await supportService.markRead(ticket._id);
        setTickets(prev =>
          prev.map(t =>
            t._id === ticket._id ? { ...t, userUnread: false } : t,
          ),
        );
      } catch {}
    }
  };

  const handleSendReply = async ticketId => {
    const text = (replyText[ticketId] || '').trim();
    if (!text) return;
    setSendingId(ticketId);
    try {
      const updated = await supportService.addMessage(ticketId, text);
      setTickets(prev => prev.map(t => (t._id === ticketId ? updated : t)));
      setReplyText(prev => ({ ...prev, [ticketId]: '' }));
    } catch {
      setFormError('Unable to send message.');
    } finally {
      setSendingId(null);
    }
  };

  /* ── Renders ── */

  const inputStyle = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    color: colors.textPrimary,
  };

  const renderNewRequest = () => (
    <View style={{ gap: 14 }}>
      {!!formError && (
        <View
          style={[
            styles.errorBox,
            { backgroundColor: colors.dangerSoft, borderColor: '#FCA5A5' },
          ]}
        >
          <Icon name="alert-circle-outline" size={15} color={colors.danger} />
          <Text style={{ color: colors.danger, fontSize: 12.5, flex: 1 }}>
            {formError}
          </Text>
        </View>
      )}

      <Field label="Your Name" required icon="account" colors={colors}>
        <TextInput
          style={[styles.input, inputStyle]}
          value={form.contactName}
          onChangeText={v => setF('contactName', v)}
          placeholder="Enter your full name"
          placeholderTextColor={colors.textTertiary}
        />
      </Field>

      <Field label="Email Address" required icon="email" colors={colors}>
        <TextInput
          style={[styles.input, inputStyle]}
          value={form.contactEmail}
          onChangeText={v => setF('contactEmail', v)}
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
          onChangeText={v => setF('contactPhone', v)}
          placeholder="Enter your phone number"
          placeholderTextColor={colors.textTertiary}
          keyboardType="phone-pad"
        />
      </Field>

      <Field label="Subject" required icon="file-document" colors={colors}>
        <TouchableOpacity
          style={[styles.select, inputStyle]}
          onPress={() => setSubjectOpen(p => !p)}
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
            {SUBJECT_OPTIONS.map(opt => {
              const active = form.subject === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.dropdownRow,
                    { borderBottomColor: colors.border },
                    active && { backgroundColor: colors.primarySoft },
                  ]}
                  onPress={() => {
                    setF('subject', opt);
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
                    {opt}
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
          onChangeText={v => setF('message', v)}
          placeholder="Please describe your issue or question in detail…"
          placeholderTextColor={colors.textTertiary}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
        />
      </Field>

      {/* ── Attachments ── */}
      <Field
        label="Attach Screenshots / Video (Optional)"
        icon="upload"
        colors={colors}
      >
        <View style={styles.uploadRow}>
          {/* Camera — sidha photo khinch ke bhejo */}
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

          {/* Files — gallery / file browser */}
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

        {files.length > 0 && (
          <View style={styles.thumbGrid}>
            {files.map((f, idx) => (
              <View
                key={`${f.uri}-${idx}`}
                style={[styles.thumb, { borderColor: colors.border }]}
              >
                {f.isVideo ? (
                  // Document picker video ka thumbnail nahi deta — icon dikhao
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
                      {f.name}
                    </Text>
                  </View>
                ) : (
                  <Image source={{ uri: f.uri }} style={styles.thumbImg} />
                )}
                <TouchableOpacity
                  style={styles.thumbRemove}
                  onPress={() => removeFile(idx)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Icon name="close" size={12} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
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

      {/* ── Support info ── */}
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
            Support Hours
          </Text>
        </View>
        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
          Mon–Sat, 10AM–7PM IST
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
            <Text style={[styles.blockLabel, { color: colors.textTertiary }]}>
              ORIGINAL MESSAGE
            </Text>
            <Text style={[styles.blockText, { color: colors.textSecondary }]}>
              {ticket.message}
            </Text>

            {/* ── Attachments — tap to view ── */}
            {ticket.attachments?.length > 0 && (
              <View>
                <Text
                  style={[styles.blockLabel, { color: colors.textTertiary }]}
                >
                  ATTACHMENTS ({ticket.attachments.length})
                </Text>
                <View style={styles.attGrid}>
                  {ticket.attachments.map((a, i) => {
                    const url = attUrl(a);
                    const image = isImageAtt(a);
                    const video = isVideoAtt(a);
                    return (
                      <TouchableOpacity
                        key={`${url}-${i}`}
                        style={[
                          styles.attThumb,
                          { borderColor: colors.border },
                        ]}
                        onPress={() => openAttachment(a)}
                        activeOpacity={0.8}
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
                                video
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

            {!!ticket.adminReply && (
              <View
                style={[
                  styles.replyBox,
                  {
                    backgroundColor: colors.primarySoft,
                    borderColor: colors.primaryBorder || colors.primary,
                  },
                ]}
              >
                <Text style={[styles.blockLabel, { color: colors.primary }]}>
                  SUPPORT TEAM REPLY
                </Text>
                <Text
                  style={[styles.blockText, { color: colors.textSecondary }]}
                >
                  {ticket.adminReply}
                </Text>
              </View>
            )}

            {/* Conversation thread */}
            {ticket.messages?.length > 0 && (
              <View
                style={[
                  styles.thread,
                  { backgroundColor: colors.backgroundSecondary },
                ]}
              >
                {ticket.messages.map(m => {
                  const isAdmin = m.sender === 'admin';
                  return (
                    <View
                      key={m._id}
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
                        <Text
                          style={{ fontSize: 13, color: colors.textPrimary }}
                        >
                          {m.text}
                        </Text>
                        <Text
                          style={[
                            styles.bubbleMeta,
                            { color: colors.textTertiary },
                          ]}
                        >
                          {isAdmin ? 'Support Team' : 'You'} ·{' '}
                          {fmtDateTime(m.createdAt)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {!ticket.adminReply && !ticket.messages?.length && (
              <Text style={[styles.noReply, { color: colors.textTertiary }]}>
                No reply yet — our team will get back to you soon.
              </Text>
            )}

            {/* Reply box */}
            <View style={styles.replyRow}>
              <TextInput
                style={[styles.replyInput, inputStyle]}
                value={replyText[ticket._id] || ''}
                onChangeText={v =>
                  setReplyText(prev => ({ ...prev, [ticket._id]: v }))
                }
                placeholder="Type a reply…"
                placeholderTextColor={colors.textTertiary}
                onSubmitEditing={() => handleSendReply(ticket._id)}
                returnKeyType="send"
              />
              <TouchableOpacity
                style={[
                  styles.replySend,
                  { backgroundColor: colors.primary },
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
                  <Icon name="send" size={15} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderHistory = () => {
    if (historyLoading) {
      return (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }

    if (!tickets.length) {
      return (
        <View style={[styles.centerBox, { paddingVertical: 48 }]}>
          <Icon name="history" size={32} color={colors.textTertiary} />
          <Text
            style={{
              fontSize: 13,
              color: colors.textTertiary,
              marginTop: 8,
            }}
          >
            You haven't raised any requests yet.
          </Text>
        </View>
      );
    }

    return (
      <>
        <View style={styles.historyTop}>
          <Text style={{ fontSize: 12.5, color: colors.textTertiary, flex: 1 }}>
            Track the status of queries you've raised.
          </Text>
          <TouchableOpacity
            style={[styles.refreshBtn, { borderColor: colors.border }]}
            onPress={loadTickets}
            activeOpacity={0.7}
          >
            <Icon name="refresh" size={13} color={colors.textSecondary} />
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
              Refresh
            </Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={tickets}
          keyExtractor={t => t._id}
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
      {/* ── Header ── */}
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
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
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

        {/* ── Tabs ── */}
        <View
          style={[
            styles.tabBar,
            { backgroundColor: colors.backgroundSecondary },
          ]}
        >
          {[
            { key: 'new', label: 'New Request', icon: 'plus' },
            { key: 'history', label: 'My Requests', icon: 'history' },
          ].map(t => {
            const active = activeTab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                style={[
                  styles.tab,
                  active && { backgroundColor: colors.surface },
                ]}
                onPress={() => {
                  setActiveTab(t.key);
                  setFormError('');
                }}
                activeOpacity={0.7}
              >
                <Icon
                  name={t.icon}
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
                  {t.label}
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

      {/* ── Full-screen image preview ── */}
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
            <TouchableOpacity
              onPress={() => setPreview(null)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
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
            activeOpacity={0.8}
          >
            <Icon name="open-in-new" size={15} color="#fff" />
            <Text style={styles.previewOpenText}>Open in browser</Text>
          </TouchableOpacity>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
};

/* ─── Styles ──────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  /* Header */
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

  /* Tabs */
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

  /* Body */
  body: { padding: 14 },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },

  /* Fields */
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

  /* Upload */
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

  /* Submit */
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

  /* Info */
  infoBox: { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoLabel: { fontSize: 12.5, fontWeight: '700' },
  infoText: { fontSize: 12, marginTop: 4 },

  /* History */
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

  /* Ticket card */
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

  /* Ticket attachments */
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

  /* Full-screen preview */
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
  replyBox: { borderWidth: 1, borderRadius: 10, padding: 10 },

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

  noReply: { fontSize: 12, fontStyle: 'italic' },

  replyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  replyInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 11,
    fontSize: 13,
    paddingVertical: 0,
  },
  replySend: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default SupportScreen;
