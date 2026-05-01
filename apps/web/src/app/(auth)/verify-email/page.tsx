'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Mail, RefreshCw, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@org/ui-components';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export default function VerifyEmailPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const email = searchParams.get('email') || '';

    const [digits, setDigits] = useState(['', '', '', '', '', '']);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [countdown, setCountdown] = useState(60);
    const [canResend, setCanResend] = useState(false);
    const inputs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        inputs.current[0]?.focus();
    }, []);

    useEffect(() => {
        if (countdown <= 0) { setCanResend(true); return; }
        const t = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(t);
    }, [countdown]);

    const handleChange = (i: number, val: string) => {
        const d = val.replace(/\D/g, '').slice(-1);
        const next = [...digits];
        next[i] = d;
        setDigits(next);
        if (d && i < 5) inputs.current[i + 1]?.focus();
    };

    const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (text.length === 6) {
            setDigits(text.split(''));
            inputs.current[5]?.focus();
        }
    };

    const handleVerify = async () => {
        const code = digits.join('');
        if (code.length < 6) { setError('Entrez les 6 chiffres du code.'); return; }
        setError(''); setLoading(true);
        try {
            const res = await fetch(`${API_URL}/auth/verify-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code }),
            });
            if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
            setSuccess(true);
            setTimeout(() => router.push('/login'), 2500);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Code invalide ou expiré.');
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        setError(''); setCanResend(false); setCountdown(60);
        try {
            const res = await fetch(`${API_URL}/auth/resend-verification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Erreur lors du renvoi.');
        }
    };

    if (success) {
        return (
            <div className="flex flex-col items-center gap-4 py-8">
                <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-green-400" />
                </div>
                <h2 className="text-xl font-bold text-white">Email vérifié !</h2>
                <p className="text-dark-muted text-sm text-center">Redirection vers la page de connexion…</p>
            </div>
        );
    }

    return (
        <>
            <div className="flex flex-col items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                    <Mail className="w-6 h-6 text-primary" />
                </div>
                <div className="text-center">
                    <h1 className="text-xl font-bold text-white">Vérification email</h1>
                    <p className="text-sm text-dark-muted mt-1">
                        Code envoyé à <span className="text-white font-medium">{email}</span>
                    </p>
                </div>
            </div>

            {error && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm text-center">
                    {error}
                </div>
            )}

            {/* OTP inputs — conservés tels quels (composant spécialisé) */}
            <div className="flex gap-2 justify-center mb-6" onPaste={handlePaste}>
                {digits.map((d, i) => (
                    <input
                        key={i}
                        ref={el => { inputs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={d}
                        onChange={e => handleChange(i, e.target.value)}
                        onKeyDown={e => handleKeyDown(i, e)}
                        className="otp-input"
                    />
                ))}
            </div>

            <Button
                onClick={handleVerify}
                disabled={loading || digits.join('').length < 6}
                className="w-full bg-primary hover:bg-primary-hover shadow-lg shadow-primary/25 normal-case tracking-normal font-semibold text-sm rounded-xl h-11"
            >
                {loading ? <span className="spinner" /> : <><ArrowRight className="w-4 h-4" /> Vérifier le code</>}
            </Button>

            <div className="text-center mt-4">
                {canResend ? (
                    <Button
                        variant="ghost"
                        onClick={handleResend}
                        className="mx-auto text-sm text-primary hover:text-primary-hover normal-case tracking-normal font-medium"
                    >
                        <RefreshCw className="w-4 h-4" /> Renvoyer un code
                    </Button>
                ) : (
                    <p className="text-sm text-dark-muted">
                        Renvoyer dans <span className="text-white font-medium">{countdown}s</span>
                    </p>
                )}
            </div>

            <p className="text-center text-sm text-dark-muted mt-6">
                <Link href="/login" className="text-primary hover:text-primary-hover font-medium transition-colors">
                    Retour à la connexion
                </Link>
            </p>
        </>
    );
}
