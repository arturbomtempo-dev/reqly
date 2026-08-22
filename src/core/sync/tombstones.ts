import { idbStorage } from '@/shared/utils/idb-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { FlatCollection, FlatRequest, FlatVariable, Workspace } from './types';

interface TombstonesState {
    collections: Record<string, FlatCollection>;
    requests: Record<string, FlatRequest>;
    variables: Record<string, FlatVariable>;
}

interface TombstonesActions {
    record: (entries: {
        collections?: FlatCollection[];
        requests?: FlatRequest[];
        variables?: FlatVariable[];
    }) => void;
    forget: (ids: { collections?: string[]; requests?: string[]; variables?: string[] }) => void;
    clear: () => void;
    toWorkspace: () => Workspace;
}

function indexById<T extends { id: string }>(rows: T[]): Record<string, T> {
    return Object.fromEntries(rows.map((row) => [row.id, row]));
}

function omit<T>(source: Record<string, T>, ids: string[]): Record<string, T> {
    if (ids.length === 0) return source;
    const next = { ...source };
    for (const id of ids) delete next[id];
    return next;
}

export const useTombstonesStore = create<TombstonesState & TombstonesActions>()(
    persist(
        (set, get) => ({
            collections: {},
            requests: {},
            variables: {},

            record: ({ collections = [], requests = [], variables = [] }) => {
                if (!collections.length && !requests.length && !variables.length) return;
                set((s) => ({
                    collections: { ...s.collections, ...indexById(collections) },
                    requests: { ...s.requests, ...indexById(requests) },
                    variables: { ...s.variables, ...indexById(variables) },
                }));
            },

            forget: ({ collections = [], requests = [], variables = [] }) => {
                if (!collections.length && !requests.length && !variables.length) return;
                set((s) => ({
                    collections: omit(s.collections, collections),
                    requests: omit(s.requests, requests),
                    variables: omit(s.variables, variables),
                }));
            },

            clear: () => set({ collections: {}, requests: {}, variables: {} }),

            toWorkspace: () => {
                const { collections, requests, variables } = get();
                return {
                    collections: Object.values(collections),
                    requests: Object.values(requests),
                    variables: Object.values(variables),
                };
            },
        }),
        {
            name: 'reqly:tombstones',
            storage: createJSONStorage(() => idbStorage),
            partialize: (state) => ({
                collections: state.collections,
                requests: state.requests,
                variables: state.variables,
            }),
        }
    )
);

export function recordTombstones(entries: {
    collections?: FlatCollection[];
    requests?: FlatRequest[];
    variables?: FlatVariable[];
}): void {
    useTombstonesStore.getState().record(entries);
}
