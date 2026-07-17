/**
 * IconButton — circular / rounded icon press target (Topbar, cards)
 */

import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useUISystem } from '../../hooks/useUISystem';

export default function IconButton({
  name,
  onPress,
  size = 22,
  color,
  backgroundColor,
  hitSlop = 10,
  style,
  disabled = false,
}) {
  const { colors, borderRadius } = useUISystem();
  const iconColor = color || colors.textSecondary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlop}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: backgroundColor || 'transparent',
          borderRadius: borderRadius.md,
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      <Icon name={name} size={size} color={iconColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
