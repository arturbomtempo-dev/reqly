import type { Variable } from '@/modules/request/_store/variables';
import type { Collection, SavedRequest, TabSnapshot } from '@/modules/request/_types';
import { stamp } from './clock';
import type { FlatCollection, FlatRequest, FlatVariable, Workspace } from './types';

function stripResponse(snapshot: TabSnapshot): TabSnapshot {
    return { ...snapshot, response: null };
}

export function flattenCollections(tree: Collection[]): {
    collections: FlatCollection[];
    requests: FlatRequest[];
} {
    const collections: FlatCollection[] = [];
    const requests: FlatRequest[] = [];

    const walk = (nodes: Collection[], parentId: string | null) => {
        nodes.forEach((node, index) => {
            collections.push({
                id: node.id,
                parentId,
                name: node.name,
                sortOrder: index,
                updatedAt: node.updatedAt,
                deletedAt: null,
            });

            node.requests.forEach((request, requestIndex) => {
                requests.push({
                    id: request.id,
                    collectionId: node.id,
                    name: request.name,
                    sortOrder: requestIndex,
                    snapshot: stripResponse(request.snapshot),
                    updatedAt: request.updatedAt,
                    deletedAt: null,
                });
            });

            walk(node.folders ?? [], node.id);
        });
    };

    walk(tree, null);
    return { collections, requests };
}

export function flattenVariables(variables: Variable[]): FlatVariable[] {
    return variables.map((variable, index) => ({
        id: variable.id,
        key: variable.key,
        value: variable.value,
        enabled: variable.enabled,
        sortOrder: index,
        updatedAt: variable.updatedAt,
        deletedAt: null,
    }));
}

export function flattenWorkspace(tree: Collection[], variables: Variable[]): Workspace {
    const { collections, requests } = flattenCollections(tree);
    return { collections, requests, variables: flattenVariables(variables) };
}

function bySortOrder<T extends { sortOrder: number; id: string }>(a: T, b: T): number {
    return a.sortOrder - b.sortOrder || a.id.localeCompare(b.id);
}

export function buildCollectionTree(
    collections: FlatCollection[],
    requests: FlatRequest[]
): Collection[] {
    const live = collections.filter((collection) => collection.deletedAt === null);
    const byId = new Map(live.map((collection) => [collection.id, collection]));

    const requestsByCollection = new Map<string, FlatRequest[]>();
    for (const request of requests) {
        if (request.deletedAt !== null) continue;
        const parentId = request.collectionId;
        if (!parentId || !byId.has(parentId)) continue;
        const bucket = requestsByCollection.get(parentId);
        if (bucket) bucket.push(request);
        else requestsByCollection.set(parentId, [request]);
    }

    const resolveParent = (collection: FlatCollection): string | null => {
        const parentId = collection.parentId;
        if (!parentId || !byId.has(parentId)) return null;

        const seen = new Set<string>([collection.id]);
        let current: string | null = parentId;

        while (current && byId.has(current)) {
            if (seen.has(current)) return null;
            seen.add(current);
            current = byId.get(current)!.parentId;
        }

        return parentId;
    };

    const childrenOf = new Map<string | null, FlatCollection[]>();
    for (const collection of live) {
        const parentId = resolveParent(collection);
        const bucket = childrenOf.get(parentId);
        if (bucket) bucket.push(collection);
        else childrenOf.set(parentId, [collection]);
    }

    const toNode = (collection: FlatCollection): Collection => ({
        id: collection.id,
        name: collection.name,
        updatedAt: collection.updatedAt,
        requests: (requestsByCollection.get(collection.id) ?? [])
            .slice()
            .sort(bySortOrder)
            .map(toSavedRequest),
        folders: (childrenOf.get(collection.id) ?? []).slice().sort(bySortOrder).map(toNode),
    });

    return (childrenOf.get(null) ?? []).slice().sort(bySortOrder).map(toNode);
}

function toSavedRequest(request: FlatRequest): SavedRequest {
    return {
        id: request.id,
        name: request.name,
        snapshot: request.snapshot,
        updatedAt: request.updatedAt,
    };
}

export function buildVariables(variables: FlatVariable[]): Variable[] {
    return variables
        .filter((variable) => variable.deletedAt === null)
        .slice()
        .sort(bySortOrder)
        .map((variable) => ({
            id: variable.id,
            key: variable.key,
            value: variable.value,
            enabled: variable.enabled,
            updatedAt: variable.updatedAt,
        }));
}

export function collectSubtreeIds(collections: FlatCollection[], rootId: string): Set<string> {
    const childrenOf = new Map<string, string[]>();
    for (const collection of collections) {
        if (!collection.parentId) continue;
        const bucket = childrenOf.get(collection.parentId);
        if (bucket) bucket.push(collection.id);
        else childrenOf.set(collection.parentId, [collection.id]);
    }

    const ids = new Set<string>();
    const queue = [rootId];

    while (queue.length > 0) {
        const id = queue.pop()!;
        if (ids.has(id)) continue;
        ids.add(id);
        queue.push(...(childrenOf.get(id) ?? []));
    }

    return ids;
}

export function toTombstones<T extends { updatedAt: number; deletedAt: number | null }>(
    rows: T[],
    deletedAt: number = stamp()
): T[] {
    return rows.map((row) => ({ ...row, updatedAt: deletedAt, deletedAt }));
}
