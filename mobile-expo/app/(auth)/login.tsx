import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  StatusBar,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { globalAuthAPI, googleAuthAPI } from '../../src/services/apiClient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';

WebBrowser.maybeCompleteAuthSession();

// ─── Google OAuth Config ───────────────────────────────────────
const WEB_CLIENT_ID = '706624374984-qg1ueivbvougs0gff3842jkgvf9qurno.apps.googleusercontent.com';
const ANDROID_CLIENT_ID = '706624374984-qg1ueivbvougs0gff3842jkgvf9qurno.apps.googleusercontent.com'; // sama dulu sampai Android client dibuat

// ─── Colors ────────────────────────────────────────────────────
const COLORS = {
  bg1: '#0f0c29',
  bg2: '#302b63',
  bg3: '#24243e',
  card: 'rgba(255,255,255,0.07)',
  cardBorder: 'rgba(255,255,255,0.12)',
  input: 'rgba(0,0,0,0.25)',
  inputBorder: 'rgba(255,255,255,0.1)',
  accent: '#818cf8',       // indigo-400
  accentDark: '#4f46e5',   // indigo-600
  placeholder: 'rgba(129,140,248,0.6)',
  textMain: '#fff',
  textSub: 'rgba(199,210,254,0.85)',  // indigo-200
  textMuted: 'rgba(199,210,254,0.5)',
  error: 'rgba(239,68,68,0.15)',
  errorBorder: 'rgba(239,68,68,0.5)',
  errorText: '#fca5a5',
  divider: 'rgba(255,255,255,0.12)',
  googleBtn: 'rgba(255,255,255,0.08)',
  googleBtnBorder: 'rgba(255,255,255,0.18)',
};

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const { login } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // ── Animations ──
  const logoOpacity = useSharedValue(0);
  const logoTranslateY = useSharedValue(-30);
  const cardOpacity = useSharedValue(0);
  const cardTranslateY = useSharedValue(40);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
    logoTranslateY.value = withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) });
    cardOpacity.value = withDelay(200, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }));
    cardTranslateY.value = withDelay(200, withTiming(0, { duration: 700, easing: Easing.out(Easing.cubic) }));
  }, []);

  const logoAnimStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ translateY: logoTranslateY.value }],
  }));

  const cardAnimStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardTranslateY.value }],
  }));

  // ── Google OAuth ──
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: WEB_CLIENT_ID,
    androidClientId: ANDROID_CLIENT_ID,
    scopes: ['profile', 'email'],
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      if (authentication?.accessToken) {
        handleGoogleToken(authentication.accessToken);
      }
    } else if (response?.type === 'error') {
      setErrorMsg('Google Sign-In gagal. Silakan coba lagi.');
      setIsGoogleLoading(false);
    }
  }, [response]);

  const handleGoogleToken = async (accessToken: string) => {
    setIsGoogleLoading(true);
    try {
      const res = await googleAuthAPI.authenticate({ accessToken });
      if (res.data && res.data.token) {
        await login(res.data);
      } else {
        setErrorMsg('Autentikasi Google gagal. Response tidak valid.');
      }
    } catch (error: any) {
      console.error('[Google Auth Error]', error);
      const msg =
        error.response?.data?.message ||
        error.response?.data?.error ||
        'Login Google gagal. Silakan coba lagi.';
      setErrorMsg(msg);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg('');
    setIsGoogleLoading(true);
    try {
      await promptAsync();
    } catch (e) {
      setIsGoogleLoading(false);
    }
  };

  // ── Email/Password Login ──
  const handleLogin = async () => {
    setErrorMsg('');
    if (!email.trim()) {
      setErrorMsg('Email wajib diisi');
      return;
    }
    if (!password) {
      setErrorMsg('Password wajib diisi');
      return;
    }

    setIsLoading(true);
    try {
      const res = await globalAuthAPI.globalLogin({ email: email.trim(), password });
      if (res.data && res.data.token) {
        await login(res.data);
      } else {
        setErrorMsg('Response dari server tidak valid');
      }
    } catch (error: any) {
      console.error('[Login Error]', error);
      const status = error.response?.status;
      if (status === 404) {
        setErrorMsg('Email tidak ditemukan di sistem');
      } else if (status === 401) {
        setErrorMsg('Password salah');
      } else {
        setErrorMsg(
          error.response?.data?.message ||
          error.response?.data?.error ||
          'Terjadi kesalahan saat login'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    router.push('/(auth)/forgot-password' as any);
  };

  const handleRegister = () => {
    Alert.alert(
      'Daftar Akun Baru',
      'Pendaftaran akun baru tersedia di website superkafe.com. Kunjungi website kami untuk mendaftar.',
      [{ text: 'OK', style: 'default' }]
    );
  };

  const busy = isLoading || isGoogleLoading;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Background layer: multi-color dark gradient via nested views */}
      <View style={[styles.bgLayer1, { backgroundColor: COLORS.bg1 }]} />
      <View style={[styles.bgLayer2, { backgroundColor: COLORS.bg2 }]} />
      <View style={[styles.bgLayer3, { backgroundColor: COLORS.bg3 }]} />
      {/* Neon accent orb top-right */}
      <View style={styles.orbTopRight} />
      {/* Neon accent orb bottom-left */}
      <View style={styles.orbBottomLeft} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Logo / Header ── */}
          <Animated.View style={[styles.header, logoAnimStyle]}>
            <View style={styles.logoBox}>
              <View style={styles.logoInner}>
                <Ionicons name="cafe" size={44} color={COLORS.accent} />
              </View>
            </View>
            <Text style={styles.appTitle}>SuperKafe</Text>
            <Text style={styles.appSubtitle}>Sistem Manajemen Bisnis Anda</Text>
          </Animated.View>

          {/* ── Login Card ── */}
          <Animated.View style={[styles.card, cardAnimStyle]}>
            <Text style={styles.cardTitle}>Masuk ke Akun</Text>

            {/* Error Banner */}
            {!!errorMsg && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={18} color={COLORS.errorText} />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}

            {/* Google Login Button */}
            <TouchableOpacity
              onPress={handleGoogleLogin}
              disabled={busy || !request}
              style={[styles.googleBtn, (busy || !request) && styles.disabledBtn]}
              activeOpacity={0.8}
            >
              {isGoogleLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  {/* Google "G" icon using text */}
                  <View style={styles.googleIcon}>
                    <Text style={styles.googleIconText}>G</Text>
                  </View>
                  <Text style={styles.googleBtnText}>Masuk dengan Google</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>atau masuk dengan email</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Email Input */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Email</Text>
              <View style={styles.inputRow}>
                <Ionicons name="mail-outline" size={18} color={COLORS.accent} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Contoh: admin@warkop.com"
                  placeholderTextColor={COLORS.placeholder}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={email}
                  onChangeText={setEmail}
                  editable={!busy}
                />
              </View>
            </View>

            {/* Password Input */}
            <View style={styles.fieldGroup}>
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>Password</Text>
                <TouchableOpacity onPress={handleForgotPassword} disabled={busy}>
                  <Text style={styles.forgotLink}>Lupa Password?</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.inputRow}>
                <Ionicons name="lock-closed-outline" size={18} color={COLORS.accent} />
                <TextInput
                  style={[styles.textInput, styles.inputFlex]}
                  placeholder="Masukkan password Anda"
                  placeholderTextColor={COLORS.placeholder}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  editable={!busy}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  disabled={busy}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={COLORS.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Login Button */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={busy}
              style={[styles.loginBtn, busy && styles.disabledBtn]}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Text style={styles.loginBtnText}>Masuk</Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" style={{ marginLeft: 8 }} />
                </>
              )}
            </TouchableOpacity>

            {/* Register Link */}
            <View style={styles.registerRow}>
              <Text style={styles.registerLabel}>Belum punya akun?</Text>
              <TouchableOpacity onPress={handleRegister} disabled={busy}>
                <Text style={styles.registerLink}>Daftar Akun</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────
const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#0f0c29' },

  // Background layering for depth illusion
  bgLayer1: {
    ...StyleSheet.absoluteFillObject,
    opacity: 1,
  },
  bgLayer2: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '60%',
    opacity: 0.6,
    borderBottomLeftRadius: 80,
    borderBottomRightRadius: 80,
  },
  bgLayer3: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '40%',
    opacity: 0.4,
  },
  orbTopRight: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(99,102,241,0.18)',
  },
  orbBottomLeft: {
    position: 'absolute',
    bottom: -60,
    left: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(167,139,250,0.12)',
  },

  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoBox: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(129,140,248,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  logoInner: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: 'rgba(99,102,241,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -1,
  },
  appSubtitle: {
    fontSize: 14,
    color: COLORS.textSub,
    marginTop: 6,
  },

  // Card
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
    elevation: 12,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 20,
  },

  // Error
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.error,
    borderWidth: 1,
    borderColor: COLORS.errorBorder,
    borderRadius: 14,
    padding: 12,
    gap: 10,
    marginBottom: 16,
  },
  errorText: {
    color: COLORS.errorText,
    flex: 1,
    fontSize: 13,
  },

  // Google Button
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.googleBtn,
    borderWidth: 1,
    borderColor: COLORS.googleBtnBorder,
    borderRadius: 16,
    paddingVertical: 14,
    gap: 10,
    marginBottom: 20,
  },
  googleIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIconText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#4285F4',
  },
  googleBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.divider,
  },
  dividerText: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
  },

  // Input fields
  fieldGroup: { marginBottom: 16 },
  fieldLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSub,
    marginBottom: 8,
  },
  forgotLink: {
    fontSize: 13,
    color: COLORS.accent,
    fontWeight: '500',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.input,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
  },
  textInput: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
  },
  inputFlex: { flex: 1 },

  // Login Button
  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accentDark,
    borderRadius: 18,
    paddingVertical: 17,
    marginTop: 8,
    marginBottom: 20,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 8,
  },
  loginBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  disabledBtn: {
    opacity: 0.6,
  },

  // Register
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  registerLabel: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  registerLink: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: '700',
  },
});
