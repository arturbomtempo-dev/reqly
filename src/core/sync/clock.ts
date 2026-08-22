let skewMs = 0;

export function setClockSkew(ms: number): void {
    skewMs = Number.isFinite(ms) ? ms : 0;
}

export function getClockSkew(): number {
    return skewMs;
}

export function measureClockSkew(serverTime: string, requestStartedAt: number): number {
    const server = Date.parse(serverTime);
    if (Number.isNaN(server)) return skewMs;

    const roundTrip = Date.now() - requestStartedAt;
    const localAtServerTime = requestStartedAt + roundTrip / 2;
    return server - localAtServerTime;
}

export function syncNow(): number {
    return Date.now() + skewMs;
}

let lastStamp = 0;

export function stamp(): number {
    const now = syncNow();
    lastStamp = now > lastStamp ? now : lastStamp + 1;
    return lastStamp;
}
