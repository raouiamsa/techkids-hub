'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock, LogIn, MailWarning } from 'lucide-react';
import { useAuth } from '../../contexts/auth.context';
import { Button, Input, Label } from '@org/ui-components';

export default function LoginPage() {
    const { login } = useAuth();
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [unverifiedEmail, setUnverifiedEmail] = useState('');
    const [loading, setLoading] = useState(false);

    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const returnUrl = searchParams?.get('returnUrl');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setUnverifiedEmail('');
        setLoading(true);
        try {
            await login(email, password);

            // On attend un tout petit peu pour que le state du AuthContext se mette à jour avec le "user"
            setTimeout(() => {
                const storedUser = localStorage.getItem('tk_user');
                const userObj = storedUser ? JSON.parse(storedUser) : null;

                if (returnUrl) {
                    router.push(returnUrl);
                } else if (userObj?.role === 'STUDENT') {
                    router.push('/student/dashboard');
                } else if (userObj?.role === 'PARENT') {
                    router.push('/parent/dashboard');
                } else if (userObj?.role === 'TEACHER') {
                    router.push('/teacher/dashboard');
                } else if (userObj?.role === 'ADMIN') {
                    router.push('/admin/dashboard');
                } else {
                    router.push('/');
                }
            }, 100);

        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Erreur de connexion';
            if (msg.toLowerCase().includes('vérifier votre email')) {
                setUnverifiedEmail(email);
            } else {
                setError(msg);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                    <Lock className="w-5 h-5 text-primary" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-white">Connexion</h1>
                    <p className="text-sm text-dark-muted">Bienvenue ! Entrez vos identifiants.</p>
                </div>
            </div>

            {/* Erreur générique */}
            {error && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* Cas spécial : email non vérifié */}
            {unverifiedEmail && (
                <div className="mb-4 px-4 py-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-sm space-y-3">
                    <div className="flex items-center gap-2 font-semibold">
                        <MailWarning className="w-5 h-5 text-yellow-400" />
                        Votre email n&apos;est pas encore vérifié
                    </div>
                    <p className="text-yellow-400/80">
                        Un code de vérification a été envoyé à <strong>{unverifiedEmail}</strong>.<br />
                        Vérifiez votre boîte mail et entrez le code pour activer votre compte.
                    </p>
                    <Button
                        onClick={() => router.push(`/verify-email?email=${encodeURIComponent(unverifiedEmail)}`)}
                        className="w-full bg-yellow-500 hover:bg-yellow-400 text-black rounded-xl font-semibold text-sm normal-case tracking-normal"
                    >
                        Vérifier mon email →
                    </Button>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                    <Label htmlFor="email">Adresse email</Label>
                    <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="vous@exemple.com"
                        required
                        autoComplete="email"
                        className="bg-dark-input border-dark-border text-white placeholder-gray-600 focus:ring-primary/50 focus:border-primary"
                    />
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="password">Mot de passe</Label>
                    <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        autoComplete="current-password"
                        className="bg-dark-input border-dark-border text-white placeholder-gray-600 focus:ring-primary/50 focus:border-primary"
                    />
                </div>

                <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary hover:bg-primary-hover shadow-lg shadow-primary/25 mt-2 normal-case tracking-normal font-semibold text-sm rounded-xl h-11"
                >
                    {loading ? (
                        <span className="spinner" />
                    ) : (
                        <>
                            <LogIn className="w-4 h-4" />
                            Se connecter
                        </>
                    )}
                </Button>
            </form>

            <p className="text-center text-sm text-dark-muted mt-6">
                Pas encore de compte ?{' '}
                <Link href="/register" className="text-primary hover:text-primary-hover font-medium transition-colors">
                    Créer un compte
                </Link>
            </p>
        </>
    );
}
