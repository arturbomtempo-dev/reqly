import { idbStorage } from '@/shared/utils/idb-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Collection, SavedRequest, TabSnapshot } from '../_types';

function uid(): string {
    return Math.random().toString(36).slice(2);
}

function mapCollections(
    collections: Collection[],
    id: string,
    updater: (c: Collection) => Collection
): Collection[] {
    return collections.map((c) => {
        if (c.id === id) return updater(c);
        return { ...c, folders: mapCollections(c.folders ?? [], id, updater) };
    });
}

function filterCollections(collections: Collection[], id: string): Collection[] {
    return collections
        .filter((c) => c.id !== id)
        .map((c) => ({ ...c, folders: filterCollections(c.folders ?? [], id) }));
}

function findCollection(collections: Collection[], id: string): Collection | undefined {
    for (const c of collections) {
        if (c.id === id) return c;
        const found = findCollection(c.folders ?? [], id);
        if (found) return found;
    }
    return undefined;
}

export function indexRequests(collections: Collection[]): Map<string, string> {
    const index = new Map<string, string>();
    const walk = (cols: Collection[]) => {
        for (const c of cols) {
            for (const r of c.requests) index.set(r.id, c.id);
            walk(c.folders ?? []);
        }
    };
    walk(collections);
    return index;
}

function deepClearResponses(c: Collection): Collection {
    return {
        ...c,
        requests: c.requests.map((r) => ({ ...r, snapshot: { ...r.snapshot, response: null } })),
        folders: (c.folders ?? []).map(deepClearResponses),
    };
}

function normalizeCollection(c: Collection): Collection {
    return {
        ...c,
        folders: (c.folders ?? []).map(normalizeCollection),
    };
}

interface CollectionsState {
    collections: Collection[];
    expandedIds: string[];
    sidebarOpen: boolean;
}

interface CollectionsActions {
    toggleSidebar: () => void;
    setSidebarOpen: (open: boolean) => void;
    addCollection: (name: string) => string;
    addFolder: (parentId: string, name: string) => string;
    renameCollection: (id: string, name: string) => void;
    removeCollection: (id: string) => void;
    toggleExpanded: (id: string) => void;
    addRequest: (collectionId: string, name: string, snapshot: TabSnapshot) => string;
    renameRequest: (collectionId: string, requestId: string, name: string) => void;
    removeRequest: (collectionId: string, requestId: string) => void;
    updateRequest: (collectionId: string, requestId: string, snapshot: TabSnapshot) => void;
    moveRequest: (fromCollectionId: string, toCollectionId: string, requestId: string) => void;
    clearCollections: () => void;
}

export const useCollectionsStore = create<CollectionsState & CollectionsActions>()(
    persist(
        (set) => ({
            collections: [],
            expandedIds: [],
            sidebarOpen: false,

            toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
            setSidebarOpen: (open) => set({ sidebarOpen: open }),

            addCollection: (name) => {
                const id = uid();
                set((s) => ({
                    collections: [...s.collections, { id, name, requests: [], folders: [] }],
                    expandedIds: [...s.expandedIds, id],
                }));
                return id;
            },

            addFolder: (parentId, name) => {
                const id = uid();
                set((s) => ({
                    collections: mapCollections(s.collections, parentId, (c) => ({
                        ...c,
                        folders: [...(c.folders ?? []), { id, name, requests: [], folders: [] }],
                    })),
                    expandedIds: [...s.expandedIds, id],
                }));
                return id;
            },

            renameCollection: (id, name) => {
                set((s) => ({
                    collections: mapCollections(s.collections, id, (c) => ({
                        ...c,
                        name: name.trim() || c.name,
                    })),
                }));
            },

            removeCollection: (id) => {
                set((s) => ({
                    collections: filterCollections(s.collections, id),
                    expandedIds: s.expandedIds.filter((eid) => eid !== id),
                }));
            },

            toggleExpanded: (id) => {
                set((s) => ({
                    expandedIds: s.expandedIds.includes(id)
                        ? s.expandedIds.filter((eid) => eid !== id)
                        : [...s.expandedIds, id],
                }));
            },

            addRequest: (collectionId, name, snapshot) => {
                const id = uid();
                const saved: SavedRequest = {
                    id,
                    name,
                    snapshot: { ...snapshot, response: null },
                };
                set((s) => ({
                    collections: mapCollections(s.collections, collectionId, (c) => ({
                        ...c,
                        requests: [...c.requests, saved],
                    })),
                }));
                return id;
            },

            renameRequest: (collectionId, requestId, name) => {
                set((s) => ({
                    collections: mapCollections(s.collections, collectionId, (c) => ({
                        ...c,
                        requests: c.requests.map((r) =>
                            r.id === requestId ? { ...r, name: name.trim() || r.name } : r
                        ),
                    })),
                }));
            },

            removeRequest: (collectionId, requestId) => {
                set((s) => ({
                    collections: mapCollections(s.collections, collectionId, (c) => ({
                        ...c,
                        requests: c.requests.filter((r) => r.id !== requestId),
                    })),
                }));
            },

            updateRequest: (collectionId, requestId, snapshot) => {
                set((s) => ({
                    collections: mapCollections(s.collections, collectionId, (c) => ({
                        ...c,
                        requests: c.requests.map((r) =>
                            r.id === requestId
                                ? { ...r, snapshot: { ...snapshot, response: null } }
                                : r
                        ),
                    })),
                }));
            },

            clearCollections: () => {
                set({ collections: [], expandedIds: [] });
            },

            moveRequest: (fromCollectionId, toCollectionId, requestId) => {
                set((s) => {
                    if (fromCollectionId === toCollectionId) return s;

                    const from = findCollection(s.collections, fromCollectionId);
                    const req = from?.requests.find((r) => r.id === requestId);
                    if (!req) return s;

                    const detached = mapCollections(s.collections, fromCollectionId, (c) => ({
                        ...c,
                        requests: c.requests.filter((r) => r.id !== requestId),
                    }));

                    return {
                        collections: mapCollections(detached, toCollectionId, (c) => ({
                            ...c,
                            requests: [...c.requests, req],
                        })),
                    };
                });
            },
        }),
        {
            name: 'reqly:collections',
            storage: createJSONStorage(() => idbStorage),
            partialize: (state) => ({
                collections: state.collections.map(deepClearResponses),
                expandedIds: state.expandedIds,
                sidebarOpen: state.sidebarOpen,
            }),
            onRehydrateStorage: () => (state) => {
                if (state) {
                    state.collections = state.collections.map(normalizeCollection);
                }
            },
        }
    )
);
