'use client';

import { useState } from 'react';
import { useAuth } from '../../contexts/auth.context';
import { useRouter } from 'next/navigation';
import { BookOpen, AlertCircle } from 'lucide-react';
import { Button } from '@org/ui-components';

export function CourseEnrollButton({ courseId }: { courseId: string }) {
  const { user, token } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEnrollment = async () => {
    if (!user) {
      // Rediriger vers la page de login avec returnUrl
      router.push(`/login?returnUrl=/courses/${courseId}`);
      return;
    }

    if (user.role !== 'STUDENT' && user.role !== 'PARENT') {
      setError("Seuls les étudiants ou les parents peuvent s'inscrire à un cours.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api'}/enrollments`, {
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

      // Inscription réussie : rediriger vers le dashboard étudiant
      router.push('/student/dashboard');

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Button
        onClick={handleEnrollment}
        disabled={isLoading}
        size="lg"
        className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all disabled:opacity-70 normal-case tracking-normal text-lg h-14"
      >
        {isLoading ? (
          <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <BookOpen className="h-5 w-5" />
        )}
        {user ? "S'inscrire au cours" : "Se connecter pour s'inscrire"}
      </Button>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
          <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}
