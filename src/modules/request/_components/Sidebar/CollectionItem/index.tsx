import { Input } from '@/shared/components/ui/Input';
import { cn } from '@/shared/utils/cn';
import {
    ChevronRight,
    Download,
    FolderOpen,
    FolderPlus,
    MoreHorizontal,
    Pencil,
    Plus,
    Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useCollectionsStore } from '../../../_store/collections';
import { defaultSnapshot, useTabsStore } from '../../../_store/tabs';
import type { Collection } from '../../../_types';
import { ContextMenu } from '../ContextMenu';
import { drag } from '../drag';
import { ExportCollectionDialog } from '../ExportCollectionDialog';
import { InlineEdit } from '../InlineEdit';
import { RequestItem } from '../RequestItem';
import { captureSnapshot, openSavedRequest } from '../utils';

function NewFolderInput({ depth, onDone }: { depth: number; onDone: (name: string) => void }) {
    const [name, setName] = useState('');
    const ref = useRef<HTMLInputElement>(null);

    useEffect(() => {
        ref.current?.focus();
    }, []);

    const commit = () => onDone(name.trim());

    return (
        <div
            className="flex items-center gap-1.5 py-1 pr-2"
            style={{ paddingLeft: `${8 + depth * 12}px` }}
        >
            <ChevronRight className="h-3 w-3 shrink-0 opacity-0" />
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-(--color-primary)/70" />
            <Input
                ref={ref}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') commit();
                    if (e.key === 'Escape') onDone('');
                }}
                placeholder="Folder name"
                className="h-6 text-xs border-0 border-b border-(--color-primary) rounded-none bg-transparent shadow-none focus-visible:ring-0 px-0"
            />
        </div>
    );
}

export function CollectionItem({
    collection,
    depth = 0,
}: {
    collection: Collection;
    depth?: number;
}) {
    const {
        expandedIds,
        toggleExpanded,
        renameCollection,
        removeCollection,
        addFolder,
        addRequest,
        updateRequest,
        moveRequest,
    } = useCollectionsStore();

    const createAndOpenRequest = () => {
        const snapshot = defaultSnapshot();
        const id = addRequest(collection.id, 'New Request', snapshot);
        openSavedRequest({ id, name: 'New Request', snapshot }, collection.id);
        if (!expanded) toggleExpanded(collection.id);
    };

    const expanded = expandedIds.includes(collection.id);
    const [editing, setEditing] = useState(false);
    const [creatingFolder, setCreatingFolder] = useState(false);
    const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
    const [exportOpen, setExportOpen] = useState(false);
    const [dragOver, setDragOver] = useState(false);

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setMenu({ x: e.clientX, y: e.clientY });
    };

    const handleDragOver = (e: React.DragEvent) => {
        if (!drag.current) return;
        if (drag.current.type === 'request' && drag.current.sourceCollectionId === collection.id)
            return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOver(true);
    };

    const handleDragLeave = () => setDragOver(false);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        if (!drag.current) return;
        const dragging = drag.current;

        if (dragging.type === 'tab' && dragging.tabId) {
            const tab = useTabsStore.getState().tabs.find((t) => t.id === dragging.tabId);
            if (tab) {
                const snapshot =
                    tab.id === useTabsStore.getState().activeTabId
                        ? captureSnapshot()
                        : tab.snapshot;

                if (tab.savedRequestId && tab.collectionId) {
                    moveRequest(tab.collectionId, collection.id, tab.savedRequestId);
                    updateRequest(collection.id, tab.savedRequestId, snapshot);
                    useTabsStore.getState().linkTab(tab.id, tab.savedRequestId, collection.id);
                } else {
                    const url = snapshot.url.trim();
                    let name = tab.name || 'New Request';
                    if (!tab.name && url) {
                        try {
                            const parsed = new URL(url);
                            name = parsed.pathname === '/' ? parsed.hostname : parsed.pathname;
                        } catch {
                            name = url.length > 24 ? url.slice(0, 24) + '…' : url;
                        }
                    }
                    const requestId = addRequest(collection.id, name, snapshot);
                    useTabsStore.getState().linkTab(tab.id, requestId, collection.id);
                }
                if (!expanded) toggleExpanded(collection.id);
            }
        } else if (
            dragging.type === 'request' &&
            dragging.requestId &&
            dragging.sourceCollectionId
        ) {
            moveRequest(dragging.sourceCollectionId, collection.id, dragging.requestId);
            const linkedTab = useTabsStore
                .getState()
                .tabs.find((t) => t.savedRequestId === dragging.requestId);
            if (linkedTab) {
                useTabsStore.getState().linkTab(linkedTab.id, dragging.requestId, collection.id);
            }
            if (!expanded) toggleExpanded(collection.id);
        }

        drag.current = null;
    };

    return (
        <div>
            <div
                onClick={() => toggleExpanded(collection.id)}
                onContextMenu={handleContextMenu}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={{ paddingLeft: `${8 + depth * 12}px` }}
                className={cn(
                    'group flex items-center gap-1.5 pr-2 py-1.5 cursor-pointer hover:bg-(--color-surface-hover) rounded-sm transition-colors',
                    dragOver && 'ring-2 ring-(--color-primary)/50 bg-(--color-primary)/5'
                )}
            >
                <ChevronRight
                    className={cn(
                        'h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-150',
                        expanded && 'rotate-90'
                    )}
                />
                <FolderOpen className="h-3.5 w-3.5 shrink-0 text-(--color-primary)/70" />
                {editing ? (
                    <InlineEdit
                        value={collection.name}
                        onCommit={(name) => {
                            renameCollection(collection.id, name);
                            setEditing(false);
                        }}
                        onCancel={() => setEditing(false)}
                    />
                ) : (
                    <span className="text-xs font-medium truncate min-w-0 text-(--color-text)">
                        {collection.name}
                    </span>
                )}
                <span className="ml-auto text-[10px] font-mono text-muted-foreground tabular-nums shrink-0">
                    {collection.requests.length + (collection.folders?.length ?? 0)}
                </span>
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        setMenu({ x: rect.right, y: rect.bottom });
                    }}
                    className="shrink-0 opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-(--color-text) transition-all"
                >
                    <MoreHorizontal className="h-3 w-3" />
                </button>
            </div>

            {expanded && (
                <div>
                    {collection.requests.length === 0 &&
                        (collection.folders?.length ?? 0) === 0 &&
                        !creatingFolder && (
                            <p
                                className="py-2 text-[11px] text-(--color-text-subtle)"
                                style={{ paddingLeft: `${28 + depth * 12}px` }}
                            >
                                No requests yet
                            </p>
                        )}
                    {collection.requests.map((req) => (
                        <RequestItem
                            key={req.id}
                            req={req}
                            collectionId={collection.id}
                            depth={depth}
                        />
                    ))}
                    {(collection.folders ?? []).map((f) => (
                        <CollectionItem key={f.id} collection={f} depth={depth + 1} />
                    ))}
                    {creatingFolder && (
                        <NewFolderInput
                            depth={depth + 1}
                            onDone={(name) => {
                                if (name) addFolder(collection.id, name);
                                setCreatingFolder(false);
                            }}
                        />
                    )}
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            createAndOpenRequest();
                        }}
                        className="flex items-center gap-1.5 pr-2 py-1 w-full text-[11px] text-muted-foreground hover:text-(--color-text) transition-colors cursor-pointer"
                        style={{ paddingLeft: `${28 + depth * 12}px` }}
                    >
                        <Plus className="h-3 w-3" />
                        New request
                    </button>
                </div>
            )}

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
                            label: 'New folder',
                            icon: FolderPlus,
                            onClick: () => {
                                if (!expanded) toggleExpanded(collection.id);
                                setCreatingFolder(true);
                            },
                        },
                        {
                            label: 'New request',
                            icon: Plus,
                            onClick: createAndOpenRequest,
                        },
                        ...(depth === 0
                            ? [
                                  {
                                      label: 'Export',
                                      icon: Download,
                                      onClick: () => setExportOpen(true),
                                  },
                              ]
                            : []),
                        {
                            label: depth === 0 ? 'Delete collection' : 'Delete folder',
                            icon: Trash2,
                            onClick: () => removeCollection(collection.id),
                            destructive: true,
                        },
                    ]}
                />
            )}

            {depth === 0 && (
                <ExportCollectionDialog
                    open={exportOpen}
                    onClose={() => setExportOpen(false)}
                    collection={collection}
                />
            )}
        </div>
    );
}
