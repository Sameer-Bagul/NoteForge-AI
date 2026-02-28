import { Router, Request, Response } from 'express';
import { AppSettings, AIProvider, ProviderConfig } from '../types';
import { getSettings, updateSettings } from '../services/multi-llm.service';

const router = Router();

// Helper: redact API keys for safe client display
function redactSettings(settings: AppSettings): AppSettings {
    return {
        providers: settings.providers.map(p => ({
            ...p,
            apiKeys: p.apiKeys.map(k => (k ? `${k.slice(0, 6)}${'*'.repeat(Math.max(0, k.length - 6))}` : '')),
        })),
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
        const { providers } = req.body as AppSettings;

        if (!Array.isArray(providers)) {
            return res.status(400).json({ success: false, error: 'providers array is required' });
        }

        const validProviders: AIProvider[] = ['gemini', 'grok', 'lmstudio', 'ollama'];

        // Validate and sanitize
        const sanitized: ProviderConfig[] = providers.map(p => {
            if (!validProviders.includes(p.provider)) {
                throw new Error(`Invalid provider: ${p.provider}`);
            }
            return {
                provider: p.provider,
                enabled: Boolean(p.enabled),
                apiKeys: Array.isArray(p.apiKeys) ? p.apiKeys.filter(k => typeof k === 'string') : [],
                model: typeof p.model === 'string' ? p.model : '',
                baseUrl: typeof p.baseUrl === 'string' ? p.baseUrl : undefined,
                priority: typeof p.priority === 'number' ? p.priority : 99,
            };
        });

        updateSettings({ providers: sanitized });

        res.json({
            success: true,
            message: 'Settings updated',
            data: redactSettings({ providers: sanitized }),
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to update settings',
        });
    }
});

export default router;
