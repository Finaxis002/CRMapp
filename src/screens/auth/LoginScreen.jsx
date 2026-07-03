import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Dimensions,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  ActivityIndicator,
  Keyboard,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDispatch } from 'react-redux';
import { setUser } from '../../store/slices/authSlice';
import { authService } from '../../services/authService';
import { toast } from '../../hooks/useToast';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BRAND = '#5A7BF6';
const { height: SCREEN_H } = Dimensions.get('window');

const LoginScreen = () => {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();

  // Refs for keyboard scroll
  const scrollRef = useRef(null);
  const scrollViewRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState('');
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({ email: '', password: '' });
  const [focused, setFocused] = useState({ email: false, password: false });

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    if (apiError) setApiError('');
  };

  const validate = () => {
    const newErrors = { email: '', password: '' };
    let isValid = true;

    if (!formData.email) {
      newErrors.email = 'Email is required.';
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address.';
      isValid = false;
    }

    if (!formData.password) {
      newErrors.password = 'Password is required.';
      isValid = false;
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters.';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    setApiError('');
    const loadingId = toast.loading('Logging you in...');

    try {
      const data = await authService.login(formData.email, formData.password);
      dispatch(setUser(data.user));
      await AsyncStorage.setItem('currentUserId', data.user._id);
      toast.dismiss(loadingId);
      toast.success('Logged in successfully!');
      // Redux state change automatically switches to MainNavigator
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        'Invalid email or password. Please try again.';
      toast.dismiss(loadingId);
      setApiError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Scroll to field when keyboard opens
  const scrollToField = fieldRef => {
    setTimeout(() => {
      fieldRef?.current?.measureLayout(
        scrollViewRef.current,
        (_x, y) => {
          const scrollY = y - SCREEN_H * 0.38;
          scrollRef.current?.scrollTo({
            y: Math.max(0, scrollY),
            animated: true,
          });
        },
        () => {},
      );
    }, 300);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#ffffff' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View ref={scrollViewRef}>
            {/* ── Top blue branding section ── */}
            <View
              style={[styles.brandSection, { paddingTop: insets.top + 50 }]}
            >
              {/* Decorative circles */}
              <View style={[styles.decoCircle, styles.decoCircle1]} />
              <View style={[styles.decoCircle, styles.decoCircle2]} />
              <View style={[styles.decoCircle, styles.decoCircle3]} />
              <View style={[styles.decoCircle, styles.decoCircle4]} />

              {/* Logo — image from assets */}
              <View style={styles.logoCircle}>
                <Image
                  source={require('../../assets/images/sharda_favicon.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>

              <Text style={styles.welcomeTitle}>Sharda CRM</Text>
              <Text style={styles.welcomeSubtitle}>
                Your central hub to manage daily tasks, leads, and operations
                efficiently.
              </Text>
            </View>

            {/* ── White form section ── */}
            <View style={styles.formSection}>
              <Text style={styles.helloTitle}>Hello! Welcome back 👋</Text>

              {apiError ? (
                <View style={styles.apiErrorBox}>
                  <Icon name="alert-circle" size={16} color="#ef4444" />
                  <Text style={styles.apiErrorText}>{apiError}</Text>
                </View>
              ) : null}

              {/* Email field */}
              <View ref={emailRef} style={styles.inputGroup}>
                <Text
                  style={[
                    styles.inputLabel,
                    focused.email && styles.inputLabelFocused,
                  ]}
                >
                  Email
                </Text>
                <View
                  style={[
                    styles.inputWrapper,
                    focused.email && styles.inputWrapperFocused,
                    errors.email && styles.inputWrapperError,
                    apiError && !errors.email && styles.inputWrapperError,
                  ]}
                >
                  <Icon
                    name="email-outline"
                    size={20}
                    color={focused.email ? BRAND : '#9ca3af'}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    value={formData.email}
                    onChangeText={val => handleChange('email', val)}
                    placeholder="Enter your email address"
                    placeholderTextColor="#9ca3af"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    returnKeyType="next"
                    onFocus={() => {
                      setFocused(prev => ({ ...prev, email: true }));
                      scrollToField(emailRef);
                    }}
                    onBlur={() =>
                      setFocused(prev => ({ ...prev, email: false }))
                    }
                  />
                </View>
                {errors.email ? (
                  <Text style={styles.errorText}>{errors.email}</Text>
                ) : null}
              </View>

              {/* Password field */}
              <View ref={passwordRef} style={styles.inputGroup}>
                <Text
                  style={[
                    styles.inputLabel,
                    focused.password && styles.inputLabelFocused,
                  ]}
                >
                  Password
                </Text>
                <View
                  style={[
                    styles.inputWrapper,
                    focused.password && styles.inputWrapperFocused,
                    errors.password && styles.inputWrapperError,
                    apiError && !errors.password && styles.inputWrapperError,
                  ]}
                >
                  <Icon
                    name="lock-outline"
                    size={20}
                    color={focused.password ? BRAND : '#9ca3af'}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    value={formData.password}
                    onChangeText={val => handleChange('password', val)}
                    placeholder="Enter your password"
                    placeholderTextColor="#9ca3af"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit}
                    onFocus={() => {
                      setFocused(prev => ({ ...prev, password: true }));
                      scrollToField(passwordRef);
                    }}
                    onBlur={() =>
                      setFocused(prev => ({ ...prev, password: false }))
                    }
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeButton}
                  >
                    <Icon
                      name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                      size={20}
                      color="#9ca3af"
                    />
                  </TouchableOpacity>
                </View>
                {errors.password ? (
                  <Text style={styles.errorText}>{errors.password}</Text>
                ) : null}
              </View>

              {/* Login button */}
              <TouchableOpacity
                style={[
                  styles.loginButton,
                  loading && styles.loginButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <>
                    <ActivityIndicator size="small" color="#ffffff" />
                    <Text style={styles.loginButtonText}>Signing in…</Text>
                  </>
                ) : (
                  <>
                    <Icon name="login" size={20} color="#ffffff" />
                    <Text style={styles.loginButtonText}>Login</Text>
                  </>
                )}
              </TouchableOpacity>

              <Text style={styles.hint}>
                Having trouble? Contact your admin.
              </Text>
              <View style={{ height: insets.bottom + 32 }} />
            </View>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  // ── Brand section ──────────────────────────────────────────
  brandSection: {
    backgroundColor: BRAND,
    paddingBottom: 56,
    paddingHorizontal: 28,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
  },
  decoCircle: {
    position: 'absolute',
    borderRadius: 9999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  decoCircle1: { width: 160, height: 160, top: -50, right: -40 },
  decoCircle2: {
    width: 100,
    height: 100,
    top: 60,
    right: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  decoCircle3: {
    width: 60,
    height: 60,
    bottom: 20,
    right: -15,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  decoCircle4: {
    width: 36,
    height: 36,
    top: 44,
    right: 110,
    backgroundColor: 'rgba(82,240,255,0.28)',
  },

  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    elevation: 8,
  },
  logoImage: {
    width: 48,
    height: 48,
  },

  welcomeTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
    marginBottom: 10,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 13.5,
    color: 'rgba(255,255,255,0.82)',
    lineHeight: 21,
    fontWeight: '400',
    maxWidth: 260,
    textAlign: 'center',
  },

  // ── Form section ───────────────────────────────────────────
  formSection: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 36,
  },
  helloTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 24,
  },

  apiErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fee2e2',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  apiErrorText: {
    fontSize: 13,
    color: '#ef4444',
    fontWeight: '500',
    flex: 1,
  },

  inputGroup: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 6,
    marginLeft: 4,
  },
  inputLabelFocused: {
    color: BRAND,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F7FE',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
    height: 52,
    paddingHorizontal: 14,
  },
  inputWrapperFocused: {
    backgroundColor: '#ffffff',
    borderColor: BRAND,
  },
  inputWrapperError: {
    borderColor: '#f87171',
    backgroundColor: '#fef2f2',
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#1f2937',
    padding: 0,
  },
  eyeButton: {
    padding: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 6,
    marginLeft: 4,
  },

  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: BRAND,
    height: 52,
    borderRadius: 12,
    marginTop: 14,
    shadowColor: BRAND,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },

  hint: {
    textAlign: 'center',
    fontSize: 12,
    color: '#c4cbd8',
    marginTop: 22,
  },
});

export default LoginScreen;
