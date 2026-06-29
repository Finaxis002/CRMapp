import React, { useEffect, useRef } from 'react';
import { View, Animated, ScrollView, StyleSheet } from 'react-native';

const KanbanSkeleton = ({ colors }) => {
  // Fallback to light theme if colors not provided
  const theme = colors || {
    screenBg: '#f9fafb',
    headerBg: '#ffffff',
    headerBorder: '#e5e7eb',
    cardBg: '#ffffff',
    cardBorder: '#f1f5f9',
    tabBg: '#ffffff',
    tabBorder: '#e5e7eb',
    textColor: '#e5e7eb',      // for placeholder lines
  };

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
          backgroundColor: theme.textColor,  
          borderRadius: 6,
          opacity: fadeAnim,
        },
        style,
      ]}
    />
  );

  const StageTabSkeleton = () => (
    <View
      style={[
        styles.tabSkeleton,
        {
          backgroundColor: theme.tabBg,
          borderColor: theme.tabBorder,
        },
      ]}
    >
      <SkeletonBox width={70} height={14} />
      <SkeletonBox
        width={22}
        height={14}
        style={{ marginLeft: 6, borderRadius: 999 }}
      />
    </View>
  );

  const LeadCardSkeleton = () => (
    <View
      style={[
        styles.cardSkeleton,
        {
          backgroundColor: theme.cardBg,
          borderColor: theme.cardBorder,
        },
      ]}
    >
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
    <View style={[styles.container, { backgroundColor: theme.screenBg }]}>
      {/* Header Skeleton */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.headerBg,
            borderBottomColor: theme.headerBorder,
          },
        ]}
      >
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
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    marginHorizontal: -16, // to align with screen edges
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tabsScroll: {
    marginTop: 12,
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  tabSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
  },
  cardsContainer: {
    marginTop: 12,
    gap: 10,
  },
  cardSkeleton: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
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