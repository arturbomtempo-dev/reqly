import { useAuth } from '@/core/auth';
import { fetchCloudCollections, saveCollectionsToCloud } from '@/core/sync';
import { useCollectionsStore } from '@/modules/request/_store/collections';
import { useTabsStore } from '@/modules/request/_store/tabs';
import type { Collection } from '@/modules/request/_types';
import { useEffect, useRef, type ReactNode } from 'react';

let _isSyncingFromCloud = false;

export function SyncProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const prevUidRef = useRef<string | null>(null);

    useEffect(() => {
        const currentUid = user?.uid ?? null;
        const prevUid = prevUidRef.current;

        if (currentUid === prevUid) return;
        prevUidRef.current = currentUid;

        if (!currentUid) {
            useCollectionsStore.getState().clearCollections();
            useTabsStore.getState().clearTabs();
            return;
        }

        (async () => {
            if (!useCollectionsStore.persist.hasHydrated()) {
                await new Promise<void>((resolve) => {
                    const unsub = useCollectionsStore.persist.onFinishHydration(() => {
                        unsub();
                        resolve();
                    });
                });
            }

            const localCollections = useCollectionsStore.getState().collections;
            const cloudCollections = await fetchCloudCollections();

            const merged = mergeCollections(cloudCollections, localCollections);

            _isSyncingFromCloud = true;
            useCollectionsStore.setState({ collections: merged });
            _isSyncingFromCloud = false;

            await saveCollectionsToCloud(merged);
        })();
    }, [user]);

    useEffect(() => {
        if (!user) return;

        const unsub = useCollectionsStore.subscribe((state, prevState) => {
            if (_isSyncingFromCloud) return;
            if (state.collections === prevState.collections) return;
            saveCollectionsToCloud(state.collections);
        });

        return unsub;
    }, [user]);

    return <>{children}</>;
}

function mergeCollections(cloud: Collection[], local: Collection[]): Collection[] {
    const merged = [...cloud];
    const cloudIds = new Set(cloud.map((c) => c.id));

    for (const localCol of local) {
        if (!cloudIds.has(localCol.id)) {
            merged.push(localCol);
        }
    }

    return merged;
}
