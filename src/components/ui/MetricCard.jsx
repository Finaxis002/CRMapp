/**
 * MetricCard — dashboard KPI tile
 * color: blue | yellow | green | purple | cyan
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View, Dimensions } from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { useUISystem } from '../../hooks/useUISystem';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HALF = (SCREEN_WIDTH - 16 * 2 - 8) / 2;

const COLOR_MAP = {
  blue: { accent: 'primary', soft: 'primarySoft' },
  yellow: { accent: 'warning', soft: 'warningSoft' },
  green: { accent: 'success', soft: 'successSoft' },
  purple: { accent: 'purple', soft: 'purpleSoft' },
  cyan: { accent: 'cyan', soft: 'cyanSoft' },
};

export default function MetricCard({
  label,
  value,
  icon = 'users',
  color = 'blue',
  onPress,
  fullWidth = false,
  style,
}) {
  const { colors, typography, borderRadius, elevation } = useUISystem();
  const map = COLOR_MAP[color] || COLOR_MAP.blue;
  const top = colors[map.accent];
  const soft = colors[map.soft];

  const content = (
    <>
      <View style={[styles.icon, { backgroundColor: soft, borderRadius: borderRadius.md }]}>
        <Feather name={icon} size={18} color={top} />
      </View>
      <Text style={[typography.overline, { color: colors.textSecondary, marginTop: 8, marginBottom: 8 }]}>
        {label}
      </Text>
      <Text
        style={[
          typography.h2,
          {
            color: colors.textPrimary,
            fontSize: label === 'Collected' ? 22 : 26,
            lineHeight: 30,
          },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </>
  );

  const baseStyle = [
    styles.card,
    elevation.xs,
    {
      width: fullWidth ? '100%' : HALF,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderTopColor: top,
      borderRadius: borderRadius.xl,
    },
    fullWidth && { marginBottom: 12 },
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [...baseStyle, { opacity: pressed ? 0.9 : 1 }]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={baseStyle}>{content}</View>;
}

const styles = StyleSheet.create({
  card: {
    padding: 12,
    borderWidth: 1,
    borderTopWidth: 3,
    minHeight: 110,
  },
  icon: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
