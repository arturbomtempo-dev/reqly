import { HTTP_METHODS } from '@/core/constants';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/shared/components/ui/Select';
import { cn } from '@/shared/utils/cn';
import { Check, ChevronDown, Copy, Loader2, Send, Terminal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useRequest } from '../../_hooks/use-request';
import { newKV, useRequestStore } from '../../_store';
import type { BodyType, HttpMethod, KV } from '../../_types';
import { buildCurlCommand, parseCurlCommand } from '../../_utils/curl';
import { METHOD_BORDER_COLORS, MethodBadge } from '../MethodBadge';
import { VariableInput } from '../VariableInput';

function toKVItems(data: Record<string, string>): KV[] {
    const entries = Object.entries(data);
    if (entries.length === 0) return [newKV()];

    return entries.map(([key, value]) => ({
        id: Math.random().toString(36).slice(2),
        key,
        value,
        enabled: true,
    }));
}

function inferBodyType(contentType: string, body: string): BodyType {
    const ct = contentType.toLowerCase();

    if (ct.includes('application/json')) return 'json';
    if (ct.includes('application/xml') || ct.includes('text/xml')) return 'xml';
    if (ct.includes('application/x-www-form-urlencoded')) return 'form';
    if (!body.trim()) return 'none';

    try {
        JSON.parse(body);
        return 'json';
    } catch {
        return 'text';
    }
}

export function UrlBar() {
    const { method, url, loading, setMethod, setUrl, patch } = useRequestStore();
    const { send } = useRequest();

    const applyCurlIfNeeded = (value: string): boolean => {
        const parsed = parseCurlCommand(value);
        if (!parsed) return false;

        const headers = toKVItems(parsed.headers);

        if (parsed.multipartFields && parsed.multipartFields.length > 0) {
            patch({
                method: parsed.method,
                url: parsed.url,
                headers,
                bodyType: 'multipart',
                body: '',
                formBody: [newKV()],
                multipartBody: parsed.multipartFields,
                multipartFiles: {},
            });
            return true;
        }

        const contentType =
            Object.entries(parsed.headers).find(([k]) => k.toLowerCase() === 'content-type')?.[1] ??
            '';
        const nextBody = parsed.data ?? '';
        const nextBodyType = inferBodyType(contentType, nextBody);

        let formBody: KV[] = [newKV()];
        if (nextBodyType === 'form' && nextBody) {
            const params = new URLSearchParams(nextBody);
            const formItems: KV[] = [];
            params.forEach((formValue, formKey) => {
                formItems.push({
                    id: Math.random().toString(36).slice(2),
                    key: formKey,
                    value: formValue,
                    enabled: true,
                });
            });
            if (formItems.length > 0) formBody = formItems;
        }

        patch({
            method: parsed.method,
            url: parsed.url,
            headers,
            bodyType: nextBodyType,
            body: nextBodyType === 'form' ? '' : nextBody,
            formBody,
        });

        return true;
    };

    const handleSend = () => {
        applyCurlIfNeeded(url);
        send();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') handleSend();
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        const pasted = e.clipboardData.getData('text');
        if (!pasted) return;

        if (applyCurlIfNeeded(pasted)) {
            e.preventDefault();
        }
    };

    return (
        <div className="flex items-stretch gap-0">
            <div
                className={cn(
                    'flex flex-1 items-stretch gap-0 rounded-l-md border-l-[3px] border border-r-0 border-(--color-border) bg-(--color-surface) overflow-hidden',
                    'focus-within:shadow-[0_0_0_2px_color-mix(in_oklch,var(--color-primary)_30%,transparent)]',
                    'transition-shadow duration-(--transition-fast)',
                    METHOD_BORDER_COLORS[method]
                )}
            >
                <Select value={method} onValueChange={(v) => setMethod(v as HttpMethod)}>
                    <SelectTrigger className="w-28 border-0 rounded-none font-mono font-semibold text-xs bg-transparent shadow-none focus:ring-0 shrink-0">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {HTTP_METHODS.map((m) => (
                            <SelectItem key={m} value={m}>
                                <MethodBadge method={m} />
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <div className="w-px bg-(--color-border) shrink-0" />

                <VariableInput
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    placeholder="https://api.example.com/endpoint"
                    className="flex-1 border-0 rounded-none font-mono text-sm bg-transparent shadow-none focus-visible:ring-0 min-w-0"
                    aria-label="Request URL"
                    spellCheck={false}
                />
            </div>
            <SendDropdown onSend={handleSend} loading={loading} />
        </div>
    );
}

function SendDropdown({ onSend, loading }: { onSend: () => void; loading: boolean }) {
    const [open, setOpen] = useState(false);
    const [copied, setCopied] = useState<'url' | 'curl' | null>(null);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const flash = (type: 'url' | 'curl') => {
        setCopied(type);
        setTimeout(() => setCopied(null), 1500);
    };

    const copyUrl = async () => {
        const { url } = useRequestStore.getState();
        if (!url.trim()) return;
        await navigator.clipboard.writeText(url.trim());
        flash('url');
    };

    const copyCurl = async () => {
        const state = useRequestStore.getState();
        if (!state.url.trim()) return;
        try {
            const curl = buildCurlCommand(state);
            await navigator.clipboard.writeText(curl);
            flash('curl');
        } catch {
            return;
        }
    };

    return (
        <div
            ref={ref}
            className="relative flex items-stretch rounded-r-md border border-l-0 border-(--color-border)"
        >
            <button
                type="button"
                onClick={onSend}
                disabled={loading}
                className="flex items-center gap-2 px-5 bg-primary text-primary-foreground hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50 text-sm font-medium transition-colors shrink-0 cursor-pointer"
            >
                {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <Send className="h-4 w-4" />
                )}
                Send
            </button>

            <div className="w-px bg-primary-foreground/20 shrink-0" />

            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex items-center justify-center w-8 rounded-r-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
                aria-label="More send options"
            >
                <ChevronDown className="h-3.5 w-3.5" />
            </button>

            {open && (
                <div className="absolute right-0 top-[calc(100%+4px)] z-50 min-w-48 rounded-md border border-(--color-border) bg-popover text-popover-foreground shadow-md py-1 animate-in fade-in-0 zoom-in-95">
                    <DropdownItem
                        icon={copied === 'url' ? Check : Copy}
                        label={copied === 'url' ? 'Copied!' : 'Copy URL'}
                        onClick={copyUrl}
                    />
                    <DropdownItem
                        icon={copied === 'curl' ? Check : Terminal}
                        label={copied === 'curl' ? 'Copied!' : 'Copy as cURL'}
                        onClick={copyCurl}
                    />
                </div>
            )}
        </div>
    );
}

function DropdownItem({
    icon: Icon,
    label,
    onClick,
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex w-full items-center gap-2.5 px-3 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
        >
            <Icon className="h-3.5 w-3.5 text-(--color-text-subtle)" />
            {label}
        </button>
    );
}
