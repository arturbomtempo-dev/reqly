import * as yaml from 'js-yaml';
import type {
    Auth,
    BodyType,
    Collection,
    HttpMethod,
    KV,
    SavedRequest,
    TabSnapshot,
} from '../_types';

function uid(): string {
    return Math.random().toString(36).slice(2);
}

function newKV(): KV {
    return { id: uid(), key: '', value: '', enabled: true };
}

function defaultSnapshot(): TabSnapshot {
    return {
        method: 'GET',
        url: '',
        params: [newKV()],
        headers: [newKV()],
        bodyType: 'none',
        body: '',
        formBody: [newKV()],
        multipartBody: [],
        auth: { type: 'none' },
        response: null,
    };
}

interface PostmanHeader {
    key: string;
    value: string;
    disabled?: boolean;
}

interface PostmanQuery {
    key: string;
    value: string;
    disabled?: boolean;
}

interface PostmanBody {
    mode?: string;
    raw?: string;
    options?: { raw?: { language?: string } };
    urlencoded?: Array<{ key: string; value: string; disabled?: boolean }>;
    formdata?: Array<{ key: string; value: string; type?: string; disabled?: boolean }>;
}

interface PostmanAuth {
    type?: string;
    bearer?: Array<{ key: string; value: string }>;
    basic?: Array<{ key: string; value: string }>;
    apikey?: Array<{ key: string; value: string }>;
}

interface PostmanUrl {
    raw?: string;
    query?: PostmanQuery[];
}

interface PostmanRequest {
    method?: string;
    header?: PostmanHeader[];
    body?: PostmanBody;
    auth?: PostmanAuth;
    url?: PostmanUrl | string;
}

interface PostmanItem {
    name: string;
    item?: PostmanItem[];
    request?: PostmanRequest;
    response?: unknown[];
}

interface PostmanCollection {
    info?: { name?: string };
    item?: PostmanItem[];
    variable?: Array<{ key: string; value: string; disabled?: boolean }>;
}

interface InsomniaHeader {
    name: string;
    value: string;
    disabled?: boolean;
}

interface InsomniaBody {
    mimeType?: string;
    text?: string;
}

interface InsomniaAuth {
    type?: string;
    token?: string;
    prefix?: string;
    username?: string;
    password?: string;
}

interface InsomniaRequest {
    url?: string;
    name?: string;
    method?: string;
    headers?: InsomniaHeader[];
    body?: InsomniaBody;
    authentication?: InsomniaAuth;
}

interface InsomniaItem {
    name?: string;
    url?: string;
    method?: string;
    headers?: InsomniaHeader[];
    body?: InsomniaBody;
    authentication?: InsomniaAuth;
    meta?: { id?: string };
    children?: InsomniaItem[];
}

interface InsomniaEnvironment {
    name?: string;
    data?: Record<string, unknown>;
    subEnvironments?: InsomniaEnvironment[];
}

interface InsomniaCollection {
    type?: string;
    name?: string;
    meta?: { id?: string };
    collection?: InsomniaItem[];
    // Real exports write a single base environment object with nested
    // subEnvironments, not an array — but accept an array too for safety.
    environments?: InsomniaEnvironment | InsomniaEnvironment[];
}

interface InsomniaV4Resource {
    _id: string;
    _type: string;
    parentId?: string;
    name?: string;
    url?: string;
    method?: string;
    headers?: InsomniaHeader[];
    body?: InsomniaBody;
    authentication?: InsomniaAuth;
    data?: Record<string, unknown>;
}

interface InsomniaV4Export {
    _type: 'export';
    __export_format?: number;
    resources: InsomniaV4Resource[];
}

function parsePostmanAuth(auth?: PostmanAuth): Auth {
    if (!auth) return { type: 'none' };

    if (auth.type === 'bearer' && auth.bearer) {
        const tokenEntry = auth.bearer.find((b) => b.key === 'token');
        return { type: 'bearer', token: tokenEntry?.value ?? '', prefix: 'Bearer' };
    }

    if (auth.type === 'basic' && auth.basic) {
        const username = auth.basic.find((b) => b.key === 'username')?.value ?? '';
        const password = auth.basic.find((b) => b.key === 'password')?.value ?? '';
        return { type: 'basic', username, password };
    }

    if (auth.type === 'apikey' && auth.apikey) {
        const keyEntry = auth.apikey.find((b) => b.key === 'key');
        const valueEntry = auth.apikey.find((b) => b.key === 'value');
        const inEntry = auth.apikey.find((b) => b.key === 'in');
        return {
            type: 'api-key',
            key: keyEntry?.value ?? '',
            value: valueEntry?.value ?? '',
            addTo: inEntry?.value === 'query' ? 'query' : 'header',
        };
    }

    return { type: 'none' };
}

function parseInsomniaAuth(auth?: InsomniaAuth): Auth {
    if (!auth || !auth.type || auth.type === 'none') return { type: 'none' };

    if (auth.type === 'bearer') {
        return { type: 'bearer', token: auth.token ?? '', prefix: auth.prefix ?? 'Bearer' };
    }

    if (auth.type === 'basic') {
        return { type: 'basic', username: auth.username ?? '', password: auth.password ?? '' };
    }

    return { type: 'none' };
}

function inferBodyType(mimeType: string, body: string): BodyType {
    const ct = mimeType.toLowerCase();
    if (ct.includes('application/json')) return 'json';
    if (ct.includes('application/xml') || ct.includes('text/xml')) return 'xml';
    if (ct.includes('application/x-www-form-urlencoded')) return 'form';
    if (ct.includes('multipart/form-data')) return 'multipart';
    if (!body?.trim()) return 'none';
    try {
        JSON.parse(body);
        return 'json';
    } catch {
        return 'text';
    }
}

function parsePostmanBody(body?: PostmanBody): {
    bodyType: BodyType;
    body: string;
    formBody: KV[];
} {
    if (!body) return { bodyType: 'none', body: '', formBody: [newKV()] };

    if (body.mode === 'raw') {
        const raw = body.raw ?? '';
        const lang = body.options?.raw?.language ?? '';
        let bodyType: BodyType = 'text';
        if (lang === 'json') bodyType = 'json';
        else if (lang === 'xml') bodyType = 'xml';
        else {
            try {
                JSON.parse(raw);
                bodyType = 'json';
            } catch {
                bodyType = 'text';
            }
        }
        return { bodyType, body: raw, formBody: [newKV()] };
    }

    if (body.mode === 'urlencoded' && body.urlencoded) {
        const formBody: KV[] = body.urlencoded.map((f) => ({
            id: uid(),
            key: f.key,
            value: f.value,
            enabled: !f.disabled,
        }));
        if (formBody.length === 0) formBody.push(newKV());
        return { bodyType: 'form', body: '', formBody };
    }

    return { bodyType: 'none', body: '', formBody: [newKV()] };
}

function parseInsomniaBody(body?: InsomniaBody): {
    bodyType: BodyType;
    body: string;
    formBody: KV[];
} {
    if (!body) return { bodyType: 'none', body: '', formBody: [newKV()] };
    const bodyType = inferBodyType(body.mimeType ?? '', body.text ?? '');
    return { bodyType, body: body.text ?? '', formBody: [newKV()] };
}

function parsePostmanRequest(item: PostmanItem): SavedRequest | null {
    const req = item.request;
    if (!req) return null;

    const rawUrl = typeof req.url === 'string' ? req.url : (req.url?.raw ?? '');
    const method = (req.method?.toUpperCase() ?? 'GET') as HttpMethod;

    const headers: KV[] = (req.header ?? []).map((h) => ({
        id: uid(),
        key: h.key,
        value: h.value,
        enabled: !h.disabled,
    }));
    if (headers.length === 0) headers.push(newKV());

    const params: KV[] = [];
    if (typeof req.url !== 'string' && req.url?.query) {
        for (const q of req.url.query) {
            params.push({ id: uid(), key: q.key, value: q.value, enabled: !q.disabled });
        }
    }
    if (params.length === 0) params.push(newKV());

    const { bodyType, body, formBody } = parsePostmanBody(req.body);
    const auth = parsePostmanAuth(req.auth);

    const snapshot: TabSnapshot = {
        method,
        url: rawUrl,
        params,
        headers,
        bodyType,
        body,
        formBody,
        multipartBody: [],
        auth,
        response: null,
    };

    return { id: uid(), name: item.name, snapshot };
}

function parsePostmanFolder(item: PostmanItem): Collection {
    const requests: SavedRequest[] = [];
    const folders: Collection[] = [];

    for (const child of item.item ?? []) {
        if (child.item && child.item.length > 0) {
            folders.push(parsePostmanFolder(child));
        } else if (child.request) {
            const req = parsePostmanRequest(child);
            if (req) requests.push(req);
        }
    }

    return { id: uid(), name: item.name, requests, folders };
}

function parseInsomniaRequest(item: InsomniaItem): SavedRequest | null {
    if (!item.url) return null;

    const method = (item.method?.toUpperCase() ?? 'GET') as HttpMethod;
    const headers: KV[] = (item.headers ?? []).map((h) => ({
        id: uid(),
        key: h.name,
        value: h.value,
        enabled: !h.disabled,
    }));
    if (headers.length === 0) headers.push(newKV());

    const { bodyType, body, formBody } = parseInsomniaBody(item.body);
    const auth = parseInsomniaAuth(item.authentication);

    const snapshot: TabSnapshot = {
        method,
        url: item.url,
        params: [newKV()],
        headers,
        bodyType,
        body,
        formBody,
        multipartBody: [],
        auth,
        response: null,
    };

    return { id: uid(), name: item.name ?? 'Request', snapshot };
}

function parseInsomniaFolder(item: InsomniaItem): Collection {
    const requests: SavedRequest[] = [];
    const folders: Collection[] = [];

    for (const child of item.children ?? []) {
        if (child.children && child.children.length > 0) {
            folders.push(parseInsomniaFolder(child));
        } else if (child.url) {
            const req = parseInsomniaRequest(child);
            if (req) requests.push(req);
        }
    }

    return { id: uid(), name: item.name ?? 'Folder', requests, folders };
}

export function parsePostmanCollection(data: PostmanCollection): {
    collection: Collection;
    variables: Array<{ key: string; value: string }>;
} {
    const name = data.info?.name ?? 'Imported Collection';
    const requests: SavedRequest[] = [];
    const folders: Collection[] = [];

    for (const item of data.item ?? []) {
        if (item.item && item.item.length > 0) {
            folders.push(parsePostmanFolder(item));
        } else if (item.request) {
            const req = parsePostmanRequest(item);
            if (req) requests.push(req);
        }
    }

    const variables = (data.variable ?? [])
        .filter((v) => !v.disabled && v.key)
        .map((v) => ({ key: v.key, value: v.value ?? '' }));

    return { collection: { id: uid(), name, requests, folders }, variables };
}

function flattenInsomniaEnvironments(
    env?: InsomniaEnvironment | InsomniaEnvironment[]
): InsomniaEnvironment[] {
    if (!env) return [];
    const roots = Array.isArray(env) ? env : [env];
    const all: InsomniaEnvironment[] = [];
    for (const root of roots) {
        all.push(root);
        all.push(...(root.subEnvironments ?? []));
    }
    return all;
}

export function parseInsomniaCollection(data: InsomniaCollection): {
    collection: Collection;
    variables: Array<{ key: string; value: string }>;
} {
    const name = data.name ?? 'Imported Collection';
    const requests: SavedRequest[] = [];
    const folders: Collection[] = [];

    for (const item of data.collection ?? []) {
        if (item.children && item.children.length > 0) {
            folders.push(parseInsomniaFolder(item));
        } else if (item.url) {
            const req = parseInsomniaRequest(item);
            if (req) requests.push(req);
        }
    }

    const variables: Array<{ key: string; value: string }> = [];
    for (const env of flattenInsomniaEnvironments(data.environments)) {
        if (env.data) {
            for (const [key, value] of Object.entries(env.data)) {
                if (!variables.some((v) => v.key === key)) {
                    variables.push({ key, value: String(value) });
                }
            }
        }
    }

    return { collection: { id: uid(), name, requests, folders }, variables };
}

function parseInsomniaV4Export(data: InsomniaV4Export): {
    collection: Collection;
    variables: Array<{ key: string; value: string }>;
} {
    const resources = data.resources ?? [];
    const workspace = resources.find((r) => r._type === 'workspace');
    const name = workspace?.name ?? 'Imported Collection';

    const childrenByParent = new Map<string, InsomniaV4Resource[]>();
    for (const r of resources) {
        if (r._type !== 'request' && r._type !== 'request_group') continue;
        const key = r.parentId ?? '';
        if (!childrenByParent.has(key)) childrenByParent.set(key, []);
        childrenByParent.get(key)!.push(r);
    }

    const buildFolder = (parentId: string, folderName: string): Collection => {
        const requests: SavedRequest[] = [];
        const folders: Collection[] = [];

        for (const child of childrenByParent.get(parentId) ?? []) {
            if (child._type === 'request_group') {
                folders.push(buildFolder(child._id, child.name ?? 'Folder'));
            } else if (child.url) {
                const req = parseInsomniaRequest(child);
                if (req) requests.push(req);
            }
        }

        return { id: uid(), name: folderName, requests, folders };
    };

    const collection = buildFolder(workspace?._id ?? '', name);

    const variables: Array<{ key: string; value: string }> = [];
    for (const r of resources) {
        if (r._type !== 'environment' || !r.data) continue;
        for (const [key, value] of Object.entries(r.data)) {
            if (!variables.some((v) => v.key === key)) {
                variables.push({ key, value: String(value) });
            }
        }
    }

    return { collection, variables };
}

export function importCollection(
    content: string,
    filename: string
): { collection: Collection; variables: Array<{ key: string; value: string }> } {
    const isYaml = filename.endsWith('.yaml') || filename.endsWith('.yml');

    let data: PostmanCollection | InsomniaCollection | InsomniaV4Export;
    try {
        data = isYaml ? (yaml.load(content) as InsomniaCollection) : JSON.parse(content);
    } catch {
        throw new Error('Failed to parse file. Invalid JSON or YAML format.');
    }

    const isInsomniaV4 = Array.isArray((data as InsomniaV4Export).resources);
    if (isInsomniaV4) {
        return parseInsomniaV4Export(data as InsomniaV4Export);
    }

    const isInsomniaV5 =
        (data as InsomniaCollection).type?.includes('insomnia') ||
        (data as InsomniaCollection).collection !== undefined;

    if (isInsomniaV5) {
        return parseInsomniaCollection(data as InsomniaCollection);
    }

    return parsePostmanCollection(data as PostmanCollection);
}

function toPostmanUrl(url: string, params: KV[]): { raw: string; query?: PostmanQuery[] } {
    const enabledParams = params.filter((p) => p.enabled && p.key);
    if (enabledParams.length === 0) return { raw: url };
    return {
        raw: url,
        query: enabledParams.map((p) => ({ key: p.key, value: p.value })),
    };
}

function toPostmanHeaders(headers: KV[]): PostmanHeader[] {
    return headers
        .filter((h) => h.key)
        .map((h) => ({ key: h.key, value: h.value, disabled: !h.enabled }));
}

function toPostmanBody(bodyType: BodyType, body: string, formBody: KV[]): PostmanBody | undefined {
    if (bodyType === 'none') return undefined;

    if (bodyType === 'json') {
        return { mode: 'raw', raw: body, options: { raw: { language: 'json' } } };
    }

    if (bodyType === 'xml') {
        return { mode: 'raw', raw: body, options: { raw: { language: 'xml' } } };
    }

    if (bodyType === 'text') {
        return { mode: 'raw', raw: body, options: { raw: { language: 'text' } } };
    }

    if (bodyType === 'form') {
        return {
            mode: 'urlencoded',
            urlencoded: formBody
                .filter((f) => f.key)
                .map((f) => ({ key: f.key, value: f.value, disabled: !f.enabled })),
        };
    }

    return undefined;
}

function toPostmanAuth(auth: Auth): PostmanAuth | undefined {
    if (auth.type === 'none') return undefined;

    if (auth.type === 'bearer') {
        return { type: 'bearer', bearer: [{ key: 'token', value: auth.token }] };
    }

    if (auth.type === 'basic') {
        return {
            type: 'basic',
            basic: [
                { key: 'username', value: auth.username },
                { key: 'password', value: auth.password },
            ],
        };
    }

    if (auth.type === 'api-key') {
        return {
            type: 'apikey',
            apikey: [
                { key: 'key', value: auth.key },
                { key: 'value', value: auth.value },
                { key: 'in', value: auth.addTo },
            ],
        };
    }

    return undefined;
}

function toPostmanItem(req: SavedRequest): PostmanItem {
    const { snapshot } = req;
    return {
        name: req.name,
        request: {
            method: snapshot.method,
            header: toPostmanHeaders(snapshot.headers),
            body: toPostmanBody(snapshot.bodyType, snapshot.body, snapshot.formBody),
            auth: toPostmanAuth(snapshot.auth),
            url: toPostmanUrl(snapshot.url, snapshot.params),
        },
        response: [],
    };
}

function toPostmanFolder(collection: Collection): PostmanItem {
    const items: PostmanItem[] = [
        ...collection.requests.map(toPostmanItem),
        ...collection.folders.map(toPostmanFolder),
    ];
    return { name: collection.name, item: items };
}

export function exportToPostman(
    collection: Collection,
    variables: Array<{ key: string; value: string }>
): string {
    const items: PostmanItem[] = [
        ...collection.requests.map(toPostmanItem),
        ...collection.folders.map(toPostmanFolder),
    ];

    const postmanCollection: PostmanCollection = {
        info: {
            name: collection.name,
        },
        item: items,
        variable: variables.map((v) => ({ key: v.key, value: v.value })),
    };

    return JSON.stringify(postmanCollection, null, 2);
}

function toInsomniaRequest(req: SavedRequest): InsomniaItem {
    const { snapshot } = req;

    const headers: InsomniaHeader[] = snapshot.headers
        .filter((h) => h.key)
        .map((h) => ({ name: h.key, value: h.value, disabled: !h.enabled }));

    let body: InsomniaBody | undefined;
    if (snapshot.bodyType !== 'none' && snapshot.body) {
        let mimeType = 'text/plain';
        if (snapshot.bodyType === 'json') mimeType = 'application/json';
        else if (snapshot.bodyType === 'xml') mimeType = 'application/xml';
        else if (snapshot.bodyType === 'form') mimeType = 'application/x-www-form-urlencoded';
        body = { mimeType, text: snapshot.body };
    }

    let authentication: InsomniaAuth | undefined;
    if (snapshot.auth.type === 'bearer') {
        authentication = {
            type: 'bearer',
            token: snapshot.auth.token,
            prefix: snapshot.auth.prefix,
        };
    } else if (snapshot.auth.type === 'basic') {
        authentication = {
            type: 'basic',
            username: snapshot.auth.username,
            password: snapshot.auth.password,
        };
    }

    return {
        url: snapshot.url,
        name: req.name,
        method: snapshot.method,
        headers,
        body,
        authentication,
        meta: { id: `req_${uid()}` },
        settings: {
            renderRequestBody: true,
            encodeUrl: true,
            followRedirects: 'global',
        },
    } as InsomniaItem;
}

function toInsomniaFolder(collection: Collection): InsomniaItem {
    const children: InsomniaItem[] = [
        ...collection.requests.map(toInsomniaRequest),
        ...collection.folders.map(toInsomniaFolder),
    ];

    return {
        name: collection.name,
        meta: { id: `fld_${uid()}` },
        children,
    };
}

export function exportToInsomnia(
    collection: Collection,
    variables: Array<{ key: string; value: string }>
): string {
    const children: InsomniaItem[] = [
        ...collection.requests.map(toInsomniaRequest),
        ...collection.folders.map(toInsomniaFolder),
    ];

    const insomniaCollection: InsomniaCollection = {
        type: 'collection.insomnia.rest/5.0',
        name: collection.name,
        meta: { id: `wrk_${uid()}` },
        collection: children,
        environments:
            variables.length > 0
                ? [
                      {
                          name: 'Default',
                          data: Object.fromEntries(variables.map((v) => [v.key, v.value])),
                      },
                  ]
                : [],
    };

    return yaml.dump(insomniaCollection, { lineWidth: -1, noRefs: true });
}
