import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { AppSettings, DEFAULT_SETTINGS, ProviderConfig } from '@/types/settings';

const STORAGE_KEY = 'noteforge_ai_settings';

interface SettingsContextValue {
    settings: AppSettings;
    updateProviders: (providers: ProviderConfig[]) => void;
    updateTaskMapping: (mapping: AppSettings['taskMapping']) => void;
    updateSettings: (updates: Partial<AppSettings>) => void;
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

        // Merge each provider: start from the current default then overlay saved values.
        // This ensures new fields (model, baseUrl) are always pre-filled even for
        // providers that were already saved before the defaults changed.
        const defaultMap = new Map(DEFAULT_SETTINGS.providers.map(p => [p.provider, p]));
        const savedMap = new Map(parsed.providers.map(p => [p.provider, p]));

        const mergedProviders = Array.from(defaultMap.keys()).map(key => {
            const def = defaultMap.get(key)!;
            const saved = savedMap.get(key as any);
            if (!saved) return def;
            return {
                ...def,         // start with full defaults (model, baseUrl, etc.)
                ...saved,       // overlay user's saved values (enabled, apiKeys, priority)
                // Always keep default model/baseUrl if the saved value is empty/missing
                // OR if it's the old 'mistral' default we want to migrate away from
                model: (saved.model && saved.model !== 'mistral') ? saved.model : def.model,
                indexingModel: saved.indexingModel || def.indexingModel,
                baseUrl: saved.baseUrl || def.baseUrl,
            };
        });

        return {
            providers: mergedProviders,
            taskMapping: parsed.taskMapping || DEFAULT_SETTINGS.taskMapping,
            pdfTheme: parsed.pdfTheme || DEFAULT_SETTINGS.pdfTheme
        };
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
        setSettings(prev => {
            const next = { ...prev, providers };
            saveToStorage(next);
            return next;
        });
    }, []);

    const updateTaskMapping = useCallback((taskMapping: AppSettings['taskMapping']) => {
        setSettings(prev => {
            const next = { ...prev, taskMapping };
            saveToStorage(next);
            return next;
        });
    }, []);

    const updateSettings = useCallback((updates: Partial<AppSettings>) => {
        setSettings(prev => {
            const next = { ...prev, ...updates };
            saveToStorage(next);
            return next;
        });
    }, []);

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
            updateTaskMapping,
            updateSettings,
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
