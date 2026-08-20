import { useAuth } from '@/core/auth';
import { Button } from '@/shared/components/ui/Button';
import { LogIn, LogOut } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { MergeSummary, SyncDot, SyncStatusLine } from '../SyncStatus';

export function UserMenu() {
    const { user, loading, signInWithGoogle, signOut } = useAuth();
    const [open, setOpen] = useState(false);
    const [signingOut, setSigningOut] = useState(false);
    const [warning, setWarning] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    if (loading) return null;

    if (user) {
        const handleSignOut = async () => {
            setSigningOut(true);
            setWarning(null);

            const flushed = await signOut();
            setSigningOut(false);

            if (flushed) {
                setOpen(false);
                return;
            }

            // Signed out, but the workspace stays: some changes never reached
            // the server and clearing now would destroy them.
            setWarning(
                'Some changes could not be uploaded, so your collections were kept on this device. Sign in again to finish syncing.'
            );
        };

        return (
            <div className="relative" ref={menuRef}>
                <button
                    onClick={() => setOpen((o) => !o)}
                    className="relative h-8 w-8 rounded-full ring-1 ring-(--color-border) hover:ring-(--color-text)/40 transition-all cursor-pointer"
                    aria-label="User menu"
                >
                    <img
                        src={user.picture ?? undefined}
                        alt={user.name ?? 'User'}
                        className="h-full w-full rounded-full object-cover"
                        referrerPolicy="no-referrer"
                    />
                    <SyncDot />
                </button>

                {open && (
                    <div className="absolute right-0 top-full mt-1.5 w-64 rounded-lg border border-(--color-border) bg-(--color-surface-raised) shadow-lg py-1 z-50">
                        <div className="px-3 py-2 border-b border-(--color-border)">
                            <p className="text-xs font-medium text-(--color-text) truncate">
                                {user.name}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate">
                                {user.email}
                            </p>
                        </div>

                        <div className="border-b border-(--color-border)">
                            <SyncStatusLine />
                            <MergeSummary />
                        </div>

                        {warning && (
                            <p className="px-3 py-2 text-[10px] text-amber-500">{warning}</p>
                        )}

                        <button
                            onClick={handleSignOut}
                            disabled={signingOut}
                            className="flex items-center gap-2 w-full px-3 py-2 text-xs text-muted-foreground hover:text-(--color-text) hover:bg-(--color-surface)/60 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                        >
                            <LogOut className="h-3.5 w-3.5" />
                            {signingOut ? 'Saving your changes…' : 'Sign out'}
                        </button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <Button
            variant="ghost"
            size="sm"
            onClick={signInWithGoogle}
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-(--color-text)"
        >
            <LogIn className="h-3.5 w-3.5" />
            Sign in
        </Button>
    );
}
