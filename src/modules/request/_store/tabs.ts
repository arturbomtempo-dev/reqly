import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FormDataField, KV, Tab, TabSnapshot } from '../_types';

function newKV(): KV {
    return {
        id: Math.random().toString(36).slice(2),
        key: '',
        value: '',
        enabled: true,
    };
}

function newFormDataField(): FormDataField {
    return {
        id: Math.random().toString(36).slice(2),
        key: '',
        value: '',
        type: 'text',
        enabled: true,
    };
}

export function defaultSnapshot(): TabSnapshot {
    return {
        method: 'GET',
        url: '',
        params: [newKV()],
        headers: [newKV()],
        bodyType: 'json',
        body: '',
        formBody: [newKV()],
        multipartBody: [newFormDataField()],
        auth: { type: 'none' },
        response: null,
    };
}

function newTab(): Tab {
    return {
        id: Math.random().toString(36).slice(2),
        snapshot: defaultSnapshot(),
    };
}

interface TabsState {
    tabs: Tab[];
    activeTabId: string;
}

interface TabsActions {
    addTab: () => string;
    closeTab: (id: string) => string | null;
    setActiveTab: (id: string) => void;
    syncActiveTab: (snapshot: TabSnapshot) => void;
    renameTab: (id: string, name: string) => void;
    linkTab: (tabId: string, savedRequestId: string, collectionId: string) => void;
    findTabByRequestId: (savedRequestId: string) => Tab | undefined;
    reconcileLinks: (requestIndex: Map<string, string>) => void;
    clearTabs: () => void;
}

const initialTab = newTab();

// Large response bodies (big JSON payloads, HTML pages, etc.) can quietly fill
// up localStorage's origin quota across several open tabs, starving other
// features (like collection import) of space. Cap what gets persisted.
const MAX_PERSISTED_RESPONSE_BODY = 200_000;

export const useTabsStore = create<TabsState & TabsActions>()(
    persist(
        (set, get) => ({
            tabs: [initialTab],
            activeTabId: initialTab.id,

            addTab: () => {
                const tab = newTab();
                set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }));
                return tab.id;
            },

            closeTab: (id) => {
                const { tabs, activeTabId } = get();

                if (tabs.length === 1) {
                    const fresh = newTab();
                    set({ tabs: [fresh], activeTabId: fresh.id });
                    return fresh.id;
                }

                const idx = tabs.findIndex((t) => t.id === id);
                if (idx === -1) return null;

                const neighbour = tabs[idx === 0 ? 1 : idx - 1];
                const nextActiveId = activeTabId === id ? neighbour.id : activeTabId;

                set({
                    tabs: tabs.filter((t) => t.id !== id),
                    activeTabId: nextActiveId,
                });

                return activeTabId === id ? nextActiveId : null;
            },

            setActiveTab: (id) => set({ activeTabId: id }),

            syncActiveTab: (snapshot) => {
                set((s) => ({
                    tabs: s.tabs.map((t) => (t.id === s.activeTabId ? { ...t, snapshot } : t)),
                }));
            },

            renameTab: (id, name) => {
                set((s) => ({
                    tabs: s.tabs.map((t) =>
                        t.id === id ? { ...t, name: name.trim() || undefined } : t
                    ),
                }));
            },

            linkTab: (tabId, savedRequestId, collectionId) => {
                set((s) => ({
                    tabs: s.tabs.map((t) =>
                        t.id === tabId
                            ? {
                                  ...t,
                                  savedRequestId: savedRequestId || undefined,
                                  collectionId: collectionId || undefined,
                              }
                            : t
                    ),
                }));
            },

            findTabByRequestId: (savedRequestId) => {
                return get().tabs.find((t) => t.savedRequestId === savedRequestId);
            },

            reconcileLinks: (requestIndex) => {
                set((s) => {
                    let changed = false;

                    const tabs = s.tabs.map((t) => {
                        if (!t.savedRequestId) return t;

                        const collectionId = requestIndex.get(t.savedRequestId);

                        if (!collectionId) {
                            changed = true;
                            return { ...t, savedRequestId: undefined, collectionId: undefined };
                        }

                        if (collectionId !== t.collectionId) {
                            changed = true;
                            return { ...t, collectionId };
                        }

                        return t;
                    });

                    return changed ? { tabs } : s;
                });
            },

            clearTabs: () => {
                const fresh = newTab();
                set({ tabs: [fresh], activeTabId: fresh.id });
            },
        }),
        {
            name: 'reqly:tabs',
            partialize: (state) => ({
                tabs: state.tabs.map((t) => ({
                    ...t,
                    snapshot: {
                        ...t.snapshot,
                        response: t.snapshot.response
                            ? {
                                  ...t.snapshot.response,
                                  previewUrl: null,
                                  body:
                                      t.snapshot.response.body.length > MAX_PERSISTED_RESPONSE_BODY
                                          ? ''
                                          : t.snapshot.response.body,
                              }
                            : null,
                    },
                })),
                activeTabId: state.activeTabId,
            }),
        }
    )
);
