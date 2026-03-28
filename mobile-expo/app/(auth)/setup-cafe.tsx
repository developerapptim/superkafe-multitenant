import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { tenantAPI } from '../../src/services/apiClient';
import { Ionicons } from '@expo/vector-icons';

export default function SetupCafeScreen() {
  const [cafeName, setCafeName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const { user, updateUser, setTenantSlug } = useAuth();
  const router = useRouter();

  const handleSetup = async () => {
    setErrorMsg('');

    if (!cafeName.trim()) {
      setErrorMsg('Nama kafe wajib diisi');
      return;
    }

    setIsLoading(true);
    try {
      // 1. Register tenant via API
      const response = await tenantAPI.register({ 
        name: cafeName.trim(),
        // Add other fields if required by your backend, e.g., phone, address
      });
      
      const newTenant = response.data?.tenant || response.data;
      const slug = newTenant?.slug;

      if (!slug) {
        throw new Error('Gagal mendapatkan informasi tenant dari server.');
      }

      // 2. Update secureStorage & AuthContext untuk tenant_slug
      await setTenantSlug(slug);

      // 3. Update user object (hasCompletedSetup)
      if (user) {
        await updateUser({ ...user, hasCompletedSetup: true });
      }

      // 4. Redirect to Dashboard
      router.replace('/(admin)/index');
      
    } catch (error: any) {
      console.error('[SetupCafe Error]', error);
      const msg =
        error.response?.data?.message ||
        error.message ||
        'Terjadi kesalahan saat menyimpan pengaturan kafe';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View className="flex-1 bg-indigo-950">
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="px-6 py-10">
            {/* Header / Logo */}
            <View className="items-center mb-10">
              <View className="w-24 h-24 bg-white/10 rounded-3xl items-center justify-center mb-4 border border-white/20">
                <Ionicons name="storefront" size={48} color="#fff" />
              </View>
              <Text className="text-4xl font-extrabold text-white tracking-tight text-center">
                Wah, Hampir Selesai!
              </Text>
              <Text className="text-indigo-200 mt-2 text-base text-center">
                Tinggal selangkah lagi untuk memulai
              </Text>
            </View>

            {/* Form Card */}
            <View className="bg-white/10 rounded-3xl p-6 border border-white/10 shadow-lg">
              <Text className="text-2xl font-bold text-white mb-6">Atur Kafe Anda</Text>

              {/* Error Banner */}
              {errorMsg ? (
                <View className="bg-red-500/20 border border-red-500/50 rounded-xl p-3 mb-4 flex-row items-center">
                  <Ionicons name="alert-circle" size={20} color="#fca5a5" className="mr-2" />
                  <Text className="text-red-200 flex-1 ml-2">{errorMsg}</Text>
                </View>
              ) : null}

              <Text className="text-indigo-200 mb-6 leading-relaxed">
                Silahkan beri nama kafe atau bisnis Anda. Nama ini akan digunakan sebagai alamat web Anda (contoh: warkop.superkafe.com).
              </Text>

              {/* Cafe Name Input */}
              <View className="mb-8">
                <Text className="text-indigo-200 font-medium mb-2 ml-1">Nama Kafe / Bisnis</Text>
                <View className="flex-row items-center bg-black/20 rounded-2xl px-4 py-3 border border-white/10">
                  <Ionicons name="business-outline" size={20} color="#a5b4fc" className="mr-3" />
                  <TextInput
                    className="flex-1 text-white text-base ml-2"
                    placeholder="Contoh: Warkop Berkah Utama"
                    placeholderTextColor="#6366f1"
                    value={cafeName}
                    onChangeText={setCafeName}
                    editable={!isLoading}
                    autoFocus
                  />
                </View>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                onPress={handleSetup}
                disabled={isLoading}
                className={`w-full bg-indigo-500 rounded-2xl py-4 items-center justify-center flex-row shadow-lg ${
                  isLoading ? 'opacity-70' : 'active:opacity-80'
                }`}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Text className="text-white font-bold text-lg mr-2">Selesai Beres-beres</Text>
                    <Ionicons name="checkmark-circle-outline" size={22} color="#fff" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}
