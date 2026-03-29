import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Linking, Modal, StyleSheet } from 'react-native';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

// A simple rough semver compare logic
const isNewVersion = (currentStr: string, remoteStr: string) => {
    const current = currentStr.split('.').map(Number);
    const remote = remoteStr.split('.').map(Number);
    for (let i = 0; i < Math.max(current.length, remote.length); i++) {
        const c = current[i] || 0;
        const r = remote[i] || 0;
        if (r > c) return true;
        if (r < c) return false;
    }
    return false;
};

export default function UpdateManager() {
    const [needsUpdate, setNeedsUpdate] = useState(false);
    const [updateData, setUpdateData] = useState<any>(null);

    useEffect(() => {
        const checkForUpdates = async () => {
            try {
                // Get base API URL to derive the uploads path
                const apiUrl = Constants.expoConfig?.extra?.apiUrl || 'https://superkafe.com/api';
                const versionUrl = apiUrl.replace(/\/api\/?$/, '') + '/uploads/app-version.json';
                
                const response = await fetch(versionUrl, { cache: 'no-store' }); // Ensure it doesn't cache the old file
                if (!response.ok) throw new Error('Failed to fetch update info');
                
                const remoteConfig = await response.json();
                
                // Native app version might be null in an Expo Go environment natively running 
                // but usually works. Fallback to Constants config version if native fails.
                const currentVersion = Application.nativeApplicationVersion || Constants.expoConfig?.version || '1.0.0';
                
                if (remoteConfig.version && isNewVersion(currentVersion, remoteConfig.version)) {
                    // Only pop up if it's marked as a big update
                    if (remoteConfig.isBigUpdate) {
                        setUpdateData(remoteConfig);
                        setNeedsUpdate(true);
                    }
                }
            } catch (error) {
                console.log('[UpdateManager] Error checking for updates:', error);
            }
        };

        checkForUpdates();
    }, []);

    const handleUpdate = () => {
        if (updateData?.downloadUrl) {
            Linking.openURL(updateData.downloadUrl);
        }
    };

    if (!needsUpdate) return null;

    return (
        <Modal transparent animationType="fade" visible={needsUpdate}>
            <View style={StyleSheet.absoluteFill}>
                <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
            </View>
            <View className="flex-1 justify-center items-center p-6 z-50">
                <View className="bg-white/10 p-[1px] rounded-3xl w-full max-w-sm">
                    <View className="bg-[#1E1B4B] rounded-[23px] overflow-hidden items-center p-8">
                        <View className="w-16 h-16 bg-blue-500/20 rounded-full items-center justify-center mb-6">
                            <Ionicons name="cloud-download-outline" size={32} color="#3b82f6" />
                        </View>
                        
                        <Text className="text-white text-2xl font-bold mb-2 text-center">
                            Update Tersedia!
                        </Text>
                        
                        <Text className="text-gray-300 text-center mb-6 text-base leading-5">
                            Versi terbaru ({updateData?.version}) wajib dipasang untuk melanjutkan aktivitas bisnis Anda di SuperKafe.
                        </Text>

                        {updateData?.releaseNotes ? (
                            <View className="bg-black/30 w-full p-4 rounded-xl mb-8">
                                <Text className="text-gray-400 text-sm italic text-center">
                                    "{updateData.releaseNotes}"
                                </Text>
                            </View>
                        ) : null}

                        <TouchableOpacity 
                            onPress={handleUpdate}
                            className="bg-blue-600 w-full py-4 rounded-xl items-center shadow-lg shadow-blue-500/30 active:scale-95 transition-transform"
                        >
                            <Text className="text-white font-bold text-lg">Update Sekarang</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
