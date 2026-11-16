import { Loader2 } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

interface ConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'destructive' | 'default';
    isLoading?: boolean;
    onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    confirmText = 'Delete',
    cancelText = 'Cancel',
    variant = 'destructive',
    isLoading = false,
    onConfirm,
}: ConfirmDialogProps) {
    const handleConfirm = async (e: React.MouseEvent) => {
        e.preventDefault();
        await onConfirm();
        onOpenChange(false);
    };

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent className="sm:max-w-[440px] p-6 rounded-2xl bg-card border border-border/60 shadow-xl">
                <AlertDialogHeader className="space-y-1.5 text-left">
                    <AlertDialogTitle className="text-sm font-semibold text-foreground">
                        {title}
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
                        {description}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-border/40">
                    <AlertDialogCancel
                        disabled={isLoading}
                        className="rounded-lg h-8 text-xs font-normal border-border/60 hover:bg-muted/30"
                    >
                        {cancelText}
                    </AlertDialogCancel>
                    <Button
                        variant={variant === 'destructive' ? 'destructive' : 'default'}
                        size="sm"
                        disabled={isLoading}
                        onClick={handleConfirm}
                        className="rounded-lg h-8 text-xs font-medium gap-1.5"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Processing…</span>
                            </>
                        ) : (
                            <span>{confirmText}</span>
                        )}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

