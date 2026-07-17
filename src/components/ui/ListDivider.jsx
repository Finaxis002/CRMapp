/**
 * ListDivider — thin separator between list rows
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useUISystem } from '../../hooks/useUISystem';

export default function ListDivider({ style, inset = 0 }) {
  const { colors } = useUISystem();
  return (
    <View
      style={[
        styles.line,
        {
          backgroundColor: colors.border,
          marginLeft: inset,
          opacity: 0.6,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  line: {
    height: StyleSheet.hairlineWidth * 2 || 1,
  },
});
