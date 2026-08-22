import { getToken } from '../auth/token';

export const API_URL = import.meta.env.VITE_API_URL as string;

if (!API_URL) {
    throw new Error('VITE_API_URL is not defined. Check your .env file.');
}

export class ApiError extends Error {
    constructor(
        readonly status: number,
        message: string
    ) {
        super(message);
        this.name = 'ApiError';
    }

    get isOffline(): boolean {
        return this.status === 0;
    }

    get isUnauthorized(): boolean {
        return this.status === 401;
    }
}

interface ApiRequestInit extends Omit<RequestInit, 'body'> {
    body?: unknown;
    auth?: boolean;
}

export async function apiFetch<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
    const { body, auth = true, headers, ...rest } = init;
    const requestHeaders = new Headers(headers);

    if (body !== undefined) requestHeaders.set('Content-Type', 'application/json');

    if (auth) {
        const token = getToken();
        if (!token) throw new ApiError(401, 'Not signed in');
        requestHeaders.set('Authorization', `Bearer ${token}`);
    }

    let response: Response;

    try {
        response = await fetch(`${API_URL}${path}`, {
            ...rest,
            headers: requestHeaders,
            body: body === undefined ? undefined : JSON.stringify(body),
        });
    } catch (error) {
        throw new ApiError(0, error instanceof Error ? error.message : 'Network request failed');
    }

    if (!response.ok) {
        const message = await response
            .json()
            .then((data: { error?: string }) => data.error)
            .catch(() => null);
        throw new ApiError(response.status, message ?? `Request failed (${response.status})`);
    }

    return (await response.json()) as T;
}
