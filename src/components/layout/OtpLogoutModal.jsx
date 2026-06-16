import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const BRAND = '#5a7bf6';
const BRAND_DARK = '#4a68e0';
const OTP_LENGTH = 6;
const RESEND_WAIT = 30;

const maskEmail = email => {
  if (!email) return 'admin email';
  const [user, domain] = email.split('@');
  if (!domain) return email;
  return user.slice(0, 2) + '***@' + domain;
};

const OtpLogoutModal = ({
  visible,
  onClose,
  onConfirmed,
  adminEmail = '',
  onSendOtp,
  onVerifyOtp,
}) => {
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const [step, setStep] = useState('sending'); // sending | input | verifying | success
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(RESEND_WAIT);
  const inputRefs = useRef([]);

  useEffect(() => {
    if (!visible) return;
    setOtp(Array(OTP_LENGTH).fill(''));
    setError('');
    setStep('sending');
    setTimer(RESEND_WAIT);

    onSendOtp()
      .then(() => {
        setStep('input');
        setTimeout(() => inputRefs.current[0]?.focus(), 100);
      })
      .catch(() => {
        setError('Failed to send OTP. Please try again.');
        setStep('input');
      });
  }, [visible]);

  useEffect(() => {
    if (step !== 'input') return;
    if (timer <= 0) return;
    const id = setInterval(() => setTimer(t => t - 1), 1000);
    return () => clearInterval(id);
  }, [step, timer]);

  const handleChange = (index, val) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    if (!digit && val !== '') return;

    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    setError('');

    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (index, e) => {
    if (e.nativeEvent.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length < OTP_LENGTH) {
      setError('Please enter the complete OTP.');
      return;
    }
    setStep('verifying');
    setError('');
    try {
      const ok = await onVerifyOtp(code);
      if (ok) {
        setStep('success');
        setTimeout(async () => {
          try {
            if (typeof onConfirmed === 'function') {
              await onConfirmed();
            }
          } catch (logoutError) {
            console.error('Logout confirmation failed:', logoutError);
          }
        }, 1200);
      } else {
        setError('Invalid OTP. Please try again.');
        setStep('input');
        setOtp(Array(OTP_LENGTH).fill(''));
        setTimeout(() => inputRefs.current[0]?.focus(), 50);
      }
    } catch {
      setError('Verification failed. Please try again.');
      setStep('input');
    }
  };

  const handleResend = async () => {
    setOtp(Array(OTP_LENGTH).fill(''));
    setError('');
    setStep('sending');
    setTimer(RESEND_WAIT);
    try {
      await onSendOtp();
    } catch {
      setError('Failed to resend OTP. Please try again.');
    } finally {
      setStep('input');
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Top gradient strip */}
          <View style={styles.gradientStrip} />

          {/* Close button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="close" size={20} color="#94a3b8" />
          </TouchableOpacity>

          <View style={styles.content}>
            {/* Icon */}
            <View style={styles.iconWrap}>
              {step === 'success' ? (
                <Icon name="check-circle" size={28} color="#22c55e" />
              ) : (
                <Icon name="shield-check" size={28} color={BRAND} />
              )}
            </View>

            {/* Title */}
            <Text style={styles.title}>
              {step === 'success'
                ? 'Verified! Logging out...'
                : 'Confirm Logout'}
            </Text>
            <Text style={styles.subtitle}>
              {step === 'sending'
                ? 'Sending OTP, please wait...'
                : step === 'success'
                ? 'You have been successfully verified.'
                : `An OTP has been sent to ${maskEmail(
                    adminEmail,
                  )}. Enter it below to confirm logout.`}
            </Text>

            {/* OTP boxes */}
            {(step === 'input' || step === 'verifying') && (
              <>
                <View style={styles.otpRow}>
                  {otp.map((digit, i) => (
                    <TextInput
                      key={i}
                      ref={el => (inputRefs.current[i] = el)}
                      style={[
                        styles.otpBox,
                        error
                          ? styles.otpBoxError
                          : digit
                          ? styles.otpBoxFilled
                          : styles.otpBoxDefault,
                      ]}
                      value={digit}
                      onChangeText={val => handleChange(i, val)}
                      onKeyPress={e => handleKeyPress(i, e)}
                      keyboardType="number-pad"
                      maxLength={1}
                      editable={step !== 'verifying'}
                      selectTextOnFocus
                    />
                  ))}
                </View>

                {/* Error */}
                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                {/* Verify button */}
                <TouchableOpacity
                  style={[
                    styles.verifyButton,
                    otp.join('').length < OTP_LENGTH &&
                      styles.verifyButtonDisabled,
                  ]}
                  onPress={handleVerify}
                  disabled={
                    step === 'verifying' || otp.join('').length < OTP_LENGTH
                  }
                >
                  {step === 'verifying' ? (
                    <>
                      <ActivityIndicator size="small" color="#ffffff" />
                      <Text style={styles.verifyButtonText}>Verifying...</Text>
                    </>
                  ) : (
                    <>
                      <Icon name="logout" size={16} color="#ffffff" />
                      <Text style={styles.verifyButtonText}>
                        Verify & Logout
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Resend */}
                <Text style={styles.resendText}>
                  {timer > 0 ? `Resend OTP in (${timer}s)` : ''}
                </Text>
                {timer <= 0 && (
                  <TouchableOpacity onPress={handleResend}>
                    <Text style={styles.resendLink}>Resend OTP</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {/* Sending spinner */}
            {step === 'sending' && (
              <View style={styles.spinnerWrap}>
                <ActivityIndicator size="large" color={BRAND} />
              </View>
            )}

            {/* Success bar */}
            {step === 'success' && <View style={styles.successBar} />}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
  },
  gradientStrip: {
    height: 4,
    backgroundColor: BRAND,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
  },
  content: {
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 28,
    alignItems: 'center',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(90,123,246,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  otpBox: {
    width: 44,
    height: 48,
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    borderWidth: 2,
  },
  otpBoxDefault: {
    borderColor: 'rgba(148,163,184,0.35)',
  },
  otpBoxFilled: {
    borderColor: BRAND,
  },
  otpBoxError: {
    borderColor: '#ef4444',
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '500',
    marginBottom: 14,
  },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: BRAND,
    marginBottom: 16,
  },
  verifyButtonDisabled: {
    backgroundColor: 'rgba(148,163,184,0.35)',
  },
  verifyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  resendText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  resendLink: {
    fontSize: 12,
    color: BRAND,
    fontWeight: '600',
    textDecorationLine: 'underline',
    marginTop: 4,
  },
  spinnerWrap: {
    paddingVertical: 16,
  },
  successBar: {
    width: 40,
    height: 6,
    borderRadius: 3,
    backgroundColor: BRAND,
    marginTop: 12,
  },
});

export default OtpLogoutModal;
