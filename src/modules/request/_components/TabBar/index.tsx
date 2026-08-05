import { cn } from '@/shared/utils/cn';
import { Plus, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useRequestStore } from '../../_store';
import { useCollectionsStore } from '../../_store/collections';
import { useTabsStore } from '../../_store/tabs';
import type { Tab, TabSnapshot } from '../../_types';
import { MethodBadge } from '../MethodBadge';

function tabLabel(tab: Tab): string {
    if (tab.name) return tab.name;
    const url = tab.snapshot.url.trim();
    if (!url) return 'New Request';
    try {
        const parsed = new URL(url);
        return parsed.pathname === '/' ? parsed.hostname : parsed.pathname;
    } catch {
        return url.length > 22 ? url.slice(0, 22) + '…' : url;
    }
}

function captureSnapshot(): TabSnapshot {
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

export function TabBar() {
    const { tabs, activeTabId, addTab, closeTab, setActiveTab, syncActiveTab, renameTab } =
        useTabsStore();
    const { initFromSnapshot } = useRequestStore();

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingValue, setEditingValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const handleTabClick = (id: string) => {
        if (id === activeTabId || editingId === id) return;
        syncActiveTab(captureSnapshot());
        const target = useTabsStore.getState().tabs.find((t) => t.id === id);
        if (target) {
            setActiveTab(id);
            initFromSnapshot(target.snapshot);
        }
    };

    const handleAdd = () => {
        syncActiveTab(captureSnapshot());
        const newId = addTab();
        const newTab = useTabsStore.getState().tabs.find((t) => t.id === newId);
        if (newTab) initFromSnapshot(newTab.snapshot);
    };

    const handleClose = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (id === activeTabId) syncActiveTab(captureSnapshot());
        const newActiveId = closeTab(id);
        if (newActiveId) {
            const newActive = useTabsStore.getState().tabs.find((t) => t.id === newActiveId);
            if (newActive) initFromSnapshot(newActive.snapshot);
        }
    };

    const startEditing = (e: React.MouseEvent, tab: Tab) => {
        e.stopPropagation();
        setEditingId(tab.id);
        setEditingValue(tab.name ?? tabLabel(tab));
        setTimeout(() => {
            inputRef.current?.select();
        }, 0);
    };

    const commitEdit = () => {
        if (editingId) {
            const tab = tabs.find((t) => t.id === editingId);
            renameTab(editingId, editingValue);
            if (tab?.savedRequestId && tab.collectionId && editingValue.trim()) {
                useCollectionsStore
                    .getState()
                    .renameRequest(tab.collectionId, tab.savedRequestId, editingValue);
            }
        }
        setEditingId(null);
    };

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') commitEdit();
        if (e.key === 'Escape') setEditingId(null);
        e.stopPropagation();
    };

    return (
        <div className="flex items-center border-b border-(--color-border) bg-(--color-surface-raised)/40 px-2 shrink-0 overflow-x-auto">
            {tabs.map((tab) => {
                const isActive = tab.id === activeTabId;
                const isEditing = editingId === tab.id;
                return (
                    <div
                        key={tab.id}
                        onClick={() => handleTabClick(tab.id)}
                        onDoubleClick={(e) => startEditing(e, tab)}
                        className={cn(
                            'group flex items-center gap-1.5 px-3 py-2 text-xs cursor-pointer shrink-0 border-b-2 transition-colors duration-(--transition-fast) select-none max-w-44',
                            isActive
                                ? 'border-b-(--color-primary) text-(--color-text)'
                                : 'border-b-transparent text-muted-foreground hover:text-(--color-text) hover:bg-(--color-surface-hover)'
                        )}
                    >
                        <MethodBadge method={tab.snapshot.method} className="text-[10px]" />
                        {isEditing ? (
                            <input
                                ref={inputRef}
                                value={editingValue}
                                onChange={(e) => setEditingValue(e.target.value)}
                                onBlur={commitEdit}
                                onKeyDown={handleInputKeyDown}
                                onClick={(e) => e.stopPropagation()}
                                className="min-w-0 w-24 bg-transparent outline-none border-b border-(--color-primary) text-xs text-(--color-text) font-inherit"
                            />
                        ) : (
                            <span className="truncate min-w-0">{tabLabel(tab)}</span>
                        )}
                        <button
                            onClick={(e) => handleClose(e, tab.id)}
                            className={cn(
                                'ml-auto shrink-0 rounded p-0.5 transition-colors duration-(--transition-fast)',
                                'opacity-0 group-hover:opacity-100',
                                isActive && 'opacity-60',
                                'hover:opacity-100 hover:bg-(--color-surface-raised) text-muted-foreground hover:text-(--color-text)'
                            )}
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </div>
                );
            })}
            <button
                onClick={handleAdd}
                className="shrink-0 p-2 text-muted-foreground hover:text-(--color-text) transition-colors duration-(--transition-fast)"
                aria-label="New tab"
            >
                <Plus className="h-3.5 w-3.5" />
            </button>
        </div>
    );
}
