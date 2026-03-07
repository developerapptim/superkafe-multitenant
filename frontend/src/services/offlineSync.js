import { get, set, del, keys } from 'idb-keyval';
import api from './api';

const OFFLINE_QUEUE_KEY = 'superkafe_offline_orders';

export const saveOrderOffline = async (orderData) => {
    try {
        const currentOrders = (await get(OFFLINE_QUEUE_KEY)) || [];
        // Attach a temporary unique ID
        const tempId = `offline-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const orderToSave = { ...orderData, _tempId: tempId, offline_timestamp: new Date().toISOString() };

        currentOrders.push(orderToSave);
        await set(OFFLINE_QUEUE_KEY, currentOrders);
        console.log(`[Offline Sync] Order saved locally. Added to queue: ${tempId}`);
        return { success: true, tempId, isOffline: true };
    } catch (error) {
        console.error('[Offline Sync] Failed to save order offline:', error);
        throw error;
    }
};

export const getOfflineOrders = async () => {
    return (await get(OFFLINE_QUEUE_KEY)) || [];
};

export const syncOfflineOrders = async () => {
    let currentQueue = await getOfflineOrders();
    if (currentQueue.length === 0) return;

    if (!navigator.onLine) {
        console.log('[Offline Sync] Trying to sync but still offline. Aborting.');
        return;
    }

    console.log(`[Offline Sync] Processing ${currentQueue.length} offline orders...`);

    // We MUST copy the array because we modify currentQueue dynamically during iteration
    for (const order of [...currentQueue]) {
        const { _tempId, offline_timestamp, ...orderPayload } = order;
        try {
            await api.post('/orders', orderPayload);
            console.log(`[Offline Sync] Successfully synced order: ${_tempId}`);

            // Atomic removal immediately after success to survive browser force close
            currentQueue = currentQueue.filter(o => o._tempId !== _tempId);
            await set(OFFLINE_QUEUE_KEY, currentQueue);

        } catch (error) {
            console.error(`[Offline Sync] Failed to sync order ${_tempId}:`, error);

            const status = error?.response?.status;
            // E11000 Duplicate Key or Joi Validation errors should be discarded, never retried
            if (status >= 400 && status < 500) {
                console.log(`[Offline Sync] Discarding order ${_tempId} due to client error (${status}) to prevent retry loops.`);
                currentQueue = currentQueue.filter(o => o._tempId !== _tempId);
                await set(OFFLINE_QUEUE_KEY, currentQueue);
            }
            // If it's 5xx or Network Error, it remains in currentQueue naturally for the next sync attempt.
        }
    }

    if (currentQueue.length > 0) {
        console.log(`[Offline Sync] Finished with ${currentQueue.length} failures left in queue.`);
    } else {
        console.log(`[Offline Sync] All offline orders synced successfully! 🎉`);
    }
};

// Listeners to auto-sync when connection is restored
if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        console.log('[Offline Sync] Internet connection detected! Triggering auto-sync...');
        syncOfflineOrders();
    });
}
