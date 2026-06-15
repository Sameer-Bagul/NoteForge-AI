export type AIProvider = 'gemini' | 'grok' | 'lmstudio' | 'ollama';

export interface ProviderConfig {
    provider: AIProvider;
    enabled: boolean;
    apiKey?: string;        // Single API key
    model: string;
    indexingModel?: string; // Faster model for topic extraction
    baseUrl?: string;       // For local providers (Ollama, LM Studio)
    priority: number;       // Lower = tried first
}

export interface TaskMapping {
    notes: AIProvider | 'auto';
    indexing: AIProvider | 'auto';
    features: AIProvider | 'auto';
}

export type PdfTheme = 'modern' | 'academic' | 'dark' | 'corporate';

export interface AppSettings {
    providers: ProviderConfig[];
    taskMapping: TaskMapping;
    pineconeApiKey?: string;
    pineconeIndex?: string;
    pdfTheme?: PdfTheme;
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
    gemini: 'gemini-flash-latest',
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
            apiKey: '',
            model: 'qwen2.5-coder:7b',
            indexingModel: 'qwen2.5-coder:1.5b',
            baseUrl: 'http://localhost:11434',
            priority: 1,
        },
        {
            provider: 'gemini',
            enabled: true,
            apiKey: '',
            model: 'gemini-3.5-flash',
            baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
            priority: 2,
        },
        {
            provider: 'grok',
            enabled: false,
            apiKey: '',
            model: 'grok-beta',
            baseUrl: 'https://api.x.ai/v1',
            priority: 3,
        },
        {
            provider: 'lmstudio',
            enabled: false,
            apiKey: '',
            model: 'local-model',
            baseUrl: 'http://localhost:1234',
            priority: 4,
        },
    ],
    taskMapping: {
        notes: 'auto',
        indexing: 'auto',
        features: 'auto',
    },
    pdfTheme: 'modern',
};
