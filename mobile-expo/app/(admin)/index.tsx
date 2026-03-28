import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function DashboardScreen() {
  const { user, tenantSlug, logout } = useAuth();

  return (
    <View className="flex-1 bg-gray-50 items-center justify-center p-6">
      <View className="w-24 h-24 bg-indigo-100 rounded-full items-center justify-center mb-6 shadow-sm border border-indigo-200">
        <Ionicons name="cafe" size={48} color="#4f46e5" />
      </View>
      
      <Text className="text-3xl font-bold text-gray-900 mb-2">
        Halo, {user?.name || 'User'}!
      </Text>
      
      <Text className="text-lg text-gray-600 mb-8 text-center px-4">
        Selamat datang di dashboard <Text className="font-bold text-indigo-600">{tenantSlug || 'Kafe Anda'}</Text>.
      </Text>

      <TouchableOpacity
        onPress={logout}
        className="bg-red-500 py-3 px-8 rounded-2xl shadow-sm flex-row items-center active:opacity-80"
      >
        <Ionicons name="log-out-outline" size={20} color="#fff" />
        <Text className="text-white font-bold text-lg ml-2">Logout</Text>
      </TouchableOpacity>
    </View>
  );
}
