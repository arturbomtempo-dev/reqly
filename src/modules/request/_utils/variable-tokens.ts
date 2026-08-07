export interface VariableTokenMatch {
    start: number;
    end: number;
    text: string;
}

export function findVariableTokens(text: string): VariableTokenMatch[] {
    const matches: VariableTokenMatch[] = [];
    const re = /\{\{[^{}]*\}\}/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text))) {
        matches.push({ start: match.index, end: match.index + match[0].length, text: match[0] });
    }
    return matches;
}

export interface ActiveVariableToken {
    start: number;
    query: string;
}

export function findActiveVariableToken(text: string, caret: number): ActiveVariableToken | null {
    const uptoCaret = text.slice(0, caret);
    const start = uptoCaret.lastIndexOf('{{');
    if (start === -1) return null;

    const between = uptoCaret.slice(start + 2);
    if (between.includes('{') || between.includes('}') || between.includes('\n')) return null;

    return { start, query: between };
}
