import { useRequestStore } from '../../_store';
import { useTabsStore } from '../../_store/tabs';
import type { SavedRequest, Tab, TabSnapshot } from '../../_types';

export function captureSnapshot(): TabSnapshot {
    const {
        method,
        url,
        params,
        headers,
        bodyType,
        body,
        formBody,
        multipartBody,
        auth,
        response,
    } = useRequestStore.getState();
    return {
        method,
        url,
        params,
        headers,
        bodyType,
        body,
        formBody,
        multipartBody,
        auth,
        response,
    };
}

export function isTabSaved(tab: Tab): boolean {
    return Boolean(tab.savedRequestId);
}

export function openSavedRequest(req: SavedRequest, collectionId: string): void {
    const tabs = useTabsStore.getState();
    const { initFromSnapshot } = useRequestStore.getState();

    const linkedTab = tabs.tabs.find((t) => t.savedRequestId === req.id);
    if (linkedTab) {
        if (linkedTab.id !== tabs.activeTabId) {
            tabs.syncActiveTab(captureSnapshot());
            const fresh = useTabsStore.getState().tabs.find((t) => t.id === linkedTab.id);
            useTabsStore.getState().setActiveTab(linkedTab.id);
            initFromSnapshot(fresh?.snapshot ?? linkedTab.snapshot);
        }
        return;
    }

    tabs.syncActiveTab(captureSnapshot());

    const { tabs: synced, activeTabId } = useTabsStore.getState();
    const activeTab = synced.find((t) => t.id === activeTabId);
    const activeIsReusable = !activeTab?.savedRequestId && !activeTab?.snapshot.url.trim();

    const targetTabId = activeIsReusable ? activeTabId : useTabsStore.getState().addTab();

    const snapshot: TabSnapshot = {
        ...req.snapshot,
        auth: req.snapshot.auth ?? { type: 'none' },
    };

    initFromSnapshot(snapshot);
    useTabsStore.getState().syncActiveTab(snapshot);
    useTabsStore.getState().renameTab(targetTabId, req.name);
    useTabsStore.getState().linkTab(targetTabId, req.id, collectionId);
}

export function requestLabel(req: SavedRequest): string {
    if (req.name) return req.name;
    const url = req.snapshot.url.trim();
    if (!url) return 'New Request';
    try {
        const parsed = new URL(url);
        return parsed.pathname === '/' ? parsed.hostname : parsed.pathname;
    } catch {
        return url.length > 20 ? url.slice(0, 20) + '…' : url;
    }
}

export function tabLabel(tab: Tab): string {
    if (tab.name) return tab.name;
    const url = tab.snapshot.url.trim();
    if (!url) return 'New Request';
    try {
        const parsed = new URL(url);
        return parsed.pathname === '/' ? parsed.hostname : parsed.pathname;
    } catch {
        return url.length > 20 ? url.slice(0, 20) + '…' : url;
    }
}
