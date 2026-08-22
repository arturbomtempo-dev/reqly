import { useAuth } from '@/core/auth';
import { clearToken } from '@/core/auth/token';
import { useEffect, useRef, type ReactNode } from 'react';
import { startSync, stopSync } from './engine';
import { setSyncStatus } from './status';

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
            clearToken();
            startedFor.current = null;
            setSyncStatus({
                phase: 'error',
                error: 'Session expired. Sign in again to resume syncing.',
            });
        });

        return () => {
            startedFor.current = null;
            void stopSync({ flush: false });
        };
    }, [user]);

    return <>{children}</>;
}
