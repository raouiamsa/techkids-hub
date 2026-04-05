'use client';

import { useState } from 'react';
import { useAuth } from '../../../contexts/auth.context';
import Link from 'next/link';
import {
  Brain, Sparkles, ChevronLeft, Upload, Wand2,
  BookOpen, CheckCircle,
  Rocket, RotateCcw,
  Loader2, AlertCircle, Plus, Trash2, FileText
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useRouter } from 'next/navigation';

// ── Types ──────────────────────────────────────────────────────────────────────
type Step = 'config' | 'generating' | 'review' | 'published';

interface GeneratedResult {
  syllabus: string;
  content: string;
  draftId?: string;
}

interface DocItem {
  path: string;
  status: 'idle' | 'loading' | 'done' | 'error';
}

// ── Composant principal ────────────────────────────────────────────────────────
export default function CourseGeneratorPage() {
  const { token } = useAuth();
  const router = useRouter();

  // --- État principal
  const [step, setStep] = useState<Step>('config');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // --- Formulaire config
  const [subject, setSubject] = useState('');
  const [courseId, setCourseId] = useState('');
  const [ageGroup, setAgeGroup] = useState(12);
  // --- Documents sources
  const [docs, setDocs] = useState<DocItem[]>([{ path: '', status: 'idle' }]);

  // --- Résultats IA
  const [result, setResult] = useState<GeneratedResult | null>(null);
  const [feedback, setFeedback] = useState('');
  const [isRectifying, setIsRectifying] = useState(false);

  // ── Helpers documents ───────────────────────────────────────────────────────
  const addDoc = () => setDocs(d => [...d, { path: '', status: 'idle' }]);
  const removeDoc = (i: number) => setDocs(d => d.filter((_, idx) => idx !== i));
  const updateDocPath = (i: number, path: string) =>
    setDocs(d => d.map((doc, idx) => idx === i ? { ...doc, path } : doc));
  const updateDocStatus = (i: number, status: DocItem['status']) =>
    setDocs(d => d.map((doc, idx) => idx === i ? { ...doc, status } : doc));

  // ── Action : Générer ────────────────────────────────────────────────────────
  const handleGenerate = async (teacherFeedback = '') => {
    if (!subject || !courseId) {
      setError('Veuillez remplir le sujet et l\'identifiant du cours.');
      return;
    }
    setError('');
    setIsLoading(true);
    teacherFeedback ? setIsRectifying(true) : setStep('generating');

    try {
      const res = await fetch(`${API_URL}/ai/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          input_request: subject,
          course_id: courseId,
          age_group: ageGroup,
          teacher_feedback: teacherFeedback,
        }),
      });

      if (!res.ok) throw new Error((await res.json()).message || 'Erreur de génération');

      const data = await res.json();
      setResult({ 
        syllabus: data.syllabus, 
        content: data.content,
        draftId: data.draftId 
      });
      setFeedback('');
      setStep('review');
    } catch (e: any) {
      setError(e.message);
      setStep('config');
    } finally {
      setIsLoading(false);
      setIsRectifying(false);
    }
  };

  // ── Action : Publier (Approuver) ─────────────────────────────────────────────
  const handlePublish = async () => {
    if (!result?.draftId) return;
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/ai/publish/${result.draftId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Erreur lors de la publication');
      setStep('published');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Action : Rejeter ────────────────────────────────────────────────────────
  const handleReject = async () => {
    if (!result?.draftId) {
      setStep('config');
      setResult(null);
      return;
    }
    if (!confirm('Êtes-vous sûr de vouloir rejeter ce cours ? Il sera supprimé.')) return;

    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/ai/reject/${result.draftId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Erreur lors de la suppression');
      setStep('config');
      setResult(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Action : Enregistrer en brouillon (Juste quitter) ───────────────────────
  const handleSaveDraft = async () => {
    // Le cours est déjà sauvegardé en BDD via /generate
    alert('Brouillon enregistré ! Vous le retrouverez dans votre dashboard.');
    router.push('/teacher/dashboard');
  };

  // ── Rendu : Config ──────────────────────────────────────────────────────────
  const renderConfig = () => (
    <div className="space-y-6">
      {/* Section 0 : Import PDF */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-3">
            <Upload className="w-5 h-5 text-purple-500" />
            1. Documents sources (PDF...)
          </h2>
          <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
            {docs.filter(d => d.status === 'done').length}/{docs.length} ingérés
          </span>
        </div>
        <p className="text-sm text-slate-400">Ajoutez les documents que l'IA doit analyser pour créer le cours.</p>

        <div className="space-y-3">
          {docs.map((doc, i) => (
            <div key={i} className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition hover:shadow-md">
              <div className="flex-shrink-0">
                {doc.status === 'done' && <CheckCircle className="w-5 h-5 text-emerald-500" />}
                {doc.status === 'loading' && <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />}
                {doc.status === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
                {doc.status === 'idle' && <FileText className="w-5 h-5 text-slate-400" />}
              </div>

              {doc.path ? (
                <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                  {doc.path.split(/[\\/]/).pop()}
                </span>
              ) : (
                <span className="flex-1 text-sm text-slate-400 italic">Aucun document</span>
              )}

              <input
                type="file" accept=".pdf" id={`file-${i}`} className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  updateDocStatus(i, 'loading');
                  try {
                    const form = new FormData();
                    form.append('file', file);
                    const upRes = await fetch('/api/upload', { method: 'POST', body: form });
                    if (!upRes.ok) throw new Error('Échec de l\'upload');
                    const { filePath } = await upRes.json();
                    updateDocPath(i, filePath);

                    const ingRes = await fetch(`${API_URL}/ai/ingest`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ file_path: filePath, course_id: courseId }),
                    });
                    if (!ingRes.ok) throw new Error('Échec de l\'analyse (ChromaDB)');
                    updateDocStatus(i, 'done');
                  } catch (err: any) {
                    setError(err.message);
                    updateDocStatus(i, 'error');
                  }
                }}
              />

              {doc.status !== 'done' && (
                <label
                  htmlFor={`file-${i}`}
                  className={`px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer transition shadow-sm ${!courseId ? 'opacity-40 grayscale pointer-events-none' : ''}`}
                >
                  <Upload className="w-3 h-3" /> {doc.path ? 'Modifier' : 'Importer'}
                </label>
              )}

              {docs.length > 1 && (
                <button onClick={() => removeDoc(i)} className="p-2 text-slate-400 hover:text-red-500 transition">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        <button onClick={addDoc} className="inline-flex items-center gap-2 text-sm font-bold text-purple-600 hover:text-purple-700 bg-purple-50 dark:bg-purple-900/20 px-4 py-2 rounded-xl transition">
          <Plus className="w-4 h-4" /> Ajouter un autre PDF
        </button>
      </div>

      {/* Section 1 : Config cours */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 space-y-6">
        <h2 className="text-xl font-bold flex items-center gap-3">
          <Brain className="w-5 h-5 text-blue-500" /> 2. Détails du cours
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="col-span-full">
            <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-2">Thématique du cours</label>
            <input
              value={subject} onChange={e => setSubject(e.target.value)}
              placeholder="ex: Les fondamentaux de la robotique avec Arduino"
              className="w-full px-5 py-4 rounded-2xl bg-slate-100 dark:bg-slate-800 border-none focus:ring-2 focus:ring-blue-500 text-lg transition"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-2">Identifiant Unique</label>
            <input
              value={courseId} onChange={e => setCourseId(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
              placeholder="arduino-101"
              className="w-full px-5 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 border-none focus:ring-2 focus:ring-blue-500 font-mono transition"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-2">Âge : <span className="text-blue-500">{ageGroup} ans</span></label>
            <input
              type="range" min={7} max={17} value={ageGroup}
              onChange={e => setAgeGroup(Number(e.target.value))}
              className="w-full accent-blue-600"
            />
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 text-red-500 rounded-2xl border border-red-500/20 text-sm flex items-center gap-3 animate-shake">
            <AlertCircle className="w-5 h-5 flex-shrink-0" /> {error}
          </div>
        )}

        <button
          onClick={() => handleGenerate()}
          disabled={!subject || !courseId || isLoading}
          className="w-full py-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 disabled:grayscale text-white font-black text-lg rounded-2xl flex items-center justify-center gap-4 transition-all shadow-xl shadow-blue-500/20 active:scale-[0.98]"
        >
          {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6" />}
          GÉNÉRER LE COURS
        </button>
      </div>
    </div>
  );

  // ── Rendu : Génération ──────────────────────────────────────────────────────
  const renderGenerating = () => (
    <div className="flex flex-col items-center justify-center py-32 space-y-8 animate-in fade-in duration-700">
      <div className="relative">
        <div className="w-24 h-24 rounded-full bg-blue-500/20 flex items-center justify-center">
          <Brain className="w-12 h-12 text-blue-500 animate-pulse" />
        </div>
        <div className="absolute top-0 right-0 w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center animate-bounce shadow-lg">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
      </div>
      <div className="text-center space-y-3">
        <h3 className="text-2xl font-black">Architecture pédagogique en cours...</h3>
        <div className="flex justify-center gap-1.5">
          <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-xs font-bold rounded-lg text-slate-500">Filtrage RAG</span>
          <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-xs font-bold rounded-lg text-slate-500">Plan de cours</span>
          <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-xs font-bold rounded-lg text-slate-500">Auto-critique</span>
        </div>
      </div>
    </div>
  );

  // ── Rendu : Révision ────────────────────────────────────────────────────────
  const renderReview = () => (
    <div className="space-y-8 pb-20 animate-in slide-in-from-bottom-4 duration-500">
      
      {/* Syllabus et Contenu côte à côte ou onglets */}
      <div className="grid grid-cols-1 gap-8">
        {/* SYLLABUS RÉEL */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl">
          <div className="px-8 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
            <h3 className="font-black flex items-center gap-3">
              <BookOpen className="w-5 h-5 text-emerald-500" />
              Syllabus Pédagogique
            </h3>
            <span className="text-xs font-bold px-3 py-1 bg-emerald-500/10 text-emerald-600 rounded-full uppercase tracking-tighter">Draft IA</span>
          </div>
          <div className="p-8 prose dark:prose-invert max-w-none max-h-[500px] overflow-y-auto custom-scrollbar">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{result?.syllabus}</ReactMarkdown>
          </div>
        </div>

        {/* CONTENU RÉEL */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl">
          <div className="px-8 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
            <h3 className="font-black flex items-center gap-3 text-blue-600">
              <Wand2 className="w-5 h-5" />
              Contenu Détaillé de la Leçon
            </h3>
          </div>
          <div className="p-8 prose dark:prose-invert max-w-none max-h-[800px] overflow-y-auto custom-scrollbar bg-slate-50/20">
             <ReactMarkdown remarkPlugins={[remarkGfm]}>{result?.content}</ReactMarkdown>
          </div>
        </div>
      </div>

      {/* Amélioration */}
      <div className="bg-amber-50 dark:bg-amber-900/10 rounded-3xl border border-amber-200 dark:border-amber-900/30 p-8 space-y-4">
        <label className="text-sm font-black text-amber-700 dark:text-amber-500 flex items-center gap-2">
          <RotateCcw className="w-4 h-4" /> RECTIFICATION PÉDAGOGIQUE
        </label>
        <div className="flex gap-4">
          <input
            value={feedback} onChange={e => setFeedback(e.target.value)}
            placeholder="ex: Rends les exercices plus complexes, utilise l'analogie du drone..."
            className="flex-1 px-5 py-4 rounded-2xl bg-white dark:bg-slate-800 border-none shadow-inner focus:ring-2 focus:ring-amber-500"
          />
          <button
            onClick={() => handleGenerate(feedback)}
            disabled={!feedback || isRectifying}
            className="px-8 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-2xl transition disabled:opacity-40"
          >
            {isRectifying ? <Loader2 className="w-5 h-5 animate-spin" /> : 'RECTIFIER'}
          </button>
        </div>
      </div>

      {/* Barre d'Actions Finale */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-xl px-6 z-50">
        <div className="bg-white/80 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200 dark:border-slate-800 p-4 rounded-3xl shadow-2xl flex items-center gap-3">
          <button
            onClick={handleReject}
            className="p-4 text-slate-400 hover:text-red-500 transition-colors"
            title="Rejeter et supprimer"
          >
            <Trash2 className="w-6 h-6" />
          </button>
          
          <button
            onClick={handleSaveDraft}
            className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-black rounded-2xl transition"
          >
            ENREGISTRER
          </button>

          <button
            onClick={handlePublish}
            disabled={isLoading}
            className="flex-2 py-4 px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl flex items-center gap-3 transition-all shadow-lg shadow-emerald-500/30 active:scale-95"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Rocket className="w-5 h-5" />}
            APPROUVER & PUBLIER
          </button>
        </div>
      </div>
    </div>
  );

  // ── Rendu : Publié ──────────────────────────────────────────────────────────
  const renderPublished = () => (
    <div className="flex flex-col items-center justify-center py-24 space-y-8 text-center animate-in zoom-in duration-500">
      <div className="w-24 h-24 rounded-full bg-emerald-500/20 flex items-center justify-center shadow-inner shadow-emerald-500/50">
        <CheckCircle className="w-12 h-12 text-emerald-500" />
      </div>
      <div className="space-y-2">
        <h3 className="text-3xl font-black">COURS DÉPLOYÉ ! 🚀</h3>
        <p className="text-slate-400 font-medium max-w-xs mx-auto">
          Félicitations, votre cours est maintenant live dans le LMS.
        </p>
      </div>
      <Link href="/teacher/dashboard" className="px-10 py-5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl transition shadow-xl shadow-blue-500/20">
        RETOUR AU DASHBOARD
      </Link>
    </div>
  );

  // ── Rendu global ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-blue-500 selection:text-white">
      <div className="max-w-4xl mx-auto px-6 py-12">
        
        {/* Nav */}
        <nav className="flex items-center justify-between mb-12">
           <Link href="/teacher/dashboard" className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-slate-900 dark:hover:text-white transition group">
              <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Retour
           </Link>
           <Brain className="w-10 h-10 text-blue-600 opacity-20" />
        </nav>

        {/* Header */}
        <header className="mb-12">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-blue-600 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-blue-500/40 rotate-3 transition-transform hover:rotate-0">
               <Sparkles className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight leading-tight">AI COURSE<br/><span className="text-blue-600">ENGINE</span></h1>
              <p className="text-slate-400 text-xs font-black uppercase tracking-widest mt-1">Génération pédagogique haute fidélité</p>
            </div>
          </div>
        </header>

        {/* Main Step Content */}
        <main className="relative">
          {step === 'config' && renderConfig()}
          {step === 'generating' && renderGenerating()}
          {step === 'review' && renderReview()}
          {step === 'published' && renderPublished()}
        </main>
      </div>
    </div>
  );
}
