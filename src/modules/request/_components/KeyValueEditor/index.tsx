import { Button } from '@/shared/components/ui/Button';
import { Checkbox } from '@/shared/components/ui/Checkbox';
import { Plus, Trash2 } from 'lucide-react';
import { newKV } from '../../_store';
import type { KV } from '../../_types';
import { VariableInput } from '../VariableInput';

interface KeyValueEditorProps {
    items: KV[];
    onChange: (items: KV[]) => void;
    keyPlaceholder?: string;
    valuePlaceholder?: string;
}

export function KeyValueEditor({
    items,
    onChange,
    keyPlaceholder = 'Key',
    valuePlaceholder = 'Value',
}: KeyValueEditorProps) {
    const update = (id: string, patch: Partial<KV>) =>
        onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));

    const remove = (id: string) => onChange(items.filter((i) => i.id !== id));

    const add = () => onChange([...items, newKV()]);

    return (
        <div className="space-y-1.5">
            {items.length === 0 && (
                <p className="py-4 text-center text-xs text-(--color-text-subtle)">No items yet.</p>
            )}
            {items.map((kv) => (
                <div key={kv.id} className="flex items-center gap-2">
                    <Checkbox
                        checked={kv.enabled}
                        onCheckedChange={(v) => update(kv.id, { enabled: !!v })}
                        className="shrink-0"
                    />
                    <VariableInput
                        placeholder={keyPlaceholder}
                        value={kv.key}
                        onChange={(e) => update(kv.id, { key: e.target.value })}
                        className="font-mono text-xs h-7"
                    />
                    <VariableInput
                        placeholder={valuePlaceholder}
                        value={kv.value}
                        onChange={(e) => update(kv.id, { value: e.target.value })}
                        className="font-mono text-xs h-7"
                    />
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(kv.id)}
                        className="h-7 w-7 shrink-0 text-(--color-text-subtle) hover:text-destructive"
                        aria-label="Remove row"
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
                Add
            </Button>
        </div>
    );
}
