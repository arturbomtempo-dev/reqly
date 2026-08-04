import { Button } from '@/shared/components/ui/Button';
import { CodeEditor } from '@/shared/components/ui/CodeEditor';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/Tabs';
import { cn } from '@/shared/utils/cn';
import { formatBytes, formatJson, formatXml } from '@/shared/utils/format';
import { Check, Copy, Inbox, Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRequestStore } from '../../_store';
import type { ApiResponse } from '../../_types';

function statusColorClass(status: number): string {
    if (status >= 200 && status < 300) return 'text-(--color-success)';
    if (status >= 300 && status < 400) return 'text-(--color-info)';
    if (status >= 400 && status < 500) return 'text-(--color-warning)';
    return 'text-(--color-danger)';
}

function formatBody(body: string, contentType: string): string {
    const ct = contentType.toLowerCase();
    if (ct.includes('json')) return formatJson(body);
    if (ct.includes('xml') || ct.includes('html')) return formatXml(body);
    return body;
}

function languageFromContentType(contentType: string): 'json' | 'xml' | 'text' {
    const ct = contentType.toLowerCase();
    if (ct.includes('json')) return 'json';
    if (ct.includes('xml') || ct.includes('html')) return 'xml';
    return 'text';
}

function ResponseMeta({ response }: { response: ApiResponse }) {
    const [copied, setCopied] = useState(false);
    const isImage = Boolean(response.previewUrl);

    const formatted = useMemo(
        () => formatBody(response.body, response.contentType),
        [response.body, response.contentType]
    );

    const handleCopy = async () => {
        await navigator.clipboard.writeText(formatted);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-(--color-border) shrink-0">
            <div className="flex items-center gap-3 text-xs">
                <span className={cn('font-mono font-semibold', statusColorClass(response.status))}>
                    {response.status} {response.statusText}
                </span>
                <span className="text-muted-foreground">
                    <span className="text-(--color-text) font-medium">{response.time}</span>
                    {' ms'}
                </span>
                <span className="text-muted-foreground">
                    <span className="text-(--color-text) font-medium">
                        {formatBytes(response.size)}
                    </span>
                </span>
            </div>
            {!isImage && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                    className="h-6 gap-1.5 px-2 text-xs text-muted-foreground hover:text-(--color-text)"
                >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? 'Copied' : 'Copy'}
                </Button>
            )}
        </div>
    );
}

function ResponseBody({ response }: { response: ApiResponse }) {
    const isImage = Boolean(response.previewUrl);
    const formatted = useMemo(
        () => formatBody(response.body, response.contentType),
        [response.body, response.contentType]
    );
    const language = useMemo(
        () => languageFromContentType(response.contentType),
        [response.contentType]
    );

    const headerCount = Object.keys(response.headers).length;

    return (
        <Tabs defaultValue="body" className="flex-1 flex flex-col min-h-0">
            <div className="px-3 pt-2 border-b border-(--color-border) shrink-0">
                <TabsList className="h-8 bg-transparent gap-0 p-0">
                    <TabsTrigger
                        value="body"
                        className="h-7 px-3 text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-(--color-primary) data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                    >
                        Body
                    </TabsTrigger>
                    <TabsTrigger
                        value="headers"
                        className="h-7 px-3 text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-(--color-primary) data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                    >
                        Headers
                        {headerCount > 0 && (
                            <span className="ml-1.5 text-[10px] font-mono text-muted-foreground">
                                {headerCount}
                            </span>
                        )}
                    </TabsTrigger>
                </TabsList>
            </div>

            <TabsContent value="body" className="flex-1 min-h-0 overflow-auto m-0">
                {isImage ? (
                    <div className="flex items-center justify-center p-4">
                        <img
                            key={response.previewUrl}
                            src={response.previewUrl ?? undefined}
                            alt="Response preview"
                            className="max-w-full object-contain"
                        />
                    </div>
                ) : (
                    <CodeEditor
                        key={`${response.contentType}:${response.size}:${response.time}:${formatted.slice(0, 64)}`}
                        value={formatted}
                        language={language}
                        readOnly
                        minHeight="200px"
                        className="h-full border-0 rounded-none"
                    />
                )}
            </TabsContent>

            <TabsContent value="headers" className="flex-1 min-h-0 overflow-auto m-0">
                <div className="p-3 space-y-0">
                    {Object.entries(response.headers).map(([k, v]) => (
                        <div
                            key={k}
                            className="flex gap-3 font-mono text-xs border-b border-(--color-border-subtle) py-1.5 last:border-0"
                        >
                            <span className="text-(--color-primary) min-w-45 break-all">{k}</span>
                            <span className="text-muted-foreground break-all">{v}</span>
                        </div>
                    ))}
                </div>
            </TabsContent>
        </Tabs>
    );
}

export function ResponsePanel() {
    const { response, loading, error, requestId } = useRequestStore();

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center border border-(--color-border) rounded-md bg-(--color-surface)">
                <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-(--color-primary)" />
                    Sending request...
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex h-full items-center justify-center border border-destructive border-opacity-30 rounded-md bg-(--color-surface) px-6 text-center">
                <span className="max-w-md text-xs font-semibold text-destructive">{error}</span>
            </div>
        );
    }

    if (!response) {
        return (
            <div className="flex flex-col h-full items-center justify-center gap-3 border border-(--color-border) rounded-md bg-(--color-surface)">
                <Inbox className="h-8 w-8 text-(--color-text-subtle)" strokeWidth={1.25} />
                <p className="text-xs text-(--color-text-subtle)">
                    Send a request to see the response
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full min-h-0 border border-(--color-border) rounded-md bg-(--color-surface) overflow-hidden">
            <ResponseMeta response={response} />
            <ResponseBody key={requestId} response={response} />
        </div>
    );
}
