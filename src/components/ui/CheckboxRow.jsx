/**
 * CheckboxRow — multi-select service / option rows
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useUISystem } from '../../hooks/useUISystem';

export default function CheckboxRow({
  label,
  checked = false,
  onPress,
  style,
  disabled = false,
}) {
  const { colors, typography, borderRadius } = useUISystem();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.row,
        {
          borderColor: checked ? colors.primary : colors.borderSolid,
          borderWidth: checked ? 1.5 : 1,
          backgroundColor: checked ? colors.primarySoft : 'transparent',
          borderRadius: borderRadius.md,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.box,
          {
            borderColor: checked ? colors.primary : colors.borderSolid,
            backgroundColor: checked ? colors.primary : 'transparent',
            borderRadius: 5,
          },
        ]}
      >
        {checked ? <Icon name="check" size={11} color="#fff" /> : null}
      </View>
      <Text style={[typography.body2, { color: colors.textPrimary, fontWeight: '500', fontSize: 13 }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  box: {
    width: 18,
    height: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
