import { ApiError } from '@/core/http/api';
import { useCollectionsStore } from '@/modules/request/_store/collections';
import { useTabsStore } from '@/modules/request/_store/tabs';
import { useVariablesStore } from '@/modules/request/_store/variables';
import { pullWorkspace, pushWorkspace } from './api';
import { setClockSkew } from './clock';
import { applyRemoteChanges, mergeWorkspaces } from './merge';
import { useSyncMetaStore } from './meta';
import { setSyncStatus, useSyncStatusStore } from './status';
import { useTombstonesStore } from './tombstones';
import type { EntityKind, Workspace } from './types';
import { isEmptyWorkspace, versionKey, workspaceSize } from './types';
import { buildCollectionTree, buildVariables, flattenWorkspace } from './workspace';

/**
 * The sync engine.
 *
 * Invariant every mutation must uphold: **any change to a collection, request
 * or variable refreshes that entity's `updatedAt`.** The engine decides what to
 * upload by comparing each entity's `updatedAt` against the last value the
 * server acknowledged, so an edit that forgets to bump it is an edit that never
 * leaves the device.
 *
 * Lifecycle:
 *   sign in  -> full pull, merge, apply, push whatever the server is missing
 *   editing  -> debounced delta push of only the entities that changed
 *   focus    -> delta pull, so a second device shows up without a reload
 *   sign out -> flush first, then clear the workspace from this device
 */

const PUSH_DEBOUNCE_MS = 900;
/** Ceiling on how long continuous typing can hold a change back. */
const PUSH_MAX_WAIT_MS = 4_000;
const POLL_INTERVAL_MS = 60_000;
const RETRY_BASE_MS = 2_000;
const RETRY_MAX_MS = 60_000;

interface PersistApi {
    persist: {
        hasHydrated: () => boolean;
        onFinishHydration: (callback: () => void) => () => void;
    };
}

function whenHydrated(store: PersistApi): Promise<void> {
    if (store.persist.hasHydrated()) return Promise.resolve();
    return new Promise((resolve) => {
        const unsubscribe = store.persist.onFinishHydration(() => {
            unsubscribe();
            resolve();
        });
    });
}

function hydrateStores(): Promise<unknown> {
    return Promise.all([
        whenHydrated(useCollectionsStore as unknown as PersistApi),
        whenHydrated(useVariablesStore as unknown as PersistApi),
        whenHydrated(useTabsStore as unknown as PersistApi),
        whenHydrated(useTombstonesStore as unknown as PersistApi),
        whenHydrated(useSyncMetaStore as unknown as PersistApi),
    ]);
}

/**
 * A deleted entity still lives in the tombstone store, so the pushable view of
 * the workspace is the live tree plus its tombstones. If an id somehow appears
 * in both, the newer stamp wins — that is an undo, and undo must not resurrect
 * a delete that already went out.
 */
function unionWithTombstones<T extends { id: string; updatedAt: number }>(
    live: T[],
    dead: T[]
): T[] {
    const byId = new Map(live.map((row) => [row.id, row]));

    for (const row of dead) {
        const existing = byId.get(row.id);
        if (!existing || row.updatedAt > existing.updatedAt) byId.set(row.id, row);
    }

    return [...byId.values()];
}

function currentWorkspace(): Workspace {
    const live = flattenWorkspace(
        useCollectionsStore.getState().collections,
        useVariablesStore.getState().variables
    );
    const dead = useTombstonesStore.getState().toWorkspace();

    return {
        collections: unionWithTombstones(live.collections, dead.collections),
        requests: unionWithTombstones(live.requests, dead.requests),
        variables: unionWithTombstones(live.variables, dead.variables),
    };
}

function pendingChanges(workspace: Workspace): Workspace {
    const { versions } = useSyncMetaStore.getState();

    const unsynced = <T extends { id: string; updatedAt: number }>(kind: EntityKind, rows: T[]) =>
        rows.filter((row) => versions[versionKey(kind, row.id)] !== row.updatedAt);

    return {
        collections: unsynced('collection', workspace.collections),
        requests: unsynced('request', workspace.requests),
        variables: unsynced('variable', workspace.variables),
    };
}

function liveVersionKeys(workspace: Workspace): Set<string> {
    return new Set([
        ...workspace.collections.map((row) => versionKey('collection', row.id)),
        ...workspace.requests.map((row) => versionKey('request', row.id)),
        ...workspace.variables.map((row) => versionKey('variable', row.id)),
    ]);
}

class SyncEngine {
    private stopped = false;
    /** False until the sign-in pull+merge has succeeded at least once. */
    private reconciled = false;
    /** Guards the store subscriptions while the engine writes to them. */
    private applying = false;
    private queue: Promise<unknown> = Promise.resolve();
    private disposers: Array<() => void> = [];
    private debounceTimer: ReturnType<typeof setTimeout> | null = null;
    private maxWaitTimer: ReturnType<typeof setTimeout> | null = null;
    private retryTimer: ReturnType<typeof setTimeout> | null = null;
    private retryAttempt = 0;

    constructor(
        private readonly uid: string,
        private readonly onUnauthorized: () => void
    ) {}

    async start(): Promise<void> {
        await hydrateStores();
        if (this.stopped) return;

        const meta = useSyncMetaStore.getState();

        // Bookkeeping from a different account says nothing about this one. The
        // tombstones survive: they describe local deletions that still have to
        // be honoured wherever the data ends up.
        if (meta.uid !== this.uid) meta.reset(this.uid);

        setClockSkew(meta.clockSkewMs);
        setSyncStatus({ phase: 'merging', error: null });

        await this.enqueue(() => this.reconcile());

        if (this.stopped) return;

        this.watchStores();
        this.watchWindow();
    }

    /** Full pull + merge + push. Runs once per sign-in. */
    private async reconcile(): Promise<void> {
        try {
            const remote = await pullWorkspace();
            if (this.stopped) return;

            this.adoptClock(remote.skewMs);

            const outcome = mergeWorkspaces(remote.workspace, currentWorkspace());

            this.applyWorkspace(outcome.workspace);
            useTabsStore.getState().remapLinks(outcome.collectionRemap, outcome.requestRemap);

            const meta = useSyncMetaStore.getState();
            // Everything the server sent is, by definition, already on the
            // server. Recording it first means the push below carries only what
            // originated here.
            meta.markSynced(remote.workspace, Date.now());
            meta.setCursor(remote.cursor);

            setSyncStatus({ lastMerge: outcome.report });
            this.reconciled = true;

            await this.pushPending();
        } catch (error) {
            this.handleFailure(error);
        }
    }

    private adoptClock(skewMs: number): void {
        setClockSkew(skewMs);
        useSyncMetaStore.getState().setClockSkew(skewMs);
    }

    private applyWorkspace(workspace: Workspace): void {
        this.applying = true;
        try {
            useCollectionsStore
                .getState()
                .applySynced(buildCollectionTree(workspace.collections, workspace.requests));
            useVariablesStore.getState().applySynced(buildVariables(workspace.variables));
        } finally {
            this.applying = false;
        }
    }

    private async pushPending(): Promise<void> {
        if (this.stopped) return;

        const workspace = currentWorkspace();
        const pending = pendingChanges(workspace);
        const count = workspaceSize(pending);

        useSyncMetaStore.getState().pruneVersions(liveVersionKeys(workspace));

        if (count === 0) {
            setSyncStatus({
                phase: 'synced',
                pending: 0,
                error: null,
                lastSyncedAt: useSyncMetaStore.getState().lastSyncedAt,
            });
            return;
        }

        setSyncStatus({ phase: 'syncing', pending: count });

        const result = await pushWorkspace(pending);
        if (this.stopped) return;

        this.adoptClock(result.skewMs);

        const meta = useSyncMetaStore.getState();
        meta.markSynced(pending, Date.now());
        meta.setCursor(result.cursor);

        // Whatever went out has been answered for, whether it was applied or
        // overruled, so its tombstone has done its job.
        useTombstonesStore.getState().forget({
            collections: pending.collections.map((row) => row.id),
            requests: pending.requests.map((row) => row.id),
            variables: pending.variables.map((row) => row.id),
        });

        if (!isEmptyWorkspace(result.conflicts)) {
            this.applyWorkspace(applyRemoteChanges(currentWorkspace(), result.conflicts));
            meta.markSynced(result.conflicts, Date.now());
        }

        this.retryAttempt = 0;
        setSyncStatus({
            phase: 'synced',
            pending: 0,
            error: null,
            lastSyncedAt: Date.now(),
        });
    }

    private async pullDelta(): Promise<void> {
        if (this.stopped) return;

        const { cursor } = useSyncMetaStore.getState();
        if (!cursor) return;

        try {
            const remote = await pullWorkspace(cursor);
            if (this.stopped) return;

            this.adoptClock(remote.skewMs);

            const meta = useSyncMetaStore.getState();
            meta.setCursor(remote.cursor);

            if (isEmptyWorkspace(remote.workspace)) return;

            this.applyWorkspace(applyRemoteChanges(currentWorkspace(), remote.workspace));
            meta.markSynced(remote.workspace, Date.now());

            // A remote change may have superseded something still queued here.
            await this.pushPending();
        } catch (error) {
            this.handleFailure(error);
        }
    }

    private handleFailure(error: unknown): void {
        if (this.stopped) return;

        if (error instanceof ApiError && error.isUnauthorized) {
            this.onUnauthorized();
            return;
        }

        const offline = error instanceof ApiError && error.isOffline;
        setSyncStatus({
            phase: offline ? 'offline' : 'error',
            error: error instanceof Error ? error.message : 'Sync failed',
        });

        this.scheduleRetry();
    }

    private scheduleRetry(): void {
        if (this.retryTimer || this.stopped) return;

        const delay = Math.min(RETRY_BASE_MS * 2 ** this.retryAttempt, RETRY_MAX_MS);
        this.retryAttempt += 1;

        this.retryTimer = setTimeout(() => {
            this.retryTimer = null;
            // A failed sign-in must retry the merge, not just the upload: pushing
            // before the account has been read would leave the cloud collections
            // missing from this device until the next reload.
            const task = this.reconciled ? () => this.pushPending() : () => this.reconcile();
            void this.enqueue(task).catch((error: unknown) => this.handleFailure(error));
        }, delay);
    }

    /** Serialises every network operation; overlapping pushes would race. */
    private enqueue<T>(task: () => Promise<T>): Promise<T> {
        const result = this.queue.then(task);
        this.queue = result.then(
            () => undefined,
            () => undefined
        );
        return result;
    }

    schedulePush(): void {
        if (this.stopped) return;

        setSyncStatus({ pending: workspaceSize(pendingChanges(currentWorkspace())) });

        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => this.firePush(), PUSH_DEBOUNCE_MS);

        // Without a ceiling, a long typing session would never reach the server.
        if (!this.maxWaitTimer) {
            this.maxWaitTimer = setTimeout(() => this.firePush(), PUSH_MAX_WAIT_MS);
        }
    }

    private firePush(): void {
        this.clearPushTimers();
        void this.enqueue(() => this.pushPending()).catch((error: unknown) =>
            this.handleFailure(error)
        );
    }

    private clearPushTimers(): void {
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        if (this.maxWaitTimer) clearTimeout(this.maxWaitTimer);
        this.debounceTimer = null;
        this.maxWaitTimer = null;
    }

    /** Pushes immediately and reports whether the workspace is fully uploaded. */
    async flush(): Promise<boolean> {
        this.clearPushTimers();

        try {
            await this.enqueue(() => this.pushPending());
            return workspaceSize(pendingChanges(currentWorkspace())) === 0;
        } catch (error) {
            this.handleFailure(error);
            return false;
        }
    }

    private watchStores(): void {
        const onChange = () => {
            if (this.applying) return;
            this.schedulePush();
        };

        this.disposers.push(
            useCollectionsStore.subscribe((state, previous) => {
                if (state.collections !== previous.collections) onChange();
            }),
            useVariablesStore.subscribe((state, previous) => {
                if (state.variables !== previous.variables) onChange();
            }),
            useTombstonesStore.subscribe(onChange)
        );
    }

    private watchWindow(): void {
        const poll = () => void this.enqueue(() => this.pullDelta());

        const onFocus = () => {
            if (document.visibilityState === 'visible') poll();
        };
        const onOnline = () => {
            this.retryAttempt = 0;
            poll();
            this.schedulePush();
        };

        const interval = setInterval(poll, POLL_INTERVAL_MS);
        window.addEventListener('focus', onFocus);
        window.addEventListener('online', onOnline);
        document.addEventListener('visibilitychange', onFocus);

        this.disposers.push(() => {
            clearInterval(interval);
            window.removeEventListener('focus', onFocus);
            window.removeEventListener('online', onOnline);
            document.removeEventListener('visibilitychange', onFocus);
        });
    }

    async stop(options: { flush: boolean }): Promise<boolean> {
        for (const dispose of this.disposers) dispose();
        this.disposers = [];
        this.clearPushTimers();

        if (this.retryTimer) {
            clearTimeout(this.retryTimer);
            this.retryTimer = null;
        }

        const flushed = options.flush ? await this.flush() : true;
        this.stopped = true;
        return flushed;
    }
}

let engine: SyncEngine | null = null;
/**
 * Guards against a teardown that lands while `startSync` is still awaiting its
 * own cleanup — without it, React's development double-mount can leave an
 * orphaned engine running against a session that is already gone.
 */
let generation = 0;

export async function startSync(uid: string, onUnauthorized: () => void): Promise<void> {
    const token = ++generation;

    await teardown({ flush: false });
    if (token !== generation) return;

    const next = new SyncEngine(uid, onUnauthorized);
    engine = next;
    await next.start();
}

/**
 * Tears the engine down. Returns false when `flush` was requested and pending
 * changes could not be uploaded — the caller must then keep the local workspace
 * instead of clearing it, or those changes are gone for good.
 */
export async function stopSync(options: { flush: boolean }): Promise<boolean> {
    generation += 1;
    return teardown(options);
}

async function teardown(options: { flush: boolean }): Promise<boolean> {
    if (!engine) return true;

    const current = engine;
    engine = null;
    return current.stop(options);
}

/** Wipes every trace of the account's workspace from this device. */
export function clearLocalWorkspace(): void {
    useCollectionsStore.getState().clearCollections();
    useVariablesStore.getState().clearVariables();
    useTabsStore.getState().clearTabs();
    useTombstonesStore.getState().clear();
    useSyncMetaStore.getState().reset(null);
    useSyncStatusStore.getState().reset();
}
