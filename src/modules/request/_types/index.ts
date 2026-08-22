import { AUTH_TYPES, BODY_TYPES, HTTP_METHODS } from '@/core/constants';

export type HttpMethod = (typeof HTTP_METHODS)[number];
export type BodyType = (typeof BODY_TYPES)[number];
export type AuthType = (typeof AUTH_TYPES)[number];

export interface KV {
    id: string;
    key: string;
    value: string;
    enabled: boolean;
}

export interface FormDataField {
    id: string;
    key: string;
    value: string;
    type: 'text' | 'file';
    enabled: boolean;
}

export interface AuthNone {
    type: 'none';
}

export interface AuthBearer {
    type: 'bearer';
    token: string;
    prefix: string;
}

export interface AuthBasic {
    type: 'basic';
    username: string;
    password: string;
}

export interface AuthApiKey {
    type: 'api-key';
    key: string;
    value: string;
    addTo: 'header' | 'query';
}

export type Auth = AuthNone | AuthBearer | AuthBasic | AuthApiKey;

export interface ApiResponse {
    status: number;
    statusText: string;
    time: number;
    size: number;
    headers: Record<string, string>;
    body: string;
    contentType: string;
    previewUrl?: string | null;
}

export interface TabSnapshot {
    method: HttpMethod;
    url: string;
    params: KV[];
    headers: KV[];
    bodyType: BodyType;
    body: string;
    formBody: KV[];
    multipartBody: FormDataField[];
    auth: Auth;
    response: ApiResponse | null;
}

export interface Tab {
    id: string;
    name?: string;
    savedRequestId?: string;
    collectionId?: string;
    snapshot: TabSnapshot;
}

export type SyncClock = number;

export interface SavedRequest {
    id: string;
    name: string;
    snapshot: TabSnapshot;
    updatedAt: SyncClock;
}

export interface Collection {
    id: string;
    name: string;
    requests: SavedRequest[];
    folders: Collection[];
    updatedAt: SyncClock;
}
