import { describe, expect, it } from 'vitest';
import { applyRemoteChanges, mergeWorkspaces } from './merge';
import type { FlatCollection, FlatRequest, FlatVariable, Workspace } from './types';

/**
 * The merge decides whether someone keeps their work when they sign in. Each
 * case below is a situation a real user can walk into, and the assertions are
 * the promise the app makes: nothing disappears, nothing is duplicated twice
 * over, and the newer edit wins.
 */

type Snapshot = FlatRequest['snapshot'];

function snap(method: string, url: string, body = ''): Snapshot {
    return {
        method,
        url,
        params: [],
        headers: [],
        bodyType: body ? 'json' : 'none',
        body,
        formBody: [],
        multipartBody: [],
        auth: { type: 'none' },
        response: null,
    } as unknown as Snapshot;
}

function col(
    id: string,
    name: string,
    updatedAt: number,
    parentId: string | null = null,
    deletedAt: number | null = null
): FlatCollection {
    return { id, parentId, name, sortOrder: 0, updatedAt, deletedAt };
}

function req(
    id: string,
    name: string,
    collectionId: string | null,
    updatedAt: number,
    snapshot: Snapshot = snap('GET', 'https://api.test/x'),
    deletedAt: number | null = null
): FlatRequest {
    return { id, collectionId, name, sortOrder: 0, snapshot, updatedAt, deletedAt };
}

function variable(id: string, key: string, value: string, updatedAt: number): FlatVariable {
    return { id, key, value, enabled: true, sortOrder: 0, updatedAt, deletedAt: null };
}

function workspace(
    collections: FlatCollection[] = [],
    requests: FlatRequest[] = [],
    variables: FlatVariable[] = []
): Workspace {
    return { collections, requests, variables };
}

function live<T extends { deletedAt: number | null }>(rows: T[]): T[] {
    return rows.filter((row) => row.deletedAt === null);
}

describe('signing in', () => {
    it('uploads a local-only workspace to an empty account', () => {
        const local = workspace(
            [col('L1', 'Billing', 100)],
            [req('LR1', 'Charge', 'L1', 100)],
            [variable('LV1', 'host', 'https://a', 100)]
        );

        const { workspace: merged, report } = mergeWorkspaces(workspace(), local);

        expect(live(merged.collections)).toHaveLength(1);
        expect(live(merged.requests)).toHaveLength(1);
        expect(live(merged.variables)).toHaveLength(1);
        expect(merged.requests[0].collectionId).toBe('L1');
        expect(report.requests.fromLocal).toBe(1);
    });

    it('restores an account into an empty client', () => {
        const remote = workspace([col('R1', 'Billing', 100)], [req('RR1', 'Charge', 'R1', 100)]);

        const { workspace: merged } = mergeWorkspaces(remote, workspace());

        expect(live(merged.collections)).toHaveLength(1);
        expect(live(merged.requests)).toHaveLength(1);
    });
});

describe('recognising the same thing twice', () => {
    it('folds collections with the same name at the same level, keeping both sets of requests', () => {
        const remote = workspace(
            [col('R1', 'Billing', 100)],
            [req('RR1', 'Charge', 'R1', 100, snap('POST', 'https://api.test/charge'))]
        );
        const local = workspace(
            [col('L1', 'billing', 200)],
            [req('LR1', 'Refund', 'L1', 200, snap('POST', 'https://api.test/refund'))]
        );

        const { workspace: merged, collectionRemap } = mergeWorkspaces(remote, local);

        expect(live(merged.collections)).toHaveLength(1);
        expect(collectionRemap.get('L1')).toBe('R1');
        expect(live(merged.requests)).toHaveLength(2);
        expect(live(merged.requests).every((r) => r.collectionId === 'R1')).toBe(true);
    });

    it('does not duplicate a request that was saved separately on two devices', () => {
        const shared = snap('POST', 'https://api.test/charge', '{"amount":10}');
        const remote = workspace(
            [col('R1', 'Billing', 100)],
            [req('RR1', 'Charge', 'R1', 100, shared)]
        );
        const local = workspace(
            [col('L1', 'Billing', 100)],
            [req('LR1', 'Charge', 'L1', 150, shared)]
        );

        const { workspace: merged, requestRemap } = mergeWorkspaces(remote, local);

        expect(live(merged.requests)).toHaveLength(1);
        expect(requestRemap.get('LR1')).toBe('RR1');
        expect(merged.requests[0].updatedAt).toBe(150);
    });

    it('recognises a renamed request by its content', () => {
        const shared = snap('GET', 'https://api.test/users');
        const remote = workspace(
            [col('R1', 'API', 100)],
            [req('RR1', 'List users', 'R1', 100, shared)]
        );
        const local = workspace(
            [col('L1', 'API', 100)],
            [req('LR1', 'Get all users', 'L1', 300, shared)]
        );

        const { workspace: merged } = mergeWorkspaces(remote, local);

        expect(live(merged.requests)).toHaveLength(1);
        expect(merged.requests[0].name).toBe('Get all users');
    });

    it('keeps an ambiguous extra rather than dropping it', () => {
        const remote = workspace(
            [col('R1', 'API', 100)],
            [req('RR1', 'Health', 'R1', 100, snap('GET', 'https://api.test/health'))]
        );
        const local = workspace(
            [col('L1', 'API', 100)],
            [
                req('LR1', 'Health', 'L1', 300, snap('GET', 'https://other.test/health')),
                req('LR2', 'Health', 'L1', 300, snap('GET', 'https://third.test/health')),
            ]
        );

        const { workspace: merged } = mergeWorkspaces(remote, local);

        expect(live(merged.requests)).toHaveLength(2);
    });

    it('matches a nested folder inside its own parent, not a same-named folder elsewhere', () => {
        const remote = workspace(
            [col('R1', 'API', 100), col('R2', 'v1', 100, 'R1'), col('R3', 'v1', 100, null)],
            [req('RR1', 'Ping', 'R2', 100, snap('GET', 'https://api.test/v1/ping'))]
        );
        const local = workspace(
            [col('L1', 'API', 200), col('L2', 'v1', 200, 'L1')],
            [req('LR1', 'Pong', 'L2', 200, snap('GET', 'https://api.test/v1/pong'))]
        );

        const { workspace: merged, collectionRemap } = mergeWorkspaces(remote, local);

        expect(collectionRemap.get('L1')).toBe('R1');
        expect(collectionRemap.get('L2')).toBe('R2');
        expect(live(merged.collections)).toHaveLength(3);
        expect(live(merged.requests)).toHaveLength(2);
    });

    it('merges variables by key', () => {
        const remote = workspace([], [], [variable('RV1', 'baseUrl', 'https://prod', 100)]);
        const local = workspace(
            [],
            [],
            [
                variable('LV1', 'baseUrl', 'https://staging', 300),
                variable('LV2', 'token', 'abc', 300),
            ]
        );

        const { workspace: merged } = mergeWorkspaces(remote, local);

        expect(live(merged.variables)).toHaveLength(2);
        expect(merged.variables.find((v) => v.key === 'baseUrl')?.value).toBe('https://staging');
    });
});

describe('resolving conflicts', () => {
    it('gives the same id to whichever side edited it last', () => {
        const cloudWins = mergeWorkspaces(
            workspace([], [req('X', 'Cloud version', null, 500)]),
            workspace([], [req('X', 'Local version', null, 400)])
        );
        expect(cloudWins.workspace.requests[0].name).toBe('Cloud version');

        const localWins = mergeWorkspaces(
            workspace([], [req('X', 'Cloud version', null, 400)]),
            workspace([], [req('X', 'Local version', null, 500)])
        );
        expect(localWins.workspace.requests[0].name).toBe('Local version');
    });

    it('honours a delete that is newer than the remote copy', () => {
        const { workspace: merged } = mergeWorkspaces(
            workspace([col('C1', 'Billing', 100)], [req('R1', 'Charge', 'C1', 100)]),
            workspace([], [req('R1', 'Charge', 'C1', 300, snap('GET', ''), 300)])
        );

        expect(live(merged.requests)).toHaveLength(0);
    });

    it('lets a newer edit win over a stale delete', () => {
        const { workspace: merged } = mergeWorkspaces(
            workspace([], [req('R1', 'Charge', 'C1', 900)]),
            workspace([], [req('R1', 'Charge', 'C1', 300, snap('GET', ''), 300)])
        );

        expect(live(merged.requests)).toHaveLength(1);
    });
});

describe('at scale', () => {
    it('loses nothing and duplicates nothing across 250 requests', () => {
        const remote = workspace(
            Array.from({ length: 20 }, (_, i) => col(`R${i}`, `Col ${i}`, 100)),
            Array.from({ length: 200 }, (_, i) =>
                req(`RR${i}`, `Req ${i}`, `R${i % 20}`, 100, snap('GET', `https://api.test/${i}`))
            )
        );
        const local = workspace(
            Array.from({ length: 20 }, (_, i) => col(`L${i}`, `Col ${i}`, 200)),
            [
                // Already in the cloud, saved again locally under a different id.
                ...Array.from({ length: 100 }, (_, i) =>
                    req(
                        `LR${i}`,
                        `Req ${i}`,
                        `L${i % 20}`,
                        200,
                        snap('GET', `https://api.test/${i}`)
                    )
                ),
                // Created offline, never seen by the server.
                ...Array.from({ length: 50 }, (_, i) =>
                    req(
                        `LN${i}`,
                        `New ${i}`,
                        `L${i % 20}`,
                        200,
                        snap('GET', `https://api.test/new/${i}`)
                    )
                ),
            ]
        );

        const { workspace: merged } = mergeWorkspaces(remote, local);

        expect(live(merged.collections)).toHaveLength(20);
        expect(live(merged.requests)).toHaveLength(250);
        expect(
            live(merged.requests).every((r) =>
                live(merged.collections).some((c) => c.id === r.collectionId)
            )
        ).toBe(true);
        expect(new Set(merged.requests.map((r) => r.id)).size).toBe(merged.requests.length);
    });

    it('is idempotent, so a repeated sign-in never grows the workspace', () => {
        const remote = workspace([col('R1', 'API', 100)], [req('RR1', 'Ping', 'R1', 100)]);
        const local = workspace([col('L1', 'API', 200)], [req('LR1', 'Pong', 'L1', 200)]);

        const first = mergeWorkspaces(remote, local).workspace;
        const again = mergeWorkspaces(first, first).workspace;
        const replayed = mergeWorkspaces(first, local).workspace;

        expect(again.collections).toHaveLength(first.collections.length);
        expect(again.requests).toHaveLength(first.requests.length);
        expect(replayed.requests).toHaveLength(first.requests.length);
    });
});

describe('delta pulls', () => {
    it('overlays by id, prefers the server on a tie and never clobbers newer local work', () => {
        const current = workspace(
            [],
            [req('X', 'Local', null, 100), req('Y', 'Untouched', null, 100)]
        );

        const tie = applyRemoteChanges(current, workspace([], [req('X', 'Server', null, 100)]));
        expect(tie.requests.find((r) => r.id === 'X')?.name).toBe('Server');
        expect(tie.requests.find((r) => r.id === 'Y')?.name).toBe('Untouched');
        expect(tie.requests).toHaveLength(2);

        const stale = applyRemoteChanges(current, workspace([], [req('X', 'Stale', null, 50)]));
        expect(stale.requests.find((r) => r.id === 'X')?.name).toBe('Local');
    });
});
