import { Router, Request, Response } from 'express';
import { AppSettings, AIProvider, ProviderConfig } from '../types/index.js';
import { getSettings, updateSettings } from '../services/multi-llm.service.js';

const router = Router();

// Helper: redact API keys for safe client display
function redactSettings(settings: AppSettings): AppSettings {
    return {
        providers: settings.providers.map((p: ProviderConfig) => ({
            ...p,
            apiKeys: p.apiKeys.map((k: string) => (k ? `${k.slice(0, 6)}${'*'.repeat(Math.max(0, k.length - 6))}` : '')),
        })),
        taskMapping: settings.taskMapping,
    };
}

// GET /api/settings — return current settings (with redacted keys)
router.get('/', (req: Request, res: Response) => {
    try {
        const settings = getSettings();
        res.json({ success: true, data: redactSettings(settings) });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to get settings' });
    }
});

// GET /api/settings/full — return current settings with full keys (for editing UI)
router.get('/full', (req: Request, res: Response) => {
    try {
        const settings = getSettings();
        res.json({ success: true, data: settings });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to get settings' });
    }
});

// POST /api/settings — update settings
router.post('/', (req: Request, res: Response) => {
    try {
        const { providers, taskMapping } = req.body as AppSettings;

        if (!Array.isArray(providers)) {
            return res.status(400).json({ success: false, error: 'providers array is required' });
        }

        const validProviders: AIProvider[] = ['gemini', 'grok', 'lmstudio', 'ollama'];

        // Validate and sanitize
        const sanitized: ProviderConfig[] = providers.map((p: any) => {
            if (!validProviders.includes(p.provider)) {
                throw new Error(`Invalid provider: ${p.provider}`);
            }
            return {
                provider: p.provider,
                enabled: Boolean(p.enabled),
                apiKeys: Array.isArray(p.apiKeys) ? p.apiKeys.filter((k: any) => typeof k === 'string') : [],
                model: typeof p.model === 'string' ? p.model : '',
                indexingModel: typeof p.indexingModel === 'string' ? p.indexingModel : undefined,
                baseUrl: typeof p.baseUrl === 'string' ? p.baseUrl : undefined,
                priority: typeof p.priority === 'number' ? p.priority : 99,
            };
        });

        updateSettings({
            providers: sanitized,
            taskMapping: taskMapping || { notes: 'auto', indexing: 'auto', features: 'auto' }
        });

        res.json({
            success: true,
            message: 'Settings updated',
            data: redactSettings({
                providers: sanitized,
                taskMapping: taskMapping || { notes: 'auto', indexing: 'auto', features: 'auto' }
            }),
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to update settings',
        });
    }
});

// GET /api/settings/ollama/models — fetch available models from local Ollama
router.get('/ollama/models', async (req: Request, res: Response) => {
    try {
        const settings = getSettings();
        const ollama = settings.providers.find((p: ProviderConfig) => p.provider === 'ollama');
        const baseUrl = ollama?.baseUrl || 'http://localhost:11434';

        // Use axios to fetch from Ollama's API
        const response = await fetch(`${baseUrl}/api/tags`);
        if (!response.ok) {
            throw new Error(`Ollama returned ${response.status}`);
        }

        const data: any = await response.json();
        const models = data.models?.map((m: any) => ({
            name: m.name,
            size: m.size,
            details: m.details
        })) || [];

        res.json({ success: true, models });
    } catch (error) {
        console.error('[Settings] Ollama discovery failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch Ollama models. Is Ollama running?',
            models: [] // Return empty list instead of erroring out UI
        });
    }
});

export default router;
