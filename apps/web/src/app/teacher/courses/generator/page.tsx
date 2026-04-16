'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../../contexts/auth.context';
import Link from 'next/link';
import {
  Brain, Sparkles, ChevronLeft, Upload,
  BookOpen, CheckCircle, Rocket, RotateCcw,
  Loader2, AlertCircle, Plus, Trash2, FileText,
  Code2, Youtube, Globe, X, Sprout, Library
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

// ── Types ──────────────────────────────────────────────────────────────────────
type Step = 'config' | 'generating' | 'review' | 'published';
type SourceType = 'PDF' | 'VIDEO' | 'WEBPAGE';
type SourceStatus = 'idle' | 'uploading' | 'done' | 'error';

interface SourceItem {
  id: string;          // course_id retourné par l'API après upload
  label: string;       // Nom affiché (filename ou URL)
  type: SourceType;
  status: SourceStatus;
  error?: string;
}

interface CourseModule {
  order: number;
  title: string;
  content: string;
  objectives: string[];
  summary: string;
  exercises_text: any[];
  exercises_code: any[];
}

interface GeneratedResult {
  courseTitle: string;
  level: string;
  totalDuration: string;
  objectives: string[];
  modules: CourseModule[];
  draftId: string;
}

// ── Composant principal ────────────────────────────────────────────────────────
export default function CourseGeneratorPage() {
  const { token } = useAuth();
  const router = useRouter();
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // ── États UI ─────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('config');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [activeModuleIndex, setActiveModuleIndex] = useState(0);

  // ── Formulaire config ─────────────────────────────────────────────────────────
  const [subject, setSubject] = useState('');
  const [ageGroup, setAgeGroup] = useState(12);
  const [level, setLevel] = useState('BEGINNER');
  const [includeCodeExercises, setIncludeCodeExercises] = useState(false);
  const [teacherNotes, setTeacherNotes] = useState('');

  // ── Modal Bibliothèque ──────────────────────────────────────────────────────────────
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [libraryItems, setLibraryItems] = useState<any[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);

  const fetchLibrarySources = async () => {
    setLibraryLoading(true);
    try {
      const res = await fetch(`${API_URL}/ai/content-sources`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      // Afficher uniquement les sources véctoisées (READY)
      setLibraryItems(Array.isArray(data) ? data.filter((s: any) => s.indexingStatus === 'READY') : []);
    } finally {
      setLibraryLoading(false);
    }
  };

  const addFromLibrary = (item: any) => {
    // Si la source est déjà ajoutée, ne pas ré-ajouter
    if (sources.some(s => s.id === item.url)) return;
    const newSource: SourceItem = {
      id: item.url,
      label: item.title,
      type: item.type,
      status: 'done',
    };
    setSources(prev => [...prev, newSource]);
    setShowLibraryModal(false);
  };

  // ── Sources (Multi-Source Mixage) ─────────────────────────────────────────────
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [urlType, setUrlType] = useState<'VIDEO' | 'WEBPAGE'>('VIDEO');

  // ── Résultats ─────────────────────────────────────────────────────────────────
  const [result, setResult] = useState<GeneratedResult | null>(null);
  const [feedback, setFeedback] = useState('');
  const [isRectifying, setIsRectifying] = useState(false);

  // ── Nettoyage du polling au démontage ────────────────────────────────────────
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // ── Helper : Upload d'un fichier PDF vers l'API Gateway ──────────────────────
  // Théorie : On envoie directement un FormData vers POST /api/ai/content-sources
  // L'API Gateway reçoit le fichier via Multer, l'enregistre localement,
  // puis déclenche l'ingestion dans ChromaDB (vectorisation du PDF)
  const uploadFile = async (file: File): Promise<SourceItem> => {
    const tempId = `temp-${Date.now()}`;
    const newSource: SourceItem = { id: tempId, label: file.name, type: 'PDF', status: 'uploading' };
    setSources(prev => [...prev, newSource]);

    try {
      const form = new FormData();
      form.append('file', file);
      form.append('type', 'PDF');

      const res = await fetch(`${API_URL}/ai/content-sources`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      if (!res.ok) throw new Error((await res.json()).message || 'Échec upload');
      const data = await res.json();

      // Attendre que la vectorisation RabbitMQ soit terminée
      const pollUrl = setInterval(async () => {
        try {
          const sourcesRes = await fetch(`${API_URL}/ai/content-sources`, { headers: { Authorization: `Bearer ${token}` } });
          const sourcesData = await sourcesRes.json();
          const source = sourcesData.find((s: any) => s.id === data.sourceId);
          if (source && source.indexingStatus === 'READY') {
            clearInterval(pollUrl);
            const doneSource: SourceItem = { id: data.sourceUrl, label: file.name, type: 'PDF', status: 'done' };
            setSources(prev => prev.map(s => s.id === tempId ? doneSource : s));
          } else if (source && source.indexingStatus === 'ERROR') {
            clearInterval(pollUrl);
            setSources(prev => prev.map(s => s.id === tempId ? { ...s, status: 'error', error: 'Échec de vectorisation' } : s));
          }
        } catch { }
      }, 2000);
      return { id: data.sourceUrl, label: file.name, type: 'PDF', status: 'uploading' } as SourceItem;
    } catch (err: any) {
      setSources(prev => prev.map(s =>
        s.id === tempId ? { ...s, status: 'error', error: err.message } : s
      ));
      throw err;
    }
  };

  // ── Helper : Ajouter une URL (YouTube ou Web) ─────────────────────────────────
  const addUrl = async () => {
    if (!urlInput.trim()) return;
    const tempId = `url-${Date.now()}`;
    const newSource: SourceItem = { id: tempId, label: urlInput.trim(), type: urlType, status: 'uploading' };
    setSources(prev => [...prev, newSource]);
    setUrlInput('');

    try {
      const res = await fetch(`${API_URL}/ai/content-sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: urlType, url: urlInput.trim(), title: urlInput.trim() }),
      });

      if (!res.ok) throw new Error((await res.json()).message || 'Échec ingestion URL');
      const data = await res.json();

      // Lancement du polling pour attendre l'indexation
      const pollUrl = setInterval(async () => {
        try {
          const sourcesRes = await fetch(`${API_URL}/ai/content-sources`, { headers: { Authorization: `Bearer ${token}` } });
          const sourcesData = await sourcesRes.json();
          const source = sourcesData.find((s: any) => s.id === data.sourceId);
          if (source && source.indexingStatus === 'READY') {
            clearInterval(pollUrl);
            setSources(prev => prev.map(s => s.id === tempId ? { ...s, id: data.sourceUrl, status: 'done' } : s));
          } else if (source && source.indexingStatus === 'ERROR') {
            clearInterval(pollUrl);
            setSources(prev => prev.map(s => s.id === tempId ? {
              ...s, status: 'error', error: "Échec d'indexation" } : s));
          }
        } catch { }
        }, 2000);
    } catch (err: any) {
      setSources(prev => prev.map(s =>
        s.id === tempId ? { ...s, status: 'error', error: err.message } : s
      ));
    }
  };

  // ── Polling asynchrone ────────────────────────────────────────────────────────
  // Théorie : Après le déclenchement de la génération, le backend Python travaille
  // en arrière-plan. On interroge GET /api/ai/drafts/:id/status toutes les 3s
  // pour récupérer la progression (0% → 30% → 70% → 100%) et le contenu final.
  const startPolling = useCallback((id: string) => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/ai/drafts/${id}/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;

        const data = await res.json();
        setProgress(data.progressPercent || 0);

        // Quand le cours est PENDING_REVIEW → parsing du JSON du Rédacteur
        if (data.status === 'PENDING_REVIEW' && data.content) {
          clearInterval(pollRef.current!);
          try {
            const courseData = JSON.parse(data.content);
            setResult({ ...courseData, draftId: id });
            setStep('review');
          } catch {
            // Si le contenu n'est pas du JSON valide (ancien format Markdown)
            setResult({
              courseTitle: 'Cours Généré',
              level: 'Standard',
              totalDuration: '-',
              objectives: [],
              modules: [{ order: 1, title: 'Contenu', content: data.content, objectives: [], summary: '', exercises_text: [], exercises_code: [] }],
              draftId: id,
            });
            setStep('review');
          }
        }

        // Gestion d'une erreur côté Python
        if (data.status === 'ERROR') {
          clearInterval(pollRef.current!);
          setError('Le cerveau IA a rencontré une erreur. Veuillez réessayer.');
          setStep('config');
        }
      } catch { /* Ignore les erreurs réseau temporaires */ }
    }, 3000); // Toutes les 3 secondes
  }, [token]);

  // ── Action : Générer (asynchrone) ────────────────────────────────────────────
  const handleGenerate = async (teacherFeedback = '') => {
    const readySources = sources.filter(s => s.status === 'done');
    if (!subject) { setError('Veuillez entrer un sujet.'); return; }
    if (readySources.length === 0) { setError('Ajoutez au moins une source (PDF, YouTube ou URL).'); return; }

    setError('');
    setProgress(0);
    teacherFeedback ? setIsRectifying(true) : setStep('generating');

    try {
      // POST /api/ai/generate avec le tableau de course_ids (Multi-Source Mixage)
      const res = await fetch(`${API_URL}/ai/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          input_request: subject,
          course_ids: readySources.map(s => s.id),
          age_group: ageGroup,
          level: level,
          include_code_exercises: includeCodeExercises,
          teacher_feedback: teacherFeedback || teacherNotes,
        }),
      });

      if (!res.ok) throw new Error((await res.json()).message || 'Erreur de génération');

      // L'API répond IMMÉDIATEMENT avec le draftId (mode asynchrone)
      const data = await res.json();
      startPolling(data.draftId); // On démarre le polling
      setFeedback('');
    } catch (e: any) {
      setError(e.message);
      setStep('config');
      setIsRectifying(false);
    } finally {
      setIsRectifying(false);
    }
  };

  // ── Action : Publier ──────────────────────────────────────────────────────────
  const handlePublish = async () => {
    if (!result?.draftId) return;
    try {
      const res = await fetch(`${API_URL}/ai/publish/${result.draftId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Erreur lors de la publication');
      setStep('published');
    } catch (e: any) { setError(e.message); }
  };

  // ── Action : Rejeter ──────────────────────────────────────────────────────────
  const handleReject = async () => {
    if (!result?.draftId) { setStep('config'); setResult(null); return; }
    if (!confirm('Rejeter ce cours ? Il sera supprimé.')) return;
    try {
      await fetch(`${API_URL}/ai/reject/${result.draftId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      setStep('config'); setResult(null);
    } catch (e: any) { setError(e.message); }
  };

  // ════════════════════════════════════════════════════════════
  //  RENDU : Step Config
  // ════════════════════════════════════════════════════════════
  const renderConfig = () => (
    <div className="space-y-6">

      {/* ── Section 1 : Sources (Multi-Source Mixage) ── */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-3">
            <Upload className="w-5 h-5 text-purple-500" />
            1. Sources du cours
          </h2>
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${sources.filter(s => s.status === 'done').length > 0
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-slate-100 text-slate-500'
            }`}>
            {sources.filter(s => s.status === 'done').length} source(s) prête(s)
          </span>
        </div>
        <p className="text-sm text-slate-400">
          Mixez plusieurs sources — l'IA les combine toutes pour créer votre cours.
        </p>

        {/* Liste des sources ajoutées */}
        {sources.length > 0 && (
          <div className="space-y-2">
            {sources.map((src) => (
              <div key={src.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="flex-shrink-0">
                  {src.status === 'done' && <CheckCircle className="w-5 h-5 text-emerald-500" />}
                  {src.status === 'uploading' && <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />}
                  {src.status === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
                </div>
                <div className="flex-shrink-0">
                  {src.type === 'PDF' && <FileText className="w-4 h-4 text-red-400" />}
                  {src.type === 'VIDEO' && <Youtube className="w-4 h-4 text-red-500" />}
                  {src.type === 'WEBPAGE' && <Globe className="w-4 h-4 text-blue-400" />}
                </div>
                <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                  {src.label}
                </span>
                {src.error && <span className="text-xs text-red-500">{src.error}</span>}
                <button
                  onClick={() => setSources(prev => prev.filter(s => s.id !== src.id))}
                  className="p-1 text-slate-400 hover:text-red-500 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Boutons d'ajout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* PDF Upload */}
          <div>
            <input
              type="file" accept=".pdf" id="pdf-upload" className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try { await uploadFile(file); }
                catch (err: any) { setError(err.message); }
                e.target.value = '';
              }}
            />
            <label
              htmlFor="pdf-upload"
              className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-purple-300 dark:border-purple-700 rounded-2xl text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 cursor-pointer transition font-bold text-sm"
            >
              <FileText className="w-4 h-4" /> Importer un nouveau PDF
            </label>
          </div>

          {/* Bouton Bibliothèque */}
          <button
            onClick={() => { setShowLibraryModal(true); fetchLibrarySources(); }}
            className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-emerald-300 dark:border-emerald-700 rounded-2xl text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition font-bold text-sm col-span-full md:col-span-1"
          >
            <Library className="w-4 h-4" /> Choisir depuis la Bibliothèque
          </button>

          {/* URL (YouTube / Web) */}
          <div className="space-y-2">
            {/* Sélecteur de type URL — boutons pills avec icônes SVG */}
            <div className="flex gap-2">
              {(['VIDEO', 'WEBPAGE'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setUrlType(t)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition border-2 ${urlType === t
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300'
                    }`}
                >
                  {t === 'VIDEO'
                    ? <><Youtube className="w-3.5 h-3.5" /> YouTube</>
                    : <><Globe className="w-3.5 h-3.5" /> Site web</>
                  }
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addUrl()}
                placeholder="Coller une URL..."
                className="flex-1 px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 border-none text-sm focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={addUrl}
                disabled={!urlInput.trim()}
                className="p-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl transition"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* ── Section 2 : Paramètres du cours ── */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 space-y-6">
        <h2 className="text-xl font-bold flex items-center gap-3">
          <Brain className="w-5 h-5 text-blue-500" /> 2. Paramètres du cours
        </h2>

        <div className="space-y-4">
          {/* Sujet */}
          <div>
            <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-2">
              Thématique du cours *
            </label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="ex: Les fondamentaux de la robotique avec Arduino"
              className="w-full px-5 py-4 rounded-2xl bg-slate-100 dark:bg-slate-800 border-none focus:ring-2 focus:ring-blue-500 text-lg transition"
            />
          </div>

          {/* Âge */}
          <div>
            <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-3">
              Âge cible : <span className="text-blue-500 text-base">{ageGroup} ans</span>
            </label>
            <input
              type="range" min={7} max={17} value={ageGroup}
              onChange={e => setAgeGroup(Number(e.target.value))}
              className="w-full accent-blue-600"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>7 ans</span><span>17 ans</span>
            </div>
          </div>

          {/* Niveau (Radio Pills) */}
          <div>
            <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-3">
              Niveau du cours *
            </label>
            <div className="flex gap-3">
              {['BEGINNER', 'INTERMEDIATE', 'ADVANCED'].map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setLevel(lvl)}
                  className={`flex-1 flex flex-col items-center justify-center p-4 rounded-2xl font-bold transition-all border-2 ${level === lvl
                    ? 'bg-blue-50/50 dark:bg-blue-900/20 border-blue-500 text-blue-600 dark:text-blue-400 shadow-md scale-[1.02]'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                >
                  {lvl === 'BEGINNER' && <Sprout className={`w-6 h-6 mb-2 ${level === lvl ? 'text-emerald-500' : 'text-slate-400'}`} />}
                  {lvl === 'INTERMEDIATE' && <Rocket className={`w-6 h-6 mb-2 ${level === lvl ? 'text-amber-500' : 'text-slate-400'}`} />}
                  {lvl === 'ADVANCED' && <Brain className={`w-6 h-6 mb-2 ${level === lvl ? 'text-purple-500' : 'text-slate-400'}`} />}

                  <span className="text-sm">
                    {lvl === 'BEGINNER' ? 'Débutant' : lvl === 'INTERMEDIATE' ? 'Intermédiaire' : 'Avancé'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Toggle exercices de code */}
          <div
            className={`flex items-center justify-between p-5 rounded-2xl border-2 cursor-pointer transition ${includeCodeExercises
              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
              : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'
              }`}
            onClick={() => setIncludeCodeExercises(v => !v)}
          >
            <div className="flex items-center gap-3">
              <Code2 className={`w-5 h-5 ${includeCodeExercises ? 'text-emerald-500' : 'text-slate-400'}`} />
              <div>
                <p className="font-bold text-sm">Exercices de programmation</p>
                <p className="text-xs text-slate-400">
                  {includeCodeExercises
                    ? 'Qwen 2.5 Coder génèrera des exercices de code Python/JS'
                    : 'Cliquez pour activer les exercices de code interactifs'}
                </p>
              </div>
            </div>
            <div className={`w-12 h-6 rounded-full transition-colors relative ${includeCodeExercises ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
              }`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${includeCodeExercises ? 'left-7' : 'left-1'
                }`} />
            </div>
          </div>

          {/* Consignes particulières (optionnel) */}
          <div>
            <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-2">
              Consignes particulières <span className="text-slate-400 font-normal">(optionnel)</span>
            </label>
            <textarea
              value={teacherNotes}
              onChange={e => setTeacherNotes(e.target.value)}
              placeholder="ex: Utilise des analogies liées au football, simplifie le vocabulaire, ajoute plus d'humour..."
              rows={3}
              className="w-full px-5 py-4 rounded-2xl bg-slate-100 dark:bg-slate-800 border-none focus:ring-2 focus:ring-amber-500 text-sm resize-none transition"
            />
          </div>
        </div>

        {/* Erreur */}
        {error && (
          <div className="p-4 bg-red-500/10 text-red-500 rounded-2xl border border-red-500/20 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" /> {error}
          </div>
        )}

        {/* Bouton Générer */}
        <button
          onClick={() => handleGenerate()}
          disabled={!subject || sources.filter(s => s.status === 'done').length === 0}
          className="w-full py-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 disabled:grayscale text-white font-black text-lg rounded-2xl flex items-center justify-center gap-4 transition-all shadow-xl shadow-blue-500/20 active:scale-[0.98]"
        >
          <Sparkles className="w-6 h-6" />
          GÉNÉRER LE COURS — {sources.filter(s => s.status === 'done').length} SOURCE(S)
        </button>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════
  //  RENDU : Step Generating (avec barre de progression réelle)
  // ════════════════════════════════════════════════════════════
  const renderGenerating = () => (
    <div className="flex flex-col items-center justify-center py-32 space-y-10 animate-in fade-in duration-700">
      {/* Icône animée */}
      <div className="relative">
        <div className="w-28 h-28 rounded-full bg-blue-500/10 flex items-center justify-center">
          <Brain className="w-14 h-14 text-blue-500 animate-pulse" />
        </div>
        <div className="absolute -top-1 -right-1 w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center animate-bounce shadow-lg">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
      </div>

      {/* Message et progression */}
      <div className="text-center space-y-4 w-full max-w-md">
        <h3 className="text-2xl font-black">Architecting your course...</h3>
        <p className="text-slate-400 text-sm">
          {progress < 30 ? ' L\'Architecte Gemini dessine le syllabus...' :
            progress < 70 ? ' Gemini + Qwen Coder rédigent le contenu...' :
              progress < 100 ? ' DeepSeek-R1 vérifie la qualité...' :
                ' Cours prêt !'}
        </p>

        {/* Barre de progression */}
        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-1000"
            style={{ width: `${Math.max(progress, 5)}%` }}
          />
        </div>
        <p className="text-blue-500 font-black text-xl">{progress}%</p>

        {/* Tags des agents */}
        <div className="flex flex-wrap justify-center gap-2 mt-4">
          {[
            { label: 'Architecte (Gemini)', done: progress >= 30 },
            { label: includeCodeExercises ? 'Rédacteur (Gemini + Qwen)' : 'Rédacteur (Gemini)', done: progress >= 70 },
            { label: 'Critique (DeepSeek-R1)', done: progress >= 100 },
          ].map((agent) => (
            <span
              key={agent.label}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${agent.done
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                }`}
            >
              {agent.done ? '✅' : '⏳'} {agent.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════
  //  RENDU : Step Review (Navigation par Modules)
  // ════════════════════════════════════════════════════════════
  const renderReview = () => {
    if (!result) return null;
    const currentModule = result.modules?.[activeModuleIndex];

    return (
      <div className="space-y-6 pb-28 animate-in slide-in-from-bottom-4 duration-500">

        {/* Header du cours */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-8 text-white shadow-2xl shadow-blue-500/30">
          <div className="flex items-center gap-2 mb-3">
            <span className="px-3 py-1 bg-white/20 text-xs font-bold rounded-full uppercase">{result.level}</span>
            <span className="px-3 py-1 bg-white/20 text-xs font-bold rounded-full">⏱ {result.totalDuration}</span>
            <span className="px-3 py-1 bg-emerald-500/50 text-xs font-bold rounded-full">Draft IA</span>
          </div>
          <h2 className="text-2xl font-black">{result.courseTitle}</h2>
          {result.objectives?.length > 0 && (
            <ul className="mt-3 space-y-1">
              {result.objectives.slice(0, 3).map((obj, i) => (
                <li key={i} className="text-sm text-white/80 flex items-center gap-2">
                  <CheckCircle className="w-3 h-3 flex-shrink-0" /> {obj}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Navigation des modules */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {result.modules?.map((mod, i) => (
            <button
              key={i}
              onClick={() => setActiveModuleIndex(i)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeModuleIndex === i
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                }`}
            >
              M{mod.order} — {mod.title.length > 20 ? mod.title.slice(0, 20) + '...' : mod.title}
            </button>
          ))}
        </div>

        {/* Contenu du module sélectionné */}
        {currentModule && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl">
            <div className="px-8 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
              <h3 className="font-black text-lg flex items-center gap-3">
                <BookOpen className="w-5 h-5 text-blue-500" />
                Module {currentModule.order} : {currentModule.title}
              </h3>
              {currentModule.summary && (
                <p className="text-sm text-slate-400 mt-1">{currentModule.summary}</p>
              )}
            </div>
            <div className="p-8 prose dark:prose-invert max-w-none max-h-[600px] overflow-y-auto">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentModule.content}</ReactMarkdown>
            </div>

            {/* Stats exercices */}
            {((currentModule.exercises_text?.length || 0) + (currentModule.exercises_code?.length || 0)) > 0 && (
              <div className="px-8 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 flex flex-wrap gap-3">
                {currentModule.exercises_text?.length > 0 && (
                  <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs font-bold rounded-full">
                    📝 {currentModule.exercises_text.length} exercice(s) Quiz/Texte
                  </span>
                )}
                {currentModule.exercises_code?.length > 0 && (
                  <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold rounded-full">
                    {currentModule.exercises_code.length} exercice(s) de code (Qwen)
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Zone de rectification */}
        <div className="bg-amber-50 dark:bg-amber-900/10 rounded-3xl border border-amber-200 dark:border-amber-900/30 p-8 space-y-4">
          <label className="text-sm font-black text-amber-700 dark:text-amber-500 flex items-center gap-2">
            <RotateCcw className="w-4 h-4" /> RECTIFICATION PÉDAGOGIQUE
          </label>
          <div className="flex gap-4">
            <input
              value={feedback} onChange={e => setFeedback(e.target.value)}
              placeholder="ex: Rends les exercices plus complexes, ajoute plus d'humour..."
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

        {/* Barre d'actions flottante */}
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-xl px-6 z-50">
          <div className="bg-white/90 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 p-4 rounded-3xl shadow-2xl flex items-center gap-3">
            <button
              onClick={handleReject}
              className="p-4 text-slate-400 hover:text-red-500 transition-colors"
              title="Rejeter et supprimer"
            >
              <Trash2 className="w-6 h-6" />
            </button>
            <button
              onClick={() => { alert('Brouillon enregistré !'); router.push('/teacher/dashboard'); }}
              className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-900 dark:text-white font-black rounded-2xl transition"
            >
              ENREGISTRER
            </button>
            <button
              onClick={handlePublish}
              className="flex-none py-4 px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl flex items-center gap-3 transition-all shadow-lg shadow-emerald-500/30 active:scale-95"
            >
              <Rocket className="w-5 h-5" />
              APPROUVER & PUBLIER
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ════════════════════════════════════════════════════════════
  //  RENDU : Step Publié
  // ════════════════════════════════════════════════════════════
  const renderPublished = () => (
    <div className="flex flex-col items-center justify-center py-24 space-y-8 text-center animate-in zoom-in duration-500">
      <div className="w-24 h-24 rounded-full bg-emerald-500/20 flex items-center justify-center shadow-inner">
        <CheckCircle className="w-12 h-12 text-emerald-500" />
      </div>
      <div className="space-y-2">
        <h3 className="text-3xl font-black">COURS DÉPLOYÉ </h3>
        <p className="text-slate-400 font-medium max-w-xs mx-auto">
          Vos modules et exercices sont maintenant disponibles dans le LMS.
        </p>
      </div>
      <Link
        href="/teacher/dashboard"
        className="px-10 py-5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl transition shadow-xl shadow-blue-500/20"
      >
        RETOUR AU DASHBOARD
      </Link>
    </div>
  );

  // ════════════════════════════════════════════════════════════
  //  RENDU Global
  // ════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
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
            <div className="w-16 h-16 bg-blue-600 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-blue-500/40 rotate-3 hover:rotate-0 transition-transform">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight">AI COURSE<br /><span className="text-blue-600">ENGINE</span></h1>
              <p className="text-slate-400 text-xs font-black uppercase tracking-widest mt-1">
                Gemini · Qwen Coder · DeepSeek-R1
              </p>
            </div>
          </div>
        </header>

        {/* Content */}
        <main>
          {step === 'config' && renderConfig()}
          {step === 'generating' && renderGenerating()}
          {step === 'review' && renderReview()}
          {step === 'published' && renderPublished()}
        </main>
      </div>

      {/* ── Modal Bibliothèque ───────────────────────────────────────────────────── */}
      {showLibraryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
              <h2 className="font-black text-xl flex items-center gap-3">
                <Library className="w-6 h-6 text-emerald-500" /> Ma Bibliothèque
              </h2>
              <button onClick={() => setShowLibraryModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {libraryLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <p className="text-sm">Chargement...</p>
                </div>
              ) : libraryItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                  <Library className="w-12 h-12 opacity-30" />
                  <p className="font-semibold">Aucune source prête</p>
                  <p className="text-sm text-center">Allez dans <strong>Ma Bibliothèque</strong> pour uploader et vectoriser vos documents.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {libraryItems.map((item: any) => (
                    <button
                      key={item.id}
                      onClick={() => addFromLibrary(item)}
                      disabled={sources.some(s => s.id === item.url)}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 disabled:opacity-40 disabled:cursor-not-allowed border-slate-200 dark:border-slate-700"
                    >
                      {item.type === 'PDF' && <FileText className="w-5 h-5 text-red-500 shrink-0" />}
                      {item.type === 'VIDEO' && <Youtube className="w-5 h-5 text-red-600 shrink-0" />}
                      {item.type === 'WEBPAGE' && <Globe className="w-5 h-5 text-blue-500 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate">{item.title}</p>
                        <p className="text-xs text-slate-400 truncate">{item.url}</p>
                      </div>
                      {sources.some(s => s.id === item.url) ? (
                        <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                      ) : (
                        <Plus className="w-5 h-5 text-slate-400 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs text-slate-400 text-center">
                Seules les sources  <strong>Prêtes</strong> sont affichées. Gérez votre bibliothèque sur <a href="/teacher/library" className="text-blue-500 hover:underline">cette page</a>.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
