/**
 * ConfirmDialog — delete / bulk confirm modals
 * Replaces inline DeleteModal patterns in LeadsScreen
 * Auto-closes after onConfirm completes (unless loading keeps it open).
 */

import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { useUISystem } from '../../hooks/useUISystem';
import ImprovedButton from './ImprovedButton';

export default function ConfirmDialog({
  visible,
  onClose,
  onConfirm,
  title = 'Confirm',
  message = '',
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  variant = 'danger', // danger | primary
  loading = false,
}) {
  const { colors, typography, borderRadius, elevation, spacing } =
    useUISystem();

  const handleConfirm = async () => {
    try {
      await onConfirm?.();
    } finally {
      onClose?.();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <View
          style={[
            styles.card,
            elevation.lg,
            {
              backgroundColor: colors.surface,
              borderRadius: borderRadius['2xl'],
              padding: spacing.xl,
            },
          ]}
        >
          <Text
            style={[
              typography.h4,
              { color: colors.textPrimary, marginBottom: 12 },
            ]}
          >
            {title}
          </Text>
          {!!message && (
            <Text
              style={[
                typography.body2,
                {
                  color: colors.textSecondary,
                  marginBottom: 20,
                  lineHeight: 20,
                },
              ]}
            >
              {message}
            </Text>
          )}
          <View style={styles.actions}>
            <ImprovedButton
              title={cancelLabel}
              variant="outline"
              onPress={onClose}
              style={{ flex: 1 }}
              disabled={loading}
            />
            <ImprovedButton
              title={confirmLabel}
              variant={variant === 'danger' ? 'danger' : 'primary'}
              onPress={handleConfirm}
              loading={loading}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
});
