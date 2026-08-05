import { Button } from '@/shared/components/ui/Button';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '@/shared/components/ui/Dialog';
import { cn } from '@/shared/utils/cn';
import { Download, FileJson, FileText } from 'lucide-react';
import { useState } from 'react';
import { useVariablesStore } from '../../../_store/variables';
import type { Collection } from '../../../_types';
import { exportToInsomnia, exportToPostman } from '../../../_utils/collection-io';

interface ExportCollectionDialogProps {
    open: boolean;
    onClose: () => void;
    collection: Collection;
}

type ExportFormat = 'postman' | 'insomnia';

export function ExportCollectionDialog({ open, onClose, collection }: ExportCollectionDialogProps) {
    const [format, setFormat] = useState<ExportFormat>('postman');
    const [includeVariables, setIncludeVariables] = useState(true);

    const handleExport = () => {
        const variables = includeVariables
            ? useVariablesStore
                  .getState()
                  .variables.filter((v) => v.enabled && v.key)
                  .map((v) => ({ key: v.key, value: v.value }))
            : [];

        let content: string;
        let filename: string;
        let mimeType: string;

        if (format === 'postman') {
            content = exportToPostman(collection, variables);
            filename = `${collection.name}.postman_collection.json`;
            mimeType = 'application/json';
        } else {
            content = exportToInsomnia(collection, variables);
            filename = `${collection.name}.insomnia.yaml`;
            mimeType = 'application/x-yaml';
        }

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        onClose();
    };

    return (
        <Dialog open={open} onClose={onClose} className="max-w-sm">
            <DialogHeader onClose={onClose}>Export Collection</DialogHeader>
            <DialogBody className="space-y-4">
                <div>
                    <p className="mb-2 text-xs font-medium text-(--color-text)">Format</p>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => setFormat('postman')}
                            className={cn(
                                'flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors cursor-pointer',
                                format === 'postman'
                                    ? 'border-(--color-primary) bg-(--color-primary)/5'
                                    : 'border-(--color-border) hover:border-(--color-border-hover)'
                            )}
                        >
                            <FileJson className="h-6 w-6 text-(--color-primary)" />
                            <div className="text-center">
                                <p className="text-xs font-medium text-(--color-text)">Postman</p>
                                <p className="text-[10px] text-muted-foreground">.json</p>
                            </div>
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormat('insomnia')}
                            className={cn(
                                'flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors cursor-pointer',
                                format === 'insomnia'
                                    ? 'border-(--color-primary) bg-(--color-primary)/5'
                                    : 'border-(--color-border) hover:border-(--color-border-hover)'
                            )}
                        >
                            <FileText className="h-6 w-6 text-purple-500" />
                            <div className="text-center">
                                <p className="text-xs font-medium text-(--color-text)">Insomnia</p>
                                <p className="text-[10px] text-muted-foreground">.yaml</p>
                            </div>
                        </button>
                    </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={includeVariables}
                        onChange={(e) => setIncludeVariables(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-(--color-primary) focus:ring-(--color-primary)"
                    />
                    <span className="text-xs text-(--color-text)">Include global variables</span>
                </label>
            </DialogBody>
            <DialogFooter>
                <Button variant="ghost" size="sm" onClick={onClose}>
                    Cancel
                </Button>
                <Button size="sm" onClick={handleExport}>
                    <Download className="mr-2 h-3.5 w-3.5" />
                    Export
                </Button>
            </DialogFooter>
        </Dialog>
    );
}
