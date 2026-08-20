import { apiFetch } from '@/core/http/api';
import { measureClockSkew } from './clock';
import type { FlatCollection, FlatRequest, FlatVariable, Workspace } from './types';
import { emptyWorkspace } from './types';

/** Wire records use ISO strings; the client works in epoch milliseconds. */
type Wire<T> = Omit<T, 'updatedAt' | 'deletedAt'> & {
    updatedAt: string;
    deletedAt: string | null;
};

interface WireWorkspace {
    collections: Wire<FlatCollection>[];
    requests: Wire<FlatRequest>[];
    variables: Wire<FlatVariable>[];
}

interface PullResponse extends WireWorkspace {
    serverTime: string;
    cursor: string;
    full: boolean;
}

interface PushResponse {
    serverTime: string;
    cursor: string;
    applied: { collections: number; requests: number; variables: number };
    conflicts: WireWorkspace;
}

function toClock(value: string | null): number | null {
    if (!value) return null;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
}

function fromWire<T extends { updatedAt: number; deletedAt: number | null }>(row: Wire<T>): T {
    return {
        ...row,
        updatedAt: toClock(row.updatedAt) ?? 0,
        deletedAt: toClock(row.deletedAt),
    } as unknown as T;
}

function decode(wire: WireWorkspace): Workspace {
    return {
        collections: (wire.collections ?? []).map(fromWire<FlatCollection>),
        requests: (wire.requests ?? []).map(fromWire<FlatRequest>),
        variables: (wire.variables ?? []).map(fromWire<FlatVariable>),
    };
}

function toWire<T extends { updatedAt: number; deletedAt: number | null }>(row: T): Wire<T> {
    return {
        ...row,
        updatedAt: new Date(row.updatedAt).toISOString(),
        deletedAt: row.deletedAt === null ? null : new Date(row.deletedAt).toISOString(),
    };
}

function encode(workspace: Workspace): WireWorkspace {
    return {
        collections: workspace.collections.map(toWire),
        requests: workspace.requests.map(toWire),
        variables: workspace.variables.map(toWire),
    };
}

export interface PullResult {
    workspace: Workspace;
    cursor: string;
    full: boolean;
    skewMs: number;
}

export async function pullWorkspace(since?: string | null): Promise<PullResult> {
    const startedAt = Date.now();
    const query = since ? `?since=${encodeURIComponent(since)}` : '';
    const response = await apiFetch<PullResponse>(`/sync${query}`);

    return {
        workspace: decode(response),
        cursor: response.cursor,
        full: response.full,
        skewMs: measureClockSkew(response.serverTime, startedAt),
    };
}

export interface PushResult {
    cursor: string;
    conflicts: Workspace;
    skewMs: number;
}

export async function pushWorkspace(workspace: Workspace): Promise<PushResult> {
    const startedAt = Date.now();
    const response = await apiFetch<PushResponse>('/sync', {
        method: 'POST',
        body: encode(workspace),
    });

    return {
        cursor: response.cursor,
        conflicts: response.conflicts ? decode(response.conflicts) : emptyWorkspace(),
        skewMs: measureClockSkew(response.serverTime, startedAt),
    };
}
