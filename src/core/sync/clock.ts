/**
 * Last-write-wins only works if every device agrees on what "later" means.
 * The server reports its own time on each sync, and the offset is applied to
 * every timestamp we stamp locally, so a device with a badly set clock cannot
 * pin its edits to the year 2035 and win every conflict forever.
 */

let skewMs = 0;

export function setClockSkew(ms: number): void {
    skewMs = Number.isFinite(ms) ? ms : 0;
}

export function getClockSkew(): number {
    return skewMs;
}

/** Measures skew from a server timestamp, compensating for round-trip latency. */
export function measureClockSkew(serverTime: string, requestStartedAt: number): number {
    const server = Date.parse(serverTime);
    if (Number.isNaN(server)) return skewMs;

    const roundTrip = Date.now() - requestStartedAt;
    const localAtServerTime = requestStartedAt + roundTrip / 2;
    return server - localAtServerTime;
}

/** Epoch milliseconds, corrected towards the server clock. */
export function syncNow(): number {
    return Date.now() + skewMs;
}

/**
 * Guarantees a strictly increasing stamp within a single tick, so two edits in
 * the same millisecond do not tie and get resolved arbitrarily.
 */
let lastStamp = 0;

export function stamp(): number {
    const now = syncNow();
    lastStamp = now > lastStamp ? now : lastStamp + 1;
    return lastStamp;
}
