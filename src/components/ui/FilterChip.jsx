/**
 * FilterChip — dashboard date filters, stage tabs, activity type pills
 * <FilterChip label="Today" active={active} onPress={...} />
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useUISystem } from '../../hooks/useUISystem';

export default function FilterChip({
  label,
  active = false,
  onPress,
  icon,
  showDot = false,
  color, // optional override accent when active (hex)
  style,
  textStyle,
  disabled = false,
}) {
  const { colors, typography, borderRadius } = useUISystem();
  const activeBg = color || colors.primary;
  const activeText = colors.textInverse;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.chip,
        {
          borderRadius: borderRadius.lg,
          borderColor: colors.border,
          backgroundColor: active ? activeBg : colors.surface,
          opacity: disabled ? 0.5 : pressed ? 0.88 : 1,
          borderWidth: active ? 0 : 1,
        },
        style,
      ]}
    >
      {!!icon && (
        <Icon
          name={icon}
          size={14}
          color={active ? activeText : colors.textSecondary}
          style={{ marginRight: 6 }}
        />
      )}
      <Text
        style={[
          typography.label,
          {
            color: active ? activeText : colors.textSecondary,
            fontWeight: active ? '600' : '500',
            fontSize: 13,
          },
          textStyle,
        ]}
      >
        {label}
      </Text>
      {showDot ? (
        <View
          style={[
            styles.dot,
            {
              backgroundColor: colors.success,
              borderColor: active ? activeBg : colors.surface,
            },
          ]}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    position: 'relative',
  },
  dot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 999,
    borderWidth: 2,
  },
});
