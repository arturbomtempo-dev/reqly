import { idbStorage } from '@/shared/utils/idb-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { EntityKind, Workspace } from './types';
import { versionKey } from './types';

/**
 * Bookkeeping the sync engine needs across reloads.
 *
 * `versions` is the record of what the server is known to hold: entity key ->
 * the `updatedAt` it acknowledged. Anything whose local `updatedAt` differs is
 * pending, which is how an edit made while offline is still pending after a
 * refresh instead of being silently forgotten.
 */
interface SyncMetaState {
    /** The account this bookkeeping belongs to; a different uid invalidates it. */
    uid: string | null;
    /** Server-issued cursor for delta pulls. */
    cursor: string | null;
    clockSkewMs: number;
    lastSyncedAt: number | null;
    versions: Record<string, number>;
}

interface SyncMetaActions {
    reset: (uid: string | null) => void;
    setCursor: (cursor: string) => void;
    setClockSkew: (skewMs: number) => void;
    markSynced: (workspace: Workspace, at: number) => void;
    /** Drops bookkeeping for entities that no longer exist on either side. */
    pruneVersions: (liveKeys: Set<string>) => void;
}

function collectVersions(workspace: Workspace): Record<string, number> {
    const versions: Record<string, number> = {};
    const add = (kind: EntityKind, rows: Array<{ id: string; updatedAt: number }>) => {
        for (const row of rows) versions[versionKey(kind, row.id)] = row.updatedAt;
    };

    add('collection', workspace.collections);
    add('request', workspace.requests);
    add('variable', workspace.variables);

    return versions;
}

export const useSyncMetaStore = create<SyncMetaState & SyncMetaActions>()(
    persist(
        (set) => ({
            uid: null,
            cursor: null,
            clockSkewMs: 0,
            lastSyncedAt: null,
            versions: {},

            reset: (uid) => set({ uid, cursor: null, lastSyncedAt: null, versions: {} }),

            setCursor: (cursor) => set({ cursor }),

            setClockSkew: (clockSkewMs) => set({ clockSkewMs }),

            markSynced: (workspace, at) =>
                set((s) => ({
                    versions: { ...s.versions, ...collectVersions(workspace) },
                    lastSyncedAt: at,
                })),

            pruneVersions: (liveKeys) =>
                set((s) => {
                    const versions: Record<string, number> = {};
                    for (const [key, value] of Object.entries(s.versions)) {
                        if (liveKeys.has(key)) versions[key] = value;
                    }
                    return { versions };
                }),
        }),
        {
            name: 'reqly:sync-meta',
            storage: createJSONStorage(() => idbStorage),
        }
    )
);
