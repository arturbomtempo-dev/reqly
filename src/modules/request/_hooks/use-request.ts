import axios from 'axios';
import { useRequestStore } from '../_store';
import { useVariablesStore } from '../_store/variables';

function getMimeType(contentType: string): string {
    return contentType.split(';')[0]?.trim().toLowerCase() ?? '';
}

function getCharset(contentType: string): string {
    const match = contentType.match(/charset=([^;]+)/i);
    return match?.[1]?.trim() || 'utf-8';
}

function decodeText(data: ArrayBuffer, contentType: string): string {
    try {
        return new TextDecoder(getCharset(contentType)).decode(new Uint8Array(data));
    } catch {
        return new TextDecoder('utf-8').decode(new Uint8Array(data));
    }
}

function resolveTransport(targetUrl: string): {
    requestUrl: string;
    proxyHeaders: Record<string, string>;
} {
    if (import.meta.env.DEV) {
        return {
            requestUrl: '/__proxy',
            proxyHeaders: { 'X-Proxy-Url': targetUrl },
        };
    }

    return {
        requestUrl: targetUrl,
        proxyHeaders: {},
    };
}

export function useRequest() {
    const { setResponse, setLoading, setError, nextRequest } = useRequestStore();

    const send = async () => {
        const { url, method, params, headers, bodyType, body, formBody, auth } =
            useRequestStore.getState();
        const { interpolate } = useVariablesStore.getState();

        if (!url.trim()) return;

        nextRequest();
        setLoading(true);
        setError(null);
        setResponse(null);

        try {
            const resolvedUrl = interpolate(url.trim());

            const reqParams: Record<string, string> = {};
            params
                .filter((p) => p.enabled && p.key)
                .forEach((p) => (reqParams[interpolate(p.key)] = interpolate(p.value)));

            const reqHeaders: Record<string, string> = {};
            headers
                .filter((h) => h.enabled && h.key)
                .forEach((h) => (reqHeaders[interpolate(h.key)] = interpolate(h.value)));

            if (auth.type === 'bearer' && auth.token) {
                const prefix = auth.prefix || 'Bearer';
                reqHeaders['Authorization'] = `${prefix} ${interpolate(auth.token)}`;
            } else if (auth.type === 'basic' && (auth.username || auth.password)) {
                const encoded = btoa(`${interpolate(auth.username)}:${interpolate(auth.password)}`);
                reqHeaders['Authorization'] = `Basic ${encoded}`;
            } else if (auth.type === 'api-key' && auth.key) {
                if (auth.addTo === 'header') {
                    reqHeaders[interpolate(auth.key)] = interpolate(auth.value);
                } else {
                    reqParams[interpolate(auth.key)] = interpolate(auth.value);
                }
            }

            let reqData: string | FormData | undefined;

            if (method !== 'GET' && bodyType !== 'none') {
                if (bodyType === 'json') {
                    reqData = interpolate(body);
                    reqHeaders['Content-Type'] ??= 'application/json';
                } else if (bodyType === 'xml') {
                    reqData = interpolate(body);
                    reqHeaders['Content-Type'] ??= 'application/xml';
                } else if (bodyType === 'text') {
                    reqData = interpolate(body);
                    reqHeaders['Content-Type'] ??= 'text/plain';
                } else if (bodyType === 'form') {
                    const fd = new URLSearchParams();
                    formBody
                        .filter((f) => f.enabled && f.key)
                        .forEach((f) => fd.append(interpolate(f.key), interpolate(f.value)));
                    reqData = fd.toString();
                    reqHeaders['Content-Type'] ??= 'application/x-www-form-urlencoded';
                } else if (bodyType === 'multipart') {
                    const { multipartBody, multipartFiles } = useRequestStore.getState();
                    const fd = new FormData();
                    multipartBody
                        .filter((f) => f.enabled && f.key)
                        .forEach((f) => {
                            if (f.type === 'file') {
                                const file = multipartFiles[f.id];
                                if (file) fd.append(interpolate(f.key), file, file.name);
                            } else {
                                fd.append(interpolate(f.key), interpolate(f.value));
                            }
                        });
                    reqData = fd;
                }
            }

            const start = performance.now();

            const targetUrl = new URL(resolvedUrl);
            Object.entries(reqParams).forEach(([k, v]) => targetUrl.searchParams.append(k, v));

            const { requestUrl, proxyHeaders } = resolveTransport(targetUrl.toString());

            const res = await axios.request<ArrayBuffer>({
                method,
                url: requestUrl,
                headers: {
                    ...reqHeaders,
                    ...proxyHeaders,
                },
                data: reqData,
                responseType: 'arraybuffer',
                timeout: 30_000,
                validateStatus: () => true,
            });

            const elapsed = Math.round(performance.now() - start);
            const contentType = (res.headers['content-type'] as string) ?? '';
            const mimeType = getMimeType(contentType);
            const isImage = mimeType.startsWith('image/');

            const respHeaders: Record<string, string> = {};
            Object.entries(res.headers).forEach(([k, v]) => {
                if (typeof v === 'string') respHeaders[k] = v;
                else if (Array.isArray(v)) respHeaders[k] = v.join(', ');
            });

            let responseBody = '';
            let previewUrl: string | null = null;

            if (isImage) {
                const prev = useRequestStore.getState().response;
                if (prev?.previewUrl) {
                    URL.revokeObjectURL(prev.previewUrl);
                }
                previewUrl = URL.createObjectURL(
                    new Blob([res.data], {
                        type: mimeType || 'application/octet-stream',
                    })
                );
            } else {
                responseBody = decodeText(res.data, contentType);
            }

            setResponse({
                status: res.status,
                statusText: res.statusText,
                time: elapsed,
                size: res.data.byteLength,
                headers: respHeaders,
                body: responseBody,
                contentType,
                previewUrl,
            });
        } catch {
            setError(
                import.meta.env.DEV
                    ? 'Request failed'
                    : 'Request failed. Hosted Reqly can only call browser-accessible APIs. For localhost APIs, run Reqly locally.'
            );
        } finally {
            setLoading(false);
        }
    };

    return { send };
}
