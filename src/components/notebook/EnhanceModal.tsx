import { useState, useMemo } from 'react';
import {
    Key,
    ExternalLink,
    Check,
    Loader2,
    Shield,
    Cpu,
    SlidersHorizontal,
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useSettings } from '@/context/SettingsContext';
import { AIProvider, PROVIDER_LABELS } from '@/types/settings';

export interface EnhanceOptions {
    provider: AIProvider;
    model: string;
    upgradeAuxiliary: boolean;
}

interface EnhanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    mode: 'chapter' | 'notebook';
    targetTitle: string;
    onConfirm: (options: EnhanceOptions) => Promise<void>;
    isEnhancing?: boolean;
}

const RECOMMENDED_MODELS: Record<string, { id: string; label: string; description: string }[]> = {
    gemini: [
        { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', description: 'Comprehensive technical depth, typed code and edge cases' },
        { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', description: 'Fast cloud reasoning and synthesis' },
    ],
    grok: [
        { id: 'grok-beta', label: 'Grok Beta', description: 'xAI cloud language reasoning' },
    ],
    ollama: [
        { id: 'qwen2.5-coder:latest', label: 'Qwen 2.5 Coder', description: 'Local offline code specialization' },
        { id: 'llama3.2:latest', label: 'Llama 3.2', description: 'Local offline balanced model' },
    ],
};

const KEY_HELP_LINKS: Record<string, { url: string; label: string }> = {
    gemini: { url: 'https://aistudio.google.com/app/apikey', label: 'Google AI Studio' },
    grok: { url: 'https://console.x.ai/', label: 'xAI Console' },
};

export function EnhanceModal({
    isOpen,
    onClose,
    mode,
    targetTitle,
    onConfirm,
    isEnhancing = false,
}: EnhanceModalProps) {
    const { settings, updateProviders, saveToBackend } = useSettings();

    const [selectedProvider, setSelectedProvider] = useState<AIProvider>('gemini');
    const [selectedModel, setSelectedModel] = useState<string>('gemini-1.5-pro');
    const [upgradeAuxiliary, setUpgradeAuxiliary] = useState<boolean>(false);
    const [apiKeyInput, setApiKeyInput] = useState<string>('');
    const [savingKey, setSavingKey] = useState<boolean>(false);
    const [keySavedNotification, setKeySavedNotification] = useState<boolean>(false);

    const activeConfig = useMemo(() => {
        return settings.providers.find(p => p.provider === selectedProvider);
    }, [settings.providers, selectedProvider]);

    const hasApiKey = Boolean(activeConfig?.apiKey && activeConfig.apiKey.trim().length > 0);
    const isCloudProvider = selectedProvider === 'gemini' || selectedProvider === 'grok';

    const handleProviderChange = (provider: AIProvider) => {
        setSelectedProvider(provider);
        const models = RECOMMENDED_MODELS[provider];
        if (models && models.length > 0) {
            setSelectedModel(models[0].id);
        } else {
            const config = settings.providers.find(p => p.provider === provider);
            setSelectedModel(config?.model || 'default');
        }
        setApiKeyInput('');
        setKeySavedNotification(false);
    };

    const handleSaveApiKey = async () => {
        if (!apiKeyInput.trim()) return;
        setSavingKey(true);
        try {
            const updated = settings.providers.map(p =>
                p.provider === selectedProvider
                    ? { ...p, apiKey: apiKeyInput.trim(), enabled: true }
                    : p
            );
            updateProviders(updated);
            await saveToBackend();
            setKeySavedNotification(true);
            setTimeout(() => setKeySavedNotification(false), 2500);
        } catch (err) {
            console.error('Failed to save API key:', err);
        } finally {
            setSavingKey(false);
        }
    };

    const handleStart = async () => {
        await onConfirm({
            provider: selectedProvider,
            model: selectedModel,
            upgradeAuxiliary,
        });
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && !isEnhancing && onClose()}>
            <DialogContent className="sm:max-w-[500px] p-6 rounded-2xl bg-card border border-border/60 shadow-xl">
                <DialogHeader className="space-y-1.5 text-left">
                    <div className="flex items-center justify-between gap-3">
                        <DialogTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <span>Enhance notes</span>
                            <Badge variant="outline" className="text-[10px] font-mono border-border/60 text-muted-foreground font-normal">
                                {mode === 'chapter' ? 'Single chapter' : 'Entire notebook'}
                            </Badge>
                        </DialogTitle>
                    </div>
                    <DialogDescription className="text-xs text-muted-foreground line-clamp-1">
                        {targetTitle}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Provider Selection */}
                    <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-foreground">
                            Provider
                        </Label>
                        <div className="grid grid-cols-3 gap-2">
                            {(['gemini', 'grok', 'ollama'] as AIProvider[]).map((prov) => {
                                const isSelected = selectedProvider === prov;
                                const provConfig = settings.providers.find(p => p.provider === prov);
                                const hasKey = Boolean(provConfig?.apiKey && provConfig.apiKey.trim().length > 0);
                                const isLocal = prov === 'ollama';

                                return (
                                    <button
                                        key={prov}
                                        type="button"
                                        onClick={() => handleProviderChange(prov)}
                                        className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-colors ${
                                            isSelected
                                                ? 'border-foreground/30 bg-muted/50 font-medium'
                                                : 'border-border/50 bg-card hover:bg-muted/30 text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between w-full">
                                            <span className="text-xs">
                                                {PROVIDER_LABELS[prov]}
                                            </span>
                                            {isLocal ? (
                                                <Cpu className="w-3 h-3 text-muted-foreground/70" />
                                            ) : hasKey ? (
                                                <Check className="w-3 h-3 text-muted-foreground" />
                                            ) : (
                                                <Key className="w-3 h-3 text-muted-foreground/60" />
                                            )}
                                        </div>
                                        <span className="text-[10px] text-muted-foreground mt-1">
                                            {isLocal ? 'Local offline' : hasKey ? 'Key saved' : 'Key required'}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* API Key inline input if missing for cloud provider */}
                    {isCloudProvider && !hasApiKey && (
                        <div className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-2">
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-medium text-foreground flex items-center gap-1.5">
                                    <Key className="w-3 h-3 text-muted-foreground" />
                                    <span>{PROVIDER_LABELS[selectedProvider]} API key</span>
                                </span>
                                {KEY_HELP_LINKS[selectedProvider] && (
                                    <a
                                        href={KEY_HELP_LINKS[selectedProvider].url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
                                    >
                                        <span>Get key</span>
                                        <ExternalLink className="w-2.5 h-2.5" />
                                    </a>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <Input
                                    type="password"
                                    placeholder="Paste API key"
                                    value={apiKeyInput}
                                    onChange={(e) => setApiKeyInput(e.target.value)}
                                    className="h-8 text-xs font-mono rounded-lg border-border/60 bg-background"
                                />
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={handleSaveApiKey}
                                    disabled={!apiKeyInput.trim() || savingKey}
                                    className="h-8 text-xs px-3 rounded-lg shrink-0"
                                >
                                    {savingKey ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save key'}
                                </Button>
                            </div>
                            {keySavedNotification && (
                                <p className="text-[11px] text-muted-foreground font-mono">
                                    API key saved.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Model Selection */}
                    <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-foreground">
                            Model
                        </Label>
                        <div className="space-y-1.5">
                            {(RECOMMENDED_MODELS[selectedProvider] || []).map((m) => {
                                const isSelected = selectedModel === m.id;
                                return (
                                    <label
                                        key={m.id}
                                        onClick={() => setSelectedModel(m.id)}
                                        className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                                            isSelected
                                                ? 'border-foreground/30 bg-muted/40'
                                                : 'border-border/50 hover:bg-muted/20'
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="model-select"
                                            checked={isSelected}
                                            onChange={() => setSelectedModel(m.id)}
                                            className="mt-0.5"
                                        />
                                        <div className="min-w-0">
                                            <div className="text-xs font-medium text-foreground">
                                                {m.label}
                                            </div>
                                            <div className="text-[11px] text-muted-foreground">
                                                {m.description}
                                            </div>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    {/* Scope & Safety Options */}
                    <div className="pt-2 border-t border-border/40 space-y-2">
                        <div className="flex items-center space-x-2">
                            <Checkbox id="notes-opt" checked disabled />
                            <label
                                htmlFor="notes-opt"
                                className="text-xs text-foreground peer-disabled:opacity-80"
                            >
                                Study notes (Technical depth, verified code and architecture)
                            </label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="aux-opt"
                                checked={upgradeAuxiliary}
                                onCheckedChange={(val) => setUpgradeAuxiliary(Boolean(val))}
                            />
                            <label
                                htmlFor="aux-opt"
                                className="text-xs text-foreground cursor-pointer"
                            >
                                Regenerate concept map and quiz
                            </label>
                        </div>
                    </div>

                    {/* Rollback Safety Notice */}
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/40 text-[11px] text-muted-foreground">
                        <Shield className="w-3.5 h-3.5 shrink-0" />
                        <span>
                            Pre-enhanced version will be preserved for one-click rollback.
                        </span>
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/40">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={onClose}
                        disabled={isEnhancing}
                        className="rounded-lg h-8 text-xs"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        onClick={handleStart}
                        disabled={isEnhancing || (isCloudProvider && !hasApiKey)}
                        className="rounded-lg h-8 text-xs font-medium gap-1.5 shadow-xs bg-foreground text-background hover:bg-foreground/90"
                    >
                        {isEnhancing ? (
                            <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Enhancing notes…</span>
                            </>
                        ) : (
                            <span>{mode === 'chapter' ? 'Enhance chapter' : 'Enhance notebook'}</span>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
