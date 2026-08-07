import { autocompletion, type Completion, type CompletionContext } from '@codemirror/autocomplete';
import type { Extension } from '@codemirror/state';
import {
    Decoration,
    EditorView,
    MatchDecorator,
    ViewPlugin,
    type DecorationSet,
    type ViewUpdate,
} from '@codemirror/view';

export interface VariableOption {
    key: string;
    value: string;
}

const variableMatcher = new MatchDecorator({
    regexp: /\{\{[^{}]*\}\}/g,
    decoration: () => Decoration.mark({ class: 'cm-variable-token' }),
});

const variableHighlightPlugin = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet;
        constructor(view: EditorView) {
            this.decorations = variableMatcher.createDeco(view);
        }
        update(update: ViewUpdate) {
            this.decorations = variableMatcher.updateDeco(update, this.decorations);
        }
    },
    { decorations: (v) => v.decorations }
);

const variableTheme = EditorView.baseTheme({
    '.cm-variable-token': {
        color: 'var(--color-success)',
        fontWeight: '600',
    },
    '.cm-tooltip.cm-tooltip-autocomplete': {
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        backgroundColor: 'var(--color-popover)',
        overflow: 'hidden',
    },
    '.cm-tooltip-autocomplete ul': {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: '12px',
        maxHeight: '224px',
    },
    '.cm-tooltip-autocomplete ul li': {
        padding: '4px 10px',
        color: 'var(--color-popover-foreground)',
    },
    '.cm-tooltip-autocomplete ul li[aria-selected]': {
        backgroundColor: 'var(--color-accent)',
        color: 'var(--color-accent-foreground)',
    },
    '.cm-completionLabel': {
        color: 'var(--color-success)',
        fontWeight: '600',
    },
    '.cm-completionDetail': {
        fontStyle: 'normal',
        marginLeft: '10px',
        color: 'var(--color-text-subtle)',
    },
});

function completionFor(variable: VariableOption): Completion {
    return {
        label: variable.key,
        detail: variable.value || '(empty)',
        type: 'variable',
        apply: (view, _completion, from, to) => {
            const closingAlreadyPresent = view.state.sliceDoc(to, to + 2) === '}}';
            const end = closingAlreadyPresent ? to + 2 : to;
            const insert = `${variable.key}}}`;
            view.dispatch({
                changes: { from, to: end, insert },
                selection: { anchor: from + insert.length },
            });
        },
    };
}

function variableCompletionSource(variables: VariableOption[]) {
    return (context: CompletionContext) => {
        const match = context.matchBefore(/\{\{[^{}]*$/);
        if (!match) return null;

        const query = match.text.slice(2).toLowerCase();
        const options = variables
            .filter((v) => v.key && v.key.toLowerCase().includes(query))
            .map(completionFor);

        if (options.length === 0) return null;

        return { from: match.from + 2, options, filter: false };
    };
}

export function createVariableExtensions(variables: VariableOption[]): Extension[] {
    return [
        variableHighlightPlugin,
        variableTheme,
        autocompletion({ override: [variableCompletionSource(variables)], icons: false }),
    ];
}
