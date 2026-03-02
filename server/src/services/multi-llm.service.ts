import axios from 'axios';
import { jsonrepair } from 'jsonrepair';
import { AIProvider, AppSettings, LLMMessage, LLMResponse, ProviderConfig, TaskMapping } from '../types/index.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { cacheService } from './cache.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Default Settings ──────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: AppSettings = {
    providers: [
        {
            provider: 'ollama',
            enabled: true,
            apiKeys: [],
            model: process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b',
            indexingModel: 'qwen2.5-coder:1.5b',
            baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
            priority: 1,
        },
        {
            provider: 'lmstudio',
            enabled: false,
            apiKeys: [],
            model: 'local-model',
            baseUrl: process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234',
            priority: 3,
        },
        {
            provider: 'gemini',
            enabled: false,
            apiKeys: process.env.GEMINI_API_KEYS ? process.env.GEMINI_API_KEYS.split(',').map(k => k.trim()) : [],
            model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
            baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
            priority: 1,
        },
        {
            provider: 'grok',
            enabled: false,
            apiKeys: process.env.GROK_API_KEYS ? process.env.GROK_API_KEYS.split(',').map(k => k.trim()) : [],
            model: 'grok-beta',
            baseUrl: 'https://api.x.ai/v1',
            priority: 2,
        },
    ],
    taskMapping: {
        notes: 'auto',
        indexing: 'auto',
        features: 'auto',
    },
};

// ─── Settings File Persistence ────────────────────────────────────────────────

const SETTINGS_FILE = path.join(__dirname, '../../storage/settings.json');

function loadSettingsFromFile(): AppSettings {
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
            const saved = JSON.parse(raw) as AppSettings;
            // Merge: start from defaults, overlay saved values so new providers/fields always appear
            const defaultMap = new Map(DEFAULT_SETTINGS.providers.map((p: ProviderConfig) => [p.provider, p]));
            const savedMap = new Map(saved.providers.map((p: ProviderConfig) => [p.provider, p]));
            const merged = Array.from(defaultMap.keys()).map((key: AIProvider) => {
                const def = defaultMap.get(key)!;
                const sv = savedMap.get(key);
                if (!sv) return def;
                return {
                    ...def,
                    ...sv,
                    model: (sv as any).model || (def as any).model,
                    indexingModel: (sv as any).indexingModel || (def as any).indexingModel,
                    baseUrl: (sv as any).baseUrl || (def as any).baseUrl,
                };
            });
            console.log('[MultiLLM] Loaded settings from file:', merged.map(p => `${p.provider}(${p.enabled ? 'ON' : 'off'})`).join(', '));
            return {
                providers: merged,
                taskMapping: saved.taskMapping || DEFAULT_SETTINGS.taskMapping
            };
        }
    } catch (e) {
        console.warn('[MultiLLM] Could not read settings file, using defaults:', e);
    }
    return DEFAULT_SETTINGS;
}

function saveSettingsToFile(settings: AppSettings): void {
    try {
        const dir = path.dirname(SETTINGS_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
    } catch (e) {
        console.warn('[MultiLLM] Could not save settings file:', e);
    }
}

// ─── In-memory Settings Store ──────────────────────────────────────────────────

let currentSettings: AppSettings = loadSettingsFromFile();

export function getSettings(): AppSettings {
    return JSON.parse(JSON.stringify(currentSettings));
}

export function updateSettings(settings: AppSettings): void {
    // Merge with defaults to ensure all fields (like indexingModel) are preserved
    const defaultMap = new Map(DEFAULT_SETTINGS.providers.map((p: ProviderConfig) => [p.provider, p]));
    const incomingMap = new Map(settings.providers.map((p: ProviderConfig) => [p.provider, p]));

    const merged = Array.from(defaultMap.keys()).map((key: AIProvider) => {
        const def = defaultMap.get(key)!;
        const inc = incomingMap.get(key);
        if (!inc) return def;
        return {
            ...def,
            ...inc,
            model: (inc as any).model || (def as any).model,
            indexingModel: (inc as any).indexingModel || (def as any).indexingModel,
            baseUrl: (inc as any).baseUrl || (def as any).baseUrl,
        };
    });

    currentSettings = {
        providers: merged,
        taskMapping: settings.taskMapping || currentSettings.taskMapping || DEFAULT_SETTINGS.taskMapping
    };
    saveSettingsToFile(currentSettings);
    console.log('[MultiLLM] Settings updated & saved (with defaults merge):', merged.map(p => `${p.provider}(${p.enabled ? 'on' : 'off'},model=${p.model},turbo=${p.indexingModel || 'none'})`).join(', '));
}

// ─── Rate Limiter (for cloud providers on free tier) ──────────────────────────
// Gemini free = 15 RPM → enforce 4s minimum between calls

const lastCallTime = new Map<string, number>();

async function enforceRateLimit(provider: string, isCloud: boolean): Promise<void> {
    if (!isCloud) return;
    const minGapMs = 4200; // 14 RPM effective (safe under 15 RPM limit)
    const last = lastCallTime.get(provider) || 0;
    const wait = minGapMs - (Date.now() - last);
    if (wait > 0) {
        console.log(`[MultiLLM] Rate limiting ${provider} — waiting ${Math.round(wait)}ms`);
        await new Promise(r => setTimeout(r, wait));
    }
    lastCallTime.set(provider, Date.now());
}

// ─── Provider Call Implementations ────────────────────────────────────────────

async function callOllama(
    messages: LLMMessage[],
    config: ProviderConfig
): Promise<LLMResponse> {
    const baseUrl = config.baseUrl || 'http://localhost:11434';
    const response = await axios.post(`${baseUrl}/api/chat`, {
        model: config.model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        stream: false,
        options: { temperature: 0.7, num_predict: 2048 },
    }, { timeout: 300000 }); // 5 minutes for local CPU tasks

    return {
        content: response.data.message?.content || '',
        tokensUsed: response.data.eval_count,
    };
}

/**
 * callOllamaStream — returns an AsyncGenerator that yields tokens.
 */
async function* callOllamaStream(
    messages: LLMMessage[],
    config: ProviderConfig
): AsyncGenerator<string> {
    const baseUrl = config.baseUrl || 'http://localhost:11434';
    const response = await axios.post(`${baseUrl}/api/chat`, {
        model: config.model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        stream: true,
        options: { temperature: 0.7, num_predict: 8192 },
    }, { responseType: 'stream', timeout: 300000 });

    for await (const chunk of response.data) {
        const text = chunk.toString();
        const lines = text.split('\n');
        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const json = JSON.parse(line);
                if (json.message?.content) {
                    yield json.message.content;
                }
                if (json.done) break;
            } catch (e) {
                // skip invalid or partial JSON
            }
        }
    }
}

async function callLMStudio(
    messages: LLMMessage[],
    config: ProviderConfig
): Promise<LLMResponse> {
    const baseUrl = config.baseUrl || 'http://localhost:1234';
    const response = await axios.post(`${baseUrl}/v1/chat/completions`, {
        model: config.model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        temperature: 0.7,
        max_tokens: 2048,
        stream: false,
    }, { timeout: 300000 }); // 5 minutes for local CPU tasks

    const choice = response.data.choices?.[0];
    return {
        content: choice?.message?.content || '',
        tokensUsed: response.data.usage?.completion_tokens,
    };
}

async function callGemini(
    messages: LLMMessage[],
    config: ProviderConfig,
    apiKey: string
): Promise<LLMResponse> {
    // Build Gemini-compatible payload
    const systemMsg = messages.find(m => m.role === 'system');
    const userMsgs = messages.filter(m => m.role !== 'system');

    const contents = userMsgs.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
    }));

    const body: Record<string, unknown> = { contents };
    if (systemMsg) {
        body.systemInstruction = { parts: [{ text: systemMsg.content }] };
    }
    body.generationConfig = { temperature: 0.7, maxOutputTokens: 3000 };

    const model = config.model || 'gemini-2.0-flash';
    const baseUrl = config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
    const url = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;

    const response = await axios.post(url, body, { timeout: 120000 });
    const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const tokens = response.data.usageMetadata?.candidatesTokenCount;

    return { content: text, tokensUsed: tokens };
}

async function callGrok(
    messages: LLMMessage[],
    config: ProviderConfig,
    apiKey: string
): Promise<LLMResponse> {
    const baseUrl = config.baseUrl || 'https://api.x.ai/v1';
    const response = await axios.post(`${baseUrl}/chat/completions`, {
        model: config.model || 'grok-beta',
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        temperature: 0.7,
        max_tokens: 3000,
    }, {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 120000,
    });

    const choice = response.data.choices?.[0];
    return {
        content: choice?.message?.content || '',
        tokensUsed: response.data.usage?.completion_tokens,
    };
}

// ─── Dispatcher ────────────────────────────────────────────────────────────────

const CLOUD_PROVIDERS = new Set(['gemini', 'grok']);

async function callProvider(
    messages: LLMMessage[],
    config: ProviderConfig,
    apiKey: string
): Promise<LLMResponse> {
    const isCloud = CLOUD_PROVIDERS.has(config.provider);
    await enforceRateLimit(config.provider, isCloud);
    switch (config.provider) {
        case 'ollama': return callOllama(messages, config);
        case 'lmstudio': return callLMStudio(messages, config);
        case 'gemini': return callGemini(messages, config, apiKey);
        case 'grok': return callGrok(messages, config, apiKey);
        default: throw new Error(`Unknown provider: ${config.provider}`);
    }
}

// ─── MultiLLMService ───────────────────────────────────────────────────────────

export class MultiLLMService {
    private getProviderForTask(task: keyof TaskMapping): ProviderConfig | null {
        const settings = getSettings();
        const mapping = (settings.taskMapping as any)[task];

        if (mapping && mapping !== 'auto') {
            const provider = settings.providers.find(p => p.provider === mapping && p.enabled);
            if (provider) return provider;
        }

        // Fallback to priority-based selection if 'auto' or mapped provider is disabled
        return settings.providers
            .filter(p => p.enabled)
            .sort((a, b) => a.priority - b.priority)[0] || null;
    }


    async chat(messages: LLMMessage[], task?: keyof TaskMapping): Promise<LLMResponse> {
        const settings = getSettings();
        let providers: ProviderConfig[] = [];

        if (task) {
            const mapped = this.getProviderForTask(task);
            if (mapped) {
                // If a specific task provider is requested, try it first, then others as fallback
                providers = [
                    mapped,
                    ...settings.providers.filter(p => p.enabled && p.provider !== mapped.provider).sort((a, b) => a.priority - b.priority)
                ];
            }
        }

        if (providers.length === 0) {
            providers = settings.providers
                .filter(p => p.enabled)
                .sort((a, b) => a.priority - b.priority);
        }

        if (providers.length === 0) {
            throw new Error('No AI providers are enabled. Please configure at least one provider in Settings.');
        }

        const errors: string[] = [];

        for (const provider of providers) {
            const isCloud = CLOUD_PROVIDERS.has(provider.provider);
            // Local providers (ollama, lmstudio) don't need API keys
            const keys = (provider.provider === 'ollama' || provider.provider === 'lmstudio')
                ? ['']
                : provider.apiKeys.filter(k => k.trim().length > 0);

            if (keys.length === 0 && provider.provider !== 'ollama' && provider.provider !== 'lmstudio') {
                console.warn(`[MultiLLM] ${provider.provider}: skipped (no API keys configured)`);
                errors.push(`${provider.provider}: no API keys`);
                continue;
            }

            for (let i = 0; i < keys.length; i++) {
                try {
                    console.log(`[MultiLLM] Trying ${provider.provider} (key ${i + 1}/${keys.length})...`);
                    const result = await callProvider(messages, provider, keys[i]);
                    console.log(`[MultiLLM] ✅ Success with ${provider.provider} (key ${i + 1})`);
                    return result;
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    const is429 = msg.includes('429') || msg.includes('Too Many Requests') || msg.includes('RESOURCE_EXHAUSTED');

                    if (is429 && isCloud) {
                        // On 429: wait 60s then retry the SAME key once before moving on
                        console.warn(`[MultiLLM] ⏳ ${provider.provider} key ${i + 1} hit rate limit (429). Waiting 60s...`);
                        await new Promise(r => setTimeout(r, 60_000));
                        try {
                            const retry = await callProvider(messages, provider, keys[i]);
                            console.log(`[MultiLLM] ✅ Retry succeeded for ${provider.provider} key ${i + 1}`);
                            return retry;
                        } catch (retryErr) {
                            const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
                            console.warn(`[MultiLLM] ❌ ${provider.provider} key ${i + 1} still failing after retry: ${retryMsg}`);
                            errors.push(`${provider.provider}[key${i + 1}][retry]: ${retryMsg}`);
                        }
                    } else {
                        console.warn(`[MultiLLM] ❌ ${provider.provider} key ${i + 1} failed: ${msg}`);
                        errors.push(`${provider.provider}[key${i + 1}]: ${msg}`);
                    }
                }
            }
        }

        throw new Error(`All AI providers failed:\n${errors.map(e => `  • ${e}`).join('\n')}`);
    }

    async generate(prompt: string, systemPrompt?: string, task?: keyof TaskMapping): Promise<LLMResponse> {
        const messages: LLMMessage[] = [];
        if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
        messages.push({ role: 'user', content: prompt });
        return this.chat(messages, task);
    }

    /**
     * generateLocal — forces Ollama/LMStudio ONLY.
     * Use for cheap repetitive tasks (topic extraction, query rewriting)
     * to avoid burning cloud API rate limits.
     */
    async generateLocal(prompt: string, systemPrompt?: string, modelOverride?: string, task: keyof TaskMapping = 'indexing'): Promise<LLMResponse> {
        const settings = getSettings();
        const mappedProvider = this.getProviderForTask(task);

        // If mapped provider is local, use it.
        // Otherwise, look for any enabled local provider.
        let providers: ProviderConfig[] = [];
        if (mappedProvider && (mappedProvider.provider === 'ollama' || mappedProvider.provider === 'lmstudio')) {
            providers = [mappedProvider];
        } else {
            providers = settings.providers
                .filter(p => p.enabled && (p.provider === 'ollama' || p.provider === 'lmstudio'))
                .sort((a, b) => a.priority - b.priority);
        }

        if (providers.length === 0) {
            // No local provider configured — fall back to full chat (uses cloud)
            console.warn('[MultiLLM] No local provider available, falling back to cloud for local task');
            return this.generate(prompt, systemPrompt, task);
        }

        const messages: LLMMessage[] = [];
        if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
        messages.push({ role: 'user', content: prompt });

        const errors: string[] = [];
        for (const provider of providers) {
            try {
                // Model Priority: Override > Provider's IndexingModel > Provider's Primary Model
                const modelToUse = modelOverride || provider.indexingModel || provider.model;
                console.log(`[MultiLLM] DEBUG: provider=${provider.provider}, indexingModel=${provider.indexingModel}, primaryModel=${provider.model}, modelToUse=${modelToUse}`);
                console.log(`[MultiLLM] Local task → ${provider.provider} (${modelToUse})`);

                const result = await callProvider(messages, { ...provider, model: modelToUse }, '');
                return result;
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.warn(`[MultiLLM] ❌ Local ${provider.provider} failed: ${msg}`);
                errors.push(`${provider.provider}: ${msg}`);
            }
        }

        // Local failed — fall back to cloud with a warning
        console.warn('[MultiLLM] All local providers failed, falling back to cloud');
        return this.generate(prompt, systemPrompt);
    }

    /**
     * generateJSONLocal — forces Ollama/LMStudio ONLY for JSON tasks.
     * Uses the same repair/cleanup logic as generateJSON.
     */
    async generateJSONLocal<T>(prompt: string, systemPrompt?: string, modelOverride?: string, retryCount: number = 0, task: keyof TaskMapping = 'indexing'): Promise<T> {
        const cacheKey = `json:local:${modelOverride || 'default'}:${systemPrompt || ''}:${prompt}`;
        const cached = await cacheService.get<T>(cacheKey);
        if (cached) {
            console.log('[MultiLLM] 💾 Cache hit for local JSON generation');
            return cached;
        }

        const strictRules = `
CRITICAL JSON RULES:
- Return ONLY valid JSON
- No comments
- No markdown code blocks
- No explanations`;

        const jsonSystemPrompt = `${systemPrompt || ''}${strictRules}`;
        const response = await this.generateLocal(prompt, jsonSystemPrompt, modelOverride);

        let jsonStr = response.content.trim();
        if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
        else if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
        if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
        jsonStr = jsonStr.trim();

        try {
            const parsed = JSON.parse(jsonStr) as T;
            await cacheService.set(cacheKey, parsed);
            return parsed;
        } catch {
            try {
                const parsed = JSON.parse(jsonrepair(jsonStr)) as T;
                await cacheService.set(cacheKey, parsed);
                return parsed;
            } catch {
                if (retryCount === 0) {
                    return this.generateJSONLocal<T>(prompt, systemPrompt, modelOverride, 1);
                }
                throw new Error(`Local LLM returned invalid JSON for task: ${String(task)}`);
            }
        }
    }

    async generateJSON<T>(prompt: string, systemPrompt?: string, retryCount = 0): Promise<T> {
        const strictRules = `

CRITICAL JSON RULES:
- Return ONLY valid JSON
- No comments (// or /* */)
- No markdown or code blocks
- No trailing commas
- Strings must use double quotes only
- If a list is empty, return []
- Do NOT add explanations or text outside the JSON`;

        const jsonSystemPrompt = `${systemPrompt || ''}${strictRules}`;
        const response = await this.generate(prompt, jsonSystemPrompt);

        let jsonStr = response.content.trim();
        if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
        else if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
        if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
        jsonStr = jsonStr.trim();

        try {
            return JSON.parse(jsonStr) as T;
        } catch {
            try {
                return JSON.parse(jsonrepair(jsonStr)) as T;
            } catch {
                try {
                    const cleaned = jsonStr
                        .replace(/\/\/.*$/gm, '')
                        .replace(/\/\*[\s\S]*?\*\//g, '')
                        .replace(/,\s*([}\]])/g, '$1')
                        .trim();
                    return JSON.parse(cleaned) as T;
                } catch {
                    if (retryCount === 0) {
                        console.warn('[MultiLLM] JSON parse failed, retrying with stricter prompt...');
                        const retryPrompt = `${prompt}\n\n⚠️ IMPORTANT: The previous output was invalid JSON. Please produce the SAME content again, but as strictly valid JSON with no comments or extra text.`;
                        return this.generateJSON<T>(retryPrompt, systemPrompt, 1);
                    }
                    throw new Error('LLM returned invalid JSON after multiple attempts');
                }
            }
        }
    }

    // Check health of the primary (first enabled) provider
    async checkHealth(): Promise<{ healthy: boolean; provider: AIProvider | null; error?: string }> {
        const settings = getSettings();
        const first = settings.providers
            .filter(p => p.enabled)
            .sort((a, b) => a.priority - b.priority)[0];

        if (!first) return { healthy: false, provider: null, error: 'No providers enabled' };

        try {
            if (first.provider === 'ollama') {
                const baseUrl = first.baseUrl || 'http://localhost:11434';
                const res = await axios.get(`${baseUrl}/api/tags`, { timeout: 5000 });
                return { healthy: res.status === 200, provider: 'ollama' };
            } else if (first.provider === 'lmstudio') {
                const baseUrl = first.baseUrl || 'http://localhost:1234';
                const res = await axios.get(`${baseUrl}/v1/models`, { timeout: 5000 });
                return { healthy: res.status === 200, provider: 'lmstudio' };
            } else {
                // Cloud providers — just verify there's at least one key
                const hasKey = first.apiKeys.filter(k => k.trim()).length > 0;
                return { healthy: hasKey, provider: first.provider, error: hasKey ? undefined : 'No API key set' };
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return { healthy: false, provider: first.provider, error: msg };
        }
    }

    getActiveProviders(): ProviderConfig[] {
        return getSettings().providers.filter(p => p.enabled).sort((a, b) => a.priority - b.priority);
    }

    /** Returns true if the primary active provider is a cloud provider (Gemini, Grok) */
    isPrimaryCloudProvider(): boolean {
        const first = this.getActiveProviders()[0];
        return !!first && CLOUD_PROVIDERS.has(first.provider);
    }

    /** Returns the primary active provider name */
    getPrimaryProvider(): string | null {
        return this.getActiveProviders()[0]?.provider ?? null;
    }

    /**
     * Specialized note generation call — uses 8192 output tokens for cloud providers
     * (vs. the standard 3000 used for topic extraction).
     */
    async generateNotesContent(prompt: string, systemPrompt?: string): Promise<LLMResponse> {
        const settings = getSettings();
        const mapped = this.getProviderForTask('notes');
        const providers = mapped
            ? [mapped, ...settings.providers.filter(p => p.enabled && p.provider !== mapped.provider).sort((a, b) => a.priority - b.priority)]
            : settings.providers.filter(p => p.enabled).sort((a, b) => a.priority - b.priority);

        if (providers.length === 0) {
            throw new Error('No AI providers are enabled. Please configure at least one provider in Settings.');
        }

        const errors: string[] = [];
        const messages: LLMMessage[] = [];
        if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
        messages.push({ role: 'user', content: prompt });

        for (const provider of providers) {
            const isCloud = CLOUD_PROVIDERS.has(provider.provider);
            const keys = (provider.provider === 'ollama' || provider.provider === 'lmstudio')
                ? ['']
                : provider.apiKeys.filter(k => k.trim().length > 0);

            if (keys.length === 0 && isCloud) {
                errors.push(`${provider.provider}: no API keys`);
                continue;
            }

            for (let i = 0; i < keys.length; i++) {
                try {
                    await enforceRateLimit(provider.provider, isCloud);

                    let result: LLMResponse;

                    if (provider.provider === 'gemini') {
                        // Gemini: 8192 tokens for rich detailed notes
                        const systemMsg = messages.find(m => m.role === 'system');
                        const userMsgs = messages.filter(m => m.role !== 'system');
                        const contents = userMsgs.map(m => ({
                            role: m.role === 'assistant' ? 'model' : 'user',
                            parts: [{ text: m.content }],
                        }));
                        const body: Record<string, unknown> = { contents };
                        if (systemMsg) body.systemInstruction = { parts: [{ text: systemMsg.content }] };
                        body.generationConfig = { temperature: 0.8, maxOutputTokens: 8192 };
                        const model = provider.model || 'gemini-2.0-flash';
                        const baseUrl = provider.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
                        const url = `${baseUrl}/models/${model}:generateContent?key=${keys[i]}`;
                        const response = await axios.post(url, body, { timeout: 180000 });
                        const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                        result = { content: text, tokensUsed: response.data.usageMetadata?.candidatesTokenCount };
                    } else if (provider.provider === 'grok') {
                        const baseUrl = provider.baseUrl || 'https://api.x.ai/v1';
                        const response = await axios.post(`${baseUrl}/chat/completions`, {
                            model: provider.model || 'grok-beta',
                            messages: messages.map(m => ({ role: m.role, content: m.content })),
                            temperature: 0.8,
                            max_tokens: 8192,
                        }, {
                            headers: { Authorization: `Bearer ${keys[i]}`, 'Content-Type': 'application/json' },
                            timeout: 180000,
                        });
                        result = { content: response.data.choices?.[0]?.message?.content || '', tokensUsed: response.data.usage?.completion_tokens };
                    } else {
                        // Local fallback: use standard generate
                        result = await callProvider(messages, provider, keys[i]);
                    }

                    console.log(`[MultiLLM] ✅ Notes generated with ${provider.provider} (key ${i + 1}), tokens: ${result.tokensUsed ?? '?'}`);
                    return result;
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    const is429 = msg.includes('429') || msg.includes('Too Many Requests') || msg.includes('RESOURCE_EXHAUSTED');

                    if (is429 && isCloud) {
                        // On 429: wait 60s then retry the SAME key once
                        console.warn(`[MultiLLM] ⏳ ${provider.provider} notes key ${i + 1} hit rate limit (429). Waiting 60s...`);
                        await new Promise(r => setTimeout(r, 60_000));
                        try {
                            const model = provider.model || 'gemini-2.0-flash';
                            const baseUrl = provider.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';

                            const retry = await axios.post(
                                provider.provider === 'gemini'
                                    ? `${baseUrl}/models/${model}:generateContent?key=${keys[i]}`
                                    : `${provider.baseUrl || 'https://api.x.ai/v1'}/chat/completions`,
                                provider.provider === 'gemini'
                                    ? {
                                        contents: messages.filter(m => m.role !== 'system').map(m => ({
                                            role: m.role === 'assistant' ? 'model' : 'user',
                                            parts: [{ text: m.content }],
                                        })),
                                        systemInstruction: messages.find(m => m.role === 'system')
                                            ? { parts: [{ text: messages.find(m => m.role === 'system')!.content }] }
                                            : undefined,
                                        generationConfig: { temperature: 0.8, maxOutputTokens: 8192 }
                                    }
                                    : {
                                        model: provider.model || 'grok-beta',
                                        messages: messages.map(m => ({ role: m.role, content: m.content })),
                                        temperature: 0.8,
                                        max_tokens: 8192,
                                    },
                                {
                                    headers: provider.provider === 'grok'
                                        ? { Authorization: `Bearer ${keys[i]}`, 'Content-Type': 'application/json' }
                                        : undefined,
                                    timeout: 180000
                                }
                            );

                            let retryRes: LLMResponse;
                            if (provider.provider === 'gemini') {
                                retryRes = {
                                    content: retry.data.candidates?.[0]?.content?.parts?.[0]?.text || '',
                                    tokensUsed: retry.data.usageMetadata?.candidatesTokenCount
                                };
                            } else {
                                retryRes = {
                                    content: retry.data.choices?.[0]?.message?.content || '',
                                    tokensUsed: retry.data.usage?.completion_tokens
                                };
                            }
                            console.log(`[MultiLLM] ✅ Retry succeeded for ${provider.provider} notes key ${i + 1}`);
                            return retryRes;
                        } catch (retryErr) {
                            const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
                            console.warn(`[MultiLLM] ❌ ${provider.provider} notes key ${i + 1} still failing after retry: ${retryMsg}`);
                            errors.push(`${provider.provider}[key${i + 1}][retry]: ${retryMsg}`);
                        }
                    } else {
                        console.warn(`[MultiLLM] ❌ ${provider.provider} key ${i + 1} failed: ${msg}`);
                        errors.push(`${provider.provider}[key${i + 1}]: ${msg}`);
                    }
                }
            }
        }

        throw new Error(`All providers failed for note generation:\n${errors.map(e => `  • ${e}`).join('\n')}`);
    }

    /**
     * generateNotesStream — yields tokens in real-time.
     * Optimized for local Ollama to provide instant feedback on CPU.
     */
    async *generateNotesStream(prompt: string, systemPrompt?: string): AsyncGenerator<string> {
        const settings = getSettings();
        const providers = settings.providers
            .filter(p => p.enabled)
            .sort((a, b) => a.priority - b.priority);

        if (providers.length === 0) throw new Error('No AI providers enabled');

        const messages: LLMMessage[] = [];
        if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
        messages.push({ role: 'user', content: prompt });

        const errors: string[] = [];
        for (const provider of providers) {
            try {
                if (provider.provider === 'ollama') {
                    console.log(`[MultiLLM] 🌊 Streaming notes from Ollama (${provider.model})...`);
                    yield* callOllamaStream(messages, provider);
                    return;
                } else {
                    // Fallback to non-streaming for others for now
                    console.log(`[MultiLLM] 📝 Non-streaming fallback for ${provider.provider}`);
                    const res = await this.generateNotesContent(prompt, systemPrompt);
                    yield res.content;
                    return;
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.warn(`[MultiLLM] ❌ Streaming attempt failed for ${provider.provider}: ${msg}`);
                errors.push(`${provider.provider}: ${msg}`);
            }
        }

        throw new Error(`All providers failed for streaming notes:\n${errors.map(e => `  • ${e}`).join('\n')}`);
    }
}

export const multiLlmService = new MultiLLMService();
