import { API_URL } from '@/core/http/api';
import { clearLocalWorkspace, stopSync } from '@/core/sync/engine';
import { setSyncStatus } from '@/core/sync/status';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { clearToken, getToken, setToken } from './token';

export { getToken } from './token';

export interface AuthUser {
    uid: string;
    email: string;
    name: string;
    picture: string | null;
    provider: string;
}

export interface AuthState {
    user: AuthUser | null;
    loading: boolean;
    signInWithGoogle: () => void;
    signOut: () => Promise<boolean>;
}

interface DesktopBridge {
    signInWithGoogle: (authUrl: string) => Promise<string>;
}

function desktopBridge(): DesktopBridge | null {
    return (window as unknown as { reqlyDesktop?: DesktopBridge }).reqlyDesktop ?? null;
}

export const AuthContext = createContext<AuthState>({
    user: null,
    loading: true,
    signInWithGoogle: () => {},
    signOut: async () => true,
});

export function useAuth(): AuthState {
    return useContext(AuthContext);
}

export function useAuthState(): AuthState {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = getToken();
        if (!token) {
            setLoading(false);
            return;
        }

        fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
            .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Session expired'))))
            .then((data: { user: AuthUser }) => setUser(data.user))
            .catch(() => clearToken())
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        const apiOrigin = new URL(API_URL).origin;

        const handler = (event: MessageEvent) => {
            if (event.origin !== apiOrigin) return;

            const data = event.data as {
                type?: string;
                token?: string;
                user?: AuthUser;
            };

            if (data.type === 'auth-success' && data.token && data.user) {
                setToken(data.token);
                setUser(data.user);
            }
        };

        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, []);

    const signInWithGoogle = useCallback(() => {
        const bridge = desktopBridge();

        if (bridge) {
            const url = new URL(`${API_URL}/auth/google`);
            url.searchParams.set('mode', 'redirect');

            void bridge
                .signInWithGoogle(url.toString())
                .then(async (token) => {
                    setToken(token);
                    const res = await fetch(`${API_URL}/auth/me`, {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    if (!res.ok) throw new Error('Sign in failed');
                    const data = (await res.json()) as { user: AuthUser };
                    setUser(data.user);
                })
                .catch(() => clearToken());

            return;
        }

        const url = new URL(`${API_URL}/auth/google`);
        url.searchParams.set('mode', 'popup');
        url.searchParams.set('origin', window.location.origin);
        window.open(url.toString(), 'auth', 'popup,width=500,height=600');
    }, []);

    const signOut = useCallback(async () => {
        const flushed = await stopSync({ flush: true });

        if (flushed) clearLocalWorkspace();

        clearToken();
        setUser(null);
        setSyncStatus({ phase: 'local', error: null, pending: 0 });

        return flushed;
    }, []);

    return { user, loading, signInWithGoogle, signOut };
}
