import { Router } from 'express';
import { SettingsController } from '../controllers/settings.controller.js';

const router = Router();

// GET /api/settings — return current settings (with redacted keys)
router.get('/', SettingsController.getSettings);

// GET /api/settings/full — return current settings with full keys (for editing UI)
router.get('/full', SettingsController.getFullSettings);

// POST /api/settings — update settings
router.post('/', SettingsController.updateSettings);

// GET /api/settings/ollama/models — fetch available models from local Ollama
router.get('/ollama/models', SettingsController.getOllamaModels);

export default router;
