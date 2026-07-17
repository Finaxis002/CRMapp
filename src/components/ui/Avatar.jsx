/**
 * Avatar — initials circle / rounded square
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useUISystem } from '../../hooks/useUISystem';

const getInitials = (name = '') =>
  name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();

export default function Avatar({
  name = '',
  size = 40,
  rounded = 12,
  variant = 'soft', // soft | solid
  style,
  textStyle,
}) {
  const { colors, typography } = useUISystem();
  const bg = variant === 'solid' ? colors.primary : colors.primarySoft;
  const fg = variant === 'solid' ? colors.textInverse : colors.primary;
  const fontSize = Math.max(10, Math.round(size * 0.35));

  return (
    <View
      style={[
        styles.box,
        {
          width: size,
          height: size,
          borderRadius: rounded,
          backgroundColor: bg,
          borderWidth: variant === 'soft' ? 1 : 0,
          borderColor: colors.primaryBorder,
        },
        style,
      ]}
    >
      <Text
        style={[
          typography.label,
          { color: fg, fontSize, fontWeight: '700' },
          textStyle,
        ]}
      >
        {getInitials(name) || '?'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
