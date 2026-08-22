import { normalizeName, normalizeUrl, requestSignature } from './signature';
import type { FlatCollection, FlatRequest, FlatVariable, Workspace } from './types';

export interface MergeStats {
    fromRemote: number;
    fromLocal: number;
    linked: number;
    resolved: number;
}

export interface MergeReport {
    collections: MergeStats;
    requests: MergeStats;
    variables: MergeStats;
}

export interface MergeOutcome {
    workspace: Workspace;
    collectionRemap: Map<string, string>;
    requestRemap: Map<string, string>;
    report: MergeReport;
}

const MATCH_THRESHOLD = 4;

function emptyStats(): MergeStats {
    return { fromRemote: 0, fromLocal: 0, linked: 0, resolved: 0 };
}

function resolve<T extends { updatedAt: number }>(remote: T | undefined, local: T | undefined): T {
    if (!remote) return local!;
    if (!local) return remote;
    return local.updatedAt > remote.updatedAt ? local : remote;
}

function depthOf(collection: FlatCollection, byId: Map<string, FlatCollection>): number {
    let depth = 0;
    let current = collection.parentId;
    const seen = new Set<string>([collection.id]);

    while (current && byId.has(current) && !seen.has(current)) {
        seen.add(current);
        depth += 1;
        current = byId.get(current)!.parentId;
    }

    return depth;
}

function mergeCollections(
    remote: FlatCollection[],
    local: FlatCollection[],
    remap: Map<string, string>,
    stats: MergeStats
): FlatCollection[] {
    const remoteById = new Map(remote.map((collection) => [collection.id, collection]));
    const localById = new Map(local.map((collection) => [collection.id, collection]));
    const claimed = new Set<string>();

    const remoteByParent = new Map<string, FlatCollection[]>();
    for (const collection of remote) {
        if (collection.deletedAt !== null) continue;
        const key = collection.parentId ?? '';
        const bucket = remoteByParent.get(key);
        if (bucket) bucket.push(collection);
        else remoteByParent.set(key, [collection]);
    }

    const ordered = local
        .slice()
        .sort(
            (a, b) =>
                depthOf(a, localById) - depthOf(b, localById) ||
                a.sortOrder - b.sortOrder ||
                a.id.localeCompare(b.id)
        );

    for (const collection of ordered) {
        if (remoteById.has(collection.id)) {
            claimed.add(collection.id);
            continue;
        }

        if (collection.deletedAt !== null) continue;

        const parentId = collection.parentId
            ? (remap.get(collection.parentId) ?? collection.parentId)
            : null;

        const match = (remoteByParent.get(parentId ?? '') ?? [])
            .filter(
                (candidate) =>
                    !claimed.has(candidate.id) &&
                    normalizeName(candidate.name) === normalizeName(collection.name)
            )
            .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))[0];

        if (match) {
            remap.set(collection.id, match.id);
            claimed.add(match.id);
            stats.linked += 1;
        }
    }

    return resolveAll(
        remote,
        local.map((collection) => ({
            ...collection,
            id: remap.get(collection.id) ?? collection.id,
            parentId: collection.parentId
                ? (remap.get(collection.parentId) ?? collection.parentId)
                : null,
        })),
        stats
    );
}

function similarity(a: FlatRequest, b: FlatRequest): number {
    let score = 0;

    const nameA = normalizeName(a.name);
    if (nameA && nameA === normalizeName(b.name)) score += 4;
    if (requestSignature(a.snapshot) === requestSignature(b.snapshot)) score += 3;

    const urlA = normalizeUrl(a.snapshot?.url);
    if (urlA && urlA === normalizeUrl(b.snapshot?.url)) score += 2;
    if (a.snapshot?.method && a.snapshot.method === b.snapshot?.method) score += 1;

    return score;
}

function mergeRequests(
    remote: FlatRequest[],
    local: FlatRequest[],
    collectionRemap: Map<string, string>,
    remap: Map<string, string>,
    stats: MergeStats
): FlatRequest[] {
    const remoteById = new Map(remote.map((request) => [request.id, request]));
    const claimed = new Set<string>();

    const remoteByCollection = new Map<string, FlatRequest[]>();
    for (const request of remote) {
        if (request.deletedAt !== null) continue;
        const key = request.collectionId ?? '';
        const bucket = remoteByCollection.get(key);
        if (bucket) bucket.push(request);
        else remoteByCollection.set(key, [request]);
    }

    const relocated = local.map((request) => ({
        ...request,
        collectionId: request.collectionId
            ? (collectionRemap.get(request.collectionId) ?? request.collectionId)
            : null,
    }));

    const pairs: Array<{ localId: string; remoteId: string; score: number }> = [];

    for (const request of relocated) {
        if (remoteById.has(request.id) || request.deletedAt !== null) continue;

        for (const candidate of remoteByCollection.get(request.collectionId ?? '') ?? []) {
            const score = similarity(request, candidate);
            if (score >= MATCH_THRESHOLD) {
                pairs.push({ localId: request.id, remoteId: candidate.id, score });
            }
        }
    }

    pairs.sort(
        (a, b) =>
            b.score - a.score ||
            a.localId.localeCompare(b.localId) ||
            a.remoteId.localeCompare(b.remoteId)
    );

    for (const pair of pairs) {
        if (remap.has(pair.localId) || claimed.has(pair.remoteId)) continue;
        remap.set(pair.localId, pair.remoteId);
        claimed.add(pair.remoteId);
        stats.linked += 1;
    }

    return resolveAll(
        remote,
        relocated.map((request) => ({ ...request, id: remap.get(request.id) ?? request.id })),
        stats
    );
}

function mergeVariables(
    remote: FlatVariable[],
    local: FlatVariable[],
    remap: Map<string, string>,
    stats: MergeStats
): FlatVariable[] {
    const remoteById = new Map(remote.map((variable) => [variable.id, variable]));
    const claimed = new Set<string>();

    const remoteByKey = new Map<string, FlatVariable[]>();
    for (const variable of remote) {
        if (variable.deletedAt !== null) continue;
        const key = normalizeName(variable.key);
        if (!key) continue;
        const bucket = remoteByKey.get(key);
        if (bucket) bucket.push(variable);
        else remoteByKey.set(key, [variable]);
    }

    for (const variable of local) {
        if (remoteById.has(variable.id) || variable.deletedAt !== null) continue;

        const match = (remoteByKey.get(normalizeName(variable.key)) ?? []).find(
            (candidate) => !claimed.has(candidate.id)
        );

        if (match) {
            remap.set(variable.id, match.id);
            claimed.add(match.id);
            stats.linked += 1;
        }
    }

    return resolveAll(
        remote,
        local.map((variable) => ({ ...variable, id: remap.get(variable.id) ?? variable.id })),
        stats
    );
}

function resolveAll<T extends { id: string; updatedAt: number }>(
    remote: T[],
    local: T[],
    stats: MergeStats
): T[] {
    const remoteById = new Map(remote.map((row) => [row.id, row]));
    const localById = new Map<string, T>();

    for (const row of local) {
        const current = localById.get(row.id);
        if (!current || row.updatedAt > current.updatedAt) localById.set(row.id, row);
    }

    const merged: T[] = [];

    for (const id of new Set([...remoteById.keys(), ...localById.keys()])) {
        const remoteRow = remoteById.get(id);
        const localRow = localById.get(id);

        if (remoteRow && localRow) stats.resolved += 1;
        else if (remoteRow) stats.fromRemote += 1;
        else stats.fromLocal += 1;

        merged.push(resolve(remoteRow, localRow));
    }

    return merged;
}

export function mergeWorkspaces(remote: Workspace, local: Workspace): MergeOutcome {
    const collectionRemap = new Map<string, string>();
    const requestRemap = new Map<string, string>();
    const variableRemap = new Map<string, string>();

    const report: MergeReport = {
        collections: emptyStats(),
        requests: emptyStats(),
        variables: emptyStats(),
    };

    const collections = mergeCollections(
        remote.collections,
        local.collections,
        collectionRemap,
        report.collections
    );
    const requests = mergeRequests(
        remote.requests,
        local.requests,
        collectionRemap,
        requestRemap,
        report.requests
    );
    const variables = mergeVariables(
        remote.variables,
        local.variables,
        variableRemap,
        report.variables
    );

    return {
        workspace: { collections, requests, variables },
        collectionRemap,
        requestRemap,
        report,
    };
}

export function applyRemoteChanges(current: Workspace, incoming: Workspace): Workspace {
    return {
        collections: overlay(current.collections, incoming.collections),
        requests: overlay(current.requests, incoming.requests),
        variables: overlay(current.variables, incoming.variables),
    };
}

function overlay<T extends { id: string; updatedAt: number }>(current: T[], incoming: T[]): T[] {
    const byId = new Map(current.map((row) => [row.id, row]));

    for (const row of incoming) {
        const existing = byId.get(row.id);
        if (!existing || row.updatedAt >= existing.updatedAt) byId.set(row.id, row);
    }

    return [...byId.values()];
}
