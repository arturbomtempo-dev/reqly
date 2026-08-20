import { useSyncStatusStore, type SyncPhase } from '@/core/sync/status';
import { cn } from '@/shared/utils/cn';
import { AlertTriangle, Check, CloudOff, HardDrive, RefreshCw } from 'lucide-react';

const PHASE_LABEL: Record<SyncPhase, string> = {
    local: 'Saved on this device',
    merging: 'Merging your collections…',
    syncing: 'Syncing…',
    synced: 'All changes saved',
    offline: 'Offline — changes queued',
    error: 'Sync paused',
};

const PHASE_ICON = {
    local: HardDrive,
    merging: RefreshCw,
    syncing: RefreshCw,
    synced: Check,
    offline: CloudOff,
    error: AlertTriangle,
} satisfies Record<SyncPhase, React.ComponentType<{ className?: string }>>;

function relativeTime(timestamp: number): string {
    const seconds = Math.round((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.round(hours / 24)}d ago`;
}

/** Small coloured dot on the avatar, so sync state is visible without opening the menu. */
export function SyncDot() {
    const phase = useSyncStatusStore((s) => s.phase);

    if (phase === 'local' || phase === 'synced') return null;

    return (
        <span
            aria-hidden
            className={cn(
                'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-(--color-surface)',
                phase === 'error' && 'bg-destructive',
                phase === 'offline' && 'bg-amber-500',
                (phase === 'syncing' || phase === 'merging') && 'bg-(--color-primary) animate-pulse'
            )}
        />
    );
}

export function SyncStatusLine() {
    const { phase, pending, lastSyncedAt, error } = useSyncStatusStore();
    const Icon = PHASE_ICON[phase];

    const detail = (() => {
        if (error) return error;
        if (phase === 'offline' && pending > 0) return `${pending} change(s) waiting to upload`;
        if (phase === 'syncing' && pending > 0) return `${pending} change(s) uploading`;
        if (phase === 'synced' && lastSyncedAt) return relativeTime(lastSyncedAt);
        if (phase === 'local') return 'Sign in to sync across devices';
        return null;
    })();

    return (
        <div className="flex items-start gap-2 px-3 py-2">
            <Icon
                className={cn(
                    'mt-0.5 h-3.5 w-3.5 shrink-0',
                    phase === 'error' && 'text-destructive',
                    phase === 'offline' && 'text-amber-500',
                    phase === 'synced' && 'text-emerald-500',
                    (phase === 'syncing' || phase === 'merging') &&
                        'text-(--color-primary) animate-spin'
                )}
            />
            <div className="min-w-0">
                <p className="text-[11px] font-medium text-(--color-text)">{PHASE_LABEL[phase]}</p>
                {detail && (
                    <p className="text-[10px] text-muted-foreground break-words">{detail}</p>
                )}
            </div>
        </div>
    );
}

/** One-off summary of what the sign-in merge did, shown until the menu is reopened. */
export function MergeSummary() {
    const lastMerge = useSyncStatusStore((s) => s.lastMerge);
    if (!lastMerge) return null;

    const uploaded =
        lastMerge.collections.fromLocal +
        lastMerge.requests.fromLocal +
        lastMerge.variables.fromLocal;
    const linked =
        lastMerge.collections.linked + lastMerge.requests.linked + lastMerge.variables.linked;

    if (uploaded === 0 && linked === 0) return null;

    return (
        <p className="px-3 pb-2 text-[10px] text-muted-foreground">
            {uploaded > 0 && `${uploaded} local item(s) added to your account`}
            {uploaded > 0 && linked > 0 && ' · '}
            {linked > 0 && `${linked} matched existing item(s)`}
        </p>
    );
}
