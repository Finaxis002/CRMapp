import React, { useEffect, useRef } from 'react';
import { View, Animated, ScrollView, StyleSheet } from 'react-native';

const KanbanSkeleton = () => {
  const fadeAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0.9,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  const SkeletonBox = ({ width, height, style }) => (
    <Animated.View
      style={[
        {
          width,
          height,
          backgroundColor: '#e5e7eb',
          borderRadius: 6,
          opacity: fadeAnim,
        },
        style,
      ]}
    />
  );

  // Stage tab skeleton
  const StageTabSkeleton = () => (
    <View style={styles.tabSkeleton}>
      <SkeletonBox width={70} height={14} />
      <SkeletonBox
        width={22}
        height={14}
        style={{ marginLeft: 6, borderRadius: 999 }}
      />
    </View>
  );

  // Lead card skeleton
  const LeadCardSkeleton = () => (
    <View style={styles.cardSkeleton}>
      <View style={styles.cardTopRow}>
        <SkeletonBox width="65%" height={16} />
        <SkeletonBox width={60} height={14} />
      </View>

      <SkeletonBox width="45%" height={13} style={{ marginTop: 6 }} />

      <View style={styles.cardBottomRow}>
        <SkeletonBox width="40%" height={12} />
        <SkeletonBox width={55} height={18} style={{ borderRadius: 999 }} />
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header Skeleton */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <SkeletonBox width={90} height={20} />
            <SkeletonBox width={130} height={12} style={{ marginTop: 4 }} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <SkeletonBox width={40} height={40} style={{ borderRadius: 12 }} />
            <SkeletonBox width={70} height={40} style={{ borderRadius: 12 }} />
          </View>
        </View>

        {/* User Filter Skeleton */}
        <SkeletonBox
          width="100%"
          height={36}
          style={{ marginTop: 12, borderRadius: 10 }}
        />
      </View>

      {/* Stage Tabs Skeleton */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScroll}
      >
        {[1, 2, 3, 4, 5].map(i => (
          <StageTabSkeleton key={i} />
        ))}
      </ScrollView>

      {/* Lead Cards Skeleton */}
      <View style={styles.cardsContainer}>
        {[1, 2, 3, 4, 5].map(i => (
          <LeadCardSkeleton key={i} />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tabsScroll: {
    paddingHorizontal: 16,
    marginTop: 12,
  },
  tabSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    marginRight: 8,
  },
  cardsContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  cardSkeleton: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 8,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
});

export default KanbanSkeleton;
