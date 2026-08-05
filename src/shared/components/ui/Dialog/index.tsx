import { cn } from '@/shared/utils/cn';
import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

interface DialogProps {
    open: boolean;
    onClose: () => void;
    children: ReactNode;
    className?: string;
}

export function Dialog({ open, onClose, children, className }: DialogProps) {
    const dialogRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        document.addEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'hidden';

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [open, onClose]);

    if (!open) return null;

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) onClose();
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in-0"
            onClick={handleBackdropClick}
        >
            <div
                ref={dialogRef}
                className={cn(
                    'relative max-h-[85vh] w-full max-w-lg overflow-auto rounded-lg border border-(--color-border) bg-(--color-surface) shadow-lg animate-in zoom-in-95 fade-in-0',
                    className
                )}
            >
                {children}
            </div>
        </div>
    );
}

interface DialogHeaderProps {
    children: ReactNode;
    onClose?: () => void;
}

export function DialogHeader({ children, onClose }: DialogHeaderProps) {
    return (
        <div className="flex items-center justify-between border-b border-(--color-border) px-4 py-3">
            <h2 className="text-sm font-semibold text-(--color-text)">{children}</h2>
            {onClose && (
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded p-1 text-muted-foreground hover:text-(--color-text) hover:bg-(--color-surface-hover) transition-colors"
                >
                    <X className="h-4 w-4" />
                </button>
            )}
        </div>
    );
}

interface DialogBodyProps {
    children: ReactNode;
    className?: string;
}

export function DialogBody({ children, className }: DialogBodyProps) {
    return <div className={cn('p-4', className)}>{children}</div>;
}

interface DialogFooterProps {
    children: ReactNode;
    className?: string;
}

export function DialogFooter({ children, className }: DialogFooterProps) {
    return (
        <div
            className={cn(
                'flex items-center justify-end gap-2 border-t border-(--color-border) px-4 py-3',
                className
            )}
        >
            {children}
        </div>
    );
}
