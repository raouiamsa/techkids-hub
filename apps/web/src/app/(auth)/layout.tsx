'use client';


import { Zap } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="w-full max-w-md animate-fade-in">
                {/* Logo */}
                <div className="flex items-center justify-center gap-2 mb-8">
                    <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
                        <Zap className="w-5 h-5 text-white" fill="white" />
                    </div>
                    <span className="text-xl font-bold text-white tracking-tight">TechKids</span>
                </div>

                {/* Card */}
                <div className="bg-dark-card border border-dark-border rounded-2xl p-8 shadow-2xl">
                    {children}
                </div>

                {/* Footer */}
                <p className="text-center text-xs text-dark-muted mt-6">
                    © 2026 TechKids Hub · Plateforme éducative
                </p>
            </div>
        </div>
    );
}
