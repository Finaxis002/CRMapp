import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useUISystem } from '../../hooks/useUISystem';
import ImprovedButton from './ImprovedButton';

export default function FormModal({
  visible,
  onClose,
  title,
  subtitle,
  children,
  onSubmit,
  submitLabel = 'Save',
  onCancel,
  cancelLabel = 'Cancel',
  isLoading = false,
  showFooter = true,
  fullScreen = false,
}) {
  const { colors, typography, spacing, borderRadius, elevation } = useUISystem();

  const handleCancel = () => {
    if (onCancel) onCancel();
    else onClose?.();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={!fullScreen}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View
        style={[
          styles.overlay,
          { backgroundColor: fullScreen ? colors.background : colors.overlay },
        ]}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.kav}
        >
          <View
            style={[
              styles.sheet,
              elevation.xl,
              {
                backgroundColor: colors.surface,
                borderTopLeftRadius: fullScreen ? 0 : borderRadius['2xl'],
                borderTopRightRadius: fullScreen ? 0 : borderRadius['2xl'],
                maxHeight: fullScreen ? '100%' : '92%',
                flex: fullScreen ? 1 : undefined,
              },
            ]}
          >
            <View
              style={[
                styles.header,
                {
                  borderBottomColor: colors.border,
                  paddingHorizontal: spacing.lg,
                  paddingTop: spacing.lg,
                  paddingBottom: spacing.md,
                },
              ]}
            >
              <View style={styles.headerText}>
                {!!title && (
                  <Text
                    style={[typography.h3, { color: colors.textPrimary }]}
                    numberOfLines={1}
                  >
                    {title}
                  </Text>
                )}
                {!!subtitle && (
                  <Text
                    style={[
                      typography.body2,
                      { color: colors.textSecondary, marginTop: 4 },
                    ]}
                    numberOfLines={2}
                  >
                    {subtitle}
                  </Text>
                )}
              </View>
              <Pressable
                onPress={onClose}
                hitSlop={10}
                style={[
                  styles.close,
                  {
                    backgroundColor: colors.backgroundSecondary,
                    borderRadius: borderRadius.full,
                  },
                ]}
              >
                <Icon name="close" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={{
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.lg,
                paddingBottom: spacing['2xl'],
              }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>

            {showFooter && (
              <View
                style={[
                  styles.footer,
                  {
                    borderTopColor: colors.border,
                    padding: spacing.lg,
                    gap: spacing.sm,
                    backgroundColor: colors.surface,
                  },
                ]}
              >
                <ImprovedButton
                  title={submitLabel}
                  onPress={onSubmit}
                  variant="primary"
                  size="large"
                  fullWidth
                  loading={isLoading}
                  disabled={isLoading}
                />
                <ImprovedButton
                  title={cancelLabel}
                  onPress={handleCancel}
                  variant="secondary"
                  size="medium"
                  fullWidth
                  disabled={isLoading}
                />
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  kav: { width: '100%', maxHeight: '100%' },
  sheet: { width: '100%', overflow: 'hidden' },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerText: { flex: 1, paddingRight: 12 },
  close: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { borderTopWidth: StyleSheet.hairlineWidth },
});
