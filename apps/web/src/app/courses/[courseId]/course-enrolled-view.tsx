'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/auth.context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BookOpen, ChevronRight, CheckCircle2, Lock, PlayCircle,
  ArrowLeft, Star, Trophy, BookText, AlertCircle
} from 'lucide-react';
import { Button } from '@org/ui-components';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

interface Module {
  id: string;
  title: string;
  order: number;
  content?: string;
  exercises?: Exercise[];
}

interface Exercise {
  id: string;
  title: string;
  instructions: string;
  exerciseType: 'QUIZ' | 'CIRCUIT_BUILD' | 'CODE_CHALLENGE';
}

interface Progression {
  moduleId: string;
  completionPercent: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
}

interface CourseViewProps {
  courseId: string;
  courseTitle: string;
  modules: Module[];
}

export function CourseEnrolledView({ courseId, courseTitle, modules }: CourseViewProps) {
  const { user, token } = useAuth();
  const router = useRouter();
  const [isEnrolled, setIsEnrolled] = useState<boolean | null>(null);
  const [progressions, setProgressions] = useState<Progression[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [isEnrolling, setIsEnrolling] = useState(false);

  useEffect(() => {
    if (!user || !token) {
      setIsEnrolled(false);
      setIsLoading(false);
      return;
    }

    async function checkEnrollment() {
      try {
        const [enrollRes, progRes] = await Promise.all([
          fetch(`${API_URL}/enrollments/my`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_URL}/progression/my`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (enrollRes.ok) {
          const enrollments = await enrollRes.json();
          const enrolled = enrollments.some((e: any) => e.courseId === courseId);
          setIsEnrolled(enrolled);
        } else {
          setIsEnrolled(false);
        }

        if (progRes.ok) {
          const progs = await progRes.json();
          setProgressions(progs.filter((p: any) => 
            modules.some(m => m.id === p.moduleId)
          ));
        }
      } catch {
        setIsEnrolled(false);
      } finally {
        setIsLoading(false);
      }
    }

    checkEnrollment();
  }, [user, token, courseId, modules]);

  const handleEnroll = async () => {
    if (!user) {
      router.push(`/login?returnUrl=/courses/${courseId}`);
      return;
    }
    if (user.role !== 'STUDENT' && user.role !== 'PARENT') {
      setEnrollError("Seuls les étudiants ou parents peuvent s'inscrire.");
      return;
    }
    setIsEnrolling(true);
    setEnrollError(null);
    try {
      const res = await fetch(`${API_URL}/enrollments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ courseId }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Erreur lors de l'inscription");
      }
      setIsEnrolled(true);
    } catch (err: any) {
      setEnrollError(err.message);
    } finally {
      setIsEnrolling(false);
    }
  };

  const getModuleProgress = (moduleId: string) => {
    return progressions.find(p => p.moduleId === moduleId);
  };

  // Nombre de modules complétés à 100% / nombre total de modules
  const completedModules = modules.filter(m => {
    const prog = progressions.find(p => p.moduleId === m.id);
    return prog?.completionPercent === 100 || prog?.status === 'COMPLETED';
  }).length;
  const overallProgress = modules.length > 0
    ? Math.round((completedModules / modules.length) * 100)
    : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  // ─── VIEW: NOT ENROLLED ───────────────────────────────────────────────────
  const hasAccess = isEnrolled || user?.role === 'TEACHER' || user?.role === 'ADMIN';

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center gap-6 py-8">
        <Button
          onClick={handleEnroll}
          disabled={isEnrolling}
          size="lg"
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all disabled:opacity-70 normal-case tracking-normal text-lg h-14 px-8"
        >
          {isEnrolling ? (
            <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
          ) : (
            <BookOpen className="h-5 w-5 mr-2" />
          )}
          {user ? "S'inscrire à ce cours" : "Se connecter pour s'inscrire"}
        </Button>

        {enrollError && (
          <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl flex items-start gap-3 max-w-sm">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
            <p className="text-red-700 dark:text-red-400 text-sm">{enrollError}</p>
          </div>
        )}
      </div>
    );
  }

  // ─── VIEW: ENROLLED ──────────────────────────────────────────────────────
  return (
    <div className="w-full space-y-8">
      {/* Overall Progress Bar */}
      {user?.role !== 'TEACHER' && user?.role !== 'ADMIN' && (
        <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl text-white shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-300" />
              <span className="font-semibold">Ta progression dans ce cours</span>
            </div>
            <span className="text-2xl font-extrabold">{overallProgress}%</span>
          </div>
          <div className="h-3 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-1000"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Modules List */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <BookText className="h-5 w-5 text-blue-500" />
          Modules du cours ({modules.length})
        </h2>

        {modules.length === 0 ? (
          <div className="p-8 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-slate-500">
            Les modules de ce cours sont en cours de rédaction.
          </div>
        ) : (
          <div className="space-y-3">
            {modules
              .sort((a, b) => a.order - b.order)
              .map((module, idx) => {
                const prog = getModuleProgress(module.id);
                const percent = prog?.completionPercent ?? 0;
                const status = prog?.status ?? 'NOT_STARTED';

                return (
                  <div
                    key={module.id}
                    className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden hover:shadow-md transition-shadow"
                  >
                    <div className="p-5 flex items-center gap-4">
                      {/* Status Icon */}
                      <div className="shrink-0">
                        {status === 'COMPLETED' ? (
                          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                        ) : status === 'IN_PROGRESS' ? (
                          <PlayCircle className="h-8 w-8 text-blue-500" />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-500">
                            {idx + 1}
                          </div>
                        )}
                      </div>

                      {/* Module Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-900 dark:text-white text-lg truncate">
                          {module.title}
                        </h3>
                        {module.content && (
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                            {module.content}
                          </p>
                        )}
                        {/* Mini Progress Bar */}
                        {percent > 0 && (
                          <div className="mt-2 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden max-w-xs">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Exercises count */}
                      {module.exercises && module.exercises.length > 0 && (
                        <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1 shrink-0">
                          <Star className="h-4 w-4" />
                          {module.exercises.length} exercice{module.exercises.length > 1 ? 's' : ''}
                        </div>
                      )}

                      {/* Arrow */}
                      <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all shrink-0" />
                    </div>

                    {/* Exercises Sub-list (collapsed by default, shown on hover or expanded) */}
                    {module.exercises && module.exercises.length > 0 && (
                      <div className="px-5 pb-5 pt-0 border-t border-slate-100 dark:border-slate-800 mt-0">
                        <div className="grid grid-cols-1 gap-2 mt-3">
                          {module.exercises.map((exercise) => (
                            <Link
                              key={exercise.id}
                              href={`/courses/${courseId}/modules/${module.id}/exercises/${exercise.id}`}
                              className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-sm font-medium text-slate-700 dark:text-slate-300"
                            >
                              <div className="h-6 w-6 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                                <Lock className="h-3 w-3 text-blue-500" />
                              </div>
                              {exercise.title}
                              <span className="ml-auto text-xs text-slate-400 uppercase tracking-wide">{exercise.exerciseType.replace('_', ' ')}</span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Go to Dashboard */}
      <div className="text-center pt-4">
        <Link
          href="/student/dashboard"
          className="text-sm text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Voir tout mon tableau de bord
        </Link>
      </div>
    </div>
  );
}
