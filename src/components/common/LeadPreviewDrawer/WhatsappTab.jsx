import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Linking,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';

import api from '../../../services/api';

// =============================================
// HELPERS
// =============================================
const formatTime = d =>
  new Date(d).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });

const formatDuration = secs => {
  if (!secs) return null;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s < 10 ? '0' + s : s}s`;
};

const getDateLabel = d => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const itemDate = new Date(d);
  itemDate.setHours(0, 0, 0, 0);
  const diff = Math.round((today - itemDate) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const CALL_CFG = {
  incoming: { emoji: '📥', label: 'Incoming Call', color: '#25D366' },
  outgoing: { emoji: '📤', label: 'Outgoing Call', color: '#1976D2' },
  missed: { emoji: '📵', label: 'Missed Call', color: '#ef4444' },
  video: { emoji: '📹', label: 'Video Call', color: '#8b5cf6' },
};

const normalizeWhatsappPhone = phone => {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('+') ? digits.slice(1) : digits;
};

const buildWhatsappUrl = (phone, text = '') => {
  if (!phone) return '';
  const normalized = normalizeWhatsappPhone(phone);
  if (!normalized) return '';
  const encodedText = encodeURIComponent(text || '');
  return `https://wa.me/${normalized}${
    encodedText ? `?text=${encodedText}` : ''
  }`;
};

// =============================================
// MAIN COMPONENT
// =============================================
const WhatsappTab = ({
  leadId,
  leadPhone,
  leadName,
  isDark = false,
  theme = {},
}) => {
  const currentUserName = 'You';

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fallbackNotice, setFallbackNotice] = useState(null);
  const [filter, setFilter] = useState('all');
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [showActionsId, setShowActionsId] = useState(null);
  const messagesEndRef = useRef(null);

  // Theme-aware values (use theme when provided)
  const waBg = theme.whatsappBg || (isDark ? '#0B141A' : '#ECE5DD');
  const callCardBg = theme.callCardBg || (isDark ? '#1F2C34' : '#fff');
  const filterBg = theme.filterBg || (isDark ? '#1A1A1A' : '#F0F2F5');
  const inputBg = theme.inputBg || (isDark ? '#1F2C34' : '#fff');
  const inputColor = theme.inputColor || (isDark ? '#E9EDF0' : '#111');

  const bubbleStyle = {
    sent: {
      bg: theme.bubbleSentBg || (isDark ? '#005C4B' : '#DCF8C6'),
      color: theme.bubbleSentColor || (isDark ? '#E9EDF0' : '#111'),
    },
    received: {
      bg: theme.bubbleReceivedBg || (isDark ? '#1F2C34' : '#fff'),
      color: theme.bubbleReceivedColor || (isDark ? '#E9EDF0' : '#111'),
    },
  };

  // =============================================
  // FETCH
  // =============================================
  const fetchHistory = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    setError(null);
    setFallbackNotice(null);
    try {
      const res = await api.get(`/whatsapp/messages?leadId=${leadId}`);
      const data = res?.data?.data || res?.data || [];

      const sorted = [...data].sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      );
      setItems(sorted);
    } catch (err) {
      console.error('WhatsApp fetch error:', err);
      setError('Failed to load history. Please try again.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    fetchHistory();

    // Background sync every 5 seconds
    const interval = setInterval(async () => {
      if (!leadId || sending) return;
      try {
        const res = await api.get(`/whatsapp/messages?leadId=${leadId}`);
        const data = res?.data?.data || res?.data || [];

        if (data.length !== items.length) {
          const sorted = [...data].sort(
            (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
          );
          setItems(sorted);
        }
      } catch (err) {
        console.debug('WhatsApp background sync failed:', err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchHistory, leadId, sending, items.length]);

  // Auto scroll to bottom
  useEffect(() => {
    if (!loading) {
      setTimeout(() => {
        messagesEndRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [items, loading, filter]);

  // =============================================
  // SEND MESSAGE
  // =============================================
  const handleDeleteMessage = async messageId => {
    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/whatsapp/messages/${messageId}`);
              setItems(prev => prev.filter(m => m._id !== messageId));
              if (editingId === messageId) {
                setEditingId(null);
                setEditingText('');
              }
            } catch (err) {
              console.error('Delete message error:', err);
              Alert.alert('Error', 'Failed to delete message.');
            }
          },
        },
      ],
    );
  };

  const handleSaveEdit = async messageId => {
    if (!editingText.trim() || sending) return;
    setSending(true);
    try {
      const res = await api.patch(`/whatsapp/messages/${messageId}`, {
        body: editingText.trim(),
      });
      const updated = res?.data?.data || res?.data;
      setItems(prev =>
        prev.map(m => (m._id === messageId ? { ...m, ...updated } : m)),
      );
      setEditingId(null);
      setEditingText('');
    } catch (err) {
      console.error('Edit message error:', err);
      Alert.alert('Error', 'Failed to update message.');
    } finally {
      setSending(false);
    }
  };

  const handleSend = async () => {
    if (!newMsg.trim() || sending) return;
    const messageText = newMsg.trim();
    setSending(true);
    setFallbackNotice(null);

    const tempId = `temp_${Date.now()}`;
    const tempMsg = {
      _id: tempId,
      type: 'chat',
      body: messageText,
      direction: 'outgoing',
      status: 'sent',
      createdAt: new Date().toISOString(),
    };

    setItems(prev => [...prev, tempMsg]);
    setNewMsg('');

    try {
      const res = await api.post('/whatsapp/send', {
        leadId,
        message: messageText,
      });
      const saved = res?.data?.data || res?.data;
      setItems(prev =>
        prev.map(m => (m._id === tempId ? { ...saved, type: 'chat' } : m)),
      );
    } catch (err) {
      console.error('Send error:', err);
      setItems(prev => prev.filter(m => m._id !== tempId));

      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to send message. Please try again.';

      const fallbackError =
        /WhatsApp API token invalid|not configured|Cannot parse access token|template|24(?:\s|-)?hour|customer care window|HSM/i.test(
          message,
        );

      if (fallbackError && leadPhone) {
        setFallbackNotice(
          'WhatsApp cannot send this message via API after 24 hours. Opening direct chat instead.',
        );
        Linking.openURL(buildWhatsappUrl(leadPhone, messageText));
      } else if (fallbackError) {
        setError(
          'WhatsApp cannot send this message via API after 24 hours. Please open direct WhatsApp chat.',
        );
      } else {
        Alert.alert('Error', message);
      }
    } finally {
      setSending(false);
    }
  };

  // =============================================
  // FILTER
  // =============================================
  const filtered = items.filter(item => {
    if (filter === 'chats') return item.type === 'chat';
    if (filter === 'calls') return item.type === 'call';
    return true;
  });

  // Date Dividers
  const withDividers = [];
  let lastDate = null;
  filtered.forEach(item => {
    const label = getDateLabel(item.createdAt);
    if (label !== lastDate) {
      withDividers.push({ _isDivider: true, label, key: `div${label}` });
      lastDate = label;
    }
    withDividers.push(item);
  });

  const chatCount = items.filter(i => i.type === 'chat').length;
  const callCount = items.filter(i => i.type === 'call').length;

  // =============================================
  // RENDER MESSAGE BUBBLE
  // =============================================
  const renderMessageBubble = item => {
    const isSent = item.direction === 'outgoing';
    const bs = isSent ? bubbleStyle.sent : bubbleStyle.received;
    const tickColor = item.status === 'read' ? theme.info || '#53BDEB' : '#aaa';
    const tick =
      item.status === 'read' || item.status === 'delivered' ? '✓✓' : '✓';

    return (
      <View
        key={item._id}
        style={[
          styles.bubbleContainer,
          isSent ? styles.bubbleSent : styles.bubbleReceived,
        ]}
      >
        {/* Actions Overlay */}
        {isSent && editingId !== item._id && showActionsId === item._id && (
          <View style={styles.actionsOverlay}>
            <TouchableOpacity
              onPress={() => {
                setEditingId(item._id);
                setEditingText(item.body || '');
                setShowActionsId(null);
              }}
              style={styles.actionButton}
            >
              <Text style={styles.actionIcon}>✏️</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDeleteMessage(item._id)}
              style={styles.actionButton}
            >
              <Text
                style={[
                  styles.actionIcon,
                  { color: theme.danger || '#ef4444' },
                ]}
              >
                🗑️
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View
          style={[
            styles.bubble,
            {
              backgroundColor: bs.bg,
              borderBottomLeftRadius: isSent ? 8 : 2,
              borderBottomRightRadius: isSent ? 2 : 8,
            },
          ]}
        >
          {/* Attachment */}
          {item.mediaUrl && (
            <TouchableOpacity
              onPress={() => Linking.openURL(item.mediaUrl)}
              style={[
                styles.attachment,
                {
                  backgroundColor:
                    theme.attachmentBg ||
                    (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
                },
              ]}
            >
              <Text style={{ fontSize: 12 }}>📎</Text>
              <Text style={[styles.attachmentText, { color: bs.color }]}>
                {item.mediaName || 'Attachment'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Text or Edit */}
          {editingId === item._id ? (
            <>
              <TextInput
                value={editingText}
                onChangeText={setEditingText}
                multiline
                style={[
                  styles.editInput,
                  {
                    backgroundColor:
                      theme.editInputBg || (isDark ? '#111827' : '#f8fafc'),
                    color:
                      theme.editInputColor || (isDark ? '#eef2ff' : '#111827'),
                  },
                ]}
              />
              <View style={styles.editActions}>
                <TouchableOpacity
                  onPress={() => handleSaveEdit(item._id)}
                  style={styles.saveButton}
                >
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setEditingId(null);
                    setEditingText('');
                  }}
                  style={styles.cancelButton}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            item.body && (
              <Text style={[styles.bubbleText, { color: bs.color }]}>
                {item.body}
              </Text>
            )
          )}

          {/* Footer: Sender + Time + Tick */}
          <View style={styles.bubbleFooter}>
            <Text style={styles.bubbleSender}>
              {isSent
                ? item.sentBy?.name || currentUserName
                : leadName || 'Lead'}
            </Text>
            <Text style={styles.bubbleTime}>{formatTime(item.createdAt)}</Text>
            {isSent && (
              <Text style={[styles.tick, { color: tickColor }]}>{tick}</Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  // =============================================
  // RENDER CALL CARD
  // =============================================
  const renderCallCard = item => {
    const cfg = CALL_CFG[item.callType] || CALL_CFG.outgoing;
    return (
      <View key={item._id} style={styles.callCardContainer}>
        <View style={[styles.callCard, { backgroundColor: callCardBg }]}>
          <Text style={styles.callEmoji}>{cfg.emoji}</Text>
          <View style={styles.callInfo}>
            <Text style={[styles.callLabel, { color: cfg.color }]}>
              {cfg.label}
            </Text>
            <Text style={styles.callTime}>{formatTime(item.createdAt)}</Text>
          </View>
          {formatDuration(item.duration) && (
            <Text style={styles.callDuration}>
              ⏱ {formatDuration(item.duration)}
            </Text>
          )}
        </View>
      </View>
    );
  };

  // =============================================
  // RENDER
  // =============================================
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { borderColor: theme?.border || '#e5e7eb' }]}
    >
      {/* Filter Bar */}
      <View
        style={[
          styles.filterBar,
          {
            backgroundColor: filterBg,
            borderBottomColor: theme?.border || '#e5e7eb',
          },
        ]}
      >
        {[
          { key: 'all', label: `All (${items.length})` },
          { key: 'chats', label: `💬 Chats (${chatCount})` },
          { key: 'calls', label: `📞 Calls (${callCount})` },
        ].map(f => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setFilter(f.key)}
            style={[
              styles.filterButton,
              {
                borderColor:
                  filter === f.key ? '#075E54' : theme?.border || '#e5e7eb',
                backgroundColor: filter === f.key ? '#075E54' : 'transparent',
              },
            ]}
          >
            <Text
              style={[
                styles.filterButtonText,
                {
                  color:
                    filter === f.key
                      ? '#fff'
                      : theme?.textSecondary || '#6b7280',
                },
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          onPress={() => {
            const url = buildWhatsappUrl(leadPhone);
            if (url) Linking.openURL(url);
          }}
          disabled={!leadPhone}
          style={styles.seeHistoryButton}
        >
          <Text>💬</Text>
          <Text
            style={[
              styles.seeHistoryText,
              { color: leadPhone ? theme?.textMuted || '#9ca3af' : '#999' },
            ]}
          >
            See History
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={fetchHistory} style={styles.refreshButton}>
          <Text style={{ fontSize: 16, color: theme?.textMuted || '#9ca3af' }}>
            ↻
          </Text>
        </TouchableOpacity>
      </View>

      {/* Fallback Notice */}
      {fallbackNotice && (
        <View
          style={[
            styles.fallbackNotice,
            {
              backgroundColor: isDark ? '#42291f' : '#fef2f2',
              borderBottomColor: theme?.border || '#e5e7eb',
            },
          ]}
        >
          <Text
            style={{
              fontSize: 13,
              color: isDark ? '#fca5a5' : '#b91c1c',
            }}
          >
            {fallbackNotice}
          </Text>
        </View>
      )}

      {/* Messages Area */}
      <ScrollView
        ref={messagesEndRef}
        style={[styles.messagesArea, { backgroundColor: waBg }]}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Loading */}
        {loading && (
          <View style={styles.centerContent}>
            <Text style={{ fontSize: 28 }}>⏳</Text>
            <Text
              style={[
                styles.centerText,
                { color: theme?.textMuted || '#9ca3af' },
              ]}
            >
              Loading WhatsApp history...
            </Text>
          </View>
        )}

        {/* Error */}
        {!loading && error && (
          <View style={styles.centerContent}>
            <Text style={{ fontSize: 28 }}>⚠️</Text>
            <Text style={[styles.centerText, { color: '#ef4444' }]}>
              {error}
            </Text>
            <TouchableOpacity
              onPress={fetchHistory}
              style={styles.tryAgainButton}
            >
              <Text style={styles.tryAgainText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Empty */}
        {!loading && !error && filtered.length === 0 && (
          <View style={styles.centerContent}>
            <Text style={{ fontSize: 32 }}>💬</Text>
            <Text
              style={[
                styles.centerText,
                { color: theme?.textMuted || '#9ca3af' },
              ]}
            >
              No{' '}
              {filter === 'chats'
                ? 'messages'
                : filter === 'calls'
                ? 'calls'
                : 'conversations'}{' '}
              found
            </Text>
            <Text
              style={[
                styles.centerSubtext,
                { color: theme?.textMuted || '#9ca3af' },
              ]}
            >
              WhatsApp conversations with this lead will appear here
            </Text>
          </View>
        )}

        {/* Messages with Dividers */}
        {!loading &&
          !error &&
          withDividers.map(item => {
            // Date Divider
            if (item._isDivider) {
              return (
                <View key={item.key} style={styles.dateDivider}>
                  <View
                    style={[
                      styles.dateDividerBadge,
                      {
                        backgroundColor: isDark
                          ? 'rgba(0,0,0,0.45)'
                          : 'rgba(255,255,255,0.75)',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dateDividerText,
                        { color: isDark ? '#aaa' : '#5D6D7E' },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </View>
                </View>
              );
            }

            // Call Card
            if (item.type === 'call') {
              return renderCallCard(item);
            }

            // Chat Bubble
            return (
              <TouchableOpacity
                key={item._id}
                activeOpacity={0.9}
                onLongPress={() =>
                  setShowActionsId(showActionsId === item._id ? null : item._id)
                }
              >
                {renderMessageBubble(item)}
              </TouchableOpacity>
            );
          })}
      </ScrollView>

      {/* Input Bar */}
      <View
        style={[
          styles.inputBar,
          {
            backgroundColor: filterBg,
            borderTopColor: theme?.border || '#e5e7eb',
          },
        ]}
      >
        <TextInput
          value={newMsg}
          onChangeText={setNewMsg}
          placeholder="Type a message... (Enter to send)"
          multiline
          maxLength={1000}
          style={[
            styles.messageInput,
            {
              backgroundColor: inputBg,
              color: inputColor,
            },
          ]}
        />
        <TouchableOpacity
          onPress={handleSend}
          disabled={sending || !newMsg.trim()}
          style={[
            styles.sendButton,
            {
              backgroundColor: sending || !newMsg.trim() ? '#aaa' : '#25D366',
            },
          ]}
        >
          <Text style={styles.sendButtonIcon}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

// =============================================
// STYLES
// =============================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    flexShrink: 0,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '400',
  },
  seeHistoryButton: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  seeHistoryText: {
    fontSize: 13,
  },
  refreshButton: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  fallbackNotice: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  messagesArea: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  centerContent: {
    alignItems: 'center',
    paddingTop: 24,
  },
  centerText: {
    fontSize: 13,
    marginTop: 8,
  },
  centerSubtext: {
    fontSize: 11,
    marginTop: 6,
  },
  tryAgainButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#6366f1',
    borderRadius: 6,
  },
  tryAgainText: {
    fontSize: 12,
    color: '#fff',
  },
  dateDivider: {
    alignItems: 'center',
    marginVertical: 4,
  },
  dateDividerBadge: {
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 3,
  },
  dateDividerText: {
    fontSize: 11,
  },
  callCardContainer: {
    alignItems: 'center',
  },
  callCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 230,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  callEmoji: {
    fontSize: 20,
  },
  callInfo: {
    flex: 1,
  },
  callLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  callTime: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 1,
  },
  callDuration: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
  bubbleContainer: {
    marginVertical: 2,
  },
  bubbleSent: {
    alignItems: 'flex-end',
  },
  bubbleReceived: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '72%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  actionsOverlay: {
    position: 'absolute',
    top: -30,
    right: 0,
    flexDirection: 'row',
    gap: 4,
    zIndex: 2,
  },
  actionButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  actionIcon: {
    fontSize: 14,
  },
  attachment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  attachmentText: {
    fontSize: 12,
    fontWeight: '600',
  },
  bubbleText: {
    fontSize: 13,
    lineHeight: 20,
  },
  editInput: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    minHeight: 70,
    marginBottom: 6,
    textAlignVertical: 'top',
  },
  editActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  saveButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#10b981',
    borderRadius: 6,
  },
  saveButtonText: {
    fontSize: 11,
    color: '#fff',
  },
  cancelButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 6,
  },
  cancelButtonText: {
    fontSize: 11,
    color: '#111',
  },
  bubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    marginTop: 4,
  },
  bubbleSender: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8696A0',
  },
  bubbleTime: {
    fontSize: 11,
    color: '#8696A0',
  },
  tick: {
    fontSize: 11,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    flexShrink: 0,
  },
  messageInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 13,
    maxHeight: 100,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonIcon: {
    fontSize: 18,
    color: '#fff',
  },
});

export default WhatsappTab;
