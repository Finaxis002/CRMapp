/**
 * BottomSheet — filter / sort sheets shell
 * Header + scroll body + optional footer
 */

import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useUISystem } from '../../hooks/useUISystem';
import ImprovedButton from './ImprovedButton';

export default function BottomSheet({
  visible,
  onClose,
  title,
  children,
  footerLabel,
  onFooterPress,
  footer,
  maxHeight = '88%',
  rightHeader,
}) {
  const { colors, typography, borderRadius, spacing } = useUISystem();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderTopLeftRadius: borderRadius['3xl'] || 20,
              borderTopRightRadius: borderRadius['3xl'] || 20,
              maxHeight,
              paddingBottom: Platform.OS === 'ios' ? 30 : 16,
            },
          ]}
        >
          <View
            style={[styles.handle, { backgroundColor: colors.borderSolid || colors.border }]}
          />

          <View
            style={[
              styles.header,
              {
                borderBottomColor: colors.border,
                paddingHorizontal: spacing.lg,
              },
            ]}
          >
            <Text style={[typography.h4, { color: colors.textPrimary, flex: 1 }]}>
              {title}
            </Text>
            <View style={styles.headerRight}>
              {rightHeader}
              <Pressable onPress={onClose} hitSlop={10}>
                <Icon name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>
          </View>

          <ScrollView
            style={{ paddingHorizontal: spacing.lg }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
            <View style={{ height: 24 }} />
          </ScrollView>

          {footer
            ? footer
            : footerLabel && onFooterPress
              ? (
                <View style={{ paddingHorizontal: spacing.lg, paddingTop: 12 }}>
                  <ImprovedButton
                    title={footerLabel}
                    onPress={onFooterPress}
                    fullWidth
                    size="large"
                  />
                </View>
                )
              : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    width: '100%',
    overflow: 'hidden',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
});
