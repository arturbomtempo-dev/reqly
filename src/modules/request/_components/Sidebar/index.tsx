import {
    SIDEBAR_DEFAULT_WIDTH,
    SIDEBAR_MAX_WIDTH,
    SIDEBAR_MIN_WIDTH,
    SIDEBAR_WIDTH_STORAGE_KEY,
} from '@/core/constants';
import { storageGet, storageSet } from '@/core/storage';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { cn } from '@/shared/utils/cn';
import { Braces, Download, FolderOpen, FolderPlus, Plus, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useRequestStore } from '../../_store';
import { useCollectionsStore } from '../../_store/collections';
import { useTabsStore } from '../../_store/tabs';
import { CollectionItem } from './CollectionItem';
import { ImportCollectionDialog } from './ImportCollectionDialog';
import { RecentSection } from './RecentSection';
import { VariablesDialog } from './VariablesDialog';
import { captureSnapshot } from './utils';

function NewCollectionInput({ onDone }: { onDone: () => void }) {
    const { addCollection } = useCollectionsStore();
    const [name, setName] = useState('');
    const ref = useRef<HTMLInputElement>(null);

    useEffect(() => {
        ref.current?.focus();
    }, []);

    const commit = () => {
        if (name.trim()) addCollection(name.trim());
        onDone();
    };

    return (
        <div className="flex items-center gap-1.5 px-2 py-1">
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-(--color-primary)/70" />
            <Input
                ref={ref}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') commit();
                    if (e.key === 'Escape') onDone();
                }}
                placeholder="Collection name"
                className="h-6 text-xs border-0 border-b border-(--color-primary) rounded-none bg-transparent shadow-none focus-visible:ring-0 px-0"
            />
        </div>
    );
}

export function Sidebar() {
    const { collections, sidebarOpen } = useCollectionsStore();
    const { addTab, syncActiveTab } = useTabsStore();
    const { initFromSnapshot } = useRequestStore();
    const [creating, setCreating] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const [variablesOpen, setVariablesOpen] = useState(false);

    const [width, setWidth] = useState<number>(() => {
        const stored = storageGet<number>(SIDEBAR_WIDTH_STORAGE_KEY);
        if (stored !== null)
            return Math.min(Math.max(stored, SIDEBAR_MIN_WIDTH), SIDEBAR_MAX_WIDTH);
        return SIDEBAR_DEFAULT_WIDTH;
    });

    const [isResizing, setIsResizing] = useState(false);

    if (!sidebarOpen) return null;

    const handleNewRequest = () => {
        syncActiveTab(captureSnapshot());
        const newId = addTab();
        const newTab = useTabsStore.getState().tabs.find((t) => t.id === newId);
        if (newTab) initFromSnapshot(newTab.snapshot);
    };

    const handleResizeMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = width;
        setIsResizing(true);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        const handleMouseMove = (ev: MouseEvent) => {
            const delta = ev.clientX - startX;
            const newWidth = Math.min(
                Math.max(startWidth + delta, SIDEBAR_MIN_WIDTH),
                SIDEBAR_MAX_WIDTH
            );
            setWidth(newWidth);
        };

        const handleMouseUp = (ev: MouseEvent) => {
            const delta = ev.clientX - startX;
            const finalWidth = Math.min(
                Math.max(startWidth + delta, SIDEBAR_MIN_WIDTH),
                SIDEBAR_MAX_WIDTH
            );
            storageSet(SIDEBAR_WIDTH_STORAGE_KEY, finalWidth);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            setIsResizing(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    return (
        <div
            style={{ width }}
            className="relative flex flex-col h-full shrink-0 border-r border-(--color-border) bg-(--color-surface-raised)/40"
        >
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-(--color-border) shrink-0">
                <span className="text-xs font-semibold text-(--color-text) tracking-wide uppercase">
                    Collections
                </span>
                <div className="flex items-center gap-0.5">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setVariablesOpen(true)}
                        className="h-6 w-6 text-muted-foreground hover:text-(--color-text)"
                        aria-label="Variables"
                        title="Global Variables"
                    >
                        <Braces className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setImportOpen(true)}
                        className="h-6 w-6 text-muted-foreground hover:text-(--color-text)"
                        aria-label="Import collection"
                        title="Import Collection"
                    >
                        <Upload className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleNewRequest}
                        className="h-6 w-6 text-muted-foreground hover:text-(--color-text)"
                        aria-label="New request"
                    >
                        <Plus className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setCreating(true)}
                        className="h-6 w-6 text-muted-foreground hover:text-(--color-text)"
                        aria-label="New collection"
                    >
                        <FolderPlus className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
                <RecentSection />

                {collections.length > 0 && <div className="h-px bg-(--color-border) mx-1 my-1.5" />}

                {collections.map((c) => (
                    <CollectionItem key={c.id} collection={c} />
                ))}

                {creating && <NewCollectionInput onDone={() => setCreating(false)} />}
            </div>

            <div
                role="separator"
                aria-orientation="vertical"
                onMouseDown={handleResizeMouseDown}
                className="absolute inset-y-0 -right-0.75 w-1.5 cursor-col-resize z-20 group/handle"
            >
                <div
                    className={cn(
                        'absolute inset-y-0 left-0.5 w-0.5 rounded-full transition-colors duration-150',
                        isResizing
                            ? 'bg-(--color-primary)/70'
                            : 'bg-transparent group-hover/handle:bg-(--color-primary)/40'
                    )}
                />
            </div>

            <ImportCollectionDialog open={importOpen} onClose={() => setImportOpen(false)} />
            <VariablesDialog open={variablesOpen} onClose={() => setVariablesOpen(false)} />
        </div>
    );
}
