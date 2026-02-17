
import { createContext, useContext, useState, useCallback, useRef } from 'react';

const RefreshContext = createContext(null);

export const RefreshProvider = ({ children }) => {
    // We use a ref for the handler to always access the latest one without causing re-renders
    const refreshHandlerRef = useRef(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Function to register a refresh handler
    // This should be called in useEffect of the page component
    const registerRefreshHandler = useCallback((handler) => {
        refreshHandlerRef.current = handler;

        // Cleanup function to be returned by useEffect
        return () => {
            refreshHandlerRef.current = null;
        };
    }, []);

    // Function to trigger the refresh
    const triggerRefresh = useCallback(async () => {
        if (refreshHandlerRef.current) {
            try {
                setIsRefreshing(true);
                // Ensure minimum loading time for better UX
                const startTime = Date.now();
                await refreshHandlerRef.current();
                const elapsedTime = Date.now() - startTime;

                if (elapsedTime < 500) {
                    await new Promise(resolve => setTimeout(resolve, 500 - elapsedTime));
                }
            } catch (error) {
                console.error("Refresh failed:", error);
            } finally {
                setIsRefreshing(false);
            }
        } else {
            // If no handler, just simulate a short delay
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }, []);

    return (
        <RefreshContext.Provider value={{ registerRefreshHandler, triggerRefresh, isRefreshing }}>
            {children}
        </RefreshContext.Provider>
    );
};

export const useRefresh = () => {
    const context = useContext(RefreshContext);
    if (!context) {
        throw new Error('useRefresh must be used within a RefreshProvider');
    }
    return context;
};
