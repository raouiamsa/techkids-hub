'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type UserRole = 'ADMIN' | 'TEACHER' | 'PARENT' | 'STUDENT';

export interface AuthUser {
    id: string;
    email: string;
    role: UserRole;
    firstName?: string;
    lastName?: string;
}

interface AuthContextValue {
    user: AuthUser | null;
    token: string | null;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string, firstName: string, lastName: string, role?: 'PARENT' | 'STUDENT') => Promise<void>;
    logout: () => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const stored = localStorage.getItem('tk_token');
        const storedUser = localStorage.getItem('tk_user');
        if (stored && storedUser && storedUser !== 'undefined' && storedUser !== 'null') {
            try {
                setToken(stored);
                setUser(JSON.parse(storedUser));
            } catch {
                localStorage.removeItem('tk_token');
                localStorage.removeItem('tk_user');
            }
        }
        setIsLoading(false);
    }, []);

    const login = async (email: string, password: string) => {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Identifiants incorrects');
        }

        const data = await res.json();
        const { access_token, user: userInfo } = data;

        localStorage.setItem('tk_token', access_token);
        localStorage.setItem('tk_user', JSON.stringify(userInfo));
        setToken(access_token);
        setUser(userInfo);
    };

    const register = async (email: string, password: string, firstName: string, lastName: string, role: 'PARENT' | 'STUDENT' = 'STUDENT') => {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, firstName, lastName, role }),
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || "Erreur d'inscription");
        }
        // Pas d'auto-login : l'utilisateur doit vérifier son email d'abord
    };

    const logout = () => {
        localStorage.removeItem('tk_token');
        localStorage.removeItem('tk_user');
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
    return ctx;
}
