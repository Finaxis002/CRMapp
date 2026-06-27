import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useDispatch } from "react-redux";
import { setUser } from "../../store/slices/authSlice";
import { authService } from "../../services/authService";
import { toast } from "../../hooks/useToast";

const BRAND = "#5A7BF6";
const { height: SCREEN_H } = Dimensions.get("window");

const LoginScreen = () => {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const scrollRef = useRef(null);
  const scrollViewRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

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

  // Measure field position and scroll so it's visible above keyboard
  const scrollToField = (fieldRef) => {
    setTimeout(() => {
      fieldRef?.current?.measureLayout(
        scrollViewRef.current,
        (_x, y, _w, h) => {
          // y = field ka top, h = field height
          // Keyboard roughly 300px leta hai, toh field ko upar le jao
          const scrollY = y - (SCREEN_H * 0.38); // hero height ke baad
          scrollRef.current?.scrollTo({ y: Math.max(0, scrollY), animated: true });
        },
        () => {}
      );
    }, 300);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: BRAND }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ScrollView ke inner View ka ref — measureLayout ke liye */}
        <View ref={scrollViewRef}>

          {/* ── Hero Section ── */}
          <View
            style={[
              styles.hero,
              { paddingTop: insets.top + 48, minHeight: SCREEN_H * 0.44 },
            ]}
          >
            <View style={styles.blob1} />
            <View style={styles.blob2} />
            <View style={styles.blob3} />
            <View style={styles.blob4} />
            <View style={styles.blob5} />

            <View style={styles.logoCircle}>
              <Text style={styles.logoLetter}>S</Text>
            </View>

            <Text style={styles.brandName}>Sharda</Text>
            <View style={styles.crmRow}>
              <View style={styles.crmLine} />
              <Text style={styles.crmText}>C R M</Text>
              <View style={styles.crmLine} />
            </View>

            <Text style={styles.heroSub}>
              Your central hub to manage daily tasks,{"\n"}
              leads, and operations efficiently.
            </Text>
          </View>

          {/* ── Form Card ── */}
          <View style={styles.card}>
            <View style={styles.greetingWrap}>
              <Text style={styles.greeting}>Hello! Welcome back </Text>
              <Text style={styles.greetingSub}>Log in to continue</Text>
            </View>

            {apiError ? (
              <View style={styles.apiErrorBox}>
                <Icon name="alert-circle-outline" size={16} color="#ef4444" />
                <Text style={styles.apiErrorText}>{apiError}</Text>
              </View>
            ) : null}

            {/* Email */}
            <View ref={emailRef} style={{ marginTop: 24 }}>
              <Text style={[styles.label, focused.email && styles.labelFocused]}>
                Email
              </Text>
              <View
                style={[
                  styles.inputRow,
                  focused.email && styles.inputRowFocused,
                  (errors.email || apiError) && styles.inputRowError,
                ]}
              >
                <Icon
                  name="email-outline"
                  size={20}
                  color={focused.email ? BRAND : "#9ca3af"}
                  style={{ marginRight: 12 }}
                />
                <TextInput
                  style={styles.textInput}
                  value={formData.email}
                  onChangeText={(v) => handleChange("email", v)}
                  placeholder="you@example.com"
                  placeholderTextColor="#c4cbd8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  returnKeyType="next"
                  onFocus={() => {
                    setFocused({ ...focused, email: true });
                    scrollToField(emailRef);
                  }}
                  onBlur={() => setFocused({ ...focused, email: false })}
                />
              </View>
              {errors.email ? (
                <Text style={styles.errorText}>{errors.email}</Text>
              ) : null}
            </View>

            {/* Password */}
            <View ref={passwordRef} style={{ marginTop: 20 }}>
              <Text style={[styles.label, focused.password && styles.labelFocused]}>
                Password
              </Text>
              <View
                style={[
                  styles.inputRow,
                  focused.password && styles.inputRowFocused,
                  (errors.password || apiError) && styles.inputRowError,
                ]}
              >
                <Icon
                  name="lock-outline"
                  size={20}
                  color={focused.password ? BRAND : "#9ca3af"}
                  style={{ marginRight: 12 }}
                />
                <TextInput
                  style={styles.textInput}
                  value={formData.password}
                  onChangeText={(v) => handleChange("password", v)}
                  placeholder="Min. 6 characters"
                  placeholderTextColor="#c4cbd8"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                  onFocus={() => {
                    setFocused({ ...focused, password: true });
                    scrollToField(passwordRef);
                  }}
                  onBlur={() => setFocused({ ...focused, password: false })}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={{ padding: 6 }}
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

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.btn, loading && { opacity: 0.75 }]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Icon name="login" size={20} color="#fff" />
              )}
              <Text style={styles.btnText}>
                {loading ? "Signing in…" : "Login"}
              </Text>
            </TouchableOpacity>

            <Text style={styles.hint}>Having trouble? Contact your admin.</Text>
            <View style={{ height: insets.bottom + 40 }} />
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  hero: {
    backgroundColor: BRAND,
    paddingBottom: 64,
    paddingHorizontal: 28,
    alignItems: "center",
    overflow: "hidden",
    position: "relative",
  },
  blob1: {
    position: "absolute", borderRadius: 999,
    width: 220, height: 220, top: -70, right: -70,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  blob2: {
    position: "absolute", borderRadius: 999,
    width: 120, height: 120, top: 40, right: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  blob3: {
    position: "absolute", borderRadius: 999,
    width: 80, height: 80, bottom: 20, left: -20,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  blob4: {
    position: "absolute", borderRadius: 999,
    width: 50, height: 50, top: 40, left: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  blob5: {
    position: "absolute", borderRadius: 999,
    width: 160, height: 160, bottom: -40, right: -40,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  logoCircle: {
    width: 77, height: 77, borderRadius: 39,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 2.5,
    borderColor: "rgba(255,255,255,0.4)",
    alignItems: "center", justifyContent: "center",
    marginBottom: 18,
    elevation: 10,
  },
  logoLetter: {
    fontSize: 40, fontWeight: "900", color: "#fff", letterSpacing: -1,
  },
  brandName: {
    fontSize: 36, fontWeight: "900",
    color: "#fff", letterSpacing: 1, marginBottom: 6,
  },
  crmRow: {
    flexDirection: "row", alignItems: "center",
    gap: 10, marginBottom: 20,
  },
  crmLine: {
    height: 1.5, width: 28,
    backgroundColor: "rgba(255,255,255,0.4)", borderRadius: 2,
  },
  crmText: {
    fontSize: 12, fontWeight: "700",
    color: "rgba(255,255,255,0.75)", letterSpacing: 4,
  },
  heroSub: {
    fontSize: 13.5,
    color: "rgba(255,255,255,0.78)",
    textAlign: "center", lineHeight: 21,
    fontWeight: "400", maxWidth: 280,
  },
  card: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    flex: 1,
    marginTop: -32,
    paddingHorizontal: 28,
    paddingTop: 36,
    paddingBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 14,
  },
  greetingWrap: { alignItems: "center", marginBottom: 4 },
  greeting: {
    fontSize: 22, fontWeight: "800",
    color: "#111827", textAlign: "center", marginBottom: 4,
  },
  greetingSub: {
    fontSize: 14, color: "#848992", textAlign: "center",
  },
  apiErrorBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#fef2f2", borderWidth: 1,
    borderColor: "#fecaca", paddingHorizontal: 14,
    paddingVertical: 10, borderRadius: 12, marginTop: 16,
  },
  apiErrorText: { fontSize: 13, color: "#ef4444", flex: 1 },
  label: {
    fontSize: 13, fontWeight: "600",
    color: "#374151", marginBottom: 8,
  },
  labelFocused: { color: BRAND },
  inputRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 14, borderWidth: 1.5,
    borderColor: "#e5e7eb", height: 56,
    paddingHorizontal: 16,
  },
  inputRowFocused: { borderColor: BRAND, backgroundColor: "#fafbff" },
  inputRowError: { borderColor: "#f87171", backgroundColor: "#fff5f5" },
  textInput: {
    flex: 1, fontSize: 15, color: "#111827", padding: 0,
  },
  errorText: {
    fontSize: 12, color: "#ef4444", marginTop: 5, marginLeft: 2,
  },
  btn: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 10,
    backgroundColor: BRAND,
    height: 56, borderRadius: 14,
    marginTop: 36,
    shadowColor: BRAND,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.38,
    shadowRadius: 16,
    elevation: 8,
  },
  btnText: {
    fontSize: 17, fontWeight: "700", color: "#fff", letterSpacing: 0.3,
  },
  hint: {
    textAlign: "center", fontSize: 12,
    color: "#c4cbd8", marginTop: 22,
  },
});

export default LoginScreen;