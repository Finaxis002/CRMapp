/**
 * ImprovedButton — theme-aware
 * variants: primary | secondary | outline | danger | ghost
 */

import React, { useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useUISystem } from '../../hooks/useUISystem';

const SIZE_STYLES = {
  small: { height: 32, padH: 12, fontSize: 13, radius: 8, icon: 16 },
  medium: { height: 44, padH: 18, fontSize: 15, radius: 10, icon: 18 },
  large: { height: 52, padH: 22, fontSize: 16, radius: 12, icon: 20 },
};

export default function ImprovedButton({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled = false,
  fullWidth = false,
  icon,
  iconPosition = 'left',
  style,
  textStyle,
  ...rest
}) {
  const { colors, typography } = useUISystem();
  const scale = useRef(new Animated.Value(1)).current;
  const isDisabled = disabled || loading;
  const sizeCfg = SIZE_STYLES[size] || SIZE_STYLES.medium;

  const palette =
    {
      primary: {
        bg: colors.primary,
        text: colors.textInverse,
        border: colors.primary,
        spinner: colors.textInverse,
      },
      secondary: {
        bg: colors.backgroundSecondary,
        text: colors.textPrimary,
        border: colors.backgroundSecondary,
        spinner: colors.textPrimary,
      },
      outline: {
        bg: 'transparent',
        text: colors.textPrimary,
        border: colors.border,
        spinner: colors.textPrimary,
      },
      danger: {
        bg: colors.danger,
        text: colors.textInverse,
        border: colors.danger,
        spinner: colors.textInverse,
      },
      ghost: {
        bg: 'transparent',
        text: colors.primary,
        border: 'transparent',
        spinner: colors.primary,
      },
    }[variant] || {
      bg: colors.primary,
      text: colors.textInverse,
      border: colors.primary,
      spinner: colors.textInverse,
    };

  const iconNode =
    typeof icon === 'string' ? (
      <Icon name={icon} size={sizeCfg.icon} color={palette.text} />
    ) : (
      icon
    );

  return (
    <Animated.View
      style={[fullWidth && { width: '100%' }, { transform: [{ scale }] }, style]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() =>
          Animated.spring(scale, {
            toValue: 0.97,
            useNativeDriver: true,
            friction: 6,
            tension: 120,
          }).start()
        }
        onPressOut={() =>
          Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            friction: 6,
            tension: 120,
          }).start()
        }
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        style={[
          styles.btn,
          {
            height: sizeCfg.height,
            paddingHorizontal: sizeCfg.padH,
            borderRadius: sizeCfg.radius,
            backgroundColor: palette.bg,
            borderWidth: variant === 'outline' ? 1.5 : 0,
            borderColor: palette.border,
            opacity: isDisabled ? 0.55 : 1,
          },
        ]}
        {...rest}
      >
        {loading ? (
          <ActivityIndicator color={palette.spinner} size="small" />
        ) : (
          <View style={styles.content}>
            {iconNode && iconPosition === 'left' ? (
              <View style={styles.iconLeft}>{iconNode}</View>
            ) : null}
            <Text
              style={[
                typography.button,
                { fontSize: sizeCfg.fontSize, color: palette.text },
                textStyle,
              ]}
              numberOfLines={1}
            >
              {title}
            </Text>
            {iconNode && iconPosition === 'right' ? (
              <View style={styles.iconRight}>{iconNode}</View>
            ) : null}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  iconLeft: { marginRight: 8 },
  iconRight: { marginLeft: 8 },
});
