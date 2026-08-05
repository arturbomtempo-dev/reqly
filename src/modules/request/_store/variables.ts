import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Variable {
    id: string;
    key: string;
    value: string;
    enabled: boolean;
}

function uid(): string {
    return Math.random().toString(36).slice(2);
}

export function newVariable(): Variable {
    return { id: uid(), key: '', value: '', enabled: true };
}

interface VariablesState {
    variables: Variable[];
}

interface VariablesActions {
    setVariables: (variables: Variable[]) => void;
    addVariable: (key?: string, value?: string) => string;
    updateVariable: (id: string, partial: Partial<Variable>) => void;
    removeVariable: (id: string) => void;
    clearVariables: () => void;
    getVariableValue: (key: string) => string | undefined;
    interpolate: (text: string) => string;
}

export const useVariablesStore = create<VariablesState & VariablesActions>()(
    persist(
        (set, get) => ({
            variables: [],

            setVariables: (variables) => set({ variables }),

            addVariable: (key = '', value = '') => {
                const id = uid();
                set((s) => ({
                    variables: [...s.variables, { id, key, value, enabled: true }],
                }));
                return id;
            },

            updateVariable: (id, partial) => {
                set((s) => ({
                    variables: s.variables.map((v) => (v.id === id ? { ...v, ...partial } : v)),
                }));
            },

            removeVariable: (id) => {
                set((s) => ({
                    variables: s.variables.filter((v) => v.id !== id),
                }));
            },

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
        }
    )
);

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
