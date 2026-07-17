import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useUISystem } from '../../hooks/useUISystem';

const PADDING = { small: 12, medium: 16, large: 20 };

export default function ImprovedCard({
  children,
  variant = 'elevated',
  padding = 'medium',
  pressable = false,
  onPress,
  disabled = false,
  borderRadius: radiusKey = 'lg',
  style,
  ...rest
}) {
  const { colors, borderRadius, elevation } = useUISystem();
  const scale = useRef(new Animated.Value(1)).current;
  const isPressable = pressable || typeof onPress === 'function';
  const pad = PADDING[padding] ?? PADDING.medium;
  const radius = borderRadius[radiusKey] ?? borderRadius.lg;

  const variantStyle = (() => {
    switch (variant) {
      case 'flat':
      case 'default':
        return { backgroundColor: colors.surface, borderWidth: 0, ...elevation.xs };
      case 'outline':
      case 'bordered':
        return {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          ...elevation.none,
        };
      case 'ghost':
        return {
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.borderLight,
          ...elevation.none,
        };
      case 'elevated':
      default:
        return { backgroundColor: colors.surface, borderWidth: 0, ...elevation.md };
    }
  })();

  const content = (
    <View
      style={[
        styles.card,
        variantStyle,
        {
          padding: pad,
          borderRadius: radius,
          opacity: disabled ? 0.6 : 1,
        },
        style,
      ]}
      {...(!isPressable ? rest : {})}
    >
      {children}
    </View>
  );

  if (!isPressable) return content;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        onPressIn={() =>
          Animated.spring(scale, {
            toValue: 0.98,
            useNativeDriver: true,
            friction: 7,
          }).start()
        }
        onPressOut={() =>
          Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            friction: 7,
          }).start()
        }
        {...rest}
      >
        {content}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
});
