import { useState, useCallback, useEffect } from 'react';
import { X, Plus, Trash2, Eye, EyeOff, ChevronUp, ChevronDown, Zap, Save, CheckCircle2, AlertTriangle, Cpu, Cloud, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSettings } from '@/context/SettingsContext';
import { ProviderConfig, AIProvider, PROVIDER_LABELS, PROVIDER_DESCRIPTIONS, DEFAULT_MODELS, DEFAULT_BASE_URLS, IS_LOCAL_PROVIDER } from '@/types/settings';
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
import { ScrollArea } from "@/components/ui/scroll-area";

// ─── Provider Icon ─────────────────────────────────────────────────────────────

const PROVIDER_ICONS: Record<AIProvider, React.ReactNode> = {
    gemini: (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#4285F4" />
            <path d="M12 6l1.5 4.5H18l-3.75 2.75 1.5 4.5L12 15 8.25 17.75l1.5-4.5L6 10.5h4.5z" fill="white" />
        </svg>
    ),
    grok: (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
            <path d="M13.55 3.27L4.72 20.6h3.61l7.05-14.5 6.1 14.5H25l-9.91-17.33h-1.54zM3.02 14.36l1.36-2.59h9.2l-1.36 2.59z" />
        </svg>
    ),
    lmstudio: <Cpu className="w-5 h-5" />,
    ollama: <Zap className="w-5 h-5" />,
};

const PROVIDER_COLORS: Record<AIProvider, string> = {
    gemini: 'hover:border-blue-500/30 hover:bg-blue-500/5',
    grok: 'hover:border-gray-500/30 hover:bg-gray-500/5',
    lmstudio: 'hover:border-purple-500/30 hover:bg-purple-500/5',
    ollama: 'hover:border-orange-500/30 hover:bg-orange-500/5',
};

const PROVIDER_ACCENT: Record<AIProvider, string> = {
    gemini: 'text-blue-400',
    grok: 'text-gray-300',
    lmstudio: 'text-purple-400',
    ollama: 'text-orange-400',
};

// removed ApiKeyItem

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

    const update = (patch: Partial<ProviderConfig>) => onChange({ ...config, ...patch });
    const [keyVisible, setKeyVisible] = useState(false);

    return (
        <div className={cn(
            'group rounded-xl border border-border/50 bg-card transition-all duration-200 overflow-hidden',
            PROVIDER_COLORS[config.provider],
            config.enabled ? 'ring-1 ring-primary/10' : 'opacity-60 saturate-50',
        )}>
            {/* Card header */}
            <div
                className="flex items-center gap-4 p-4 cursor-pointer select-none"
                onClick={() => setExpanded(e => !e)}
            >
                {/* Priority reorder */}
                <div className="flex flex-col gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                    <button
                        disabled={index === 0}
                        onClick={onMoveUp}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors p-0.5"
                    ><ChevronUp className="w-3.5 h-3.5" /></button>
                    <button
                        disabled={index === total - 1}
                        onClick={onMoveDown}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors p-0.5"
                    ><ChevronDown className="w-3.5 h-3.5" /></button>
                </div>

                <span className="text-xs font-mono text-muted-foreground/60 w-4 text-center">{index + 1}</span>

                <div className={cn('shrink-0 p-2 rounded-lg bg-muted/50 transition-colors group-hover:bg-background', PROVIDER_ACCENT[config.provider])}>
                    {PROVIDER_ICONS[config.provider]}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">{PROVIDER_LABELS[config.provider]}</span>
                        <Badge variant="secondary" className="text-[10px] h-4.5 px-1.5 font-medium bg-muted/50">
                            {isLocal ? 'Local' : 'Cloud'}
                        </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground/80 truncate mt-0.5">{PROVIDER_DESCRIPTIONS[config.provider]}</p>
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

            {/* Expanded body - Clean grid layout */}
            {expanded && (
                <div className="px-4 pb-5 pt-1 space-y-6 border-t border-border/40 bg-muted/10 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                        {/* Primary Model */}
                        <div className="space-y-2.5">
                            <div className="flex items-center gap-2">
                                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Primary Model</Label>
                                <Badge variant="outline" className="text-[9px] h-4 border-primary/20 text-primary">High Quality</Badge>
                            </div>
                            {isOllama && availableModels && availableModels.length > 0 ? (
                                <Select value={config.model} onValueChange={(v: string) => update({ model: v })}>
                                    <SelectTrigger className="h-9 text-sm bg-background border-border/60 focus:ring-primary/30">
                                        <SelectValue placeholder={DEFAULT_MODELS[config.provider]} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableModels.map(m => (
                                            <SelectItem key={m} value={m}>{m}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Input
                                    value={config.model}
                                    onChange={e => update({ model: e.target.value })}
                                    placeholder={DEFAULT_MODELS[config.provider]}
                                    className="h-9 text-sm bg-background border-border/60 focus-visible:ring-primary/30"
                                />
                            )}
                            <p className="text-[10px] text-muted-foreground italic px-1">
                                Used for note generation and deep analysis.
                            </p>
                        </div>

                        {/* Base URL */}
                        <div className="space-y-2.5">
                            <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Endpoint / Base URL</Label>
                            <Input
                                value={config.baseUrl || ''}
                                onChange={e => update({ baseUrl: e.target.value || undefined })}
                                placeholder={DEFAULT_BASE_URLS[config.provider] || 'https://...'}
                                className="h-9 text-sm bg-background border-border/60 focus-visible:ring-primary/30"
                            />
                            <p className="text-[10px] text-muted-foreground italic px-1">
                                Regional API or local endpoint.
                            </p>
                        </div>
                    </div>

                    {/* Turbo Model Row */}
                    <div className="p-4 rounded-xl border border-primary/10 bg-primary/5 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Label className="text-[11px] font-bold uppercase tracking-wider text-primary">Indexing Model</Label>
                                <Badge className="text-[9px] h-4 bg-primary/20 text-primary border-none font-bold">TURBO</Badge>
                            </div>
                        </div>
                        {isOllama && availableModels && availableModels.length > 0 ? (
                            <Select value={config.indexingModel || ''} onValueChange={v => update({ indexingModel: v })}>
                                <SelectTrigger className="h-9 text-sm bg-background border-primary/20 focus:ring-primary/30 font-medium">
                                    <SelectValue placeholder="Select turbo model..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableModels.map(m => (
                                        <SelectItem key={m} value={m}>{m}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <Input
                                value={config.indexingModel || ''}
                                onChange={e => update({ indexingModel: e.target.value || undefined })}
                                placeholder="e.g. qwen2.5-coder:1.5b"
                                className="h-9 text-sm bg-background border-primary/20 focus-visible:ring-primary/30 font-medium"
                            />
                        )}
                        <p className="text-[10px] text-primary/70 leading-relaxed px-1">
                            Lightweight model optimized for fast topic extraction and video analysis.
                        </p>
                    </div>

                    {/* API Key */}
                    {!isLocal && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">API Credentials</Label>
                            </div>
                            <div className="relative">
                                <Input
                                    type={keyVisible ? 'text' : 'password'}
                                    value={config.apiKey || ''}
                                    onChange={e => update({ apiKey: e.target.value })}
                                    placeholder="Enter API Key"
                                    className="pr-9 bg-muted/30 border-border/40 text-sm font-mono h-9 focus-visible:ring-primary/30"
                                />
                                <button
                                    type="button"
                                    onClick={() => setKeyVisible(v => !v)}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {keyVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
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
    const { settings, updateSettings, saveToBackend, isSettingsOpen, closeSettings, isSaving } = useSettings();
    const [localProviders, setLocalProviders] = useState(settings.providers);
    const [localTaskMapping, setLocalTaskMapping] = useState(settings.taskMapping);
    const [localPineconeApiKey, setLocalPineconeApiKey] = useState(settings.pineconeApiKey || '');
    const [localPineconeIndex, setLocalPineconeIndex] = useState(settings.pineconeIndex || '');
    const [saved, setSaved] = useState(false);
    const [ollamaModels, setOllamaModels] = useState<string[]>([]);
    const [fetchingModels, setFetchingModels] = useState(false);

    const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:3001/api';

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
        const withPriority = localProviders.map((p, i) => ({ ...p, priority: i + 1 }));
        updateSettings({
            providers: withPriority,
            taskMapping: localTaskMapping,
            pineconeApiKey: localPineconeApiKey,
            pineconeIndex: localPineconeIndex,
        });
        await saveToBackend();
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const fetchOllamaModels = useCallback(async () => {
        setFetchingModels(true);
        try {
            const res = await fetch(`${API_BASE}/settings/ollama/models`);
            const data = await res.json();
            if (data.success) {
                setOllamaModels(data.models.map((m: any) => m.name));
            }
        } catch (e) {
            console.error('Failed to fetch Ollama models', e);
        } finally {
            setFetchingModels(false);
        }
    }, [API_BASE]);

    useEffect(() => {
        if (isSettingsOpen) {
            fetchOllamaModels();
            setLocalProviders(settings.providers);
            setLocalTaskMapping(settings.taskMapping);
            setLocalPineconeApiKey(settings.pineconeApiKey || '');
            setLocalPineconeIndex(settings.pineconeIndex || '');
        }
    }, [isSettingsOpen, settings.providers, settings.taskMapping, fetchOllamaModels]);

    const enabledCount = localProviders.filter(p => p.enabled).length;

    return (
        <Dialog open={isSettingsOpen} onOpenChange={open => !open && closeSettings()}>
            <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden flex flex-col sm:rounded-2xl border-border/40 shadow-2xl">
                <DialogHeader className="px-6 py-5 border-b border-border/40 bg-muted/20">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <DialogTitle className="text-xl font-bold flex items-center gap-2 tracking-tight">
                                <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
                                    <Settings2 className="w-5 h-5" />
                                </span>
                                AI Configuration
                            </DialogTitle>
                            <DialogDescription className="text-xs font-medium text-muted-foreground/70">
                                Management of intelligent models and provider fallbacks.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <Tabs defaultValue="providers" className="flex-1 flex flex-col overflow-hidden">
                    <div className="px-6 border-b border-border/40 bg-muted/10">
                        <TabsList className="h-12 bg-transparent p-0 gap-6">
                            <TabsTrigger
                                value="providers"
                                className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 text-sm font-bold uppercase tracking-widest transition-all"
                            >
                                Models & Connectivity
                            </TabsTrigger>
                            <TabsTrigger
                                value="tasks"
                                className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 text-sm font-bold uppercase tracking-widest transition-all"
                            >
                                Task Assignment
                            </TabsTrigger>
                            <TabsTrigger
                                value="storage"
                                className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 text-sm font-bold uppercase tracking-widest transition-all"
                            >
                                Vector Storage
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="flex-1 overflow-y-auto min-h-0">
                        <TabsContent value="providers" className="p-6 m-0 space-y-6 outline-none">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <h3 className="text-sm font-bold text-foreground">Active Providers</h3>
                                    <p className="text-[11px] text-muted-foreground">Fallbacks are attempted in the order shown (top to bottom).</p>
                                </div>
                                <Badge variant="outline" className={cn("text-[10px] font-bold tracking-wider px-2 py-0.5 border-primary/20", enabledCount === 0 ? "text-destructive border-destructive/30 bg-destructive/5" : "text-primary bg-primary/5")}>
                                    {enabledCount} ENABLED
                                </Badge>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
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

                        <TabsContent value="tasks" className="p-6 m-0 space-y-8 outline-none max-w-2xl mx-auto">
                            <div className="text-center space-y-2 mb-4">
                                <div className="inline-flex p-3 rounded-full bg-primary/10 text-primary mb-2">
                                    <Cpu className="w-6 h-6" />
                                </div>
                                <h3 className="text-lg font-bold tracking-tight">Dedicated Task Routing</h3>
                                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                                    Optimize performance by assigning specific providers to specialized tasks.
                                </p>
                            </div>

                            <div className="space-y-4">
                                {[
                                    { id: 'notes', label: 'Detailed Summary Generation', icon: <CheckCircle2 className="w-4 h-4 text-green-400" />, desc: 'High-quality formatting for long-form content.' },
                                    { id: 'indexing', label: 'Content Indexing & Extraction', icon: <Zap className="w-4 h-4 text-yellow-400" />, desc: 'Fast extraction of topics and key moments.' },
                                    { id: 'features', label: 'Interactive Features (AI Tools)', icon: <Plus className="w-4 h-4 text-blue-400" />, desc: 'Mind Maps, Quizzes, and specialized tools.' },
                                ].map(task => (
                                    <div key={task.id} className="group p-5 rounded-2xl border border-border/50 bg-card/60 transition-all hover:bg-card hover:border-border hover:shadow-lg">
                                        <div className="flex items-center gap-5">
                                            <div className="p-2.5 rounded-xl bg-muted/50 group-hover:bg-background transition-colors">
                                                {task.icon}
                                            </div>
                                            <div className="flex-1 space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-sm font-bold tracking-tight">{task.label}</Label>
                                                    <Select
                                                        value={(localTaskMapping as any)[task.id]}
                                                        onValueChange={v => setLocalTaskMapping(prev => ({ ...prev, [task.id]: v }))}
                                                    >
                                                        <SelectTrigger className="h-9 w-40 text-xs font-semibold bg-background/50 border-border/40 focus:ring-primary/20">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="auto">Auto (Priority)</SelectItem>
                                                            {localProviders.filter(p => p.enabled).map(p => (
                                                                <SelectItem key={p.provider} value={p.provider}>
                                                                    {PROVIDER_LABELS[p.provider]}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <p className="text-[11px] text-muted-foreground leading-relaxed pr-20">
                                                    {task.desc}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="p-4 rounded-xl bg-muted/30 border border-border/40 text-center">
                                <p className="text-[11px] text-muted-foreground/80 italic">
                                    "Auto" dynamically selects the highest priority enabled provider.
                                    Explicit pinning ensures consistent behavior for specialized tasks.
                                </p>
                            </div>
                        </TabsContent>

                        <TabsContent value="storage" className="p-6 m-0 space-y-8 outline-none max-w-2xl mx-auto">
                            <div className="text-center space-y-2 mb-4">
                                <div className="inline-flex p-3 rounded-full bg-primary/10 text-primary mb-2">
                                    <Cloud className="w-6 h-6" />
                                </div>
                                <h3 className="text-lg font-bold tracking-tight">Persistent Vector Storage</h3>
                                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                                    Configure Pinecone to save video indexes permanently. Leave blank for in-memory storage.
                                </p>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold tracking-tight">Pinecone API Key</Label>
                                    <Input 
                                        type="password"
                                        placeholder="pcsk_..."
                                        value={localPineconeApiKey}
                                        onChange={e => { setLocalPineconeApiKey(e.target.value); setSaved(false); }}
                                    />
                                    <p className="text-[11px] text-muted-foreground">Required for cloud persistence.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold tracking-tight">Pinecone Index Name</Label>
                                    <Input 
                                        placeholder="noteforge-index"
                                        value={localPineconeIndex}
                                        onChange={e => { setLocalPineconeIndex(e.target.value); setSaved(false); }}
                                    />
                                    <p className="text-[11px] text-muted-foreground">The name of the index you created in your Pinecone dashboard (Dimensions: 768 for Nomic, 1536 for OpenAI).</p>
                                </div>
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>

                <div className="px-6 py-5 border-t border-border/40 bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5 order-2 sm:order-1">
                        <Cloud className="w-3.5 h-3.5" /> Settings persist locally and sync with backend.
                    </p>
                    <div className="flex items-center gap-3 w-full sm:w-auto order-1 sm:order-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs font-bold"
                            onClick={closeSettings}
                        >
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            className="h-10 px-8 gap-2 font-bold shadow-lg shadow-primary/20"
                            onClick={handleSave}
                            disabled={isSaving}
                        >
                            {saved ? (
                                <>
                                    <CheckCircle2 className="w-4 h-4" />
                                    Saved!
                                </>
                            ) : isSaving ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                                    Applying…
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    Save & Apply
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
