import { storageGet, storageSet } from '@/core/storage';
import { useState } from 'react';

export function usePersistedTab(key: string, defaultValue: string) {
    const [value, setValue] = useState(() => storageGet<string>(key) ?? defaultValue);

    const setPersistedValue = (next: string) => {
        setValue(next);
        storageSet(key, next);
    };

    return [value, setPersistedValue] as const;
}
