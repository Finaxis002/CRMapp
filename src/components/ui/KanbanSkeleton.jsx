import React, { useEffect, useRef } from 'react';
import { Animated, ScrollView, View, StyleSheet } from 'react-native';

const columns = [
  { name: 'New', color: '#2563eb' },
  { name: 'Did Not Answered', color: '#eab308' },
  { name: 'Interested', color: '#b86e00' },
  { name: 'Details Shared', color: '#6c35de' },
  { name: 'Final Discussions', color: '#06b6d4' },
  { name: 'Success', color: '#2a7d4f' },
  { name: 'Closed', color: '#1a1a18' },
];

const withAlpha = (hex, alpha) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const KanbanSkeleton = () => {
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [fadeAnim]);

  const SkeletonBlock = ({ style }) => (
    <Animated.View
      style={[styles.skeletonBase, { opacity: fadeAnim }, style]}
    />
  );

  const SkeletonCard = () => (
    <View style={styles.card}>
      <SkeletonBlock style={styles.cardLine1} />
      <SkeletonBlock style={styles.cardLine2} />
      <View style={styles.cardTagsRow}>
        <SkeletonBlock style={styles.cardTag} />
        <SkeletonBlock style={styles.cardTag} />
      </View>
    </View>
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.columnsRow}>
        {columns.map(column => (
          <View key={column.name} style={styles.column}>
            {/* Header */}
            <View style={styles.columnHeader}>
              <View style={styles.columnHeaderTop}>
                <View style={styles.columnHeaderLeft}>
                  <View
                    style={[styles.dot, { backgroundColor: column.color }]}
                  />
                  <SkeletonBlock style={styles.headerTitle} />
                  <SkeletonBlock style={styles.headerCount} />
                </View>
              </View>
              <Animated.View
                style={[
                  styles.headerBar,
                  {
                    backgroundColor: withAlpha(column.color, 0.4),
                    opacity: fadeAnim,
                  },
                ]}
              />
            </View>

            {/* Cards */}
            <View style={styles.cardsContainer}>
              {[...Array(4)].map((_, index) => (
                <SkeletonCard key={index} />
              ))}
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 16,
  },
  columnsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  column: {
    width: 288,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  columnHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  columnHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  columnHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    height: 10,
    width: 10,
    borderRadius: 5,
  },
  headerTitle: {
    height: 16,
    width: 96,
    borderRadius: 4,
  },
  headerCount: {
    height: 24,
    width: 32,
    borderRadius: 9999,
  },
  headerBar: {
    height: 4,
    borderRadius: 9999,
  },
  cardsContainer: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
    minHeight: 200,
  },
  card: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    backgroundColor: 'rgba(255,255,255,0.7)',
    gap: 8,
  },
  cardLine1: {
    height: 16,
    width: '75%',
    borderRadius: 4,
  },
  cardLine2: {
    height: 12,
    width: '50%',
    borderRadius: 4,
  },
  cardTagsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  cardTag: {
    height: 20,
    width: 48,
    borderRadius: 9999,
  },
  skeletonBase: {
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
  },
});

export default KanbanSkeleton;
