'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, ShoppingCart, FlaskConical, Brain, LogOut, Zap, Shield, BookUser, Users, GraduationCap } from 'lucide-react';
import { useAuth } from '../../contexts/auth.context';

const roleConfig: Record<string, { label: string; Icon: React.ElementType; color: string }> = {
    ADMIN: { label: 'Admin', Icon: Shield, color: 'text-amber-400  bg-amber-400/10  border-amber-400/30' },
    TEACHER: { label: 'Teacher', Icon: BookUser, color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30' },
    PARENT: { label: 'Parent', Icon: Users, color: 'text-indigo-400  bg-indigo-400/10  border-indigo-400/30' },
    STUDENT: { label: 'Étudiant', Icon: GraduationCap, color: 'text-blue-400    bg-blue-400/10    border-blue-400/30' },
};

const features = [
    { Icon: BookOpen, title: 'Mes cours', desc: 'Gérez vos cours existants.', phase: 'Stable', link: '/courses' },
    { Icon: Brain, title: 'Générateur IA', desc: 'Créez des cours avec le RAG & GPT.', phase: 'Beta', link: '/dashboard/courses/generator' },
    { Icon: ShoppingCart, title: 'Boutique', desc: 'Phase 3 (E-Commerce)', phase: 'Phase 3' },
    { Icon: FlaskConical, title: 'Labo virtuel', desc: 'Phase 6 (Virtual Lab)', phase: 'Phase 6' },
];

export default function DashboardPage() {
    const { user, logout, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && !user) router.push('/login');
    }, [user, isLoading, router]);

    if (isLoading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <span className="spinner" />
            </div>
        );
    }

    const isTeacher = user.role === 'TEACHER';
    const role = roleConfig[user.role] ?? { label: user.role, Icon: Shield, color: 'text-gray-400 bg-gray-400/10 border-gray-400/30' };
    const RoleIcon = role.Icon;

    return (
        <div className="min-h-screen flex flex-col">
            {/* ... (Header remains the same) */}
            <header className="sticky top-0 z-10 border-b border-dark-border bg-dark-bg/80 backdrop-blur px-6 py-3">
                {/* (No change needed in header for now) */}
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                            <Zap className="w-4 h-4 text-white" fill="white" />
                        </div>
                        <span className="font-bold text-white text-sm">TechKids Hub</span>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${role.color}`}>
                            <RoleIcon className="w-3.5 h-3.5" />
                            {role.label}
                        </span>
                        <span className="text-sm text-dark-muted hidden sm:block">{user.email}</span>
                        <button
                            onClick={logout}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-white hover:bg-dark-border transition-all"
                        >
                            <LogOut className="w-3.5 h-3.5" />
                            Déconnexion
                        </button>
                    </div>
                </div>
            </header>

            {/* Main */}
            <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-10">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-white">
                        Bonjour, {user.firstName ? `${user.firstName} ${user.lastName ?? ''}`.trim() : user.email.split('@')[0]}
                    </h1>
                    <p className="text-dark-muted mt-1 text-sm">
                        {isTeacher ? "Prêt à créer votre prochain cours avec l'IA ?" : "Bienvenue sur votre espace TechKids !"}
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {features.map(({ Icon, title, desc, phase, link }) => (
                        <div
                            key={title}
                            onClick={() => link && router.push(link)}
                            className={`relative group bg-dark-card border border-dark-border rounded-2xl p-5 hover:border-primary/40 transition-all duration-200 ${link ? 'cursor-pointer hover:bg-white/5' : 'cursor-not-allowed opacity-50'}`}
                        >
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                                <Icon className="w-5 h-5 text-primary" />
                            </div>
                            <h3 className="font-semibold text-white text-sm mb-1">{title}</h3>
                            <p className="text-xs text-dark-muted">{desc}</p>
                            <span className="absolute top-3 right-3 text-xs px-2 py-0.5 rounded-full bg-dark-border text-gray-500 font-medium">
                                {phase}
                            </span>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}
