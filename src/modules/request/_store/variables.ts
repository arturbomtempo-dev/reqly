import { stamp } from '@/core/sync/clock';
import { recordTombstones } from '@/core/sync/tombstones';
import { flattenVariables, toTombstones } from '@/core/sync/workspace';
import { idbStorage } from '@/shared/utils/idb-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface Variable {
    id: string;
    key: string;
    value: string;
    enabled: boolean;
    updatedAt: number;
}

function uid(): string {
    return Math.random().toString(36).slice(2);
}

export function newVariable(): Variable {
    return { id: uid(), key: '', value: '', enabled: true, updatedAt: stamp() };
}

interface VariablesState {
    variables: Variable[];
}

interface VariablesActions {
    setVariables: (variables: Variable[]) => void;
    addVariable: (key?: string, value?: string) => string;
    updateVariable: (id: string, partial: Partial<Variable>) => void;
    removeVariable: (id: string) => void;
    applySynced: (variables: Variable[]) => void;
    clearVariables: () => void;
    getVariableValue: (key: string) => string | undefined;
    interpolate: (text: string) => string;
}

export const useVariablesStore = create<VariablesState & VariablesActions>()(
    persist(
        (set, get) => ({
            variables: [],

            setVariables: (variables) => {
                const previous = get().variables;
                const nextIds = new Set(variables.map((v) => v.id));
                const removed = previous.filter((v) => !nextIds.has(v.id));

                if (removed.length > 0) {
                    recordTombstones({ variables: toTombstones(flattenVariables(removed)) });
                }

                set({ variables: variables.map((v) => ({ ...v, updatedAt: stamp() })) });
            },

            addVariable: (key = '', value = '') => {
                const id = uid();
                set((s) => ({
                    variables: [
                        ...s.variables,
                        { id, key, value, enabled: true, updatedAt: stamp() },
                    ],
                }));
                return id;
            },

            updateVariable: (id, partial) => {
                set((s) => ({
                    variables: s.variables.map((v) =>
                        v.id === id ? { ...v, ...partial, updatedAt: stamp() } : v
                    ),
                }));
            },

            removeVariable: (id) => {
                const doomed = get().variables.filter((v) => v.id === id);
                if (doomed.length > 0) {
                    recordTombstones({ variables: toTombstones(flattenVariables(doomed)) });
                }
                set((s) => ({ variables: s.variables.filter((v) => v.id !== id) }));
            },

            applySynced: (variables) => set({ variables }),

            clearVariables: () => set({ variables: [] }),

            getVariableValue: (key) => {
                const v = get().variables.find((v) => v.enabled && v.key === key);
                return v?.value;
            },

            interpolate: (text) => {
                if (!text) return text;
                const vars = get().variables.filter((v) => v.enabled && v.key);
                let result = text;
                for (const v of vars) {
                    const pattern = new RegExp(`\\{\\{\\s*${escapeRegex(v.key)}\\s*\\}\\}`, 'g');
                    result = result.replace(pattern, v.value);
                }
                return result;
            },
        }),
        {
            name: 'reqly:variables',
            storage: createJSONStorage(() => idbStorage),
            onRehydrateStorage: () => (state) => {
                if (state) {
                    const fallback = Date.now();
                    state.variables = state.variables.map((v) => ({
                        ...v,
                        updatedAt: v.updatedAt ?? fallback,
                    }));
                }
            },
        }
    )
);

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
