import type { TabSnapshot } from '@/modules/request/_types';

/**
 * The sync layer works on a flat, id-addressable view of the workspace. The UI
 * keeps collections as a nested tree, but a tree is a terrible unit of change:
 * flattening lets every collection, request and variable be versioned, merged
 * and deleted on its own.
 */

export interface FlatCollection {
    id: string;
    parentId: string | null;
    name: string;
    sortOrder: number;
    updatedAt: number;
    deletedAt: number | null;
}

export interface FlatRequest {
    id: string;
    collectionId: string | null;
    name: string;
    sortOrder: number;
    snapshot: TabSnapshot;
    updatedAt: number;
    deletedAt: number | null;
}

export interface FlatVariable {
    id: string;
    key: string;
    value: string;
    enabled: boolean;
    sortOrder: number;
    updatedAt: number;
    deletedAt: number | null;
}

export interface Workspace {
    collections: FlatCollection[];
    requests: FlatRequest[];
    variables: FlatVariable[];
}

export type EntityKind = 'collection' | 'request' | 'variable';

export function emptyWorkspace(): Workspace {
    return { collections: [], requests: [], variables: [] };
}

export function isEmptyWorkspace(workspace: Workspace): boolean {
    return (
        workspace.collections.length === 0 &&
        workspace.requests.length === 0 &&
        workspace.variables.length === 0
    );
}

export function workspaceSize(workspace: Workspace): number {
    return workspace.collections.length + workspace.requests.length + workspace.variables.length;
}

export function versionKey(kind: EntityKind, id: string): string {
    return `${kind[0]}:${id}`;
}
