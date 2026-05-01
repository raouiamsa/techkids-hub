import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Signal, Clock, Users, BookText } from 'lucide-react';
import { CourseEnrolledView } from './course-enrolled-view';
import { Badge } from '@org/ui-components';

// Configuration URL API
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3000/api';

// Types
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
interface Course {
  id: string;
  title: string;
  description: string;
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  isPublished: boolean;
  createdAt: string;
  teacherId: string;
  modules?: Module[];
}

// Fetch course details (Server Side)
async function fetchCourseDetails(courseId: string): Promise<Course | null> {
  try {
    const res = await fetch(`${API_URL}/courses/${courseId}`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Failed to fetch course: ${res.statusText}`);
    }
    return res.json();
  } catch (error) {
    console.error('Error fetching course:', error);
    return null;
  }
}

const LevelBadge = ({ level }: { level: string }) => {
  const map: Record<string, { label: string; variant: 'default' | 'approved' | 'processing' | 'pending' }> = {
    BEGINNER: { label: 'Débutant', variant: 'default' },
    INTERMEDIATE: { label: 'Intermédiaire', variant: 'processing' },
    ADVANCED: { label: 'Avancé', variant: 'pending' },
  };
  const config = map[level] ?? map.BEGINNER;
  return (
    <Badge variant={config.variant} className="px-4 py-1.5 rounded-full text-sm font-medium">
      Niveau {config.label}
    </Badge>
  );
};

export default async function CourseDetailsPage({ params }: { params: Promise<{ courseId: string }> }) {
  const resolvedParams = await params;
  const course = await fetchCourseDetails(resolvedParams.courseId);

  if (!course) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      {/* Hero Section */}
      <section className="relative px-6 py-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="absolute top-0 right-0 -mr-40 -mt-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 -ml-40 -mb-20 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />

        <div className="relative max-w-5xl mx-auto space-y-6">
          <Link href="/courses" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour au catalogue
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            <LevelBadge level={course.level} />
            <span className="inline-flex items-center text-sm text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full">
              <BookText className="h-4 w-4 mr-2" />
              {course.modules?.length ?? 0} modules
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {course.title}
          </h1>

          {course.description && (
            <p className="max-w-2xl text-lg text-slate-600 dark:text-slate-400">
              {course.description}
            </p>
          )}
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-6 py-16 grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Left: Enrollment / Course Content */}
        <div className="lg:col-span-2">
          <CourseEnrolledView
            courseId={course.id}
            courseTitle={course.title}
            modules={course.modules ?? []}
          />
        </div>

        {/* Right: Sidebar */}
        <div className="lg:col-span-1 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 pt-12 lg:pt-0 lg:pl-12">
          <div className="sticky top-24 space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider mb-4">
                Informations Clés
              </h3>
              <ul className="space-y-4 text-slate-600 dark:text-slate-400">
                <li className="flex items-center gap-3">
                  <Signal className="h-5 w-5 text-slate-400" />
                  Niveau {course.level}
                </li>
                <li className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-slate-400" />
                  À votre rythme
                </li>
                <li className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-slate-400" />
                  Communauté d&apos;apprenants
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
