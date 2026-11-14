import { useState, useCallback, useEffect, useMemo } from 'react';
import {
    Plus, Eye, EyeOff, ChevronUp, ChevronDown, Zap, Save,
    CheckCircle2, Cpu, Settings2, Loader2, ShieldCheck, Database, Sliders
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSettings } from '@/context/SettingsContext';
import {
    ProviderConfig,
    AIProvider,
    TaskMapping,
    AppSettings,
    PROVIDER_LABELS,
    PROVIDER_DESCRIPTIONS,
    DEFAULT_MODELS,
    DEFAULT_BASE_URLS,
    IS_LOCAL_PROVIDER
} from '@/types/settings';
import { cn } from '@/lib/utils';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import { toast } from '@/hooks/use-toast';

// ─── Provider Icon ─────────────────────────────────────────────────────────────

const PROVIDER_ICONS: Record<AIProvider, React.ReactNode> = {
    gemini: (
        <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="none">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#4285F4" />
            <path d="M12 6l1.5 4.5H18l-3.75 2.75 1.5 4.5L12 15 8.25 17.75l1.5-4.5L6 10.5h4.5z" fill="white" />
        </svg>
    ),
    grok: (
        <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="currentColor">
            <path d="M13.55 3.27L4.72 20.6h3.61l7.05-14.5 6.1 14.5H25l-9.91-17.33h-1.54zM3.02 14.36l1.36-2.59h9.2l-1.36 2.59z" />
        </svg>
    ),
    lmstudio: <Cpu className="w-4.5 h-4.5" />,
    ollama: <Zap className="w-4.5 h-4.5" />,
};

// ─── Provider Card ─────────────────────────────────────────────────────────────

function ProviderCard({
    config,
    index,
    total,
    onChange,
    onMoveUp,
    onMoveDown,
    availableModels,
}: {
    config: ProviderConfig;
    index: number;
    total: number;
    onChange: (updated: ProviderConfig) => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    availableModels?: string[];
}) {
    const isLocal = IS_LOCAL_PROVIDER[config.provider];
    const isOllama = config.provider === 'ollama';
    const [expanded, setExpanded] = useState(config.enabled);
    const [keyVisible, setKeyVisible] = useState(false);

    const update = (patch: Partial<ProviderConfig>) => onChange({ ...config, ...patch });

    return (
        <div className={cn(
            'rounded-xl border border-border/60 bg-card/60 transition-all duration-150 overflow-hidden',
            config.enabled ? 'border-border shadow-xs' : 'opacity-65 saturate-70 bg-card/30'
        )}>
            {/* Card header */}
            <div
                className="flex items-center gap-3.5 px-4 py-3 cursor-pointer select-none"
                onClick={() => setExpanded(e => !e)}
            >
                {/* Priority reorder controls */}
                <div className="flex flex-col gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                    <button
                        disabled={index === 0}
                        onClick={onMoveUp}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors p-0.5"
                        title="Move priority up"
                    >
                        <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                        disabled={index === total - 1}
                        onClick={onMoveDown}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors p-0.5"
                        title="Move priority down"
                    >
                        <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                </div>

                <span className="text-xs font-mono text-muted-foreground/60 w-4 text-center">{index + 1}</span>

                <div className="shrink-0 p-1.5 rounded-md bg-muted/60 text-foreground">
                    {PROVIDER_ICONS[config.provider]}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-foreground">{PROVIDER_LABELS[config.provider]}</span>
                        <Badge variant="outline" className="text-[10px] h-4.5 px-1.5 font-normal border-border/50 text-muted-foreground">
                            {isLocal ? 'Local Machine' : 'Cloud API'}
                        </Badge>
                        {config.enabled && (
                            <span className="text-[11px] font-mono text-muted-foreground truncate">
                                {config.model}
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground/75 truncate mt-0.5">{PROVIDER_DESCRIPTIONS[config.provider]}</p>
                </div>

                <div onClick={e => e.stopPropagation()} className="flex items-center gap-3">
                    <Switch
                        checked={config.enabled}
                        onCheckedChange={checked => {
                            update({ enabled: checked });
                            if (checked) setExpanded(true);
                        }}
                    />
                </div>
            </div>

            {/* Expanded configuration form */}
            {expanded && (
                <div className="px-4 pb-4 pt-2 space-y-4 border-t border-border/30 bg-muted/20 animate-in fade-in duration-150">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        {/* Primary Model */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-semibold text-foreground/90">Primary Model</Label>
                                <span className="text-[10px] text-muted-foreground">Detailed synthesis</span>
                            </div>
                            {isOllama && availableModels && availableModels.length > 0 ? (
                                <Select value={config.model} onValueChange={(v: string) => update({ model: v })}>
                                    <SelectTrigger className="h-8.5 text-xs bg-background border-border/60">
                                        <SelectValue placeholder={DEFAULT_MODELS[config.provider]} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableModels.map(m => (
                                            <SelectItem key={m} value={m} className="text-xs font-mono">{m}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Input
                                    value={config.model}
                                    onChange={e => update({ model: e.target.value })}
                                    placeholder={DEFAULT_MODELS[config.provider]}
                                    className="h-8.5 text-xs font-mono bg-background border-border/60"
                                />
                            )}
                        </div>

                        {/* Base URL */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-semibold text-foreground/90">Endpoint / Base URL</Label>
                                <span className="text-[10px] text-muted-foreground">HTTP API target</span>
                            </div>
                            <Input
                                value={config.baseUrl || ''}
                                onChange={e => update({ baseUrl: e.target.value || undefined })}
                                placeholder={DEFAULT_BASE_URLS[config.provider] || 'https://...'}
                                className="h-8.5 text-xs font-mono bg-background border-border/60"
                            />
                        </div>
                    </div>

                    {/* Fast Indexing / Turbo Model */}
                    <div className="p-3 rounded-lg border border-border/40 bg-card/40 space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                                <Zap className="w-3.5 h-3.5 text-primary" />
                                <Label className="text-xs font-semibold text-foreground">Fast Indexing Model</Label>
                            </div>
                            <span className="text-[10px] text-muted-foreground">Quick topic extraction & outline</span>
                        </div>
                        {isOllama && availableModels && availableModels.length > 0 ? (
                            <Select value={config.indexingModel || ''} onValueChange={v => update({ indexingModel: v })}>
                                <SelectTrigger className="h-8 text-xs bg-background border-border/50">
                                    <SelectValue placeholder="Select turbo model (optional)..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableModels.map(m => (
                                        <SelectItem key={m} value={m} className="text-xs font-mono">{m}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <Input
                                value={config.indexingModel || ''}
                                onChange={e => update({ indexingModel: e.target.value || undefined })}
                                placeholder={config.provider === 'ollama' ? 'e.g. llama3.2:1b' : 'Optional faster model for outline'}
                                className="h-8 text-xs font-mono bg-background border-border/50"
                            />
                        )}
                    </div>

                    {/* API Key (Cloud Only) */}
                    {!isLocal && (
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-semibold text-foreground/90 flex items-center gap-1.5">
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                                    API Key (Keychain Protected)
                                </Label>
                                {config.apiKey && config.apiKey.length > 0 ? (
                                    <span className="text-[10px] text-emerald-500 font-mono flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" /> Key configured
                                    </span>
                                ) : (
                                    <span className="text-[10px] text-muted-foreground font-mono">
                                        Encrypted in OS Keychain
                                    </span>
                                )}
                            </div>
                            <div className="relative">
                                <Input
                                    type={keyVisible ? 'text' : 'password'}
                                    value={config.apiKey || ''}
                                    onChange={e => update({ apiKey: e.target.value })}
                                    onPaste={e => {
                                        const text = e.clipboardData.getData('text');
                                        if (text) {
                                            e.preventDefault();
                                            update({ apiKey: text.trim() });
                                        }
                                    }}
                                    placeholder={`Paste ${PROVIDER_LABELS[config.provider]} API Key`}
                                    className="pr-16 h-8.5 text-xs font-mono bg-background border-border/60"
                                    autoComplete="off"
                                    autoCorrect="off"
                                    spellCheck={false}
                                />
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                    {config.apiKey ? (
                                        <button
                                            type="button"
                                            onClick={() => update({ apiKey: '' })}
                                            className="text-muted-foreground/60 hover:text-foreground p-1 transition-colors text-[10px]"
                                            title="Clear API key"
                                        >
                                            ✕
                                        </button>
                                    ) : null}
                                    <button
                                        type="button"
                                        onClick={() => setKeyVisible(v => !v)}
                                        className="text-muted-foreground hover:text-foreground transition-colors p-1"
                                        title={keyVisible ? "Hide key" : "Show key"}
                                    >
                                        {keyVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Settings Panel ────────────────────────────────────────────────────────────

export function SettingsPanel() {
    const { settings, saveSettings, isSettingsOpen, closeSettings, isSaving } = useSettings();
    const [localProviders, setLocalProviders] = useState<ProviderConfig[]>(settings.providers);
    const [localTaskMapping, setLocalTaskMapping] = useState<TaskMapping>(settings.taskMapping);
    const [saved, setSaved] = useState(false);
    const [ollamaModels, setOllamaModels] = useState<string[]>([]);

    // Detect if current form differs from baseline saved settings
    const isDirty = useMemo(() => {
        const currentPayload = JSON.stringify({
            providers: localProviders.map(p => ({
                provider: p.provider,
                enabled: p.enabled,
                apiKey: (p.apiKey || '').trim(),
                model: p.model,
                indexingModel: p.indexingModel || '',
                baseUrl: p.baseUrl || '',
                priority: p.priority,
            })),
            taskMapping: localTaskMapping,
        });

        const savedPayload = JSON.stringify({
            providers: settings.providers.map(p => ({
                provider: p.provider,
                enabled: p.enabled,
                apiKey: (p.apiKey || '').trim(),
                model: p.model,
                indexingModel: p.indexingModel || '',
                baseUrl: p.baseUrl || '',
                priority: p.priority,
            })),
            taskMapping: settings.taskMapping,
        });

        return currentPayload !== savedPayload;
    }, [localProviders, localTaskMapping, settings]);

    const updateCard = useCallback((index: number, updated: ProviderConfig) => {
        setLocalProviders(prev => prev.map((p, i) => i === index ? updated : p));
        setSaved(false);
    }, []);

    const moveUp = useCallback((index: number) => {
        if (index === 0) return;
        setLocalProviders(prev => {
            const next = [...prev];
            [next[index - 1], next[index]] = [next[index], next[index - 1]];
            return next.map((p, i) => ({ ...p, priority: i + 1 }));
        });
        setSaved(false);
    }, []);

    const moveDown = useCallback((index: number) => {
        setLocalProviders(prev => {
            if (index >= prev.length - 1) return prev;
            const next = [...prev];
            [next[index], next[index + 1]] = [next[index + 1], next[index]];
            return next.map((p, i) => ({ ...p, priority: i + 1 }));
        });
        setSaved(false);
    }, []);

    const handleSave = async () => {
        const withPriority = localProviders.map((p, i) => ({
            ...p,
            apiKey: p.apiKey ? p.apiKey.trim() : '',
            priority: i + 1,
        }));
        const updatedSettings: AppSettings = {
            ...settings,
            providers: withPriority,
            taskMapping: localTaskMapping,
        };

        await saveSettings(updatedSettings);
        setSaved(true);
        toast({
            title: 'Settings saved',
            description: 'AI configuration and OS Keychain credentials updated successfully.',
        });
    };

    // Auto-detect models from local Ollama if running (standalone, no state dependencies)
    const fetchOllamaModels = useCallback(async (baseUrl?: string) => {
        try {
            const targetUrl = baseUrl || 'http://localhost:11434';
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);

            const res = await fetch(`${targetUrl}/api/tags`, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data.models) && data.models.length > 0) {
                    setOllamaModels(data.models.map((m: any) => m.name));
                }
            }
        } catch {
            // Ollama may not be active; fail silently
        }
    }, []);

    // Sync only when dialog is opened (isSettingsOpen becomes true)
    useEffect(() => {
        if (isSettingsOpen) {
            setLocalProviders(settings.providers);
            setLocalTaskMapping(settings.taskMapping);
            setSaved(false);
            const ollama = settings.providers.find(p => p.provider === 'ollama');
            fetchOllamaModels(ollama?.baseUrl);
        }
    }, [isSettingsOpen]); // eslint-disable-line react-hooks/exhaustive-deps

    const enabledCount = localProviders.filter(p => p.enabled).length;

    return (
        <Dialog open={isSettingsOpen} onOpenChange={open => !open && closeSettings()}>
            <DialogContent className="max-w-3xl max-h-[85vh] p-0 overflow-hidden flex flex-col sm:rounded-xl border border-border shadow-xl">
                {/* Header */}
                <DialogHeader className="px-6 py-4 border-b border-border/50 bg-card/40 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                            <Settings2 className="w-4.5 h-4.5" />
                        </div>
                        <div>
                            <DialogTitle className="text-base font-semibold tracking-tight text-foreground">
                                Settings & AI Configuration
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                                Manage local and cloud models, fallback priority, and task routing.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                {/* Tabs */}
                <Tabs defaultValue="providers" className="flex-1 flex flex-col overflow-hidden">
                    <div className="px-6 border-b border-border/40 bg-muted/20 shrink-0">
                        <TabsList className="h-10 bg-transparent p-0 gap-6">
                            <TabsTrigger
                                value="providers"
                                className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 text-xs font-semibold tracking-wide transition-all"
                            >
                                Models & Connectivity
                            </TabsTrigger>
                            <TabsTrigger
                                value="tasks"
                                className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 text-xs font-semibold tracking-wide transition-all"
                            >
                                Task Routing
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="flex-1 overflow-y-auto min-h-0">
                        {/* Tab 1: Models & Connectivity */}
                        <TabsContent value="providers" className="p-6 m-0 space-y-4 outline-none">
                            <div className="flex items-center justify-between pb-1">
                                <div>
                                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Configured Providers</h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">Reorder with the arrows to set automatic fallback priority.</p>
                                </div>
                                <Badge variant="outline" className={cn("text-[11px] font-mono", enabledCount === 0 ? "text-destructive border-destructive/40" : "text-primary border-primary/40")}>
                                    {enabledCount} Active
                                </Badge>
                            </div>

                            <div className="space-y-3">
                                {localProviders.map((provider, idx) => (
                                    <ProviderCard
                                        key={provider.provider}
                                        config={provider}
                                        index={idx}
                                        total={localProviders.length}
                                        onChange={updated => updateCard(idx, updated)}
                                        onMoveUp={() => moveUp(idx)}
                                        onMoveDown={() => moveDown(idx)}
                                        availableModels={provider.provider === 'ollama' ? ollamaModels : undefined}
                                    />
                                ))}
                            </div>
                        </TabsContent>

                        {/* Tab 2: Task Routing */}
                        <TabsContent value="tasks" className="p-6 m-0 space-y-5 outline-none max-w-2xl mx-auto">
                            <div className="p-4 rounded-xl border border-border/50 bg-card/50 space-y-1">
                                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                    <Sliders className="w-4 h-4 text-primary" />
                                    Dedicated Task Routing
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    Route specialized synthesis stages to specific models. "Auto" will dynamically use the highest priority enabled provider.
                                </p>
                            </div>

                            <div className="space-y-3">
                                {[
                                    {
                                        id: 'notes',
                                        label: 'Summary & Notes Generation',
                                        desc: 'Produces in-depth markdown study notes and Mermaid architecture diagrams.',
                                        icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                    },
                                    {
                                        id: 'indexing',
                                        label: 'Content Indexing & Structure',
                                        desc: 'Fast topic segmentation and conceptual outline from video transcripts.',
                                        icon: <Zap className="w-4 h-4 text-amber-500" />
                                    },
                                    {
                                        id: 'features',
                                        label: 'Interactive Study Tools',
                                        desc: 'On-demand generation of Mind Maps, Flashcard Quizzes, and Interview Q&A.',
                                        icon: <Cpu className="w-4 h-4 text-primary" />
                                    },
                                ].map(task => (
                                    <div key={task.id} className="p-4 rounded-xl border border-border/50 bg-card/40 flex items-center justify-between gap-4">
                                        <div className="flex items-start gap-3 min-w-0">
                                            <div className="p-2 rounded-lg bg-muted/60 shrink-0 mt-0.5">
                                                {task.icon}
                                            </div>
                                            <div className="space-y-0.5 min-w-0">
                                                <Label className="text-xs font-semibold text-foreground">{task.label}</Label>
                                                <p className="text-[11px] text-muted-foreground leading-snug">{task.desc}</p>
                                            </div>
                                        </div>

                                        <Select
                                            value={(localTaskMapping as any)[task.id]}
                                            onValueChange={v => {
                                                setLocalTaskMapping(prev => ({ ...prev, [task.id]: v }));
                                                setSaved(false);
                                            }}
                                        >
                                            <SelectTrigger className="h-8.5 w-44 text-xs font-medium bg-background border-border/60 shrink-0">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="auto" className="text-xs">Auto (Priority Fallback)</SelectItem>
                                                {localProviders.filter(p => p.enabled).map(p => (
                                                    <SelectItem key={p.provider} value={p.provider} className="text-xs">
                                                        {PROVIDER_LABELS[p.provider]}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                ))}
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>

                {/* Footer with Reactive Save State */}
                <div className="px-6 py-3.5 border-t border-border/50 bg-card/40 flex items-center justify-between gap-4 shrink-0">
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono">
                        <span className="flex items-center gap-1">
                            <Database className="w-3.5 h-3.5 text-primary/70" />
                            SQLite Local DB
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                            OS Keychain
                        </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs font-medium text-muted-foreground hover:text-foreground"
                            onClick={closeSettings}
                        >
                            Cancel
                        </Button>

                        {isSaving ? (
                            <Button disabled size="sm" className="h-8 px-4 gap-1.5 text-xs font-medium">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Saving…
                            </Button>
                        ) : !isDirty && saved ? (
                            <Button
                                variant="outline"
                                size="sm"
                                disabled
                                className="h-8 px-4 gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 cursor-default"
                            >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Saved
                            </Button>
                        ) : !isDirty ? (
                            <Button
                                variant="ghost"
                                size="sm"
                                disabled
                                className="h-8 px-4 text-xs font-medium text-muted-foreground/60 cursor-default"
                            >
                                Up to Date
                            </Button>
                        ) : (
                            <Button
                                size="sm"
                                className="h-8 px-4 gap-1.5 text-xs font-semibold shadow-xs"
                                onClick={handleSave}
                            >
                                <Save className="w-3.5 h-3.5" />
                                Save Changes
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
