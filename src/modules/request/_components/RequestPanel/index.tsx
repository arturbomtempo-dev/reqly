import { BODY_TYPES } from '@/core/constants';
import { CodeEditor } from '@/shared/components/ui/CodeEditor';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/shared/components/ui/Select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/Tabs';
import { usePersistedTab } from '@/shared/lib/use-persisted-tab';
import { useRequestStore } from '../../_store';
import { useVariablesStore } from '../../_store/variables';
import type { BodyType } from '../../_types';
import { AuthEditor } from '../AuthEditor';
import { FormDataEditor } from '../FormDataEditor';
import { KeyValueEditor } from '../KeyValueEditor';

const BODY_TYPE_LABELS: Record<(typeof BODY_TYPES)[number], string> = {
    none: 'None',
    json: 'JSON',
    text: 'Text',
    xml: 'XML',
    form: 'URL Encoded',
    multipart: 'Form Data',
};

export function RequestPanel() {
    const {
        params,
        headers,
        bodyType,
        body,
        formBody,
        multipartBody,
        multipartFiles,
        auth,
        setParams,
        setHeaders,
        setBodyType,
        setBody,
        setFormBody,
        setMultipartBody,
        setMultipartFiles,
    } = useRequestStore();

    const variables = useVariablesStore((s) => s.variables);
    const enabledParamsCount = params.filter((p) => p.enabled && p.key).length;
    const enabledHeadersCount = headers.filter((h) => h.enabled && h.key).length;
    const [activeTab, setActiveTab] = usePersistedTab('reqly:requestPanelTab', 'params');

    return (
        <div className="flex flex-col h-full min-h-0 border border-(--color-border) rounded-md bg-(--color-surface) overflow-hidden">
            <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="flex flex-col h-full min-h-0"
            >
                <div className="px-3 pt-2 border-b border-(--color-border) shrink-0">
                    <TabsList className="h-8 bg-transparent gap-0 p-0">
                        <TabsTrigger
                            value="params"
                            className="h-7 px-3 text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-(--color-primary) data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                        >
                            Params
                            {enabledParamsCount > 0 && (
                                <span className="ml-1.5 text-[10px] font-mono text-muted-foreground">
                                    {enabledParamsCount}
                                </span>
                            )}
                        </TabsTrigger>
                        <TabsTrigger
                            value="headers"
                            className="h-7 px-3 text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-(--color-primary) data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                        >
                            Headers
                            {enabledHeadersCount > 0 && (
                                <span className="ml-1.5 text-[10px] font-mono text-muted-foreground">
                                    {enabledHeadersCount}
                                </span>
                            )}
                        </TabsTrigger>
                        <TabsTrigger
                            value="body"
                            className="h-7 px-3 text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-(--color-primary) data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                        >
                            Body
                        </TabsTrigger>
                        <TabsTrigger
                            value="auth"
                            className="h-7 px-3 text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-(--color-primary) data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                        >
                            Auth
                            {auth.type !== 'none' && (
                                <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-(--color-primary)" />
                            )}
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="params" className="flex-1 min-h-0 overflow-auto p-3 m-0">
                    <KeyValueEditor
                        items={params}
                        onChange={setParams}
                        keyPlaceholder="Parameter"
                    />
                </TabsContent>

                <TabsContent value="headers" className="flex-1 min-h-0 overflow-auto p-3 m-0">
                    <KeyValueEditor items={headers} onChange={setHeaders} keyPlaceholder="Header" />
                </TabsContent>

                <TabsContent
                    value="body"
                    className="flex-1 min-h-0 overflow-hidden p-3 m-0 flex flex-col gap-3"
                >
                    <Select value={bodyType} onValueChange={(v) => setBodyType(v as BodyType)}>
                        <SelectTrigger className="h-7 w-44 text-xs shrink-0">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {BODY_TYPES.map((b) => (
                                <SelectItem key={b} value={b} className="text-xs">
                                    {BODY_TYPE_LABELS[b]}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <div className="flex-1 min-h-0 overflow-auto">
                        {bodyType === 'none' && (
                            <p className="text-xs text-(--color-text-subtle) py-2">
                                This request has no body.
                            </p>
                        )}

                        {(bodyType === 'json' || bodyType === 'xml' || bodyType === 'text') && (
                            <CodeEditor
                                value={body}
                                onChange={setBody}
                                language={bodyType}
                                minHeight="220px"
                                className="h-full"
                                variables={variables}
                            />
                        )}

                        {bodyType === 'form' && (
                            <KeyValueEditor items={formBody} onChange={setFormBody} />
                        )}

                        {bodyType === 'multipart' && (
                            <FormDataEditor
                                items={multipartBody}
                                onChange={setMultipartBody}
                                files={multipartFiles}
                                onFilesChange={setMultipartFiles}
                            />
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="auth" className="flex-1 min-h-0 overflow-auto p-3 m-0">
                    <AuthEditor />
                </TabsContent>
            </Tabs>
        </div>
    );
}
