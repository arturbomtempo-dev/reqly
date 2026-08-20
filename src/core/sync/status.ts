import { create } from 'zustand';
import type { MergeReport } from './merge';

export type SyncPhase =
    /** Signed out: everything stays in this browser. */
    | 'local'
    /** Reconciling the local workspace with the account on sign-in. */
    | 'merging'
    /** A push or pull is in flight. */
    | 'syncing'
    /** Everything local is on the server. */
    | 'synced'
    /** Changes are queued because the server is unreachable. */
    | 'offline'
    | 'error';

interface SyncStatusState {
    phase: SyncPhase;
    pending: number;
    lastSyncedAt: number | null;
    error: string | null;
    /** Summary of the last sign-in merge, surfaced once in the UI. */
    lastMerge: MergeReport | null;
}

interface SyncStatusActions {
    set: (partial: Partial<SyncStatusState>) => void;
    reset: () => void;
}

const initial: SyncStatusState = {
    phase: 'local',
    pending: 0,
    lastSyncedAt: null,
    error: null,
    lastMerge: null,
};

export const useSyncStatusStore = create<SyncStatusState & SyncStatusActions>()((set) => ({
    ...initial,
    set: (partial) => set(partial),
    reset: () => set(initial),
}));

export function setSyncStatus(partial: Partial<SyncStatusState>): void {
    useSyncStatusStore.getState().set(partial);
}
