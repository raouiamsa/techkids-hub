'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/auth.context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, Trophy, PlayCircle, CheckCircle2 } from 'lucide-react';
import { Button, Card, CardContent } from '@org/ui-components';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export default function StudentDashboardPage() {
  const { user, token, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();

  const [enrolledCourses, setEnrolledCourses] = useState<any[]>([]);
  const [learningProgressions, setLearningProgressions] = useState<any[]>([]);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push('/login?returnUrl=/student/dashboard');
    } else if (user && user.role !== 'STUDENT') {
      router.push('/');
    }
  }, [user, isAuthLoading, router]);

  useEffect(() => {
    if (!token) return;

    const fetchDashboardData = async () => {
      try {
        const [enrollRes, progRes] = await Promise.all([
          fetch(`${API_URL}/enrollments/my`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/progression/my`, { headers: { Authorization: `Bearer ${token}` } })
        ]);

        if (enrollRes.ok && progRes.ok) {
          setEnrolledCourses(await enrollRes.json());
          setLearningProgressions(await progRes.json());
        }
      } catch (error) {
        console.error("Erreur chargement dashboard", error);
      } finally {
        setIsLoadingDashboard(false);
      }
    };

    fetchDashboardData();
  }, [token]);

  if (isAuthLoading || isLoadingDashboard) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  // Calcul global : moyenne des taux de complétion par cours
  const totalCompletion = enrolledCourses.length > 0
    ? Math.round(
        enrolledCourses.reduce((acc, enrollment) => {
          const courseModules = enrollment.course?.modules ?? [];
          if (courseModules.length === 0) return acc;
          const completed = courseModules.filter((m: any) => {
            const prog = learningProgressions.find((p: any) => p.moduleId === m.id);
            return prog?.completionPercent === 100 || prog?.status === 'COMPLETED';
          }).length;
          return acc + Math.round((completed / courseModules.length) * 100);
        }, 0) / enrolledCourses.length
      )
    : 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header Dashboard */}
        <Card className="rounded-3xl">
          <CardContent className="p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                Bonjour, {user?.firstName || 'Étudiant'} ! 👋
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-2">
                Prêt à continuer votre apprentissage aujourd&apos;hui ?
              </p>
            </div>

            <div className="flex gap-4">
              <Card className="rounded-2xl border-blue-100 dark:border-blue-800/30 bg-blue-50 dark:bg-blue-900/20">
                <CardContent className="px-6 py-4 flex flex-col items-center">
                  <span className="text-blue-600 dark:text-blue-400 font-bold text-2xl">{enrolledCourses.length}</span>
                  <span className="text-sm text-slate-500 font-medium">Cours actifs</span>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border-emerald-100 dark:border-emerald-800/30 bg-emerald-50 dark:bg-emerald-900/20">
                <CardContent className="px-6 py-4 flex flex-col items-center">
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold text-2xl">{totalCompletion}%</span>
                  <span className="text-sm text-slate-500 font-medium">Complétion</span>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        {/* Mes Cours */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-blue-500" /> Mes Cours
            </h2>
            <Button variant="ghost" size="sm" asChild className="normal-case tracking-normal font-medium text-sm text-blue-600 dark:text-blue-400">
              <Link href="/courses">Voir d&apos;autres cours</Link>
            </Button>
          </div>

          {enrolledCourses.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl">
              <Trophy className="mx-auto h-12 w-12 text-slate-300 mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Aucun cours en cours</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-6 mt-2 max-w-sm mx-auto">
                Explorez le catalogue et choisissez votre première aventure d&apos;apprentissage !
              </p>
              <Button asChild className="rounded-xl shadow-lg">
                <Link href="/courses">Explorer le catalogue</Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {enrolledCourses.map((enrollment) => {
                const courseModules = enrollment.course?.modules ?? [];
                const completedCount = courseModules.filter((m: any) => {
                  const prog = learningProgressions.find((p: any) => p.moduleId === m.id);
                  return prog?.completionPercent === 100 || prog?.status === 'COMPLETED';
                }).length;
                const avgProgress = courseModules.length > 0
                  ? Math.round((completedCount / courseModules.length) * 100)
                  : 0;

                return (
                  <Card key={enrollment.id} className="group flex flex-col rounded-3xl overflow-hidden hover:shadow-md transition-shadow">
                    <CardContent className="p-6 flex-1 flex flex-col">
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 line-clamp-1">
                        {enrollment.course?.title || "Cours inconnu"}
                      </h3>
                      <p className="text-sm text-slate-500 mb-6">
                        Inscrit depuis le {new Date(enrollment.enrolledAt).toLocaleDateString('fr-FR')}
                      </p>

                      <div className="space-y-2 mt-auto">
                        <div className="flex justify-between text-sm font-medium">
                          <span className="text-slate-700 dark:text-slate-300">Progression</span>
                          <span className="text-blue-600 dark:text-blue-400">{avgProgress}%</span>
                        </div>
                        <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${avgProgress}%` }}
                          />
                        </div>
                      </div>

                      <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
                        <Button variant="outline" asChild className="w-full normal-case tracking-normal font-medium text-sm group-hover:bg-blue-600 group-hover:text-white group-hover:border-transparent">
                          <Link href={`/courses/${enrollment.courseId}`}>
                            {avgProgress === 100
                              ? <><CheckCircle2 className="h-4 w-4" /> Revoir le cours</>
                              : <><PlayCircle className="h-4 w-4" /> Continuer</>
                            }
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
