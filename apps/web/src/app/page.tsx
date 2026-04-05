import Link from 'next/link';
import { BookOpen, Rocket, BrainCircuit, Users, ChevronRight, Zap } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans selection:bg-blue-500/30">
      
      {/* ─── NAVBAR ─── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Zap className="h-4 w-4 text-white" fill="currentColor" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300">
              TechKids Hub
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <Link href="#features" className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              Découvrir
            </Link>
            <Link href="/courses" className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              Catalogue de Cours
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <Link 
              href="/login" 
              className="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Se connecter
            </Link>
            <Link 
              href="/register" 
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-colors"
            >
              Rejoindre
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── HERO SECTION ─── */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full -z-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-blue-400 rounded-full mix-blend-multiply filter blur-[128px] opacity-40 animate-blob"></div>
          <div className="absolute top-20 right-20 w-72 h-72 bg-indigo-400 rounded-full mix-blend-multiply filter blur-[128px] opacity-40 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-72 h-72 bg-purple-400 rounded-full mix-blend-multiply filter blur-[128px] opacity-40 animate-blob animation-delay-4000"></div>
        </div>
        
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] -z-20"></div>

        <div className="max-w-5xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 text-sm font-medium mb-8">
            <Rocket className="h-4 w-4" />
            <span>La nouvelle plateforme d'apprentissage 2026</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-8 leading-[1.1]">
            Réveillez le <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-500">génie technologique</span> de votre enfant.
          </h1>

          <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 mb-10 max-w-3xl mx-auto leading-relaxed">
            TechKids Hub est une plateforme éducative innovante alliant cours interactifs, kits physiques, et intelligence artificielle pour apprendre la robotique et la programmation de manière amusante.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              href="/courses" 
              className="w-full sm:w-auto px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-2xl hover:scale-105 transition-transform shadow-xl flex items-center justify-center gap-2"
            >
              Explorer le catalogue
              <ChevronRight className="h-5 w-5" />
            </Link>
            <Link 
              href="/register" 
              className="w-full sm:w-auto px-8 py-4 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 font-bold rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              Créer un compte Parent
            </Link>
          </div>
        </div>
      </section>

      {/* ─── FEATURES SECTION ─── */}
      <section id="features" className="py-24 bg-white dark:bg-slate-900 border-y border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">
              Une méthode pédagogique complète
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              Tout ce dont votre enfant a besoin pour passer du statut de consommateur à celui de créateur de technologies.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 text-left">
            {/* Feature 1 */}
            <div className="p-8 rounded-3xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 hover:shadow-lg transition-shadow">
              <div className="h-12 w-12 rounded-2xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center mb-6">
                <BookOpen className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Parcours Structurés</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                Des cours d'électronique et de code conçus par des experts éducatifs, de l'initiation aux projets avancés (Arduino, capteurs).
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-8 rounded-3xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 hover:shadow-lg transition-shadow">
              <div className="h-12 w-12 rounded-2xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center mb-6">
                <Users className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Suivi Parental Centralisé</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                Visualisez la progression de vos enfants en temps réel, admirez leurs créations, et recevez des rapports de compétences personnalisés.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-8 rounded-3xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 hover:shadow-lg transition-shadow">
              <div className="h-12 w-12 rounded-2xl bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center mb-6">
                <BrainCircuit className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Tuteur IA Dédié</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                Un assistant intelligent qui aide l'enfant lorsqu'il ou elle est bloqué(e) sur un bout de code ou un montage électrique, en le guidant sans donner la solution.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="bg-slate-50 dark:bg-slate-950 py-12 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between text-slate-500 dark:text-slate-400 text-sm">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
             <Zap className="h-4 w-4" />
             <span className="font-medium">TechKids Hub © 2026. Produit éducatif PFE.</span>
          </div>
          <div className="flex gap-6">
            <Link href="/courses" className="hover:text-slate-900 dark:hover:text-white transition">Catalogue</Link>
            <Link href="/login" className="hover:text-slate-900 dark:hover:text-white transition">Connexion</Link>
            <Link href="/register" className="hover:text-slate-900 dark:hover:text-white transition">Inscription</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
