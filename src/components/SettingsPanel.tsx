import { useState, useCallback } from 'react';
import { X, Plus, Trash2, Eye, EyeOff, ChevronUp, ChevronDown, Zap, Save, CheckCircle2, AlertTriangle, Cpu, Cloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSettings } from '@/context/SettingsContext';
import { ProviderConfig, AIProvider, PROVIDER_LABELS, PROVIDER_DESCRIPTIONS, DEFAULT_MODELS, DEFAULT_BASE_URLS, IS_LOCAL_PROVIDER } from '@/types/settings';
import { cn } from '@/lib/utils';

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
    gemini: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
    grok: 'from-gray-500/20 to-gray-600/10 border-gray-500/30',
    lmstudio: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
    ollama: 'from-orange-500/20 to-orange-600/10 border-orange-500/30',
};

const PROVIDER_ACCENT: Record<AIProvider, string> = {
    gemini: 'text-blue-400',
    grok: 'text-gray-300',
    lmstudio: 'text-purple-400',
    ollama: 'text-orange-400',
};

// ─── API Key Item ──────────────────────────────────────────────────────────────

function ApiKeyItem({
    value,
    index,
    total,
    onChange,
    onRemove,
}: {
    value: string;
    index: number;
    total: number;
    onChange: (v: string) => void;
    onRemove: () => void;
}) {
    const [visible, setVisible] = useState(false);

    return (
        <div className="flex items-center gap-2 group">
            <div className="relative flex-1">
                <Input
                    type={visible ? 'text' : 'password'}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={`API Key ${index + 1}`}
                    className="pr-9 bg-background/50 border-border/60 text-sm font-mono h-8 focus-visible:ring-primary/50"
                />
                <button
                    type="button"
                    onClick={() => setVisible(v => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                    {visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
            </div>
            <button
                type="button"
                onClick={onRemove}
                className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                title="Remove key"
            >
                <Trash2 className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}

// ─── Provider Card ─────────────────────────────────────────────────────────────

function ProviderCard({
    config,
    index,
    total,
    onChange,
    onMoveUp,
    onMoveDown,
}: {
    config: ProviderConfig;
    index: number;
    total: number;
    onChange: (updated: ProviderConfig) => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
}) {
    const isLocal = IS_LOCAL_PROVIDER[config.provider];
    const [expanded, setExpanded] = useState(config.enabled);

    const update = (patch: Partial<ProviderConfig>) => onChange({ ...config, ...patch });

    const addKey = () => update({ apiKeys: [...config.apiKeys, ''] });
    const removeKey = (i: number) => update({ apiKeys: config.apiKeys.filter((_, idx) => idx !== i) });
    const updateKey = (i: number, v: string) => {
        const keys = [...config.apiKeys];
        keys[i] = v;
        update({ apiKeys: keys });
    };

    return (
        <div className={cn(
            'rounded-xl border bg-gradient-to-br transition-all duration-200',
            PROVIDER_COLORS[config.provider],
            config.enabled ? 'opacity-100' : 'opacity-60',
        )}>
            {/* Card header */}
            <div
                className="flex items-center gap-3 p-3 cursor-pointer select-none"
                onClick={() => setExpanded(e => !e)}
            >
                {/* Priority reorder */}
                <div className="flex flex-col gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                    <button
                        disabled={index === 0}
                        onClick={onMoveUp}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                    ><ChevronUp className="w-3 h-3" /></button>
                    <button
                        disabled={index === total - 1}
                        onClick={onMoveDown}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                    ><ChevronDown className="w-3 h-3" /></button>
                </div>

                {/* Priority badge */}
                <span className="text-xs font-mono text-muted-foreground w-4 text-center">{index + 1}</span>

                {/* Icon */}
                <span className={cn('shrink-0', PROVIDER_ACCENT[config.provider])}>
                    {PROVIDER_ICONS[config.provider]}
                </span>

                {/* Name & desc */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-foreground">{PROVIDER_LABELS[config.provider]}</span>
                        {isLocal ? (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-muted-foreground/30">Local</Badge>
                        ) : (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-muted-foreground/30">
                                <Cloud className="w-2.5 h-2.5 mr-1" />Cloud
                            </Badge>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{PROVIDER_DESCRIPTIONS[config.provider]}</p>
                </div>

                {/* Toggle */}
                <div onClick={e => e.stopPropagation()}>
                    <Switch
                        checked={config.enabled}
                        onCheckedChange={checked => {
                            update({ enabled: checked });
                            if (checked) setExpanded(true);
                        }}
                    />
                </div>
            </div>

            {/* Expanded body */}
            {expanded && (
                <div className="px-3 pb-3 space-y-3 border-t border-border/30 pt-3">
                    {/* Model */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Model</Label>
                            <Input
                                value={config.model}
                                onChange={e => update({ model: e.target.value })}
                                placeholder={DEFAULT_MODELS[config.provider]}
                                className="h-8 text-sm bg-background/50 border-border/60"
                            />
                        </div>
                        {/* Base URL (show for all providers) */}
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Base URL</Label>
                            <Input
                                value={config.baseUrl || ''}
                                onChange={e => update({ baseUrl: e.target.value || undefined })}
                                placeholder={DEFAULT_BASE_URLS[config.provider] || 'https://...'}
                                className="h-8 text-sm bg-background/50 border-border/60"
                            />
                        </div>
                    </div>

                    {/* API Keys (only for cloud providers) */}
                    {!isLocal && (
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs text-muted-foreground">
                                    API Keys
                                    <span className="ml-1.5 text-[10px] text-muted-foreground/60">
                                        (tried in order — if one fails, next is used)
                                    </span>
                                </Label>
                                <button
                                    type="button"
                                    onClick={addKey}
                                    className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                                >
                                    <Plus className="w-3 h-3" /> Add Key
                                </button>
                            </div>
                            {config.apiKeys.length === 0 ? (
                                <button
                                    type="button"
                                    onClick={addKey}
                                    className="w-full border border-dashed border-border/50 rounded-lg py-2 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                                >
                                    + Add your first API key
                                </button>
                            ) : (
                                <div className="space-y-1.5">
                                    {config.apiKeys.map((key, i) => (
                                        <ApiKeyItem
                                            key={i}
                                            value={key}
                                            index={i}
                                            total={config.apiKeys.length}
                                            onChange={v => updateKey(i, v)}
                                            onRemove={() => removeKey(i)}
                                        />
                                    ))}
                                </div>
                            )}
                            {config.apiKeys.length > 1 && (
                                <p className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" />
                                    If a key fails, the next key in the list is automatically tried.
                                </p>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Settings Panel ────────────────────────────────────────────────────────────

export function SettingsPanel() {
    const { settings, updateProviders, saveToBackend, isSettingsOpen, closeSettings, isSaving } = useSettings();
    const [localProviders, setLocalProviders] = useState(settings.providers);
    const [saved, setSaved] = useState(false);

    // Sync local state when panel opens
    const handleOpen = useCallback(() => {
        setLocalProviders(settings.providers);
        setSaved(false);
    }, [settings.providers]);

    // Reset when opened
    if (isSettingsOpen && localProviders !== settings.providers && !saved) {
        // handled via useEffect equivalent via key
    }

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
        updateProviders(withPriority);
        await saveToBackend();
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const enabledCount = localProviders.filter(p => p.enabled).length;

    if (!isSettingsOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity"
                onClick={closeSettings}
            />

            {/* Panel */}
            <div className="fixed right-0 top-0 h-full w-full max-w-md bg-card border-l border-border shadow-2xl z-50 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-card/80 backdrop-blur-sm shrink-0">
                    <div>
                        <h2 className="text-base font-semibold text-foreground">AI Provider Settings</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {enabledCount === 0
                                ? 'No providers enabled — please enable at least one'
                                : `${enabledCount} provider${enabledCount > 1 ? 's' : ''} enabled · fallback order: top → bottom`}
                        </p>
                    </div>
                    <button
                        onClick={closeSettings}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                    {enabledCount === 0 && (
                        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                            <p className="text-xs text-destructive">
                                No AI providers are enabled. Enable at least one provider for note generation to work.
                            </p>
                        </div>
                    )}

                    <div className="space-y-1 mb-1">
                        <p className="text-xs text-muted-foreground">
                            Providers are tried from <strong>top to bottom</strong>. Within each cloud provider, keys are tried in order.
                            Drag the arrows to change priority.
                        </p>
                    </div>

                    {localProviders.map((provider, idx) => (
                        <ProviderCard
                            key={provider.provider}
                            config={provider}
                            index={idx}
                            total={localProviders.length}
                            onChange={updated => updateCard(idx, updated)}
                            onMoveUp={() => moveUp(idx)}
                            onMoveDown={() => moveDown(idx)}
                        />
                    ))}
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-border bg-card/80 backdrop-blur-sm shrink-0">
                    <Button
                        className="w-full gap-2"
                        onClick={handleSave}
                        disabled={isSaving}
                    >
                        {saved ? (
                            <>
                                <CheckCircle2 className="w-4 h-4 text-green-400" />
                                Settings Saved!
                            </>
                        ) : isSaving ? (
                            <>
                                <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                                Saving…
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                Save & Apply
                            </>
                        )}
                    </Button>
                    <p className="text-center text-[10px] text-muted-foreground mt-2">
                        Settings persist in browser storage and sync to the server.
                    </p>
                </div>
            </div>
        </>
    );
}
