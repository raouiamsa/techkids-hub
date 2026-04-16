'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/auth.context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  BookOpen, Brain, Users, PlusCircle, Sparkles, Library,
  ChevronRight, TrendingUp, Clock, BookText, 
  Settings, LayoutDashboard
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export default function TeacherDashboardPage() {
  const { user, token, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({ totalCourses: 0, totalStudents: 0 });

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push('/login?returnUrl=/teacher/dashboard');
    } else if (user && user.role !== 'TEACHER') {
      router.push('/dashboard'); // Redirection vers le dashboard général si pas teacher
    }
  }, [user, isAuthLoading, router]);

  if (isAuthLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  const features = [
    {
      title: 'Générateur de Cours IA',
      desc: 'Créez un cours complet à partir de vos fichiers PDF en quelques secondes grâce au RAG.',
      icon: Brain,
      color: 'bg-blue-500',
      link: '/teacher/courses/generator',
      highlight: true
    },
    {
      title: 'Mes Cours',
      desc: 'Gérez vos leçons, exercices et contenus pédagogiques.',
      icon: BookOpen,
      color: 'bg-emerald-500',
      link: '/courses'
    },
    {
      title: 'Ma Bibliothèque',
      desc: 'Gérez vos PDFs, vidéos et liens web. Visualisez vos sources et suivez leur statut d\'indexation.',
      icon: Library,
      color: 'bg-purple-500',
      link: '/teacher/library'
    },
    {
      title: 'Suivi Élèves',
      desc: 'Analysez la progression et les performances de vos classes.',
      icon: Users,
      color: 'bg-amber-500',
      link: '#'
    },
    {
      title: 'Paramètres',
      desc: 'Configurez votre profil enseignant et vos préférences.',
      icon: Settings,
      color: 'bg-slate-500',
      link: '#'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="max-w-7xl mx-auto px-6 py-12 space-y-8">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl">
                <LayoutDashboard className="h-8 w-8 text-primary" />
              </div>
              Espace Enseignant
            </h1>
            <p className="text-slate-500 dark:text-slate-400">
              Bienvenue, {user.firstName || user.email.split('@')[0]} ! Prêt à inspirer les innovateurs de demain ?
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-4 py-2 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-full text-xs font-bold uppercase">
              Statut : Expert TechKids
            </div>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center">
              <BookText className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Vos Cours</p>
              <p className="text-2xl font-black">12</p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center">
              <Users className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Élèves Actifs</p>
              <p className="text-2xl font-black">156</p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Impact Score</p>
              <p className="text-2xl font-black">98%</p>
            </div>
          </div>
        </div>

        {/* Action Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {features.map((item, idx) => (
            <Link 
              key={idx}
              href={item.link}
              className={`group relative p-8 rounded-[2rem] border transition-all duration-300 overflow-hidden ${
                item.highlight 
                ? 'bg-primary dark:bg-blue-600 border-primary text-white shadow-xl shadow-blue-500/20 hover:scale-[1.02]' 
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-primary/40 text-slate-900 dark:text-slate-100'
              }`}
            >
              {item.highlight && (
                <div className="absolute top-0 right-0 p-4">
                   <div className="px-3 py-1 bg-white/20 backdrop-blur rounded-full text-[10px] font-black uppercase flex items-center gap-1">
                     <Sparkles className="w-3 h-3" /> Nouveau
                   </div>
                </div>
              )}
              
              <div className="relative z-10 flex gap-6">
                <div className={`h-16 w-16 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:rotate-12 ${
                   item.highlight ? 'bg-white/20' : `${item.color}/10`
                }`}>
                  <item.icon className={`h-8 w-8 ${item.highlight ? 'text-white' : `text-${item.color.split('-')[1]}-500`}`} />
                </div>
                
                <div className="flex-1 space-y-2">
                  <h3 className="text-xl font-bold">{item.title}</h3>
                  <p className={`text-sm ${item.highlight ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'}`}>
                    {item.desc}
                  </p>
                  <div className={`flex items-center gap-2 text-sm font-bold pt-2 ${item.highlight ? 'text-white' : 'text-primary'}`}>
                    Accéder <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </div>

              {item.highlight && (
                <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-colors"></div>
              )}
            </Link>
          ))}
        </div>

        {/* Recent Activity Placeholder */}
        <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8">
           <div className="flex items-center justify-between mb-6">
             <h2 className="text-xl font-bold flex items-center gap-2">
               <Clock className="w-5 h-5 text-primary" /> Activité Récente
             </h2>
             <button className="text-sm font-medium text-primary hover:underline">Voir tout</button>
           </div>
           <div className="text-center py-12 text-slate-400 italic">
             Aucune activité récente. Commencez par générer un cours avec l'IA !
           </div>
        </section>

      </div>
    </div>
  );
}
