'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/auth.context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Users, BookOpen, Trophy, TrendingUp, Clock,
  CheckCircle2, PlayCircle, BookText, ChevronRight, AlertCircle,
  UserPlus, X, Loader2, Trash2, PlusCircle
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

interface ChildProgression {
  moduleId: string;
  completionPercent: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  completedAt: string | null;
}

interface CourseModule {
  id: string;
  title: string;
  order: number;
}

interface Enrollment {
  id: string;
  courseId: string;
  enrolledAt: string;
  status: string;
  course: {
    id: string;
    title: string;
    level: string;
    modules: CourseModule[];
  };
}

interface Child {
  id: string;
  email: string;
  profile: { firstName: string; lastName: string; avatar: string | null } | null;
  enrollments: Enrollment[];
  progressions: ChildProgression[];
}

interface CourseOption {
  id: string;
  title: string;
  description: string;
  level: string;
}

const levelColors: Record<string, string> = {
  BEGINNER: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  INTERMEDIATE: 'text-blue-600 bg-blue-50 border-blue-200',
  ADVANCED: 'text-purple-600 bg-purple-50 border-purple-200',
};

const levelLabels: Record<string, string> = {
  BEGINNER: 'Débutant',
  INTERMEDIATE: 'Intermédiaire',
  ADVANCED: 'Avancé',
};

function getChildDisplayName(child: Child): string {
  if (child.profile?.firstName && child.profile?.lastName) {
    return `${child.profile.firstName} ${child.profile.lastName}`;
  }
  return child.email.split('@')[0];
}

function getCourseProgress(enrollment: Enrollment, progressions: ChildProgression[]): number {
  const modules = enrollment.course?.modules ?? [];
  if (modules.length === 0) return 0;
  const completed = modules.filter(m => {
    const prog = progressions.find(p => p.moduleId === m.id);
    return prog?.completionPercent === 100 || prog?.status === 'COMPLETED';
  }).length;
  return Math.round((completed / modules.length) * 100);
}

function getOverallProgress(child: Child): number {
  if (child.enrollments.length === 0) return 0;
  const total = child.enrollments.reduce((acc, enr) => {
    return acc + getCourseProgress(enr, child.progressions);
  }, 0);
  return Math.round(total / child.enrollments.length);
}

export default function ParentDashboardPage() {
  const { user, token, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();

  const [children, setChildren] = useState<Child[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  // Add child form
  const [showAddForm, setShowAddForm] = useState(false);
  const [childEmail, setChildEmail] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Enroll form
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push('/login?returnUrl=/parent/dashboard');
    } else if (user && user.role !== 'PARENT') {
      router.push('/');
    }
  }, [user, isAuthLoading, router]);

  useEffect(() => {
    if (!token) return;

    async function fetchChildren() {
      try {
        const res = await fetch(`${API_URL}/parent/children`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Impossible de charger vos enfants');
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setChildren(list);
        if (list.length > 0) setSelectedChildId(list[0].id);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoadingData(false);
      }
    }
    fetchChildren();

    // Fetch available courses
    fetch(`${API_URL}/courses`)
      .then(res => res.json())
      .then(data => setCourses(data))
      .catch(err => console.error("Error fetching courses", err));
  }, [token]);

  async function handleAddChild(e: React.FormEvent) {
    e.preventDefault();
    if (!childEmail.trim()) return;
    setIsAdding(true);
    setAddError(null);
    setAddSuccess(null);
    try {
      const res = await fetch(`${API_URL}/parent/children/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: childEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erreur inconnue');
      setAddSuccess(data.message);
      setChildEmail('');
      // Refresh children list
      const refreshed = await fetch(`${API_URL}/parent/children`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (refreshed.ok) {
        const list = await refreshed.json();
        setChildren(Array.isArray(list) ? list : []);
        if (Array.isArray(list) && list.length > 0 && !selectedChildId) setSelectedChildId(list[0].id);
      }
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setIsAdding(false);
    }
  }

  async function handleRemoveChild(childId: string) {
    if (!confirm('Voulez-vous vraiment supprimer le lien avec cet enfant ?')) return;
    setRemovingId(childId);
    try {
      const res = await fetch(`${API_URL}/parent/children/${childId}/remove`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Erreur lors de la suppression');
      const updated = children.filter(c => c.id !== childId);
      setChildren(updated);
      if (selectedChildId === childId) setSelectedChildId(updated[0]?.id ?? null);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRemovingId(null);
    }
  }

  async function handleEnrollChild(courseId: string) {
    if (!selectedChildId) return;
    setIsEnrolling(true);
    try {
      const res = await fetch(`${API_URL}/parent/children/${selectedChildId}/enrollments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ courseId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erreur lors de l\'inscription');
      
      // Refresh children list to get new enrollment
      const refreshed = await fetch(`${API_URL}/parent/children`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (refreshed.ok) {
        const list = await refreshed.json();
        setChildren(Array.isArray(list) ? list : []);
      }
      setShowEnrollModal(false);
      alert('Inscription réussie !');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsEnrolling(false);
    }
  }

  if (isAuthLoading || isLoadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  const safeChildren = Array.isArray(children) ? children : [];
  const selectedChild = safeChildren.find(c => c.id === selectedChildId) ?? null;
  const totalActiveCourses = selectedChild?.enrollments.length ?? 0;
  const overallProgress = selectedChild ? getOverallProgress(selectedChild) : 0;
  const completedCourses = selectedChild?.enrollments.filter(
    enr => getCourseProgress(enr, selectedChild.progressions) === 100
  ).length ?? 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 dark:from-slate-950 dark:to-indigo-950/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* Header */}
        <header className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                  <Users className="h-5 w-5 text-white" />
                </div>
                Tableau de bord Parent
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-2">
                Bonjour {user?.email.split('@')[0]} 👋 — Suivez la progression de vos enfants
              </p>
            </div>
            <Link
              href="/courses"
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow transition-colors"
            >
              <BookOpen className="h-4 w-4" />
              Explorer les cours
            </Link>
          </div>
        </header>

        {/* Error */}
        {error && (
          <div className="p-5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
            <p className="text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Grid Container (Always render sidebar!) */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* ─── Left Sidebar: Children List & Add Form ─── */}
          <aside className="lg:col-span-1 space-y-4">
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
              Mes enfants
            </h2>
          {/* Add Child Button */}
          <button
            onClick={() => { setShowAddForm(!showAddForm); setAddError(null); setAddSuccess(null); }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl border-2 border-dashed border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-sm font-semibold transition-colors"
          >
            <UserPlus className="h-4 w-4" />
            Ajouter un enfant
          </button>

          {/* Add Child Form */}
          {showAddForm && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-indigo-200 dark:border-indigo-800 p-4 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Lier un enfant</h3>
              <form onSubmit={handleAddChild} className="space-y-2">
                <input
                  type="email"
                  value={childEmail}
                  onChange={e => setChildEmail(e.target.value)}
                  placeholder="Email de l'enfant"
                  required
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={isAdding || !childEmail.trim()}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  {isAdding ? 'Ajout...' : 'Ajouter'}
                </button>
              </form>
              {addError && (
                <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                  <X className="h-3 w-3" /> {addError}
                </p>
              )}
              {addSuccess && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> {addSuccess}
                </p>
              )}
            </div>
          )}
              {safeChildren.map(child => {
                const prog = getOverallProgress(child);
                const isSelected = child.id === selectedChildId;
                return (
                  <div key={child.id} className="relative group">
                    <button
                      onClick={() => setSelectedChildId(child.id)}
                      className={`w-full text-left p-4 rounded-2xl border transition-all ${
                        isSelected
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300 hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-lg shrink-0 ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600'
                        }`}>
                          {getChildDisplayName(child)[0].toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`font-semibold truncate ${isSelected ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                            {getChildDisplayName(child)}
                          </p>
                          <p className={`text-sm ${isSelected ? 'text-indigo-200' : 'text-slate-500'}`}>
                            {child.enrollments.length} cours • {prog}% global
                          </p>
                        </div>
                      </div>
                      {/* Mini progress bar */}
                      <div className={`mt-3 h-1.5 rounded-full overflow-hidden ${isSelected ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800'}`}>
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${isSelected ? 'bg-white' : 'bg-indigo-500'}`}
                          style={{ width: `${prog}%` }}
                        />
                      </div>
                    </button>
                    {/* Remove button */}
                    <button
                      onClick={() => handleRemoveChild(child.id)}
                      disabled={removingId === child.id}
                      title="Supprimer le lien"
                      className="absolute top-2 right-2 h-6 w-6 rounded-full bg-red-100 dark:bg-red-900/30 text-red-500 hover:bg-red-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      {removingId === child.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    </button>
                  </div>
                );
              })}
            </aside>

            {/* ─── Right: Selected Child Detail or Empty State ─── */}
            <div className="lg:col-span-3">
              {safeChildren.length === 0 ? (
                <div className="text-center bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-3xl py-20 px-8 h-full flex flex-col justify-center">
                  <Users className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Aucun enfant lié à votre compte</h2>
                  <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    Utilisez le bouton <b>"Ajouter un enfant"</b> dans la barre latérale pour lier le compte de votre enfant (avec son adresse email).
                  </p>
                </div>
              ) : selectedChild ? (
                <div className="space-y-6">
                {/* KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                      <BookOpen className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalActiveCourses}</p>
                      <p className="text-sm text-slate-500">Cours inscrits</p>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                      <Trophy className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">{overallProgress}%</p>
                      <p className="text-sm text-slate-500">Progression globale</p>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center">
                      <CheckCircle2 className="h-6 w-6 text-violet-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">{completedCourses}</p>
                      <p className="text-sm text-slate-500">Cours terminés</p>
                    </div>
                  </div>
                </div>

                {/* Progress Banner */}
                <div className="p-6 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-3xl text-white shadow-xl">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-indigo-200" />
                      <span className="font-semibold">Progression de {selectedChild.profile?.firstName ?? selectedChild.email.split('@')[0]}</span>
                    </div>
                    <span className="text-2xl font-extrabold">{overallProgress}%</span>
                  </div>
                  <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white rounded-full transition-all duration-1000"
                      style={{ width: `${overallProgress}%` }}
                    />
                  </div>
                  <p className="text-indigo-200 text-sm mt-2">
                    {completedCourses} cours terminé{completedCourses > 1 ? 's' : ''} sur {totalActiveCourses}
                  </p>
                </div>

                {/* Courses Header & Enroll Button */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <BookText className="h-5 w-5 text-indigo-500" />
                    Cours en cours
                  </h3>
                  <button
                    onClick={() => setShowEnrollModal(true)}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold rounded-xl flex items-center gap-2 transition-colors shadow-sm"
                  >
                    <PlusCircle className="h-4 w-4" />
                    Inscrire à un cours
                  </button>
                </div>

                {/* Enrollment Modal */}
                {showEnrollModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
                      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Inscrire {getChildDisplayName(selectedChild)} à un cours</h3>
                        <button onClick={() => setShowEnrollModal(false)} className="text-slate-400 hover:text-slate-500">
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                      <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
                        {courses.length === 0 ? (
                          <p className="text-slate-500 text-center py-4">Aucun cours disponible.</p>
                        ) : courses.map(course => {
                          const isAlreadyEnrolled = selectedChild.enrollments.some(e => e.courseId === course.id);
                          return (
                            <div key={course.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
                              <div>
                                <h4 className="font-bold text-slate-900 dark:text-white">{course.title}</h4>
                                <p className="text-sm text-slate-500 line-clamp-1">{course.description}</p>
                              </div>
                              <button
                                onClick={() => handleEnrollChild(course.id)}
                                disabled={isAlreadyEnrolled || isEnrolling}
                                className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                                  isAlreadyEnrolled 
                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                                }`}
                              >
                                {isEnrolling ? <Loader2 className="h-4 w-4 animate-spin" /> : (isAlreadyEnrolled ? 'Inscrit' : 'Inscrire')}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800 text-right">
                        <button onClick={() => setShowEnrollModal(false)} className="px-5 py-2.5 rounded-xl font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">Fermer</button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Courses List */}
                <div className="space-y-4">

                  {selectedChild.enrollments.length === 0 ? (
                    <div className="p-10 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-500">
                      Cet enfant n'est encore inscrit à aucun cours.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {selectedChild.enrollments.map(enrollment => {
                        const courseProgress = getCourseProgress(enrollment, selectedChild.progressions);
                        const modules = enrollment.course?.modules ?? [];
                        const completedModules = modules.filter(m => {
                          const prog = selectedChild.progressions.find(p => p.moduleId === m.id);
                          return prog?.completionPercent === 100 || prog?.status === 'COMPLETED';
                        }).length;

                        return (
                          <div key={enrollment.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                            <div className="p-6">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2 mb-2">
                                    <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                                      {enrollment.course?.title ?? 'Cours inconnu'}
                                    </h4>
                                    {enrollment.course?.level && (
                                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${levelColors[enrollment.course.level] ?? 'text-slate-500 bg-slate-50 border-slate-200'}`}>
                                        {levelLabels[enrollment.course.level] ?? enrollment.course.level}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-slate-500 flex items-center gap-1">
                                    <Clock className="h-3.5 w-3.5" />
                                    Inscrit le {new Date(enrollment.enrolledAt).toLocaleDateString('fr-FR')}
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">{courseProgress}%</p>
                                  <p className="text-xs text-slate-500">{completedModules}/{modules.length} modules</p>
                                </div>
                              </div>

                              {/* Course progress bar */}
                              <div className="mt-4 mb-2">
                                <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-700 ${
                                      courseProgress === 100
                                        ? 'bg-gradient-to-r from-emerald-500 to-green-500'
                                        : 'bg-gradient-to-r from-indigo-500 to-violet-500'
                                    }`}
                                    style={{ width: `${courseProgress}%` }}
                                  />
                                </div>
                              </div>

                              {/* Module breakdown */}
                              {modules.length > 0 && (
                                <div className="mt-4 grid grid-cols-1 gap-1.5">
                                  {modules.map(module => {
                                    const prog = selectedChild.progressions.find(p => p.moduleId === module.id);
                                    const pct = prog?.completionPercent ?? 0;
                                    const status = prog?.status ?? 'NOT_STARTED';
                                    return (
                                      <div key={module.id} className="flex items-center gap-3 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                                        {status === 'COMPLETED' ? (
                                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                                        ) : status === 'IN_PROGRESS' ? (
                                          <PlayCircle className="h-4 w-4 text-blue-500 shrink-0" />
                                        ) : (
                                          <div className="h-4 w-4 rounded-full border-2 border-slate-300 dark:border-slate-600 shrink-0" />
                                        )}
                                        <span className="text-sm text-slate-700 dark:text-slate-300 flex-1 truncate">{module.title}</span>
                                        <span className={`text-xs font-semibold ${
                                          pct === 100 ? 'text-emerald-600' : pct > 0 ? 'text-blue-600' : 'text-slate-400'
                                        }`}>
                                          {pct}%
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
                              <Link
                                href={`/courses/${enrollment.courseId}`}
                                className="text-sm text-indigo-600 dark:text-indigo-400 font-medium hover:underline flex items-center gap-1"
                              >
                                Voir le cours
                                <ChevronRight className="h-4 w-4" />
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
