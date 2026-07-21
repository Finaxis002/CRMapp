import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import LeadCardMobile from './LeadCardMobile.jsx';
import { useUISystem } from '../../hooks/useUISystem';
import EmptyState from '../ui/EmptyState';

const LeadsListMobile = ({
  leads,
  loading,
  refreshing = false,
  onRefresh,
  selectedIds,
  onToggleSelect,
  onPreview,
  onOpenDetails,
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
  const { colors, spacing, borderRadius } = useUISystem();

  const refreshControl = onRefresh ? (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      colors={[colors.primary]}
      tintColor={colors.primary}
      progressBackgroundColor={colors.surface}
      title="Pull to refresh..."
      titleColor={colors.textSecondary}
    />
  ) : undefined;

  // ── Loading skeletons ──
  if (loading && !refreshing && (!leads || leads.length === 0)) {
    return (
      <ScrollView
        contentContainerStyle={styles.listContainer}
        refreshControl={refreshControl}
      >
        {[...Array(5)].map((_, idx) => (
          <View
            key={`m-skel-${idx}`}
            style={[
              styles.skeletonCard,
              {
                borderColor: colors.border,
                backgroundColor: colors.surface,
                borderRadius: borderRadius.lg,
              },
            ]}
          >
            <View style={styles.skeletonHeader}>
              <View
                style={[
                  styles.skeletonLine,
                  { width: 128, backgroundColor: colors.skeletonBase },
                ]}
              />
              <View
                style={[
                  styles.skeletonBadge,
                  { width: 64, backgroundColor: colors.skeletonBase },
                ]}
              />
            </View>
            <View
              style={[
                styles.skeletonLine,
                {
                  width: 96,
                  marginTop: 8,
                  backgroundColor: colors.skeletonBase,
                },
              ]}
            />
            <View style={styles.skeletonGrid}>
              <View
                style={[
                  styles.skeletonBlock,
                  { backgroundColor: colors.skeletonBase },
                ]}
              />
              <View
                style={[
                  styles.skeletonBlock,
                  { backgroundColor: colors.skeletonBase },
                ]}
              />
              <View
                style={[
                  styles.skeletonBlock,
                  { backgroundColor: colors.skeletonBase },
                ]}
              />
            </View>
            <View
              style={[
                styles.skeletonBlock,
                {
                  marginTop: 12,
                  height: 32,
                  backgroundColor: colors.skeletonBase,
                },
              ]}
            />
          </View>
        ))}
      </ScrollView>
    );
  }

  // ── Empty state ──
  if (!leads || leads.length === 0) {
    return (
      <ScrollView
        contentContainerStyle={styles.emptyContainer}
        refreshControl={refreshControl}
      >
        <EmptyState
          icon="file-document-outline"
          title="No leads found"
          message="Pull down to refresh or adjust your filters"
        />
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
          onOpenDetails={onOpenDetails}
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

const styles = StyleSheet.create({
  listContainer: { padding: 10 },
  skeletonCard: { borderWidth: 1, padding: 14, marginBottom: 8 },
  skeletonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  skeletonLine: { height: 15, borderRadius: 4 },
  skeletonBadge: { height: 18, borderRadius: 999 },
  skeletonGrid: { flexDirection: 'row', gap: 8, marginTop: 12 },
  skeletonBlock: { flex: 1, height: 32, borderRadius: 6 },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 80,
  },
});

export default LeadsListMobile;
