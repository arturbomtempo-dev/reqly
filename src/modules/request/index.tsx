import { useEffect } from 'react';
import { RequestPanel } from './_components/RequestPanel';
import { ResponsePanel } from './_components/ResponsePanel';
import { Sidebar } from './_components/Sidebar';
import { TabBar } from './_components/TabBar';
import { TopBar } from './_components/TopBar';
import { UrlBar } from './_components/UrlBar';
import { _resetSkipCollectionSync, _skipCollectionSync, useRequestStore } from './_store';
import { indexRequests, useCollectionsStore } from './_store/collections';
import { useTabsStore } from './_store/tabs';
import type { Collection, TabSnapshot } from './_types';

export function RequestModule() {
    useEffect(() => {
        return useRequestStore.subscribe((state) => {
            const snapshot: TabSnapshot = {
                method: state.method,
                url: state.url,
                params: state.params,
                headers: state.headers,
                bodyType: state.bodyType,
                body: state.body,
                formBody: state.formBody,
                multipartBody: state.multipartBody,
                auth: state.auth,
                response: state.response,
            };
            useTabsStore.getState().syncActiveTab(snapshot);

            if (_skipCollectionSync) {
                _resetSkipCollectionSync();
                return;
            }

            const { tabs, activeTabId } = useTabsStore.getState();
            const activeTab = tabs.find((t) => t.id === activeTabId);

            if (activeTab?.savedRequestId && activeTab?.collectionId) {
                useCollectionsStore
                    .getState()
                    .updateRequest(activeTab.collectionId, activeTab.savedRequestId, snapshot);
            }
        });
    }, []);

    useEffect(() => {
        const reconcile = (collections: Collection[]) =>
            useTabsStore.getState().reconcileLinks(indexRequests(collections));

        reconcile(useCollectionsStore.getState().collections);

        return useCollectionsStore.subscribe((state, prev) => {
            if (state.collections !== prev.collections) reconcile(state.collections);
        });
    }, []);

    return (
        <div className="flex h-full min-h-0">
            <Sidebar />
            <div className="flex flex-col flex-1 min-w-0 min-h-0">
                <TopBar />
                <TabBar />
                <div className="flex-1 flex flex-col gap-3 p-4 min-h-0 overflow-hidden">
                    <UrlBar />
                    <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 grid-rows-1 gap-3 min-h-0">
                        <RequestPanel />
                        <ResponsePanel />
                    </div>
                </div>
            </div>
        </div>
    );
}
