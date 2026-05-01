'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Users, GraduationCap, UserPlus } from 'lucide-react';
import { useAuth } from '../../contexts/auth.context';
import { Button, Input, Label } from '@org/ui-components';

export default function RegisterPage() {
    const { register } = useAuth();
    const router = useRouter();
    const [role, setRole] = useState<'PARENT' | 'STUDENT'>('STUDENT');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await register(email, password, firstName, lastName, role);
            router.push(`/verify-email?email=${encodeURIComponent(email)}`);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Erreur d'inscription");
        } finally {
            setLoading(false);
        }
    };

    const roles = [
        { key: 'PARENT' as const, label: 'Parent', desc: "Je supervise mon enfant", Icon: Users },
        { key: 'STUDENT' as const, label: 'Étudiant', desc: "J'apprends par moi-même", Icon: GraduationCap },
    ];

    return (
        <>
            <div className="mb-6">
                <h1 className="text-xl font-bold text-white">Créer un compte</h1>
                <p className="text-sm text-dark-muted mt-1">Rejoignez TechKids Hub et commencez à apprendre.</p>
            </div>

            {error && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* Role selector */}
            <div className="grid grid-cols-2 gap-3 mb-5">
                {roles.map(({ key, label, desc, Icon }) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => setRole(key)}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200
                            ${role === key
                                ? 'border-primary bg-primary/10 text-white'
                                : 'border-dark-border bg-dark-input text-dark-muted hover:border-gray-600'
                            }`}
                    >
                        <Icon className={`w-6 h-6 ${role === key ? 'text-primary' : 'text-gray-500'}`} />
                        <div>
                            <p className="font-semibold text-sm">{label}</p>
                            <p className="text-xs opacity-70">{desc}</p>
                        </div>
                    </button>
                ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Prénom + Nom */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="firstName">Prénom</Label>
                        <Input
                            id="firstName"
                            type="text"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            placeholder="Mohammed"
                            required
                            className="bg-dark-input border-dark-border text-white placeholder-gray-600 focus:ring-primary/50 focus:border-primary"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="lastName">Nom</Label>
                        <Input
                            id="lastName"
                            type="text"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            placeholder="Benali"
                            required
                            className="bg-dark-input border-dark-border text-white placeholder-gray-600 focus:ring-primary/50 focus:border-primary"
                        />
                    </div>
                </div>

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
                        autoComplete="new-password"
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
                            <UserPlus className="w-4 h-4" />
                            Créer mon compte {role === 'PARENT' ? 'Parent' : 'Étudiant'}
                        </>
                    )}
                </Button>
            </form>

            <p className="text-center text-sm text-dark-muted mt-6">
                Déjà un compte ?{' '}
                <Link href="/login" className="text-primary hover:text-primary-hover font-medium transition-colors">
                    Se connecter
                </Link>
            </p>
        </>
    );
}
