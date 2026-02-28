import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { AppSettings, DEFAULT_SETTINGS, ProviderConfig } from '@/types/settings';

const STORAGE_KEY = 'noteforge_ai_settings';

interface SettingsContextValue {
    settings: AppSettings;
    updateProviders: (providers: ProviderConfig[]) => void;
    saveToBackend: () => Promise<void>;
    isSettingsOpen: boolean;
    openSettings: () => void;
    closeSettings: () => void;
    isSaving: boolean;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

function loadFromStorage(): AppSettings {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return DEFAULT_SETTINGS;
        const parsed = JSON.parse(raw) as AppSettings;
        // Merge with defaults to handle new providers added in later versions
        const existingProviders = new Set(parsed.providers.map(p => p.provider));
        const merged = { ...parsed };
        DEFAULT_SETTINGS.providers.forEach(dp => {
            if (!existingProviders.has(dp.provider)) {
                merged.providers.push(dp);
            }
        });
        return merged;
    } catch {
        return DEFAULT_SETTINGS;
    }
}

function saveToStorage(settings: AppSettings) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
        // storage full or unavailable
    }
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
    const [settings, setSettings] = useState<AppSettings>(loadFromStorage);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Sync to backend on initial mount
    useEffect(() => {
        syncToBackend(settings).catch(() => {
            // backend may not be running yet, silently ignore
        });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const updateProviders = useCallback((providers: ProviderConfig[]) => {
        const next = { ...settings, providers };
        setSettings(next);
        saveToStorage(next);
    }, [settings]);

    const syncToBackend = async (s: AppSettings) => {
        await fetch(`${API_BASE}/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(s),
        });
    };

    const saveToBackend = useCallback(async () => {
        setIsSaving(true);
        try {
            await syncToBackend(settings);
        } finally {
            setIsSaving(false);
        }
    }, [settings]);

    const openSettings = useCallback(() => setIsSettingsOpen(true), []);
    const closeSettings = useCallback(() => setIsSettingsOpen(false), []);

    return (
        <SettingsContext.Provider value={{
            settings,
            updateProviders,
            saveToBackend,
            isSettingsOpen,
            openSettings,
            closeSettings,
            isSaving,
        }}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings(): SettingsContextValue {
    const ctx = useContext(SettingsContext);
    if (!ctx) throw new Error('useSettings must be used within <SettingsProvider>');
    return ctx;
}
