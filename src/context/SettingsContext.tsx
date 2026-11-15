import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { AppSettings, DEFAULT_SETTINGS, ProviderConfig } from '@/types/settings';
import { tauriApi, isTauri } from '@/services/tauri';

const STORAGE_KEY = 'noteforge_ai_settings';

interface SettingsContextValue {
    settings: AppSettings;
    updateProviders: (providers: ProviderConfig[]) => void;
    updateTaskMapping: (mapping: AppSettings['taskMapping']) => void;
    updateSettings: (updates: Partial<AppSettings>) => void;
    saveSettings: (newSettings: AppSettings) => Promise<void>;
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

        const defaultMap = new Map(DEFAULT_SETTINGS.providers.map(p => [p.provider, p]));
        const savedMap = new Map(parsed.providers.map(p => [p.provider, p]));

        const mergedProviders = Array.from(defaultMap.keys()).map(key => {
            const def = defaultMap.get(key)!;
            const saved = savedMap.get(key as any);
            if (!saved) return def;
            let model = saved.model;
            let indexingModel = saved.indexingModel;
            if (model === 'llama3.2:1b' || model === 'mistral') model = def.model;
            if (indexingModel === 'llama3.2:1b') indexingModel = def.indexingModel;
            return {
                ...def,
                ...saved,
                apiKey: saved.apiKey || def.apiKey || '',
                model: model || def.model,
                indexingModel: indexingModel || def.indexingModel,
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

    // Initial mount: load keychain keys in Tauri mode & sync to backend if available
    useEffect(() => {
        if (isTauri()) {
            (async () => {
                try {
                    const updated = await Promise.all(
                        settings.providers.map(async p => {
                            try {
                                const key = await tauriApi.getApiKey(p.provider);
                                if (key) {
                                    return { ...p, apiKey: key };
                                }
                            } catch (e) {
                                console.warn(`Could not load keychain key for ${p.provider}:`, e);
                            }
                            return p;
                        })
                    );
                    setSettings(prev => ({ ...prev, providers: updated }));
                } catch (e) {
                    console.error('Failed to load keys from native keychain:', e);
                }
            })();
        } else {
            syncToBackend(settings).catch(() => {
                // backend may not be running yet, silently ignore
            });
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const updateProviders = useCallback((providers: ProviderConfig[]) => {
        setSettings(prev => {
            const next = { ...prev, providers };
            saveToStorage(next);
            return next;
        });

        if (isTauri()) {
            for (const p of providers) {
                if (p.apiKey) {
                    tauriApi.saveApiKey(p.provider, p.apiKey).catch(console.error);
                } else {
                    tauriApi.deleteApiKey(p.provider).catch(console.error);
                }
            }
        }
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

    const saveSettings = useCallback(async (newSettings: AppSettings) => {
        setIsSaving(true);
        try {
            setSettings(newSettings);
            saveToStorage(newSettings);
            if (isTauri()) {
                for (const p of newSettings.providers) {
                    if (p.apiKey && p.apiKey.trim()) {
                        await tauriApi.saveApiKey(p.provider, p.apiKey.trim());
                    } else {
                        await tauriApi.deleteApiKey(p.provider).catch(() => {});
                    }
                }
            } else {
                await syncToBackend(newSettings).catch(() => {});
            }
        } finally {
            setIsSaving(false);
        }
    }, []);

    const saveToBackend = useCallback(async () => {
        await saveSettings(settings);
    }, [saveSettings, settings]);

    const openSettings = useCallback(() => setIsSettingsOpen(true), []);
    const closeSettings = useCallback(() => setIsSettingsOpen(false), []);

    return (
        <SettingsContext.Provider value={{
            settings,
            updateProviders,
            updateTaskMapping,
            updateSettings,
            saveSettings,
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
