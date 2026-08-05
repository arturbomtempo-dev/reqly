import { cn } from '@/shared/utils/cn';
import { GripVertical, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useRequestStore } from '../../../_store';
import { useCollectionsStore } from '../../../_store/collections';
import { useTabsStore } from '../../../_store/tabs';
import type { SavedRequest } from '../../../_types';
import { MethodBadge } from '../../MethodBadge';
import { ContextMenu } from '../ContextMenu';
import { drag } from '../drag';
import { InlineEdit } from '../InlineEdit';
import { captureSnapshot, openSavedRequest, requestLabel } from '../utils';

export function RequestItem({
    req,
    collectionId,
    depth = 0,
}: {
    req: SavedRequest;
    collectionId: string;
    depth?: number;
}) {
    const { renameRequest, removeRequest } = useCollectionsStore();
    const { initFromSnapshot } = useRequestStore();
    const { syncActiveTab, closeTab } = useTabsStore();
    const [editing, setEditing] = useState(false);
    const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

    const handleDelete = () => {
        const { tabs, activeTabId } = useTabsStore.getState();
        const matchingTab = tabs.find((t) => t.savedRequestId === req.id);
        removeRequest(collectionId, req.id);
        if (matchingTab) {
            if (matchingTab.id === activeTabId) {
                syncActiveTab(captureSnapshot());
            }
            const newActiveId = closeTab(matchingTab.id);
            if (newActiveId) {
                const newActive = useTabsStore.getState().tabs.find((t) => t.id === newActiveId);
                if (newActive) initFromSnapshot(newActive.snapshot);
            }
        }
    };

    const openRequest = () => {
        if (editing) return;
        openSavedRequest(req, collectionId);
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setMenu({ x: e.clientX, y: e.clientY });
    };

    const handleDragStart = (e: React.DragEvent) => {
        drag.current = { type: 'request', requestId: req.id, sourceCollectionId: collectionId };
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', req.id);
    };

    const handleDragEnd = () => {
        drag.current = null;
    };

    return (
        <>
            <div
                onClick={openRequest}
                onDoubleClick={(e) => {
                    e.stopPropagation();
                    setEditing(true);
                }}
                onContextMenu={handleContextMenu}
                draggable
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                className="group flex items-center gap-2 pr-2 py-1 cursor-pointer hover:bg-(--color-surface-hover) rounded-sm transition-colors"
                style={{ paddingLeft: `${16 + depth * 12}px` }}
            >
                <GripVertical className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-40 cursor-grab text-muted-foreground" />
                <MethodBadge method={req.snapshot.method} className="text-[9px] shrink-0" />
                {editing ? (
                    <InlineEdit
                        value={req.name}
                        onCommit={(name) => {
                            renameRequest(collectionId, req.id, name);
                            if (name.trim()) {
                                const linkedTab = useTabsStore
                                    .getState()
                                    .findTabByRequestId(req.id);
                                if (linkedTab) {
                                    useTabsStore.getState().renameTab(linkedTab.id, name);
                                }
                            }
                            setEditing(false);
                        }}
                        onCancel={() => setEditing(false)}
                    />
                ) : (
                    <span className="text-xs truncate min-w-0 text-(--color-text-subtle) group-hover:text-(--color-text) transition-colors">
                        {requestLabel(req)}
                    </span>
                )}
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        setMenu({ x: rect.right, y: rect.bottom });
                    }}
                    className="ml-auto shrink-0 opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-(--color-text) transition-all"
                >
                    <MoreHorizontal className="h-3 w-3" />
                </button>
            </div>
            {menu && (
                <ContextMenu
                    position={menu}
                    onClose={() => setMenu(null)}
                    items={[
                        {
                            label: 'Rename',
                            icon: Pencil,
                            onClick: () => setEditing(true),
                        },
                        {
                            label: 'Delete',
                            icon: Trash2,
                            onClick: handleDelete,
                            destructive: true,
                        },
                    ]}
                />
            )}
        </>
    );
}
