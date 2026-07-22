/**
 * MetricCard — dashboard KPI tile (compact)
 * color: blue | yellow | green | purple | cyan
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { useUISystem } from '../../hooks/useUISystem';

const HALF_WIDTH = '48.5%';

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
      <View
        style={[
          styles.icon,
          { backgroundColor: soft, borderRadius: borderRadius.md },
        ]}
      >
        <Feather name={icon} size={15} color={top} />
      </View>
      <Text
        style={[
          typography.overline,
          {
            color: colors.textSecondary,
            marginTop: 4,
            marginBottom: 5,
            marginRight: 34,
          },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          typography.h2,
          {
            color: colors.textPrimary,
            fontSize: label === 'Collected' ? 20 : 22,
            lineHeight: 26,
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
      width: fullWidth ? '100%' : HALF_WIDTH,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderTopColor: top,
      borderRadius: borderRadius.xl,
    },
    fullWidth && { marginBottom: 8 },
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderTopWidth: 3,
  },
  icon: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
