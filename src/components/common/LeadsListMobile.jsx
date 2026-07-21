import React, { useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import LeadCardMobile from './LeadCardMobile.jsx';
import { useUISystem } from '../../hooks/useUISystem';
import EmptyState from '../ui/EmptyState';

const LeadsListMobile = ({
  leads,
  loading,
  refreshing = false,
  onRefresh,
  onLoadMore,
  loadingMore = false,
  hasMore = false,
  resetScrollSignal = 0,
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
  const { colors, borderRadius } = useUISystem();
  const listRef = useRef(null);
  // Ek scroll gesture mein onEndReached sirf ek baar fire ho (double-load rokne ke liye)
  const endReachedLock = useRef(false);

  // Manual page jump / filter change / refresh → list top pe scroll
  useEffect(() => {
    if (resetScrollSignal > 0) {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    }
  }, [resetScrollSignal]);

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

  const keyExtractor = useCallback(item => String(item._id), []);

  const handleEndReached = useCallback(() => {
    if (endReachedLock.current) return;
    endReachedLock.current = true;
    if (onLoadMore && hasMore && !loadingMore && !loading) {
      onLoadMore();
    }
  }, [onLoadMore, hasMore, loadingMore, loading]);

  const handleMomentumScrollBegin = useCallback(() => {
    endReachedLock.current = false;
  }, []);

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

  const renderFooter = () => {
    if (loadingMore) {
      return (
        <View style={styles.footerLoading}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            Loading more leads…
          </Text>
        </View>
      );
    }
    if (!hasMore) {
      return (
        <View style={styles.footerEnd}>
          <Text style={[styles.footerEndText, { color: colors.textTertiary }]}>
            All leads loaded
          </Text>
        </View>
      );
    }
    return <View style={styles.footerSpacer} />;
  };

  const renderCard = ({ item }) => (
    <LeadCardMobile
      lead={item}
      selected={selectedIds?.has(item._id)}
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
  );

  return (
    <FlatList
      ref={listRef}
      data={leads}
      renderItem={renderCard}
      keyExtractor={keyExtractor}
      contentContainerStyle={styles.listContainer}
      refreshControl={refreshControl}
      showsVerticalScrollIndicator={false}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.4}
      onMomentumScrollBegin={handleMomentumScrollBegin}
      ListFooterComponent={renderFooter}
      initialNumToRender={8}
      maxToRenderPerBatch={10}
      updateCellsBatchingPeriod={50}
      windowSize={7}
      removeClippedSubviews
    />
  );
};

const styles = StyleSheet.create({
  listContainer: { padding: 10 },
  footerLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  footerText: { fontSize: 12, fontWeight: '500' },
  footerEnd: { alignItems: 'center', paddingVertical: 10 },
  footerEndText: { fontSize: 11, fontWeight: '500', letterSpacing: 0.3 },
  footerSpacer: { height: 4 },
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
