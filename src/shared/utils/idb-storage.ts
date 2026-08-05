import type { StateStorage } from 'zustand/middleware';

const DB_NAME = 'reqly';
const STORE_NAME = 'keyval';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }
    return dbPromise;
}

function withStore<T>(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
    return openDB().then(
        (db) =>
            new Promise<T>((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, mode);
                const req = run(tx.objectStore(STORE_NAME));
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            })
    );
}

export const idbStorage: StateStorage = {
    getItem: async (name) => {
        const value = await withStore<string | undefined>('readonly', (store) => store.get(name));
        if (value !== undefined) return value;

        try {
            const legacy = localStorage.getItem(name);
            if (legacy !== null) {
                await idbStorage.setItem(name, legacy);
                localStorage.removeItem(name);
                return legacy;
            }
        } catch {
            // localStorage unavailable or empty; nothing to migrate.
        }

        return null;
    },
    setItem: async (name, value) => {
        await withStore('readwrite', (store) => store.put(value, name));
    },
    removeItem: async (name) => {
        await withStore('readwrite', (store) => store.delete(name));
    },
};
