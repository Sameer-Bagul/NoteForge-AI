export type AIProvider = 'gemini' | 'grok' | 'lmstudio' | 'ollama';

export interface ProviderConfig {
    provider: AIProvider;
    enabled: boolean;
    apiKeys: string[];      // Multiple keys; tried in order on failure
    model: string;
    baseUrl?: string;       // For local providers (Ollama, LM Studio)
    priority: number;       // Lower = tried first
}

export interface AppSettings {
    providers: ProviderConfig[];
}

export const PROVIDER_LABELS: Record<AIProvider, string> = {
    gemini: 'Google Gemini',
    grok: 'xAI Grok',
    lmstudio: 'LM Studio',
    ollama: 'Ollama',
};

export const PROVIDER_DESCRIPTIONS: Record<AIProvider, string> = {
    gemini: 'Cloud AI by Google. Requires API key.',
    grok: 'Cloud AI by xAI. Requires API key.',
    lmstudio: 'Local AI via LM Studio (OpenAI-compatible).',
    ollama: 'Local AI via Ollama. No API key needed.',
};

export const DEFAULT_MODELS: Record<AIProvider, string> = {
    gemini: 'gemini-1.5-flash',
    grok: 'grok-beta',
    lmstudio: 'local-model',
    ollama: 'mistral',
};

export const DEFAULT_BASE_URLS: Record<AIProvider, string | undefined> = {
    gemini: undefined,
    grok: 'https://api.x.ai/v1',
    lmstudio: 'http://localhost:1234',
    ollama: 'http://localhost:11434',
};

export const IS_LOCAL_PROVIDER: Record<AIProvider, boolean> = {
    gemini: false,
    grok: false,
    lmstudio: true,
    ollama: true,
};

export const DEFAULT_SETTINGS: AppSettings = {
    providers: [
        {
            provider: 'gemini',
            enabled: false,
            apiKeys: [],
            model: 'gemini-1.5-flash',
            priority: 1,
        },
        {
            provider: 'grok',
            enabled: false,
            apiKeys: [],
            model: 'grok-beta',
            baseUrl: 'https://api.x.ai/v1',
            priority: 2,
        },
        {
            provider: 'lmstudio',
            enabled: false,
            apiKeys: [],
            model: 'local-model',
            baseUrl: 'http://localhost:1234',
            priority: 3,
        },
        {
            provider: 'ollama',
            enabled: true,
            apiKeys: [],
            model: 'mistral',
            baseUrl: 'http://localhost:11434',
            priority: 4,
        },
    ],
};
