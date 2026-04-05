import Link from 'next/link';
import { BookOpen, ChevronRight, User } from 'lucide-react';

// Configuration URL API
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3000/api';

// Types
interface Course {
  id: string;
  title: string;
  description: string;
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  isPublished: boolean;
  createdAt: string;
  teacherId: string;
}

// Fonction pour récupérer les cours
async function fetchCoursesCatalog(): Promise<Course[]> {
  try {
    const res = await fetch(`${API_URL}/courses`, {
      cache: 'no-store', // Pour le dev, on désactive le cache
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch courses: ${res.statusText}`);
    }
    return res.json();
  } catch (error) {
    console.error('Error fetching courses:', error);
    return [];
  }
}

// Composant Badges de niveau
const CourseLevelBadge = ({ level }: { level: string }) => {
  const styles = {
    BEGINNER: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    INTERMEDIATE: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    ADVANCED: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  };

  const labels = {
    BEGINNER: 'Débutant',
    INTERMEDIATE: 'Intermédiaire',
    ADVANCED: 'Avancé',
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${styles[level as keyof typeof styles] || styles.BEGINNER}`}>
      {labels[level as keyof typeof labels] || 'Débutant'}
    </span>
  );
};

export default async function CoursesCatalogPage() {
  const coursesList = await fetchCoursesCatalog();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header Section */}
      <section className="relative px-6 py-20 overflow-hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-blue-500 opacity-20 blur-[100px]"></div>

        <div className="relative max-w-7xl mx-auto text-center space-y-6">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Explorez notre <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-500">Catalogue de Cours</span>
          </h1>
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-slate-600 dark:text-slate-400">
            Découvrez nos parcours d'apprentissage en électronique, programmation et robotique, conçus spécialement pour les jeunes esprits créatifs.
          </p>
        </div>
      </section>

      {/* Course Grid Section */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        {coursesList.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
            <BookOpen className="mx-auto h-12 w-12 text-slate-400 mb-4" />
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Aucun cours disponible</h3>
            <p className="text-slate-500 dark:text-slate-400">Les nouveaux cours arrivent très bientôt !</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {coursesList.map((course) => (
              <Link
                key={course.id}
                href={`/courses/${course.id}`} // Lien vers courseId
                className="group relative flex flex-col bg-white dark:bg-slate-900 rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
              >
                {/* Decorative header */}
                <div className="h-32 bg-gradient-to-br from-blue-500/10 to-indigo-600/10 dark:from-blue-500/20 dark:to-indigo-600/20 p-6 relative overflow-hidden">
                  <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-blue-500/20 blur-xl group-hover:bg-blue-500/30 transition-colors"></div>
                  <div className="relative z-10 flex justify-between items-start">
                    <div className="h-12 w-12 rounded-2xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center border border-slate-100 dark:border-slate-700">
                      <BookOpen className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <CourseLevelBadge level={course.level} />
                  </div>
                </div>

                {/* Content */}
                <div className="flex flex-col flex-1 p-6">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {course.title}
                  </h3>

                  <p className="text-slate-600 dark:text-slate-400 text-sm mb-6 line-clamp-3">
                    {course.description || "Aucune description fournie pour ce cours."}
                  </p>

                  <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center text-sm text-slate-500 dark:text-slate-400">
                      <User className="h-4 w-4 mr-2" />
                      <span>Professeur</span>
                    </div>
                    <div className="flex items-center text-blue-600 dark:text-blue-400 font-medium text-sm">
                      Découvrir
                      <ChevronRight className="ml-1 h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
