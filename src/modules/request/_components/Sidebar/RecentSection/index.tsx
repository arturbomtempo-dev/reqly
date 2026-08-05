import { cn } from '@/shared/utils/cn';
import { ChevronRight, Clock } from 'lucide-react';
import { useState } from 'react';
import { useRequestStore } from '../../../_store';
import { useCollectionsStore } from '../../../_store/collections';
import { useTabsStore } from '../../../_store/tabs';
import { drag } from '../drag';
import { TabItem } from '../TabItem';
import { captureSnapshot, isTabSaved } from '../utils';

export function RecentSection() {
    const { tabs, activeTabId, addTab, syncActiveTab } = useTabsStore();
    const { removeRequest } = useCollectionsStore();
    const { initFromSnapshot } = useRequestStore();
    const [expanded, setExpanded] = useState(true);
    const [dragOver, setDragOver] = useState(false);

    const visibleTabs = tabs.filter((tab) => !isTabSaved(tab));

    const handleDragOver = (e: React.DragEvent) => {
        if (!drag.current || drag.current.type !== 'request') return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOver(true);
    };

    const handleDragLeave = () => setDragOver(false);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        if (!drag.current || drag.current.type !== 'request') return;
        if (!drag.current.requestId || !drag.current.sourceCollectionId) return;
        const dragging = drag.current;

        const collection = useCollectionsStore
            .getState()
            .collections.find((c) => c.id === dragging.sourceCollectionId);
        const req = collection?.requests.find((r) => r.id === dragging.requestId);

        if (req) {
            const { tabs: currentTabs, activeTabId: currentActiveTabId } = useTabsStore.getState();
            const existing = currentTabs.find((t) => t.savedRequestId === req.id);
            if (existing) {
                useTabsStore.getState().linkTab(existing.id, '', '');
                if (existing.id !== currentActiveTabId) {
                    syncActiveTab(captureSnapshot());
                    useTabsStore.getState().setActiveTab(existing.id);
                    initFromSnapshot(existing.snapshot);
                }
            } else {
                const snapshot = captureSnapshot();
                syncActiveTab(snapshot);
                const newId = addTab();
                const reqSnapshot = {
                    ...req.snapshot,
                    auth: req.snapshot.auth ?? { type: 'none' as const },
                };
                initFromSnapshot(reqSnapshot);
                useTabsStore.getState().syncActiveTab(reqSnapshot);
                useTabsStore.getState().renameTab(newId, req.name);
            }
            removeRequest(dragging.sourceCollectionId!, dragging.requestId!);
        }

        drag.current = null;
    };

    return (
        <div>
            <div
                onClick={() => setExpanded((v) => !v)}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                    'flex items-center gap-1.5 px-2 py-1.5 cursor-pointer hover:bg-(--color-surface-hover) rounded-sm transition-colors',
                    dragOver && 'ring-2 ring-(--color-primary)/50 bg-(--color-primary)/5'
                )}
            >
                <ChevronRight
                    className={cn(
                        'h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-150',
                        expanded && 'rotate-90'
                    )}
                />
                <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="text-xs font-medium truncate min-w-0 text-(--color-text)">
                    Recent
                </span>
                <span className="ml-auto text-[10px] font-mono text-muted-foreground tabular-nums shrink-0">
                    {visibleTabs.length}
                </span>
            </div>
            {expanded && (
                <div className="ml-1">
                    {visibleTabs.map((tab) => (
                        <TabItem key={tab.id} tab={tab} isActive={tab.id === activeTabId} />
                    ))}
                </div>
            )}
        </div>
    );
}
