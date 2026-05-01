'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/auth.context';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import Link from 'next/link';
import {
  Clock, BookOpen, Brain, Users, Sparkles, Library,
  ChevronRight, TrendingUp, BookText,
  LayoutDashboard, FileEdit
} from 'lucide-react';
import {
  Button,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@org/ui-components';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export default function TeacherDashboardPage() {
  const { user, token, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({ totalCourses: 0, pendingDrafts: 0, totalSources: 0, newDrafts: 0, newSources: 0 });
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push('/login?returnUrl=/teacher/dashboard');
    } else if (user && user.role !== 'TEACHER') {
      router.push('/dashboard');
    }
  }, [user, isAuthLoading, router]);

  // Chargement des vraies stats
  const fetchStats = async () => {
    if (!token) return;
    try {
      const [coursesRes, draftsRes, sourcesRes] = await Promise.all([
        fetch(`${API_URL}/courses`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/ai/drafts`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/ai/content-sources`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const courses = coursesRes.ok ? await coursesRes.json() : [];
      const drafts = draftsRes.ok ? await draftsRes.json() : [];
      const sources = sourcesRes.ok ? await sourcesRes.json() : [];

      // On compte les drafts qui ne sont pas encore publiés
      const pendingDrafts = Array.isArray(drafts) ? drafts.filter((d: any) => d.status !== 'PUBLISHED' && d.status !== 'FAILED').length : 0;
      const totalCourses = Array.isArray(courses) ? courses.length : 0;
      const totalSources = Array.isArray(sources) ? sources.length : 0;

      // On compte uniquement les sources prêtes (indexées) pour les notifications
      const readySources = Array.isArray(sources) ? sources.filter((s: any) => s.indexingStatus === 'READY').length : 0;

      // Logique de badge "nombres non lus"
      const seenSources = parseInt(localStorage.getItem('seenReadySources') || '0');
      const seenDrafts = parseInt(localStorage.getItem('seenDraftsCount') || '0');

      setStats({
        totalCourses,
        pendingDrafts,
        totalSources,
        newDrafts: pendingDrafts > seenDrafts ? pendingDrafts - seenDrafts : 0,
        newSources: readySources > seenSources ? readySources - seenSources : 0,
      });
    } catch { /* silencieux */ } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();

    // Temps réel WebSocket : écoute globale pour le Dashboard
    if (!token) return;

    const socketUrl = API_URL.replace('/api', '');
    const socket = io(socketUrl, { transports: ['websocket'] });

    socket.on('connect', () => console.log('Dashboard connecté au WebSocket'));

    // Relance le calcul des badges si l'IA s'active
    socket.on('draft_progress', () => fetchStats());
    socket.on('source_indexed', () => fetchStats());

    return () => { socket.disconnect(); };
  }, [token]);

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
      title: 'Mes Brouillons IA',
      desc: `Revoyez et publiez les cours générés. ${stats.pendingDrafts > 0 ? `${stats.pendingDrafts} brouillon(s) en attente.` : 'Aucun brouillon en attente.'}`,
      icon: FileEdit,
      color: 'bg-amber-500',
      link: '/teacher/courses/drafts',
      badge: stats.pendingDrafts > 0 ? stats.pendingDrafts : undefined
    },
    {
      title: 'Mes Cours Publiés',
      desc: 'Gérez vos leçons, exercices et contenus pédagogiques.',
      icon: BookOpen,
      color: 'bg-emerald-500',
      link: '/courses'
    },
    {
      title: 'Ma Bibliothèque',
      desc: "Gérez vos PDFs, vidéos et liens web. Visualisez vos sources et suivez leur statut d'indexation.",
      icon: Library,
      color: 'bg-purple-500',
      link: '/teacher/library',
      badge: stats.newSources > 0 ? stats.newSources : undefined
    },
    {
      title: 'Suivi Élèves',
      desc: 'Analysez la progression et les performances de vos classes.',
      icon: Users,
      color: 'bg-slate-500',
      link: '#'
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-7xl mx-auto px-6 py-12 space-y-8">

        {/* Header Section */}
        <Card className="rounded-3xl">
          <CardContent className="p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
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
            <Badge variant="approved" className="px-4 py-2 text-xs uppercase rounded-full">
              Statut : Expert TechKids
            </Badge>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="rounded-3xl">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                <BookText className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Cours Publiés</p>
                <p className="text-2xl font-black">
                  {statsLoading ? <span className="animate-pulse">...</span> : stats.totalCourses}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                <FileEdit className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Brouillons en attente</p>
                <p className="text-2xl font-black">
                  {statsLoading ? <span className="animate-pulse">...</span> : stats.pendingDrafts}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Pipeline IA</p>
                <p className="text-2xl font-black text-emerald-500">Actif</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {features.map((item, idx) => (
            <Link
              key={idx}
              href={item.link}
              className={`group relative p-8 rounded-[2rem] border transition-all duration-300 overflow-hidden ${item.highlight
                ? 'bg-blue-500 border-blue-400 text-slate-950 shadow-xl shadow-blue-500/20 hover:scale-[1.02]'
                : 'bg-slate-900/50 backdrop-blur border-slate-800 hover:border-blue-500/40 text-slate-100 shadow-md hover:shadow-blue-500/10'
                }`}
            >
              {/* Badge "Nouveau" */}
              {item.highlight && (
                <div className="absolute top-0 right-0 p-4">
                  <div className="px-3 py-1 bg-white/20 backdrop-blur rounded-full text-[10px] font-black uppercase flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Nouveau
                  </div>
                </div>
              )}
              {/* Badge compteur */}
              {'badge' in item && item.badge && (
                <div className="absolute top-4 right-4 w-7 h-7 bg-red-500 text-white text-xs font-black rounded-full flex items-center justify-center shadow-lg">
                  {item.badge}
                </div>
              )}

              <div className="relative z-10 flex gap-6">
                <div className={`h-16 w-16 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:rotate-12 ${item.highlight ? 'bg-white/20' : `${item.color}/10`}`}>
                  <item.icon className={`h-8 w-8 ${item.highlight ? 'text-white' : `text-${item.color.split('-')[1]}-500`}`} />
                </div>

                <div className="flex-1 space-y-2">
                  <h3 className="text-xl font-bold">{item.title}</h3>
                  <p className={`text-sm ${item.highlight ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'}`}>
                    {item.desc}
                  </p>
                  <div className={`flex items-center gap-2 text-sm font-bold pt-2 ${item.highlight ? 'text-slate-900' : 'text-blue-500'}`}>
                    Accéder <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </div>

              {item.highlight && (
                <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-colors" />
              )}
            </Link>
          ))}
        </div>

        {/* Recent Activity */}
        <Card className="rounded-3xl">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" /> Activité Récente
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-primary normal-case tracking-normal font-medium text-sm">
                Voir tout
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-slate-400 italic">
              Aucune activité récente. Commencez par générer un cours avec l&apos;IA !
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
