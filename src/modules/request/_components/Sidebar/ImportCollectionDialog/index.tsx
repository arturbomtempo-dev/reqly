import { Button } from '@/shared/components/ui/Button';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '@/shared/components/ui/Dialog';
import { cn } from '@/shared/utils/cn';
import { FileJson, FileText, Upload } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useCollectionsStore } from '../../../_store/collections';
import { useVariablesStore } from '../../../_store/variables';
import { importCollection } from '../../../_utils/collection-io';

interface ImportCollectionDialogProps {
    open: boolean;
    onClose: () => void;
}

export function ImportCollectionDialog({ open, onClose }: ImportCollectionDialogProps) {
    const { collections } = useCollectionsStore();
    const [dragOver, setDragOver] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [importing, setImporting] = useState(false);

    const handleImport = useCallback(
        async (file: File) => {
            setError(null);
            setImporting(true);

            try {
                const content = await file.text();
                const { collection, variables } = importCollection(content, file.name);

                const existingNames = collections.map((c) => c.name.toLowerCase());
                let finalName = collection.name;
                let counter = 1;
                while (existingNames.includes(finalName.toLowerCase())) {
                    finalName = `${collection.name} (${counter})`;
                    counter++;
                }
                collection.name = finalName;

                // Goes through the store action so the sync engine sees the
                // change and uploads the collection when the user is signed in.
                useCollectionsStore.getState().importCollection(collection);

                if (variables.length > 0) {
                    const currentVars = useVariablesStore.getState().variables;
                    const existingKeys = new Set(currentVars.map((v) => v.key));
                    const newVars = variables.filter((v) => !existingKeys.has(v.key));
                    for (const v of newVars) {
                        useVariablesStore.getState().addVariable(v.key, v.value);
                    }
                }

                onClose();
            } catch (err) {
                if (err instanceof Error && err.name === 'QuotaExceededError') {
                    setError(
                        'Not enough disk space to save this collection. Free up some space on your device, then import again.'
                    );
                } else {
                    setError(err instanceof Error ? err.message : 'Failed to import collection');
                }
            } finally {
                setImporting(false);
            }
        },
        [collections, onClose]
    );

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setDragOver(false);

            const file = e.dataTransfer.files[0];
            if (file) handleImport(file);
        },
        [handleImport]
    );

    const handleFileSelect = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (file) handleImport(file);
            e.target.value = '';
        },
        [handleImport]
    );

    return (
        <Dialog open={open} onClose={onClose}>
            <DialogHeader onClose={onClose}>Import Collection</DialogHeader>
            <DialogBody>
                <div
                    className={cn(
                        'flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-(--color-border) p-8 transition-colors',
                        dragOver && 'border-(--color-primary) bg-(--color-primary)/5'
                    )}
                    onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                >
                    <div className="flex items-center gap-3 text-muted-foreground">
                        <FileJson className="h-8 w-8" />
                        <FileText className="h-8 w-8" />
                    </div>
                    <div className="text-center">
                        <p className="text-sm font-medium text-(--color-text)">
                            Drag and drop a collection file
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Supports Postman (.json) and Insomnia (.yaml, .json)
                        </p>
                    </div>
                    <label className="cursor-pointer">
                        <input
                            type="file"
                            accept=".json,.yaml,.yml"
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={importing}
                            onClick={(e) =>
                                e.currentTarget.parentElement?.querySelector('input')?.click()
                            }
                        >
                            <Upload className="mr-2 h-3.5 w-3.5" />
                            {importing ? 'Importing...' : 'Select File'}
                        </Button>
                    </label>
                </div>

                {error && (
                    <div className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                        {error}
                    </div>
                )}
            </DialogBody>
            <DialogFooter>
                <Button variant="ghost" size="sm" onClick={onClose}>
                    Cancel
                </Button>
            </DialogFooter>
        </Dialog>
    );
}
