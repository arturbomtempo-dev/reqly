import { create } from 'zustand';
import type { MergeReport } from './merge';

export type SyncPhase =
    | 'local'
    | 'merging'
    | 'syncing'
    | 'synced'
    | 'offline'
    | 'error';

interface SyncStatusState {
    phase: SyncPhase;
    pending: number;
    lastSyncedAt: number | null;
    error: string | null;
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
