import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import LeadCardMobile from './LeadCardMobile.jsx';

import { useTheme } from '../../contexts/ThemeContext';

const ACCENT = '#5a7bf6';

/**
 * LeadsListMobile
 * Renders the leads as a stack of cards on mobile with pull-to-refresh.
 *
 * Props:
 *  - leads, loading
 *  - refreshing (bool)
 *  - onRefresh ()
 *  - selectedIds (Set)
 *  - onToggleSelect(id), onPreview(lead, e), onEdit(lead), onDelete(id, e)
 *  - canEditAnyLead, canDeleteLead
 *  - getStageColor, getContrastTextColor, getPriorityColor, getAssignedName, formatCurrency
 */
const LeadsListMobile = ({
  leads,
  loading,
  refreshing = false,
  onRefresh,
  selectedIds,
  onToggleSelect,
  onPreview,
  onEdit,
  onDelete,
  canEditAnyLead,
  canDeleteLead,
  getStageColor,
  getContrastTextColor,
  getPriorityColor,
  getAssignedName,
  formatCurrency,
}) => {
  const { isDark } = useTheme();
  const colors = useMemo(
    () => ({
      accent: ACCENT,
      bg: isDark ? '#0F172A' : '#F9FAFB',
      surface: isDark ? '#111827' : '#FFFFFF',
      border: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB',
      textPrimary: isDark ? '#F8FAFC' : '#111827',
      textSecondary: isDark ? '#94A3B8' : '#6B7280',
      muted: isDark ? '#CBD5E1' : '#9CA3AF',
      skeleton: isDark ? '#1f2937' : '#e5e7eb',
    }),
    [isDark],
  );

  const styles = useMemo(() => createStyles(colors), [colors]);

  const refreshControl = onRefresh ? (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      colors={[colors.accent]}
      tintColor={colors.accent}
      progressBackgroundColor={colors.surface}
      title="Pull to refresh..."
      titleColor={colors.textSecondary}
    />
  ) : undefined;

  // ── Loading skeletons (only on first load, not on pull-refresh) ──
  if (loading && !refreshing && (!leads || leads.length === 0)) {
    return (
      <ScrollView
        contentContainerStyle={styles.listContainer}
        refreshControl={refreshControl}
      >
        {[...Array(5)].map((_, idx) => (
          <View key={`m-skel-${idx}`} style={styles.skeletonCard}>
            <View style={styles.skeletonHeader}>
              <View style={[styles.skeletonLine, { width: 128 }]} />
              <View style={[styles.skeletonBadge, { width: 64 }]} />
            </View>
            <View style={[styles.skeletonLine, { width: 96, marginTop: 8 }]} />
            <View style={styles.skeletonGrid}>
              <View style={styles.skeletonBlock} />
              <View style={styles.skeletonBlock} />
              <View style={styles.skeletonBlock} />
            </View>
            <View
              style={[styles.skeletonBlock, { marginTop: 12, height: 32 }]}
            />
          </View>
        ))}
      </ScrollView>
    );
  }

  // ── Empty state (still allow pull-to-refresh) ──
  if (!leads || leads.length === 0) {
    return (
      <ScrollView
        contentContainerStyle={styles.emptyContainer}
        refreshControl={refreshControl}
      >
        <Text style={styles.emptyIcon}>📄</Text>
        <Text style={styles.emptyTitle}>No leads found</Text>
        <Text style={styles.emptySubtitle}>
          Pull down to refresh or adjust your filters
        </Text>
      </ScrollView>
    );
  }

  // ── Cards ──
  return (
    <ScrollView
      contentContainerStyle={styles.listContainer}
      refreshControl={refreshControl}
      showsVerticalScrollIndicator={false}
    >
      {leads.map(lead => (
        <LeadCardMobile
          key={lead._id}
          lead={lead}
          selected={selectedIds?.has(lead._id)}
          onToggleSelect={onToggleSelect}
          onPreview={onPreview}
          onEdit={onEdit}
          onDelete={onDelete}
          canEditAnyLead={canEditAnyLead}
          canDeleteLead={canDeleteLead}
          getStageColor={getStageColor}
          getContrastTextColor={getContrastTextColor}
          getPriorityColor={getPriorityColor}
          getAssignedName={getAssignedName}
          formatCurrency={formatCurrency}
        />
      ))}
    </ScrollView>
  );
};

const createStyles = colors =>
  StyleSheet.create({
    listContainer: { padding: 12, gap: 12 },
    skeletonCard: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 16,
      marginBottom: 12,
    },
    skeletonHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
    },
    skeletonLine: {
      height: 16,
      borderRadius: 4,
      backgroundColor: colors.skeleton,
    },
    skeletonBadge: {
      height: 20,
      borderRadius: 999,
      backgroundColor: colors.skeleton,
    },
    skeletonGrid: { flexDirection: 'row', gap: 8, marginTop: 16 },
    skeletonBlock: {
      flex: 1,
      height: 32,
      borderRadius: 6,
      backgroundColor: colors.skeleton,
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      paddingVertical: 80,
      gap: 8,
    },
    emptyIcon: { fontSize: 40, marginBottom: 4 },
    emptyTitle: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    emptySubtitle: { fontSize: 12, color: colors.muted },
  });

export default LeadsListMobile;
