import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useDispatch } from "react-redux";
import { setUser } from "../../store/slices/authSlice";
import { authService } from "../../services/authService";
import { toast } from "../../hooks/useToast";

const BRAND = "#5A7BF6";

const LoginScreen = () => {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState("");
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({ email: "", password: "" });
  const [focused, setFocused] = useState({ email: false, password: false });

  const handleChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
    if (apiError) setApiError("");
  };

  const validate = () => {
    const newErrors = { email: "", password: "" };
    let isValid = true;

    if (!formData.email) {
      newErrors.email = "Email is required.";
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address.";
      isValid = false;
    }

    if (!formData.password) {
      newErrors.password = "Password is required.";
      isValid = false;
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters.";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    setApiError("");
    const loadingId = toast.loading("Logging you in...");

    try {
      const data = await authService.login(formData.email, formData.password);
      dispatch(setUser(data.user));
      toast.dismiss(loadingId);
      toast.success("Logged in successfully!");
      // Redux state change automatically switches to MainNavigator
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        "Invalid email or password. Please try again.";
      toast.dismiss(loadingId);
      setApiError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Top blue branding section */}
      <View
        style={[styles.brandSection, { paddingTop: insets.top + 50 }]}
      >
        <View style={styles.logoBox}>
          <Text style={styles.logoText}>SC</Text>
        </View>

        <Text style={styles.welcomeTitle}>Welcome to{"\n"}Sharda CRM</Text>
        <Text style={styles.welcomeSubtitle}>
          Your central hub to manage daily tasks, leads, and operations
          efficiently.
        </Text>

        {/* Decorative circles */}
        <View style={[styles.decoCircle, styles.decoCircle1]} />
        <View style={[styles.decoCircle, styles.decoCircle2]} />
        <View style={[styles.decoCircle, styles.decoCircle3]} />
        <View style={[styles.decoCircle, styles.decoCircle4]} />
      </View>

      {/* White form section */}
      <ScrollView
        style={styles.formSection}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <Text style={styles.helloTitle}>Hello ! Welcome back</Text>

          {apiError ? (
            <View style={styles.apiErrorBox}>
              <Icon name="alert-circle" size={16} color="#ef4444" />
              <Text style={styles.apiErrorText}>{apiError}</Text>
            </View>
          ) : null}

          {/* Email field */}
          <View style={styles.inputGroup}>
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
                (errors.email || apiError) && styles.inputWrapperError,
              ]}
            >
              <Icon
                name="email-outline"
                size={20}
                color={focused.email ? BRAND : "#9ca3af"}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.textInput}
                value={formData.email}
                onChangeText={(val) => handleChange("email", val)}
                placeholder="Enter your email address"
                placeholderTextColor="#9ca3af"
                keyboardType="email-address"
                autoCapitalize="none"
                onFocus={() => setFocused({ ...focused, email: true })}
                onBlur={() => setFocused({ ...focused, email: false })}
              />
            </View>
            {errors.email ? (
              <Text style={styles.errorText}>{errors.email}</Text>
            ) : null}
          </View>

          {/* Password field */}
          <View style={styles.inputGroup}>
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
                (errors.password || apiError) && styles.inputWrapperError,
              ]}
            >
              <Icon
                name="lock-outline"
                size={20}
                color={focused.password ? BRAND : "#9ca3af"}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.textInput}
                value={formData.password}
                onChangeText={(val) => handleChange("password", val)}
                placeholder="Enter your password"
                placeholderTextColor="#9ca3af"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                onFocus={() => setFocused({ ...focused, password: true })}
                onBlur={() => setFocused({ ...focused, password: false })}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                <Icon
                  name={showPassword ? "eye-outline" : "eye-off-outline"}
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
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <>
                <ActivityIndicator size="small" color="#ffffff" />
                <Text style={styles.loginButtonText}>Logging in...</Text>
              </>
            ) : (
              <>
                <Icon name="login" size={20} color="#ffffff" />
                <Text style={styles.loginButtonText}>Login</Text>
              </>
            )}
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  brandSection: {
    backgroundColor: BRAND,
    paddingBottom: 50,
    paddingHorizontal: 28,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: "hidden",
    position: "relative",
  },
  logoBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  logoText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: 2,
  },
  welcomeTitle: {
    fontSize: 30,
    fontWeight: "800",
    color: "#ffffff",
    lineHeight: 38,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    lineHeight: 22,
    fontWeight: "500",
  },
  decoCircle: {
    position: "absolute",
    borderRadius: 9999,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  decoCircle1: {
    width: 120,
    height: 120,
    top: -30,
    right: -30,
  },
  decoCircle2: {
    width: 80,
    height: 80,
    top: 60,
    right: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  decoCircle3: {
    width: 50,
    height: 50,
    bottom: 20,
    right: -15,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  decoCircle4: {
    width: 30,
    height: 30,
    top: 40,
    right: 100,
    backgroundColor: "rgba(82,240,255,0.3)",
  },
  formSection: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 36,
  },
  helloTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1f2937",
    textAlign: "center",
    marginBottom: 24,
  },
  apiErrorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fee2e2",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  apiErrorText: {
    fontSize: 13,
    color: "#ef4444",
    fontWeight: "500",
    flex: 1,
  },
  inputGroup: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6b7280",
    marginBottom: 6,
    marginLeft: 4,
  },
  inputLabelFocused: {
    color: BRAND,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F4F7FE",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "transparent",
    height: 52,
    paddingHorizontal: 14,
  },
  inputWrapperFocused: {
    backgroundColor: "#ffffff",
    borderColor: BRAND,
  },
  inputWrapperError: {
    borderColor: "#f87171",
    backgroundColor: "#fef2f2",
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: "#1f2937",
    padding: 0,
  },
  eyeButton: {
    padding: 4,
  },
  errorText: {
    fontSize: 12,
    color: "#ef4444",
    marginTop: 6,
    marginLeft: 4,
  },
  loginButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
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
    fontWeight: "600",
    color: "#ffffff",
  },
});

export default LoginScreen;
