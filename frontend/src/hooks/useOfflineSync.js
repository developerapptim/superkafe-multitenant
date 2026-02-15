import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import db from '../utils/db'; // Adjust path as needed
import { menuAPI, ordersAPI } from '../services/api';

const useOfflineSync = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isSyncing, setIsSyncing] = useState(false);

    // 1. Monitor Online Status
    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            toast.success('Kembali Online! 🌐');
            syncOfflineOrders();
        };
        const handleOffline = () => {
            setIsOnline(false);
            toast('Mode Offline 🔌', { icon: '📡' });
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Initial Sync check on mount if online
        if (navigator.onLine) {
            syncOfflineOrders();
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // 2. Hydrate Menu Data (Sync Cloud -> Local DB)
    const hydrateMenu = async () => {
        if (!navigator.onLine) return; // Can't hydrate if offline

        try {
            const { data } = await menuAPI.getAll();
            if (data && Array.isArray(data)) {
                // Bulk put to update existing or add new
                // Map API data to DB schema
                const itemsRequest = data.map(item => ({
                    ...item, // Store all fields
                    id: item.id // Ensure ID is present for PK
                }));

                await db.products.bulkPut(itemsRequest);
                console.log('Menu hydrated to local DB:', itemsRequest.length);
            }
        } catch (error) {
            console.error('Failed to hydrate menu:', error);
        }
    };

    // Hydrate on mount (or you can trigger this manually/periodically)
    useEffect(() => {
        hydrateMenu();
    }, [isOnline]); // Retry hydration when coming online

    // 3. Sync Offline Orders (Local DB -> Cloud)
    const syncOfflineOrders = async () => {
        if (isSyncing) return;

        try {
            const offlineOrders = await db.offline_orders.where('synced').equals(0).toArray(); // Assuming 0 = false

            if (offlineOrders.length === 0) return;

            setIsSyncing(true);
            const toastId = toast.loading(`Sinkronisasi ${offlineOrders.length} transaksi offline...`);

            let successCount = 0;
            let failCount = 0;

            for (const order of offlineOrders) {
                try {
                    // Send to Backend
                    // MUST ensure backend accepts the original 'timestamp' or 'date' to preserve history
                    await ordersAPI.create(order.data);

                    // If success, delete from local DB or mark synced
                    await db.offline_orders.delete(order.id);
                    successCount++;
                } catch (err) {
                    console.error('Sync failed for order:', order.id, err);
                    failCount++;
                }
            }

            if (successCount > 0) {
                toast.success(`${successCount} transaksi berhasil disinkronkan!`, { id: toastId });
            } else if (failCount > 0) {
                toast.error(`Gagal sinkronisasi ${failCount} transaksi.`, { id: toastId });
            } else {
                toast.dismiss(toastId);
            }
        } catch (error) {
            console.error('Sync error:', error);
        } finally {
            setIsSyncing(false);
        }
    };

    // 4. Save Order Offline
    const saveOrderOffline = async (orderData) => {
        try {
            // Add metadata
            const offlineData = {
                timestamp: Date.now(),
                synced: 0, // 0 for false (Dexie prefers numbers for indexing sometimes, but boolean works too)
                data: orderData
            };

            await db.offline_orders.add(offlineData);
            toast.success('Disimpan Offline via Dexie! 📥');
            return true;
        } catch (error) {
            console.error('Failed to save offline:', error);
            toast.error('Gagal menyimpan offline database full?');
            return false;
        }
    };

    // Get Menu from Local DB (fallback)
    const getLocalMenu = async () => {
        return await db.products.toArray();
    };

    return {
        isOnline,
        isSyncing,
        hydrateMenu,
        syncOfflineOrders,
        saveOrderOffline,
        getLocalMenu,
    };
};

export default useOfflineSync;
