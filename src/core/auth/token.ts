import { storageGet, storageRemove, storageSet } from '../storage';

const TOKEN_KEY = 'reqly:token';

export function getToken(): string | null {
    return storageGet<string>(TOKEN_KEY);
}

export function setToken(token: string): void {
    storageSet(TOKEN_KEY, token);
}

export function clearToken(): void {
    storageRemove(TOKEN_KEY);
}
