import { Button } from '@/shared/components/ui/Button';
import { Checkbox } from '@/shared/components/ui/Checkbox';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/shared/components/ui/Select';
import { Paperclip, Plus, Trash2, X } from 'lucide-react';
import { useRef } from 'react';
import { newFormDataField } from '../../_store';
import type { FormDataField } from '../../_types';
import { VariableInput } from '../VariableInput';

interface FormDataEditorProps {
    items: FormDataField[];
    onChange: (items: FormDataField[]) => void;
    files: Record<string, File>;
    onFilesChange: (files: Record<string, File>) => void;
}

export function FormDataEditor({ items, onChange, files, onFilesChange }: FormDataEditorProps) {
    const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

    const update = (id: string, patch: Partial<FormDataField>) =>
        onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));

    const remove = (id: string) => {
        onChange(items.filter((i) => i.id !== id));
        const next = { ...files };
        delete next[id];
        onFilesChange(next);
    };

    const add = () => onChange([...items, newFormDataField()]);

    const handleTypeChange = (id: string, type: 'text' | 'file') => {
        update(id, { type, value: '' });
        if (type === 'text') {
            const next = { ...files };
            delete next[id];
            onFilesChange(next);
        }
    };

    const handleFileSelect = (id: string, file: File) => {
        onFilesChange({ ...files, [id]: file });
        update(id, { value: file.name });
    };

    const clearFile = (id: string) => {
        const next = { ...files };
        delete next[id];
        onFilesChange(next);
        update(id, { value: '' });
    };

    return (
        <div className="space-y-1.5">
            {items.length === 0 && (
                <p className="py-4 text-center text-xs text-(--color-text-subtle)">
                    No fields yet.
                </p>
            )}

            {items.map((field) => (
                <div key={field.id} className="flex items-center gap-2">
                    <Checkbox
                        checked={field.enabled}
                        onCheckedChange={(v) => update(field.id, { enabled: !!v })}
                        className="shrink-0"
                    />

                    <VariableInput
                        placeholder="Key"
                        value={field.key}
                        onChange={(e) => update(field.id, { key: e.target.value })}
                        className="font-mono text-xs h-7 w-32 shrink-0"
                    />

                    <Select
                        value={field.type}
                        onValueChange={(v) => handleTypeChange(field.id, v as 'text' | 'file')}
                    >
                        <SelectTrigger className="h-7 w-18 text-xs shrink-0 font-mono">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="text" className="text-xs">
                                Text
                            </SelectItem>
                            <SelectItem value="file" className="text-xs">
                                File
                            </SelectItem>
                        </SelectContent>
                    </Select>

                    {field.type === 'text' ? (
                        <VariableInput
                            placeholder="Value"
                            value={field.value}
                            onChange={(e) => update(field.id, { value: e.target.value })}
                            className="font-mono text-xs h-7 flex-1"
                        />
                    ) : (
                        <div className="flex-1 flex items-center gap-1.5 min-w-0">
                            <input
                                ref={(el) => {
                                    fileInputRefs.current[field.id] = el;
                                }}
                                type="file"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleFileSelect(field.id, file);
                                    e.target.value = '';
                                }}
                            />

                            {files[field.id] ? (
                                <div className="flex-1 flex items-center gap-1.5 h-7 px-2 rounded-md border border-(--color-border) bg-(--color-surface) text-xs font-mono min-w-0">
                                    <Paperclip className="h-3 w-3 text-(--color-primary) shrink-0" />
                                    <span
                                        className="flex-1 truncate text-(--color-text) cursor-pointer"
                                        title={files[field.id].name}
                                        onClick={() => fileInputRefs.current[field.id]?.click()}
                                    >
                                        {files[field.id].name}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => clearFile(field.id)}
                                        className="shrink-0 text-(--color-text-subtle) hover:text-destructive transition-colors"
                                        aria-label="Remove file"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            ) : (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => fileInputRefs.current[field.id]?.click()}
                                    className="h-7 text-xs gap-1.5 flex-1 justify-start font-normal text-(--color-text-subtle) hover:text-(--color-text)"
                                >
                                    <Paperclip className="h-3.5 w-3.5" />
                                    Choose file
                                </Button>
                            )}
                        </div>
                    )}

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(field.id)}
                        className="h-7 w-7 shrink-0 text-(--color-text-subtle) hover:text-destructive"
                        aria-label="Remove field"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            ))}

            <Button
                variant="ghost"
                size="sm"
                onClick={add}
                className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-(--color-text)"
            >
                <Plus className="h-3.5 w-3.5" />
                Add Field
            </Button>
        </div>
    );
}
