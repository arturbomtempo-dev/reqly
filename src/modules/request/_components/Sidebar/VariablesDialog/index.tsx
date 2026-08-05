import { Button } from '@/shared/components/ui/Button';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '@/shared/components/ui/Dialog';
import { Input } from '@/shared/components/ui/Input';
import { cn } from '@/shared/utils/cn';
import { Plus, Trash2 } from 'lucide-react';
import { newVariable, useVariablesStore, type Variable } from '../../../_store/variables';

interface VariablesDialogProps {
    open: boolean;
    onClose: () => void;
}

function VariableRow({
    variable,
    onUpdate,
    onRemove,
}: {
    variable: Variable;
    onUpdate: (partial: Partial<Variable>) => void;
    onRemove: () => void;
}) {
    return (
        <div className="group flex items-center gap-2">
            <input
                type="checkbox"
                checked={variable.enabled}
                onChange={(e) => onUpdate({ enabled: e.target.checked })}
                className="h-3.5 w-3.5 rounded border-gray-300 text-(--color-primary) focus:ring-(--color-primary)"
            />
            <Input
                value={variable.key}
                onChange={(e) => onUpdate({ key: e.target.value })}
                placeholder="Variable name"
                className={cn('h-8 flex-1 text-xs font-mono', !variable.enabled && 'opacity-50')}
            />
            <Input
                value={variable.value}
                onChange={(e) => onUpdate({ value: e.target.value })}
                placeholder="Value"
                className={cn('h-8 flex-1 text-xs', !variable.enabled && 'opacity-50')}
            />
            <Button
                variant="ghost"
                size="icon"
                onClick={onRemove}
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
            >
                <Trash2 className="h-3.5 w-3.5" />
            </Button>
        </div>
    );
}

export function VariablesDialog({ open, onClose }: VariablesDialogProps) {
    const { variables, addVariable, updateVariable, removeVariable, setVariables } =
        useVariablesStore();

    const handleAddVariable = () => {
        addVariable();
    };

    const ensureEmptyRow = () => {
        const hasEmpty = variables.some((v) => !v.key && !v.value);
        if (!hasEmpty && variables.length > 0) {
            addVariable();
        }
    };

    return (
        <Dialog open={open} onClose={onClose} className="max-w-xl">
            <DialogHeader onClose={onClose}>Global Variables</DialogHeader>
            <DialogBody className="space-y-3">
                <p className="text-xs text-muted-foreground">
                    Define variables that can be used in URLs and request bodies using{' '}
                    <code className="rounded bg-(--color-surface-raised) px-1.5 py-0.5 font-mono text-[10px]">
                        {'{{variableName}}'}
                    </code>{' '}
                    syntax.
                </p>

                <div className="space-y-2">
                    <div className="grid grid-cols-[24px_1fr_1fr_32px] gap-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide px-0.5">
                        <span />
                        <span>Name</span>
                        <span>Value</span>
                        <span />
                    </div>

                    {variables.length === 0 ? (
                        <div className="py-8 text-center text-xs text-muted-foreground">
                            No variables defined yet
                        </div>
                    ) : (
                        <div className="space-y-1.5">
                            {variables.map((v) => (
                                <VariableRow
                                    key={v.id}
                                    variable={v}
                                    onUpdate={(partial) => {
                                        updateVariable(v.id, partial);
                                        ensureEmptyRow();
                                    }}
                                    onRemove={() => removeVariable(v.id)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </DialogBody>
            <DialogFooter className="justify-between">
                <Button variant="outline" size="sm" onClick={handleAddVariable}>
                    <Plus className="mr-2 h-3.5 w-3.5" />
                    Add Variable
                </Button>
                <Button size="sm" onClick={onClose}>
                    Done
                </Button>
            </DialogFooter>
        </Dialog>
    );
}
