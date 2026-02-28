import axios from 'axios';
import { jsonrepair } from 'jsonrepair';
import { AIProvider, AppSettings, LLMMessage, LLMResponse, ProviderConfig } from '../types';

// ─── Default Settings ──────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: AppSettings = {
    providers: [
        {
            provider: 'ollama',
            enabled: true,
            apiKeys: [],
            model: process.env.OLLAMA_MODEL || 'mistral',
            baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
            priority: 4,
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
            model: 'gemini-1.5-flash',
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
};

// ─── In-memory Settings Store ──────────────────────────────────────────────────

let currentSettings: AppSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));

export function getSettings(): AppSettings {
    return JSON.parse(JSON.stringify(currentSettings));
}

export function updateSettings(settings: AppSettings): void {
    currentSettings = JSON.parse(JSON.stringify(settings));
    console.log('[MultiLLM] Settings updated:', settings.providers.map(p => `${p.provider}(${p.enabled ? 'on' : 'off'},${p.apiKeys.length} keys,prio=${p.priority})`).join(', '));
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
        options: { temperature: 0.7, num_predict: 4000 },
    }, { timeout: 120000 });

    return {
        content: response.data.message?.content || '',
        tokensUsed: response.data.eval_count,
    };
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
        max_tokens: 4000,
        stream: false,
    }, { timeout: 120000 });

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
    body.generationConfig = { temperature: 0.7, maxOutputTokens: 4000 };

    const model = config.model || 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

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
        max_tokens: 4000,
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

async function callProvider(
    messages: LLMMessage[],
    config: ProviderConfig,
    apiKey: string
): Promise<LLMResponse> {
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

    async chat(messages: LLMMessage[]): Promise<LLMResponse> {
        const settings = getSettings();

        // Sort enabled providers by priority (ascending)
        const providers = settings.providers
            .filter(p => p.enabled)
            .sort((a, b) => a.priority - b.priority);

        if (providers.length === 0) {
            throw new Error('No AI providers are enabled. Please configure at least one provider in Settings.');
        }

        const errors: string[] = [];

        for (const provider of providers) {
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
                    console.warn(`[MultiLLM] ❌ ${provider.provider} key ${i + 1} failed: ${msg}`);
                    errors.push(`${provider.provider}[key${i + 1}]: ${msg}`);
                }
            }
        }

        throw new Error(`All AI providers failed:\n${errors.map(e => `  • ${e}`).join('\n')}`);
    }

    async generate(prompt: string, systemPrompt?: string): Promise<LLMResponse> {
        const messages: LLMMessage[] = [];
        if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
        messages.push({ role: 'user', content: prompt });
        return this.chat(messages);
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
}

export const multiLlmService = new MultiLLMService();
