import { useState, useMemo } from 'react';
import {
    Sparkles,
    Key,
    ExternalLink,
    Check,
    Loader2,
    Shield,
    Layers,
    Cpu,
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

const RECOMMENDED_CLOUD_MODELS: Record<string, { id: string; label: string; description: string }[]> = {
    gemini: [
        { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', description: 'Deepest technical rigor, math & code analysis' },
        { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', description: 'Fast, lightweight cloud reasoning' },
    ],
    grok: [
        { id: 'grok-beta', label: 'Grok Beta', description: 'xAI cloud language reasoning' },
    ],
    ollama: [
        { id: 'qwen2.5-coder:latest', label: 'Qwen 2.5 Coder', description: 'Local code specialization' },
        { id: 'llama3.2:latest', label: 'Llama 3.2', description: 'Local balanced synthesis' },
    ],
};

const KEY_HELP_LINKS: Record<string, { url: string; label: string }> = {
    gemini: { url: 'https://aistudio.google.com/app/apikey', label: 'Google AI Studio (Free Tier available)' },
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

    // Default to gemini or first cloud provider
    const [selectedProvider, setSelectedProvider] = useState<AIProvider>('gemini');
    const [selectedModel, setSelectedModel] = useState<string>('gemini-1.5-pro');
    const [upgradeAuxiliary, setUpgradeAuxiliary] = useState<boolean>(false);
    const [apiKeyInput, setApiKeyInput] = useState<string>('');
    const [savingKey, setSavingKey] = useState<boolean>(false);
    const [keySavedNotification, setKeySavedNotification] = useState<boolean>(false);

    // Current configured provider from settings
    const activeConfig = useMemo(() => {
        return settings.providers.find(p => p.provider === selectedProvider);
    }, [settings.providers, selectedProvider]);

    const hasApiKey = Boolean(activeConfig?.apiKey && activeConfig.apiKey.trim().length > 0);
    const isCloudProvider = selectedProvider === 'gemini' || selectedProvider === 'grok';

    const handleProviderChange = (provider: AIProvider) => {
        setSelectedProvider(provider);
        const models = RECOMMENDED_CLOUD_MODELS[provider];
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
            setTimeout(() => setKeySavedNotification(false), 3000);
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
            <DialogContent className="sm:max-w-[540px] p-6 rounded-2xl bg-card border border-border/80 shadow-2xl">
                <DialogHeader className="space-y-2 text-left">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                            <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                            <DialogTitle className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
                                <span>AI Deep Enhancement</span>
                                <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">
                                    {mode === 'chapter' ? 'Single Chapter' : 'Entire Notebook'}
                                </Badge>
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground line-clamp-1">
                                {targetTitle}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Provider Selection */}
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-foreground/90">
                            Enhancement Engine
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
                                        className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                                            isSelected
                                                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                                : 'border-border/60 bg-card hover:bg-muted/30'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between w-full">
                                            <span className="text-xs font-semibold text-foreground">
                                                {PROVIDER_LABELS[prov]}
                                            </span>
                                            {isLocal ? (
                                                <Cpu className="w-3 h-3 text-muted-foreground" />
                                            ) : hasKey ? (
                                                <Check className="w-3 h-3 text-emerald-400" />
                                            ) : (
                                                <Key className="w-3 h-3 text-amber-400" />
                                            )}
                                        </div>
                                        <span className="text-[10px] text-muted-foreground/80 mt-1">
                                            {isLocal ? 'Local Offline' : hasKey ? 'Key Configured' : 'Key Needed'}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* API Key inline input if missing for cloud provider */}
                    {isCloudProvider && !hasApiKey && (
                        <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-2.5">
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-foreground flex items-center gap-1.5">
                                    <Key className="w-3.5 h-3.5 text-amber-400" />
                                    <span>Enter {PROVIDER_LABELS[selectedProvider]} API Key</span>
                                </span>
                                {KEY_HELP_LINKS[selectedProvider] && (
                                    <a
                                        href={KEY_HELP_LINKS[selectedProvider].url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[11px] text-primary hover:underline inline-flex items-center gap-1 font-medium"
                                    >
                                        <span>Get API Key</span>
                                        <ExternalLink className="w-2.5 h-2.5" />
                                    </a>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <Input
                                    type="password"
                                    placeholder="Paste API Key here..."
                                    value={apiKeyInput}
                                    onChange={(e) => setApiKeyInput(e.target.value)}
                                    className="h-8 text-xs font-mono rounded-lg border-border/80"
                                />
                                <Button
                                    size="sm"
                                    onClick={handleSaveApiKey}
                                    disabled={!apiKeyInput.trim() || savingKey}
                                    className="h-8 text-xs px-3 rounded-lg shrink-0"
                                >
                                    {savingKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save Key'}
                                </Button>
                            </div>
                            {keySavedNotification && (
                                <p className="text-[11px] text-emerald-400 font-mono">
                                    API key saved securely to settings.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Model Selection */}
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-foreground/90">
                            Model Tier
                        </Label>
                        <div className="space-y-1.5">
                            {(RECOMMENDED_CLOUD_MODELS[selectedProvider] || []).map((m) => {
                                const isSelected = selectedModel === m.id;
                                return (
                                    <label
                                        key={m.id}
                                        onClick={() => setSelectedModel(m.id)}
                                        className={`flex items-start gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${
                                            isSelected
                                                ? 'border-primary/80 bg-primary/5'
                                                : 'border-border/60 hover:bg-muted/20'
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="model-select"
                                            checked={isSelected}
                                            onChange={() => setSelectedModel(m.id)}
                                            className="mt-0.5 accent-primary"
                                        />
                                        <div className="min-w-0">
                                            <div className="text-xs font-semibold text-foreground">
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
                                className="text-xs font-medium text-foreground leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                                Deep Study Notes (Refined prose, rich typed code & memory diagrams)
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
                                className="text-xs font-medium text-foreground leading-none cursor-pointer"
                            >
                                Also regenerate Concept Mind Map & Self-Check Quiz
                            </label>
                        </div>
                    </div>

                    {/* Rollback Safety Notice */}
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/40 border border-border/30 text-[11px] text-muted-foreground">
                        <Shield className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span>
                            Your current notes will be backed up safely. You can revert with 1 click at any time.
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
                        className="rounded-xl h-8 text-xs"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        onClick={handleStart}
                        disabled={isEnhancing || (isCloudProvider && !hasApiKey)}
                        className="rounded-xl h-8 text-xs font-semibold gap-1.5 shadow-xs"
                    >
                        {isEnhancing ? (
                            <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Enhancing Notes…</span>
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>Start AI Enhancement</span>
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

