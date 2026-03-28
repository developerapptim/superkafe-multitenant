import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../src/services/apiClient';

const COLORS = {
  bg: '#0f0c29',
  card: 'rgba(255,255,255,0.07)',
  cardBorder: 'rgba(255,255,255,0.12)',
  input: 'rgba(0,0,0,0.25)',
  inputBorder: 'rgba(255,255,255,0.1)',
  accent: '#818cf8',
  accentDark: '#4f46e5',
  placeholder: 'rgba(129,140,248,0.5)',
  textMain: '#fff',
  textSub: 'rgba(199,210,254,0.85)',
  textMuted: 'rgba(199,210,254,0.5)',
};

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleSend = async () => {
    if (!email.trim()) {
      Alert.alert('Email kosong', 'Mohon masukkan alamat email Anda.');
      return;
    }
    setIsLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (error: any) {
      const msg =
        error.response?.data?.message ||
        error.response?.data?.error ||
        'Gagal mengirim email reset. Coba lagi.';
      Alert.alert('Gagal', msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Background orb */}
      <View style={styles.orb} />

      {/* Back Button */}
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={22} color="#fff" />
        <Text style={styles.backText}>Kembali</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconBox}>
          <Ionicons name="mail" size={40} color={COLORS.accent} />
        </View>

        <Text style={styles.title}>Lupa Password?</Text>
        <Text style={styles.subtitle}>
          Masukkan email Anda dan kami akan mengirimkan tautan untuk mereset password.
        </Text>

        {!sent ? (
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Alamat Email</Text>
            <View style={styles.inputRow}>
              <Ionicons name="mail-outline" size={18} color={COLORS.accent} />
              <TextInput
                style={styles.textInput}
                placeholder="admin@warkop.com"
                placeholderTextColor={COLORS.placeholder}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
                editable={!isLoading}
              />
            </View>

            <TouchableOpacity
              style={[styles.sendBtn, isLoading && styles.disabledBtn]}
              onPress={handleSend}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Text style={styles.sendBtnText}>Kirim Tautan Reset</Text>
                  <Ionicons name="send" size={18} color="#fff" style={{ marginLeft: 8 }} />
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={48} color="#34d399" />
            </View>
            <Text style={styles.successTitle}>Email Terkirim!</Text>
            <Text style={styles.successText}>
              Cek inbox Anda di <Text style={{ color: COLORS.accent }}>{email}</Text>. Ikuti tautan yang dikirim untuk mereset password.
            </Text>
            <TouchableOpacity
              style={styles.backToLogin}
              onPress={() => router.replace('/(auth)/login')}
            >
              <Text style={styles.backToLoginText}>Kembali ke Login</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  orb: {
    position: 'absolute',
    top: -100,
    right: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(99,102,241,0.15)',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backText: { color: '#fff', fontSize: 15, fontWeight: '500' },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    alignItems: 'center',
  },
  iconBox: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: 'rgba(129,140,248,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSub,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    maxWidth: 300,
  },
  card: {
    width: '100%',
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSub,
    marginBottom: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.input,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
    marginBottom: 16,
  },
  textInput: { flex: 1, color: '#fff', fontSize: 15 },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accentDark,
    borderRadius: 16,
    paddingVertical: 16,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 6,
  },
  sendBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  disabledBtn: { opacity: 0.6 },
  successIcon: { alignItems: 'center', marginBottom: 12 },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  successText: {
    fontSize: 14,
    color: COLORS.textSub,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  backToLogin: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(129,140,248,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.3)',
  },
  backToLoginText: {
    color: COLORS.accent,
    fontSize: 15,
    fontWeight: '600',
  },
});
