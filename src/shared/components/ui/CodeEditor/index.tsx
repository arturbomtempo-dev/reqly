import { useTheme } from '@/shared/lib/use-theme';
import { cn } from '@/shared/utils/cn';
import { json } from '@codemirror/lang-json';
import { xml } from '@codemirror/lang-xml';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';
import CodeMirror from '@uiw/react-codemirror';
import { useMemo } from 'react';

type CodeLanguage = 'json' | 'xml' | 'text';

interface CodeEditorProps {
    value: string;
    onChange?: (value: string) => void;
    language: CodeLanguage;
    readOnly?: boolean;
    className?: string;
    minHeight?: string;
}

export function CodeEditor({
    value,
    onChange,
    language,
    readOnly = false,
    className,
    minHeight = '220px',
}: CodeEditorProps) {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const languageExtensions = useMemo(() => {
        if (language === 'json') return [json()];
        if (language === 'xml') return [xml()];
        return [];
    }, [language]);

    const syntaxExtension = useMemo(
        () =>
            syntaxHighlighting(
                HighlightStyle.define([
                    {
                        tag: [t.string, t.number, t.bool, t.atom, t.null],
                        color: 'var(--cm-value)',
                    },
                    {
                        tag: [t.propertyName, t.attributeName],
                        color: 'var(--cm-key)',
                    },
                    {
                        tag: [t.keyword, t.operator, t.punctuation],
                        color: 'var(--cm-muted)',
                    },
                ])
            ),
        []
    );

    const themeExtension = useMemo(
        () =>
            EditorView.theme(
                {
                    '&.cm-editor': {
                        height: '100%',
                        minHeight,
                        fontSize: '12px',
                        backgroundColor: 'transparent',
                        color: 'var(--color-text)',
                        '--cm-value': 'var(--color-success)',
                        '--cm-key': 'var(--color-info)',
                        '--cm-muted': 'var(--color-text-subtle)',
                    },
                    '.cm-scroller': {
                        backgroundColor: 'transparent',
                        fontFamily:
                            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                        overflowX: 'auto',
                        overflowY: 'auto',
                    },
                    '.cm-content': {
                        padding: '12px',
                        color: 'var(--color-text)',
                    },
                    '.cm-gutters': {
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: 'var(--color-text-subtle)',
                    },
                    '.cm-lineNumbers .cm-gutterElement': {
                        paddingLeft: '8px',
                        paddingRight: '8px',
                    },
                    '.cm-activeLineGutter, .cm-activeLine': {
                        backgroundColor:
                            'color-mix(in oklch, var(--color-primary) 6%, transparent)',
                    },
                    '.cm-selectionBackground, ::selection': {
                        backgroundColor:
                            'color-mix(in oklch, var(--color-primary) 24%, transparent)',
                    },
                    '.cm-cursor': {
                        borderLeftColor: 'var(--color-text)',
                    },
                    '.cm-focused': {
                        outline: 'none',
                    },
                    '.cm-foldPlaceholder': {
                        backgroundColor:
                            'color-mix(in oklch, var(--color-primary) 14%, transparent)',
                        border: '1px solid color-mix(in oklch, var(--color-primary) 26%, transparent)',
                        color: 'var(--color-text-muted)',
                    },
                },
                { dark: isDark }
            ),
        [isDark, minHeight]
    );

    return (
        <div className={cn('h-full overflow-hidden bg-transparent', className)}>
            <CodeMirror
                className="h-full"
                value={value}
                onChange={(next) => onChange?.(next)}
                readOnly={readOnly}
                basicSetup={{
                    lineNumbers: true,
                    foldGutter: true,
                    bracketMatching: true,
                    highlightSelectionMatches: false,
                    drawSelection: true,
                    dropCursor: false,
                    autocompletion: false,
                    closeBrackets: !readOnly,
                    searchKeymap: false,
                }}
                extensions={[...languageExtensions, syntaxExtension, themeExtension]}
            />
        </div>
    );
}
