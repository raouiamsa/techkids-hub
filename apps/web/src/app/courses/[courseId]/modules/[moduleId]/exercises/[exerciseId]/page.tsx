'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../../../../../contexts/auth.context';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Send, CheckCircle2, XCircle, BookOpen,
  Code2, Cpu, HelpCircle, Loader2, History, RefreshCw
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

interface Exercise {
  id: string;
  title: string;
  instructions: string;
  exerciseType: 'QUIZ' | 'CODE_CHALLENGE' | 'CIRCUIT_BUILD';
}

interface Module {
  id: string;
  title: string;
  exercises?: Exercise[];
}

interface PreviousSubmission {
  id: string;
  answer: string;
  score: number | null;
  attempt: number;
  submittedAt: string;
}

const typeConfig = {
  QUIZ: {
    Icon: HelpCircle,
    label: 'Quiz',
    color: 'text-amber-500',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    placeholder: 'Entrez votre réponse...',
  },
  CODE_CHALLENGE: {
    Icon: Code2,
    label: 'Défi de Code',
    color: 'text-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    placeholder: '// Entrez votre code ici...\nint main() {\n  // ...\n}',
  },
  CIRCUIT_BUILD: {
    Icon: Cpu,
    label: 'Circuit Électronique',
    color: 'text-purple-500',
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    border: 'border-purple-200 dark:border-purple-800',
    placeholder: 'Décrivez votre circuit (composants, connexions)...',
  },
};

export default function ExercisePage() {
  const { user, token } = useAuth();
  const router = useRouter();
  const params = useParams();
  const courseId = params.courseId as string;
  const moduleId = params.moduleId as string;
  const exerciseId = params.exerciseId as string;

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [moduleName, setModuleName] = useState('');
  const [answer, setAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [result, setResult] = useState<{ score: number; attempt: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previousSubmission, setPreviousSubmission] = useState<PreviousSubmission | null>(null);
  const [showPrevious, setShowPrevious] = useState(false);

  useEffect(() => {
    if (!user || !token) {
      router.push(`/login?returnUrl=/courses/${courseId}/modules/${moduleId}/exercises/${exerciseId}`);
      return;
    }

    async function loadExercise() {
      try {
        const [courseRes, submissionRes] = await Promise.all([
          fetch(`${API_URL}/courses/${courseId}`),
          fetch(`${API_URL}/progression/exercises/${exerciseId}/my-submission`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const course = await courseRes.json();
        const mod: Module = course?.modules?.find((m: Module) => m.id === moduleId);
        if (mod) {
          setModuleName(mod.title);
          const ex = mod.exercises?.find((e: Exercise) => e.id === exerciseId);
          if (ex) setExercise(ex);
        }

        if (submissionRes.ok) {
          const sub = await submissionRes.json();
          if (sub) {
            setPreviousSubmission(sub);
            // Pre-fill the answer with the previous submission
            setAnswer(sub.answer);
          }
        }
      } catch {
        // silent
      } finally {
        setIsLoading(false);
      }
    }

    loadExercise();
  }, [user, token, courseId, moduleId, exerciseId, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/progression/exercises/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ exerciseId, answer }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Erreur lors de la soumission');
      }

      const submission = await res.json();
      setResult({ score: submission.score ?? 100, attempt: submission.attempt ?? 1 });
      // Update local previous submission
      setPreviousSubmission({
        id: submission.id,
        answer,
        score: submission.score,
        attempt: submission.attempt,
        submittedAt: new Date().toISOString(),
      });

      // NOTE: NO manual progression/update call here.
      // The backend submitExercise already calls recalculateModuleProgression()
      // which correctly computes the % based on submitted/total exercises in the module.

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!exercise) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <XCircle className="h-12 w-12 text-red-400" />
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Exercice introuvable</h1>
        <Link href={`/courses/${courseId}`} className="text-blue-600 hover:underline">
          ← Retour au cours
        </Link>
      </div>
    );
  }

  const config = typeConfig[exercise.exerciseType] ?? typeConfig.QUIZ;
  const TypeIcon = config.Icon;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <Link
            href={`/courses/${courseId}`}
            className="inline-flex items-center text-sm text-slate-500 hover:text-blue-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour au cours
          </Link>
          {moduleName && (
            <>
              <span className="text-slate-300 dark:text-slate-700">/</span>
              <span className="text-sm text-slate-500 flex items-center gap-1">
                <BookOpen className="h-4 w-4" />
                {moduleName}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Exercise Content */}
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        {/* Type Badge + Title */}
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${config.bg} ${config.border} ${config.color}`}>
              <TypeIcon className="h-4 w-4" />
              {config.label}
            </span>
            {/* Previous submission badge */}
            {previousSubmission && !result && (
              <button
                onClick={() => setShowPrevious(!showPrevious)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-400 hover:opacity-80 transition-opacity"
              >
                <History className="h-4 w-4" />
                {showPrevious ? 'Masquer' : 'Voir'} ma dernière réponse (tentative #{previousSubmission.attempt})
              </button>
            )}
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">
            {exercise.title}
          </h1>
        </div>

        {/* Previous submission panel */}
        {showPrevious && previousSubmission && !result && (
          <div className="p-5 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-violet-700 dark:text-violet-300 flex items-center gap-2">
                <History className="h-4 w-4" />
                Tentative #{previousSubmission.attempt} — {new Date(previousSubmission.submittedAt).toLocaleString('fr-FR')}
              </h3>
              {previousSubmission.score != null && (
                <span className="text-sm font-bold text-violet-600 dark:text-violet-400">
                  Score : {previousSubmission.score}%
                </span>
              )}
            </div>
            <pre className={`text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap bg-white dark:bg-slate-900 p-3 rounded-xl border border-violet-100 dark:border-violet-800 ${exercise.exerciseType === 'CODE_CHALLENGE' ? 'font-mono' : ''}`}>
              {previousSubmission.answer}
            </pre>
            <button
              onClick={() => { setAnswer(previousSubmission.answer); setShowPrevious(false); }}
              className="text-sm text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" />
              Utiliser cette réponse comme point de départ
            </button>
          </div>
        )}

        {/* Instructions */}
        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
            Énoncé
          </h2>
          <div className="prose prose-slate dark:prose-invert max-w-none">
            <p className="text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
              {exercise.instructions}
            </p>
          </div>
        </div>

        {/* Result Display */}
        {result ? (
          <div className="p-8 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto" />
            <h2 className="text-2xl font-bold text-emerald-800 dark:text-emerald-300">
              Bravo ! Exercice soumis avec succès !
            </h2>
            <p className="text-emerald-700 dark:text-emerald-400">
              Score : <strong>{result.score}%</strong> — Tentative #{result.attempt}
            </p>
            <div className="flex justify-center gap-4 pt-2">
              <Link
                href={`/courses/${courseId}`}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors"
              >
                Continuer le cours →
              </Link>
              <button
                onClick={() => { setResult(null); }}
                className="px-6 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Réessayer
              </button>
            </div>
          </div>
        ) : (
          /* Answer Form */
          <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {previousSubmission ? 'Modifier votre réponse' : 'Votre réponse'}
            </h2>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder={config.placeholder}
              rows={exercise.exerciseType === 'CODE_CHALLENGE' ? 12 : 6}
              className={`w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition resize-y ${exercise.exerciseType === 'CODE_CHALLENGE' ? 'font-mono text-sm' : ''}`}
              required
            />

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3 text-red-700 dark:text-red-400 text-sm">
                <XCircle className="h-5 w-5 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !answer.trim()}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg"
            >
              {isSubmitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
              {isSubmitting ? 'Soumission en cours...' : previousSubmission ? 'Soumettre une nouvelle tentative' : 'Soumettre ma réponse'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
