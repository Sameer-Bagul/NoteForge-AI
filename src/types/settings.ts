export type AIProvider = 'gemini' | 'grok' | 'lmstudio' | 'ollama';

export interface ProviderConfig {
    provider: AIProvider;
    enabled: boolean;
    apiKeys: string[];      // Multiple keys; tried in order on failure
    model: string;
    indexingModel?: string; // Faster model for topic extraction
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
    gemini: 'gemini-2.0-flash',
    grok: 'grok-beta',
    lmstudio: 'local-model',
    ollama: 'qwen2.5-coder:7b',
};

export const DEFAULT_BASE_URLS: Record<AIProvider, string | undefined> = {
    gemini: 'https://generativelanguage.googleapis.com/v1beta',
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
            provider: 'ollama',
            enabled: true,
            apiKeys: [],
            model: 'qwen2.5-coder:7b',
            indexingModel: 'qwen2.5-coder:1.5b',
            baseUrl: 'http://localhost:11434',
            priority: 1,
        },
        {
            provider: 'gemini',
            enabled: true,
            apiKeys: [],
            model: 'gemini-2.0-flash',
            baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
            priority: 2,
        },
        {
            provider: 'grok',
            enabled: false,
            apiKeys: [],
            model: 'grok-beta',
            baseUrl: 'https://api.x.ai/v1',
            priority: 3,
        },
        {
            provider: 'lmstudio',
            enabled: false,
            apiKeys: [],
            model: 'local-model',
            baseUrl: 'http://localhost:1234',
            priority: 4,
        },
    ],
};
