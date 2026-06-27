import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import Toast from "react-native-toast-message";
import { useTheme } from "../../contexts/ThemeContext";

import {
  fetchAllNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../../services/notificationService";

const LIMIT = 15;

// ─── Helpers ────────────────────────────────────────────────────────────────

const parseNotificationData = (result) => {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result.data)) return result.data;
  if (Array.isArray(result?.data?.data)) return result.data.data;
  if (Array.isArray(result.notifications)) return result.notifications;
  return [];
};

const getTotal = (result) =>
  result?.data?.pagination?.total ||
  result?.pagination?.total ||
  result?.data?.total ||
  result?.total ||
  0;

const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  if (diffMins < 1) return "Abhi";
  if (diffMins < 60) return `${diffMins} min pehle`;
  if (diffHours < 24) return `${diffHours} ghante pehle`;
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// ─── Theme Colors ────────────────────────────────────────────────────────────

const getColors = (isDark) => ({
  // Backgrounds
  screen:        isDark ? "#0f172a" : "#f1f5f9",
  card:          isDark ? "#1e293b" : "#ffffff",
  cardUnread:    isDark ? "#172554" : "#eff6ff",
  header:        isDark ? "#0f172a" : "#f1f5f9",

  // Borders
  cardBorder:        isDark ? "#334155" : "#e2e8f0",
  cardBorderUnread:  isDark ? "#1e40af" : "#bfdbfe",

  // Text
  title:         isDark ? "#f8fafc" : "#0f172a",
  subtitle:      isDark ? "#94a3b8" : "#64748b",
  cardTitle:     isDark ? "#f1f5f9" : "#0f172a",
  cardMessage:   isDark ? "#93c5fd" : "#3b82f6",
  cardMessageRead: isDark ? "#94a3b8" : "#64748b",
  cardTime:      isDark ? "#475569" : "#94a3b8",

  // Buttons
  refreshBtnBg:    isDark ? "#1e293b" : "#ffffff",
  refreshBtnBorder: isDark ? "#334155" : "#e2e8f0",
  refreshBtnText:  isDark ? "#cbd5e1" : "#334155",
  markAllBtnBg:    "#2563eb",
  markAllBtnText:  "#ffffff",

  // Mark read button
  markBtnUnreadBg: "#2563eb",
  markBtnReadBg:   isDark ? "#1e293b" : "#f8fafc",
  markBtnReadBorder: isDark ? "#334155" : "#e2e8f0",
  markBtnText:     "#ffffff",
  markBtnTextRead: isDark ? "#64748b" : "#94a3b8",

  // Accent bar
  accentBar:     "#3b82f6",

  // View more
  viewMoreBg:    isDark ? "#1e293b" : "#ffffff",
  viewMoreBorder: isDark ? "#334155" : "#e2e8f0",
  viewMoreText:  isDark ? "#94a3b8" : "#64748b",

  // States
  loadingText:   isDark ? "#94a3b8" : "#64748b",
  emptyTitle:    isDark ? "#94a3b8" : "#475569",
  emptySubtitle: isDark ? "#475569" : "#94a3b8",
  errorTitle:    "#f87171",
  errorSubtitle: "#ef4444",
  spinnerColor:  "#3b82f6",
});

// ─── Notification Card ───────────────────────────────────────────────────────

const NotificationCard = React.memo(({ item, onMarkRead, processing, colors }) => {
  const isRead = item.isRead;

  return (
    <View style={[
      styles.card,
      {
        backgroundColor: isRead ? colors.card : colors.cardUnread,
        borderColor: isRead ? colors.cardBorder : colors.cardBorderUnread,
      },
    ]}>
      {!isRead && <View style={[styles.accentBar, { backgroundColor: colors.accentBar }]} />}

      <View style={styles.cardInner}>
        <View style={styles.cardContent}>
          <Text style={[styles.cardTitle, { color: colors.cardTitle }]}>
            {item.title || "Notification"}
          </Text>
          <Text style={[styles.cardMessage, {
            color: isRead ? colors.cardMessageRead : colors.cardMessage,
          }]}>
            {item.message || "No details available."}
          </Text>
          <Text style={[styles.cardTime, { color: colors.cardTime }]}>
            {formatDate(item.createdAt)}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.markBtn,
            isRead
              ? { backgroundColor: colors.markBtnReadBg, borderColor: colors.markBtnReadBorder, borderWidth: 1 }
              : { backgroundColor: colors.markBtnUnreadBg },
          ]}
          onPress={() => onMarkRead(item._id)}
          disabled={isRead || processing}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.markBtnText,
            { color: isRead ? colors.markBtnTextRead : colors.markBtnText },
          ]}>
            {isRead ? "✓ Read" : "Mark read"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

const NotificationsScreen = () => {
  const navigation = useNavigation();
  const { isDark } = useTheme();
  const colors = getColors(isDark);

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadNotifications(true);
  }, []);

const loadNotifications = useCallback(async (reset = true) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);
    setError(null);

    try {
      const nextPage = reset ? 1 : page + 1;
      if (!reset && loadingMore) return;
      const result = await fetchAllNotifications(nextPage, LIMIT);
      const data = parseNotificationData(result);
      const total = getTotal(result);

      if (reset) {
        setNotifications(data);
        setPage(1);
      } else {
        setNotifications((prev) => {
          const existing = new Set(prev.map((n) => n._id));
          const fresh = data.filter((n) => !existing.has(n._id));
          return [...prev, ...fresh];
        });
        setPage(nextPage);
      }

      const loadedCount = reset ? data.length : notifications.length + data.length;
      setHasMore(total > 0 ? loadedCount < total : data.length >= LIMIT);
    } catch (err) {
      setError(err?.response?.data?.message || "Notifications load nahi ho sake.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [page, notifications.length, loadingMore]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadNotifications(true);
  }, []);

  const handleMarkRead = useCallback(async (notificationId) => {
    setProcessing(true);
    try {
      await markNotificationRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n._id === notificationId ? { ...n, isRead: true } : n))
      );
      Toast.show({ type: "success", text1: "Notification read mark ho gayi." });
    } catch (err) {
      Toast.show({
        type: "error",
        text1: err?.response?.data?.message || "Mark read fail ho gaya.",
      });
    } finally {
      setProcessing(false);
    }
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    if (notifications.length === 0) return;
    setProcessing(true);
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      Toast.show({ type: "success", text1: "Saari notifications read mark ho gayi." });
    } catch (err) {
      Toast.show({
        type: "error",
        text1: err?.response?.data?.message || "Mark all read fail ho gaya.",
      });
    } finally {
      setProcessing(false);
    }
  }, [notifications.length]);

  const renderItem = useCallback(
    ({ item }) => (
      <NotificationCard
        item={item}
        onMarkRead={handleMarkRead}
        processing={processing}
        colors={colors}
      />
    ),
    [handleMarkRead, processing, colors]
  );

  const keyExtractor = useCallback((item) => item._id, []);

  const ListEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.emptyTitle, { color: colors.emptyTitle }]}>Koi notification nahi.</Text>
      <Text style={[styles.emptySubtitle, { color: colors.emptySubtitle }]}>Aap bilkul up-to-date hain!</Text>
      <TouchableOpacity
        style={styles.dashboardBtn}
        onPress={() => navigation.navigate("Dashboard")}
        activeOpacity={0.8}
      >
        <Text style={styles.dashboardBtnText}>Dashboard par jao</Text>
      </TouchableOpacity>
    </View>
  );

  const ListError = () => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.errorTitle, { color: colors.errorTitle }]}>Notifications nahi load ho sake</Text>
      <Text style={[styles.errorSubtitle, { color: colors.errorSubtitle }]}>{error}</Text>
      <TouchableOpacity
        style={styles.dashboardBtn}
        onPress={() => loadNotifications(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.dashboardBtnText}>Dobara try karo</Text>
      </TouchableOpacity>
    </View>
  );

const ListFooter = () => {
    if (!hasMore) return null;
    return (
      <View style={styles.viewMoreBtn}>
        <ActivityIndicator size="small" color={colors.spinnerColor} />
      </View>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.screen }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.header }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.title }]}>Notifications</Text>
          <Text style={[styles.headerSubtitle, { color: colors.subtitle }]}>
            Saari notifications ek jagah dekhein aur manage karein.
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.refreshBtn, {
              backgroundColor: colors.refreshBtnBg,
              borderColor: colors.refreshBtnBorder,
            }]}
            onPress={handleRefresh}
            disabled={loading || processing}
            activeOpacity={0.7}
          >
            <Text style={[styles.refreshBtnText, { color: colors.refreshBtnText }]}>Refresh</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.markAllBtn,
              { backgroundColor: colors.markAllBtnBg },
              (loading || processing || notifications.length === 0) && styles.btnDisabled,
            ]}
            onPress={handleMarkAllRead}
            disabled={loading || processing || notifications.length === 0}
            activeOpacity={0.8}
          >
            <Text style={[styles.markAllBtnText, { color: colors.markAllBtnText }]}>Mark all read</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.spinnerColor} />
          <Text style={[styles.loadingText, { color: colors.loadingText }]}>
            Notifications load ho rahi hain...
          </Text>
        </View>
      ) : error ? (
        <ListError />
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={[
            styles.list,
            notifications.length === 0 && styles.listEmpty,
          ]}
          ListEmptyComponent={<ListEmpty />}
          ListFooterComponent={<ListFooter />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.spinnerColor}
              colors={[colors.spinnerColor]}
            />
          }
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          onEndReached={() => {
            if (hasMore && !loadingMore && !loading) {
              loadNotifications(false);
            }
          }}
          onEndReachedThreshold={0.3}
        />
      )}
    </View>
  );
};

// ─── Static Styles (no colors here) ─────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    gap: 10,
  },
  refreshBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  refreshBtnText: {
    fontSize: 13,
    fontWeight: "500",
  },
  markAllBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
  },
  markAllBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  btnDisabled: { opacity: 0.4 },
  list: {
    paddingHorizontal: 12,
    paddingBottom: 32,
  },
  listEmpty: {
    flex: 1,
    justifyContent: "center",
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    flexDirection: "row",
  },
  accentBar: { width: 5 },
  cardInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: 14,
    gap: 10,
  },
  cardContent: { flex: 1 },
  cardTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  cardMessage: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  cardTime: {
    fontSize: 11,
    marginTop: 8,
  },
  markBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: "flex-start",
    marginTop: 2,
  },
  markBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
viewMoreBtn: {
    marginTop: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  viewMoreText: {
    fontSize: 13,
    fontWeight: "500",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: { fontSize: 14 },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  emptySubtitle: { fontSize: 13 },
  errorTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  errorSubtitle: {
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 30,
  },
  dashboardBtn: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#2563eb",
  },
  dashboardBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default NotificationsScreen;