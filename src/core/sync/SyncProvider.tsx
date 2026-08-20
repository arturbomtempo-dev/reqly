import { useAuth } from '@/core/auth';
import { clearToken } from '@/core/auth/token';
import { useEffect, useRef, type ReactNode } from 'react';
import { startSync, stopSync } from './engine';
import { setSyncStatus } from './status';

/**
 * Binds the sync engine to the session. The engine itself is framework-free;
 * this is the only place that knows about React.
 *
 * Signing out is handled by the auth layer rather than here: the pending
 * changes have to be flushed while the token is still valid, which means it
 * cannot be a reaction to the user already being gone.
 */
export function SyncProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const startedFor = useRef<string | null>(null);

    useEffect(() => {
        const uid = user?.uid ?? null;

        if (uid === startedFor.current) return;
        startedFor.current = uid;

        if (!uid) {
            void stopSync({ flush: false });
            setSyncStatus({ phase: 'local', pending: 0, error: null });
            return;
        }

        void startSync(uid, () => {
            // The session expired mid-flight. The workspace is deliberately left
            // in place: signing back in merges it, whereas clearing it here
            // would throw away anything not yet uploaded.
            clearToken();
            startedFor.current = null;
            setSyncStatus({
                phase: 'error',
                error: 'Session expired. Sign in again to resume syncing.',
            });
        });

        // Tearing down here rather than in a separate mount-scoped effect keeps
        // the ref and the engine in step, including through React's development
        // double-mount, where the two would otherwise drift apart and leave the
        // engine stopped while the ref still claims it is running.
        return () => {
            startedFor.current = null;
            void stopSync({ flush: false });
        };
    }, [user]);

    return <>{children}</>;
}
