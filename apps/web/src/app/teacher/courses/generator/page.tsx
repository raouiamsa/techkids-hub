'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../../contexts/auth.context';
import Link from 'next/link';
import {
  Brain, Sparkles, ChevronLeft, Upload,
  BookOpen, CheckCircle, Rocket, RotateCcw,
  Loader2, AlertCircle, Plus, Trash2, FileText,
  Code2, Youtube, Globe, X, Sprout, Library, GripVertical
} from 'lucide-react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useRouter } from 'next/navigation';
import { Button, Badge, Card, CardContent, CardTitle, Input, Textarea } from '@org/ui-components';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

// ── Types ──────────────────────────────────────────────────────────────────────
type Step = 'config' | 'syllabus_review' | 'generating' | 'review' | 'published';
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

interface FinalProject {
  title?: string;
  description?: string;
  steps?: string[];
  solution_hint?: string;
}

interface GeneratedResult {
  courseTitle: string;
  level: string;
  totalDuration: string;
  objectives: string[];
  modules: CourseModule[];
  final_project?: FinalProject;
  draftId: string;
}

interface SyllabusModule {
  id: string;
  title: string;
  objectives: string[];
  exercise_mode?: string;
}

function SortableModuleCard({ mod, index, onUpdate, onDelete }: {
  mod: SyllabusModule; index: number;
  onUpdate: (id: string, u: Partial<SyllabusModule>) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: mod.id });
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(mod.title);
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} className={`flex items-start gap-3 p-4 bg-white dark:bg-slate-800 rounded-2xl border-2 transition-all ${isDragging ? 'border-blue-400 shadow-2xl' : 'border-slate-200 dark:border-slate-700'}`}>
      <button {...attributes} {...listeners} className="mt-1 p-1 text-slate-400 hover:text-blue-500 cursor-grab active:cursor-grabbing">
        <GripVertical className="w-5 h-5" />
      </button>
      <div className="mt-1 w-7 h-7 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 text-xs font-black flex items-center justify-center flex-shrink-0">{index + 1}</div>
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input autoFocus className="w-full text-sm font-bold bg-transparent border-b-2 border-blue-400 outline-none pb-1" value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            onBlur={() => { onUpdate(mod.id, { title: editTitle }); setIsEditing(false); }}
            onKeyDown={e => { if (e.key === 'Enter') { onUpdate(mod.id, { title: editTitle }); setIsEditing(false); } if (e.key === 'Escape') { setEditTitle(mod.title); setIsEditing(false); } }} />
        ) : (
          <p className="text-sm font-bold cursor-text hover:text-blue-600 transition" onClick={() => setIsEditing(true)}>{mod.title}</p>
        )}
        {mod.objectives?.length > 0 && (
          <ul className="mt-1 space-y-0.5">{mod.objectives.map((o, i) => (
            <li key={i} className="text-xs text-slate-400 flex gap-2"><span className="text-blue-400">•</span><span>{o}</span></li>
          ))}</ul>
        )}
      </div>
      <button onClick={() => onDelete(mod.id)} className="mt-1 p-1 text-slate-300 hover:text-red-400 transition"><X className="w-4 h-4" /></button>
    </div>
  );
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
  const [agentStatus, setAgentStatus] = useState("Initialisation..."); // Nouvel état pour la télémétrie dynamique
  const [activeModuleIndex, setActiveModuleIndex] = useState(0);

  // ── États Syllabus Review ─────────────────────────────────────────────────────────
  const [syllabusModules, setSyllabusModules] = useState<SyllabusModule[]>([]);
  const [syllabusTitle, setSyllabusTitle] = useState('');
  const [isSyllabusLoading, setIsSyllabusLoading] = useState(false);

  // ── DnD Kit sensors ────────────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSyllabusModules(mods => {
        const oldIndex = mods.findIndex(m => m.id === active.id);
        const newIndex = mods.findIndex(m => m.id === over.id);
        return arrayMove(mods, oldIndex, newIndex);
      });
    }
  };

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
      setLibraryItems(Array.isArray(data) ? data.filter((s: any) => s.indexingStatus === 'READY') : []);
    } finally {
      setLibraryLoading(false);
    }
  };

  const addFromLibrary = (item: any) => {
    if (sources.some(s => s.id === item.id)) return;
    const newSource: SourceItem = {
      id: item.id,
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
  const [moduleFeedbacks, setModuleFeedbacks] = useState<Record<number, string>>({});
  const [rectifyingModule, setRectifyingModule] = useState<number | null>(null);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // ── Helper : Upload d'un fichier PDF vers l'API Gateway ──────────────────────
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

      const pollUrl = setInterval(async () => {
        try {
          const sourcesRes = await fetch(`${API_URL}/ai/content-sources`, { headers: { Authorization: `Bearer ${token}` } });
          const sourcesData = await sourcesRes.json();
          const source = sourcesData.find((s: any) => s.id === data.sourceId);
          if (source && source.indexingStatus === 'READY') {
            clearInterval(pollUrl);
            const doneSource: SourceItem = { id: data.sourceId, label: file.name, type: 'PDF', status: 'done' };
            setSources(prev => prev.map(s => s.id === tempId ? doneSource : s));
          } else if (source && source.indexingStatus === 'ERROR') {
            clearInterval(pollUrl);
            setSources(prev => prev.map(s => s.id === tempId ? { ...s, status: 'error', error: 'Échec de vectorisation' } : s));
          }
        } catch { }
      }, 2000);
      return { id: data.sourceId, label: file.name, type: 'PDF', status: 'uploading' } as SourceItem;
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

      const pollUrl = setInterval(async () => {
        try {
          const sourcesRes = await fetch(`${API_URL}/ai/content-sources`, { headers: { Authorization: `Bearer ${token}` } });
          const sourcesData = await sourcesRes.json();
          const source = sourcesData.find((s: any) => s.id === data.sourceId);
          if (source && source.indexingStatus === 'READY') {
            clearInterval(pollUrl);
            setSources(prev => prev.map(s => s.id === tempId ? { ...s, id: data.sourceId, status: 'done' } : s));
          } else if (source && source.indexingStatus === 'ERROR') {
            clearInterval(pollUrl);
            setSources(prev => prev.map(s => s.id === tempId ? {
              ...s, status: 'error', error: "Échec d'indexation"
            } : s));
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

        // Lecture dynamique du statut envoyé par le backend
        if (data.agent_status) {
          setAgentStatus(data.agent_status);
        }

        if (data.status === 'PENDING_REVIEW' && data.content) {
          clearInterval(pollRef.current!);
          try {
            let courseData: any = data.content;

            if (typeof courseData === 'string') {
              courseData = JSON.parse(courseData);
            }

            if (Array.isArray(courseData)) {
              const last = courseData[courseData.length - 1];
              courseData = typeof last === 'string' ? JSON.parse(last) : last;
            }

            if (courseData && typeof courseData === 'object' && Array.isArray(courseData.content)) {
              const last = courseData.content[courseData.content.length - 1];
              courseData = typeof last === 'string' ? JSON.parse(last) : last;
            }

            if (courseData?.modules && Array.isArray(courseData.modules)) {
              courseData.modules = courseData.modules.map((m: any) => ({
                ...m,
                content: (() => {
                  const c = m.content;
                  if (!c) return '';
                  if (typeof c === 'string') return c;
                  if (Array.isArray(c)) return c.join('\n\n');
                  if (typeof c === 'object') return Object.values(c as Record<string, any>).join('\n\n');
                  return String(c);
                })(),
              }));
            }

            console.log('Cours parsé :', courseData?.courseTitle, '— Modules :', courseData?.modules?.length);
            setResult({ ...courseData, draftId: id });
            setStep('review');
          } catch (parseErr) {
            console.error('Erreur parsing contenu :', parseErr, '— Raw data.content :', typeof data.content, data.content);
            setError('Erreur de parsing du cours généré. Vérifiez la console.');
            setStep('config');
          }
        }

        if (data.status === 'ERROR') {
          clearInterval(pollRef.current!);
          setError('Le système a rencontré une erreur. Veuillez réessayer.');
          setStep('config');
        }
      } catch { /* Ignore les erreurs réseau temporaires */ }
    }, 3000);
  }, [token]);

  // ── Action : Étape 1 — Générer le SYLLABUS ──────────────
  const handleGenerateSyllabus = async () => {
    const readySources = sources.filter(s => s.status === 'done');
    if (!subject) { setError('Veuillez entrer un sujet.'); return; }
    if (readySources.length === 0) { setError('Ajoutez au moins une source (PDF, YouTube ou URL).'); return; }
    setError('');
    setIsSyllabusLoading(true);
    try {
      const res = await fetch(`${API_URL}/ai/generate-syllabus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          input_request: subject,
          course_ids: readySources.map(s => s.id),
          age_group: ageGroup,
          level,
          include_code_exercises: includeCodeExercises,
          teacher_notes: teacherNotes,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Erreur génération syllabus');
      const data = await res.json();
      let parsed = data.syllabus;
      if (typeof parsed === 'string') { try { parsed = JSON.parse(parsed); } catch { } }
      const mods: SyllabusModule[] = (parsed?.modules || []).map((m: any, i: number) => ({
        id: `mod-${i}-${Date.now()}`,
        title: m.title || `Module ${i + 1}`,
        objectives: m.objectives || [],
        exercise_mode: m.exercise_mode || 'qcm_only',
      }));
      setSyllabusTitle(parsed?.courseTitle || subject);
      setSyllabusModules(mods);
      setStep('syllabus_review');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsSyllabusLoading(false);
    }
  };

  // ── Action : Étape 2 — Approuver le syllabus et générer le CONTENU ────────────
  const handleApprove = async () => {
    setError('');
    setProgress(0);
    setStep('generating');
    const approvedSyllabus = {
      courseTitle: syllabusTitle,
      modules: syllabusModules.map(m => ({
        title: m.title,
        objectives: m.objectives,
        exercise_mode: m.exercise_mode || 'qcm_only',
      })),
    };
    try {
      const readySources = sources.filter(s => s.status === 'done');
      const res = await fetch(`${API_URL}/ai/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          input_request: subject,
          course_ids: readySources.map(s => s.id),
          age_group: ageGroup,
          level,
          include_code_exercises: includeCodeExercises,
          teacher_feedback: teacherNotes,
          existing_syllabus: JSON.stringify(approvedSyllabus),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Erreur de génération');
      const data = await res.json();
      startPolling(data.draftId);
    } catch (e: any) {
      setError(e.message);
      setStep('syllabus_review');
    }
  };

  // ── Action : Générer (mode rectification via feedback) ───────────────────────
  const handleGenerate = async (teacherFeedback = '') => {
    const readySources = sources.filter(s => s.status === 'done');
    setError('');
    setProgress(0);
    teacherFeedback ? setIsRectifying(true) : setStep('generating');
    try {
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
      const data = await res.json();
      startPolling(data.draftId);
      setFeedback('');
    } catch (e: any) {
      setError(e.message);
      setStep('config');
      setIsRectifying(false);
    } finally {
      setIsRectifying(false);
    }
  };

  // ── Action : Rectification Chirurgicale — MODULES CIBLÉS ────────────────────
  const handleRectifyModule = async (surgicalFeedback: string) => {
    if (!result?.draftId) return;

    setIsRectifying(true);
    setError('');
    setProgress(0);

    try {
      const existingContent = JSON.stringify({
        courseTitle: result.courseTitle,
        level: result.level,
        totalDuration: result.totalDuration,
        objectives: result.objectives,
        modules: result.modules,
        final_project: (result as any).final_project,
      });

      const res = await fetch(`${API_URL}/ai/rectify/${result.draftId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          feedback: surgicalFeedback,
          input_request: subject,
          course_ids: sources.filter(s => s.status === 'done').map(s => s.id),
          age_group: ageGroup,
          level: level,
          include_code_exercises: includeCodeExercises,
          programming_language: (result as any).programming_language || 'Python',
          existing_content: existingContent,
          existing_syllabus: (result as any).syllabus || null,
        }),
      });

      if (!res.ok) throw new Error((await res.json()).message || 'Erreur de rectification');

      const data = await res.json();
      startPolling(data.draftId || result.draftId);
      setFeedback('');
    } catch (e: any) {
      setError(e.message);
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

      {/* ── Section 1 : Sources ── */}
      <Card className="rounded-3xl">
        <CardContent className="p-8 space-y-5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl flex items-center gap-3">
              <Upload className="w-5 h-5 text-purple-500" />
              1. Sources du cours
            </CardTitle>
            <Badge variant={sources.filter(s => s.status === 'done').length > 0 ? 'approved' : 'default'}>
              {sources.filter(s => s.status === 'done').length} source(s) prête(s)
            </Badge>
          </div>
          <p className="text-sm text-slate-400">
            Mixez plusieurs sources — le système les combine toutes pour créer votre cours.
          </p>

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
                  <Button variant="ghost" size="icon"
                    onClick={() => setSources(prev => prev.filter(s => s.id !== src.id))}
                    className="text-slate-400 hover:text-red-500"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            <Button variant="outline"
              onClick={() => { setShowLibraryModal(true); fetchLibrarySources(); }}
              className="border-2 border-dashed border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 h-auto py-4 normal-case tracking-normal font-bold text-sm col-span-full md:col-span-1"
            >
              <Library className="w-4 h-4" /> Choisir depuis la Bibliothèque
            </Button>

            <div className="space-y-2">
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
                <Input
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addUrl()}
                  placeholder="Coller une URL..."
                />
                <Button
                  size="icon"
                  onClick={addUrl}
                  disabled={!urlInput.trim()}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 2 : Paramètres ── */}
      <Card className="rounded-3xl">
        <CardContent className="p-8 space-y-6">
          <CardTitle className="text-xl flex items-center gap-3">
            <Brain className="w-5 h-5 text-blue-500" /> 2. Paramètres du cours
          </CardTitle>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-2">
                Thématique du cours *
              </label>
              <Input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="ex: Les fondamentaux de la robotique"
                className="text-lg h-14"
              />
            </div>

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
                      ? 'Le système générera des exercices de code Python/JS'
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

            <div>
              <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-2">
                Consignes particulières <span className="text-slate-400 font-normal">(optionnel)</span>
              </label>
              <Textarea
                value={teacherNotes}
                onChange={e => setTeacherNotes(e.target.value)}
                placeholder="ex: Utilise des analogies liées au sport, simplifie le vocabulaire..."
                rows={3}
              />
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-500/10 text-red-500 rounded-2xl border border-red-500/20 text-sm flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" /> {error}
            </div>
          )}

          <Button
            size="lg"
            onClick={handleGenerateSyllabus}
            disabled={isSyllabusLoading || !subject || sources.filter(s => s.status === 'done').length === 0}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-xl shadow-blue-500/20 text-lg h-16 rounded-2xl"
          >
            {isSyllabusLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6" />}
            {isSyllabusLoading ? 'Génération du plan...' : `GÉNÉRER LE PLAN — ${sources.filter(s => s.status === 'done').length} SOURCE(S)`}
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  // ════════════════════════════════════════════════════════════
  //  RENDU : Step Generating
  // ════════════════════════════════════════════════════════════
  const renderGenerating = () => (
    <div className="flex flex-col items-center justify-center py-32 space-y-10 animate-in fade-in duration-700">
      <div className="relative">
        <div className="w-28 h-28 rounded-full bg-blue-500/10 flex items-center justify-center">
          <Brain className="w-14 h-14 text-blue-500 animate-pulse" />
        </div>
        <div className="absolute -top-1 -right-1 w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center animate-bounce shadow-lg">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
      </div>

      <div className="text-center space-y-4 w-full max-w-md">
        <h3 className="text-2xl font-black">Construction du cours...</h3>

        {/* Texte dynamique de progression */}
        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium h-5 transition-all animate-pulse">
          {agentStatus}
        </p>

        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${Math.max(progress, 5)}%` }}
          />
        </div>
        <p className="text-blue-500 font-black text-xl">{progress}%</p>

        <div className="flex flex-wrap justify-center gap-2 mt-4">
          {[
            { label: 'Architecte', done: progress >= 30 },
            { label: 'Rédacteur', done: progress >= 70 },
            { label: 'Critique', done: progress >= 100 },
          ].map((agent) => (
            <span
              key={agent.label}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 ${agent.done
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                }`}
            >
              {agent.done ? <CheckCircle className="w-3 h-3" /> : <Loader2 className={`w-3 h-3 ${progress > 0 && !agent.done ? 'animate-spin' : ''}`} />}
              {agent.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════
  //  RENDU : Step Review
  // ════════════════════════════════════════════════════════════
  const renderReview = () => {
    if (!result) return null;
    const currentModule = result.modules?.[activeModuleIndex];

    return (
      <div className="space-y-6 pb-28 animate-in slide-in-from-bottom-4 duration-500">
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
              M{mod.order ?? i + 1} — {mod.title.length > 20 ? mod.title.slice(0, 20) + '...' : mod.title}
            </button>
          ))}
        </div>

        {currentModule && (() => {
          const rawContent = currentModule.content;
          const isContentError = !rawContent || typeof rawContent === 'object' || rawContent === '[object Object]' || String(rawContent).trim() === '';

          const safeContent = (() => {
            if (isContentError) return '';
            const c = rawContent as any;
            if (typeof c === 'string') return c;
            if (Array.isArray(c)) return c.join('\n\n');
            if (c && typeof c === 'object') return Object.values(c as Record<string, any>).join('\n\n');
            return String(c || '');
          })();

          const wordCount = (currentModule as any).wordCount ?? (isContentError ? 0 : safeContent.split(/\s+/).filter(Boolean).length);

          return (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl">
              <div className="px-8 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
                <div>
                  <h3 className="font-black text-lg flex items-center gap-3">
                    <BookOpen className="w-5 h-5 text-blue-500" />
                    Module {currentModule.order ?? activeModuleIndex + 1} : {currentModule.title}
                  </h3>
                  {currentModule.summary && (
                    <p className="text-sm text-slate-400 mt-1">{currentModule.summary}</p>
                  )}
                </div>
                <span className={`px-3 py-1 text-xs font-black rounded-full ${wordCount === 0 ? 'bg-red-100 text-red-600 animate-pulse' :
                  wordCount < 500 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                  {wordCount === 0 ? 'Erreur : VIDE' : `${wordCount} mots`}
                </span>
              </div>
              <div className="p-8 prose dark:prose-invert max-w-none max-h-[600px] overflow-y-auto">
                {isContentError ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                    <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center">
                      <AlertCircle className="w-8 h-8" />
                    </div>
                    <p className="font-bold text-slate-700">Erreur de structure détectée</p>
                    <p className="text-sm text-slate-400 max-w-xs">Le contenu n'a pas pu être rendu. Utilisez la rectification ciblée ci-dessous.</p>
                  </div>
                ) : (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{safeContent}</ReactMarkdown>
                )}
              </div>

              {!((currentModule as any).is_synthesis) && currentModule.exercises_text?.length > 0 && (
                <div className="border-t border-slate-100 dark:border-slate-800">
                  <details className="group">
                    <summary className="flex items-center justify-between px-8 py-4 cursor-pointer bg-purple-50/50 dark:bg-purple-900/10 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors">
                      <span className="text-sm font-black text-purple-700 dark:text-purple-400 flex items-center gap-2">
                        <BookOpen className="w-4 h-4" /> {currentModule.exercises_text.length} Exercice(s) QCM
                      </span>
                      <span className="text-purple-400 text-xs group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <div className="px-8 py-6 space-y-6">
                      {currentModule.exercises_text.map((ex: any, ei: number) => {
                        const qText = ex.question || ex.enonce || ex.titre || ex.texte || ex.title || `Question ${ei + 1}`;
                        const opts: string[] = Array.isArray(ex.options) ? ex.options
                          : Array.isArray(ex.propositions) ? ex.propositions
                            : Array.isArray(ex.choices) ? ex.choices
                              : Array.isArray(ex.reponses) ? ex.reponses : [];
                        const correctAns = ex.answer ?? ex.bonne_reponse ?? ex.correct_answer ?? ex.reponse ?? ex.correctAnswer ?? '';
                        const explText = ex.explanation || ex.explication || ex.justification || '';
                        return (
                          <div key={ei} className="p-5 bg-white dark:bg-slate-800 rounded-2xl border border-purple-100 dark:border-purple-900/30 shadow-sm">
                            <p className="font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                              <span className="inline-flex items-center justify-center w-6 h-6 bg-purple-600 text-white text-xs rounded-full shrink-0">{ei + 1}</span>
                              {qText}
                            </p>
                            {opts.length > 0 && (
                              <div className="space-y-2 mb-4">
                                {opts.map((opt: string, oi: number) => {
                                  const letter = String.fromCharCode(65 + oi);
                                  const isCorrect = String(correctAns).toUpperCase() === letter
                                    || String(correctAns).toLowerCase() === opt.toLowerCase()
                                    || String(correctAns) === String(oi);
                                  return (
                                    <div key={oi} className={`flex items-center gap-3 p-3 rounded-xl text-sm border transition-colors ${isCorrect
                                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-300'
                                      : 'bg-slate-50 border-slate-200 dark:bg-slate-700/50 dark:border-slate-600'
                                      }`}>
                                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isCorrect ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
                                        }`}>{letter}</span>
                                      {opt}
                                      {isCorrect && <span className="ml-auto text-emerald-600 dark:text-emerald-400 text-xs font-black">Correct</span>}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            {explText && (
                              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                                <p className="text-xs font-black text-blue-700 dark:text-blue-400 mb-1 flex items-center gap-1"><Brain className="w-3 h-3" /> Explication</p>
                                <p className="text-sm text-blue-800 dark:text-blue-300">{explText}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </details>
                </div>
              )}

              {!((currentModule as any).is_synthesis) && currentModule.exercises_code?.length > 0 && (
                <div className="border-t border-slate-100 dark:border-slate-800">
                  <details className="group">
                    <summary className="flex items-center justify-between px-8 py-4 cursor-pointer bg-emerald-50/50 dark:bg-emerald-900/10 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">
                      <span className="text-sm font-black text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                        <Code2 className="w-4 h-4" />
                        {currentModule.exercises_code.length} Exercice(s) de Code
                      </span>
                      <span className="text-emerald-400 text-xs group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <div className="px-8 py-6 space-y-6">
                      {currentModule.exercises_code.map((ex: any, ei: number) => (
                        <div key={ei} className="p-5 bg-white dark:bg-slate-800 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 shadow-sm">
                          <p className="font-bold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-2">
                            <span className="inline-flex items-center justify-center w-6 h-6 bg-emerald-600 text-white text-xs rounded-full">{ei + 1}</span>
                            {ex.title || `Défi ${ei + 1}`}
                          </p>
                          {ex.instructions && (
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{ex.instructions}</p>
                          )}
                          {ex.starterCode && (
                            <div className="mb-3">
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Code de départ</p>
                              <pre className="bg-slate-900 text-emerald-400 rounded-xl p-4 text-sm overflow-x-auto font-mono">{ex.starterCode}</pre>
                            </div>
                          )}
                          {ex.solution && (
                            <details className="mt-3">
                              <summary className="cursor-pointer text-xs font-black text-amber-600 hover:text-amber-700 uppercase tracking-widest">Voir la solution</summary>
                              <pre className="mt-2 bg-slate-900 text-amber-300 rounded-xl p-4 text-sm overflow-x-auto font-mono">{ex.solution}</pre>
                            </details>
                          )}
                          {ex.hints?.length > 0 && (
                            <details className="mt-3">
                              <summary className="cursor-pointer text-xs font-black text-blue-600 uppercase tracking-widest flex items-center gap-1"><Sparkles className="w-3 h-3" /> Indices ({ex.hints.length})</summary>
                              <ul className="mt-2 space-y-1">
                                {ex.hints.map((h: string, hi: number) => (
                                  <li key={hi} className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2"><div className="w-1 h-1 bg-blue-400 rounded-full" />{h}</li>
                                ))}
                              </ul>
                            </details>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              )}

              <div className="p-6 bg-amber-50/60 dark:bg-amber-900/10 border-t border-amber-100 dark:border-amber-900/30 flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-amber-600 mb-2">
                    Feedback ciblé — Module {currentModule.order}
                  </label>
                  <Input
                    value={moduleFeedbacks[currentModule.order] || ''}
                    onChange={e => setModuleFeedbacks(prev => ({ ...prev, [currentModule.order]: e.target.value }))}
                    placeholder="ex: Explique mieux ce concept..."
                    className="h-12"
                  />
                </div>
                <Button
                  variant="amber"
                  size="lg"
                  disabled={rectifyingModule === currentModule.order}
                  onClick={async () => {
                    const modFeedback = moduleFeedbacks[currentModule.order] || 'Révision et amélioration demandées.';
                    const surgicalFeedback = `CRITIQUE TECHNIQUE : Les modules suivants sont insuffisants ou vides : '${currentModule.title}' [${modFeedback}]. Sophie, tu dois RE-GÉNÉRER ce contenu spécifiquement. Assure-toi d'atteindre au moins 800 mots.`;
                    setRectifyingModule(currentModule.order ?? activeModuleIndex + 1);
                    await handleRectifyModule(surgicalFeedback);
                    setRectifyingModule(null);
                  }}
                  className="h-12 px-5 flex-shrink-0"
                >
                  {rectifyingModule === currentModule.order ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                  <span className="ml-2 text-xs">Rectifier M{currentModule.order}</span>
                </Button>
              </div>
            </div>
          );
        })()}

        {(result as any).final_project && Object.keys((result as any).final_project).length > 0 && (() => {
          const fp = (result as any).final_project;
          const rawSteps: any[] = Array.isArray(fp.steps) ? fp.steps : typeof fp.steps === 'string' ? fp.steps.replace(/\\n/g, '\n').split('\n') : [];
          const steps: string[] = rawSteps.map((s: any) => String(s ?? '').replace(/^[\n\r]+/, '').replace(/[\n\r]+$/, '').trim()).filter((s: string) => s.length > 3 && s !== 'n' && s !== '\\n');
          return (
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-3xl border border-indigo-200 dark:border-indigo-800 overflow-hidden shadow-xl">
              <div className="px-8 py-5 border-b border-indigo-100 dark:border-indigo-800 flex items-center gap-4 bg-gradient-to-r from-indigo-600 to-purple-600">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                  <Rocket className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-black text-xl text-white">{fp.title || 'Projet Final'}</h3>
                  <p className="text-xs text-white/70 uppercase tracking-widest font-bold">Synthèse des compétences</p>
                </div>
              </div>
              <div className="p-8 space-y-8">
                {fp.context && (
                  <div className="p-5 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                    <p className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-2 flex items-center gap-1"><Globe className="w-3 h-3" /> Contexte Réel</p>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{fp.context}</p>
                  </div>
                )}
                {fp.mission && (
                  <div className="p-5 bg-purple-50 dark:bg-purple-900/20 rounded-2xl border border-purple-100 dark:border-purple-800">
                    <p className="text-xs font-black uppercase tracking-widest text-purple-600 dark:text-purple-400 mb-2 flex items-center gap-1"><Rocket className="w-3 h-3" /> Ta Mission</p>
                    <p className="text-slate-800 dark:text-slate-200 font-bold text-lg leading-relaxed">{fp.mission}</p>
                  </div>
                )}
                {steps.length > 0 && (
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-4 flex items-center gap-1"><BookOpen className="w-3 h-3" /> Étapes du Projet</p>
                    <ol className="space-y-3">
                      {steps.map((step: string, i: number) => {
                        const [stepText, hintText] = step.split(/→\s*Hint\s*:/i);
                        return (
                          <li key={i} className="flex items-start gap-3">
                            <span className="w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5">{i + 1}</span>
                            <div className="flex-1">
                              <p className="text-sm text-slate-700 dark:text-slate-300">{stepText?.trim()}</p>
                              {hintText && (
                                <details className="mt-1">
                                  <summary className="cursor-pointer text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">Voir l'indice</summary>
                                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-300 pl-2 border-l-2 border-amber-300">{hintText.trim()}</p>
                                </details>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                )}
                {Array.isArray(fp.deliverables) && fp.deliverables.length > 0 && (() => {
                  const cleanDeliverables = fp.deliverables.map((d: any) => String(d ?? '').trim()).filter((d: string) => d.length > 3 && d !== 'n' && d !== '\\n');
                  if (cleanDeliverables.length === 0) return null;
                  return (
                    <div className="p-5 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800">
                      <p className="text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-3 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Livrables Attendus</p>
                      <ul className="space-y-2">
                        {cleanDeliverables.map((d: string, i: number) => (
                          <li key={i} className="flex items-center gap-2 text-sm text-emerald-800 dark:text-emerald-300">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />{d}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })()}
                {fp.solution_hint && (
                  <details className="group">
                    <summary className="cursor-pointer flex items-center gap-2 text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">
                      <span className="group-open:hidden">Voir la solution complète (Professeur)</span>
                      <span className="hidden group-open:inline">Masquer la solution</span>
                    </summary>
                    <pre className="mt-3 bg-slate-900 text-amber-300 rounded-2xl p-5 text-sm overflow-x-auto font-mono leading-relaxed">{fp.solution_hint}</pre>
                  </details>
                )}
              </div>
            </div>
          );
        })()}

        <div className="bg-amber-50 dark:bg-amber-900/10 rounded-3xl border border-amber-200 dark:border-amber-900/30 p-8 space-y-4">
          <label className="text-sm font-black text-amber-700 dark:text-amber-500 flex items-center gap-2">
            <RotateCcw className="w-4 h-4" /> RECTIFICATION PÉDAGOGIQUE GLOBALE
          </label>
          <div className="flex gap-4">
            <Input
              value={feedback} onChange={e => setFeedback(e.target.value)}
              placeholder="ex: Rends les exercices plus complexes..."
              className="flex-1 h-14"
            />
            <Button
              variant="amber"
              size="lg"
              onClick={() => handleGenerate(feedback)}
              disabled={!feedback || isRectifying}
            >
              {isRectifying ? <Loader2 className="w-5 h-5 animate-spin" /> : 'RECTIFIER LE COURS'}
            </Button>
          </div>
        </div>

        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-xl px-6 z-50">
          <div className="bg-white/90 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 p-4 rounded-3xl shadow-2xl flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={handleReject} title="Supprimer" className="text-slate-400 hover:text-red-500">
              <Trash2 className="w-6 h-6" />
            </Button>
            <Button variant="outline" onClick={() => { alert('Brouillon enregistré !'); router.push('/teacher/dashboard'); }} className="flex-1 h-14 normal-case tracking-normal font-black rounded-2xl">
              ENREGISTRER
            </Button>
            <Button size="lg" onClick={handlePublish} className="flex-none bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/30 rounded-2xl">
              <Rocket className="w-5 h-5" /> APPROUVER & PUBLIER
            </Button>
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
      <Button size="lg" asChild className="shadow-xl shadow-blue-500/20 rounded-2xl">
        <Link href="/teacher/dashboard">RETOUR AU DASHBOARD</Link>
      </Button>
    </div>
  );

  // ════════════════════════════════════════════════════════════
  //  RENDU : Step Syllabus Review
  // ════════════════════════════════════════════════════════════
  const renderSyllabusReview = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="text-center space-y-3 py-6">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-full text-emerald-600 dark:text-emerald-400 text-sm font-bold">
          <CheckCircle className="w-4 h-4" /> Plan généré avec succès
        </div>
        <h2 className="text-3xl font-black">Votre Plan de Cours</h2>
        <p className="text-slate-400 text-sm">Réorganisez ou modifiez les modules avant de générer le contenu</p>
      </div>

      <Card className="rounded-3xl">
        <CardContent className="p-6">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Titre du cours</label>
          <input
            className="w-full text-xl font-black bg-transparent outline-none border-b-2 border-transparent focus:border-blue-400 transition pb-1 dark:text-white"
            value={syllabusTitle}
            onChange={e => setSyllabusTitle(e.target.value)}
          />
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-500" />
              {syllabusModules.length} Module{syllabusModules.length > 1 ? 's' : ''}
            </CardTitle>
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <GripVertical className="w-3 h-3" /> Glissez pour réordonner
            </span>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={syllabusModules.map(m => m.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {syllabusModules.map((mod, index) => (
                  <SortableModuleCard
                    key={mod.id} mod={mod} index={index}
                    onUpdate={(id, updates) => setSyllabusModules(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m))}
                    onDelete={(id) => setSyllabusModules(prev => prev.filter(m => m.id !== id))}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <button
            onClick={() => setSyllabusModules(prev => [...prev, {
              id: `mod-new-${Date.now()}`, title: `Nouveau Module ${prev.length + 1}`,
              objectives: ['Décrire l\'objectif ici'], exercise_mode: 'qcm_only',
            }])}
            className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl text-slate-400 hover:text-blue-500 hover:border-blue-300 dark:hover:border-blue-700 transition font-bold text-sm"
          >
            <Plus className="w-4 h-4" /> Ajouter un module
          </button>
        </CardContent>
      </Card>

      {error && (
        <div className="p-4 bg-red-500/10 text-red-500 rounded-2xl border border-red-500/20 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" /> {error}
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={() => setStep('config')} className="h-14 rounded-2xl normal-case tracking-normal">
          <ChevronLeft className="w-4 h-4" /> Retour
        </Button>
        <Button
          size="lg" onClick={handleApprove}
          disabled={syllabusModules.length === 0}
          className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-xl shadow-emerald-500/20 text-lg h-16 rounded-2xl"
        >
          <Rocket className="w-5 h-5" />
          APPROUVER & GÉNÉRER ({syllabusModules.length} modules)
        </Button>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════
  //  RENDU Global
  // ════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <nav className="flex items-center justify-between mb-12">
          <Link href="/teacher/dashboard" className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-slate-900 dark:hover:text-white transition group">
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Retour
          </Link>
          <Brain className="w-10 h-10 text-blue-600 opacity-20" />
        </nav>

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

        <main>
          {step === 'config' && renderConfig()}
          {step === 'syllabus_review' && renderSyllabusReview()}
          {step === 'generating' && renderGenerating()}
          {step === 'review' && renderReview()}
          {step === 'published' && renderPublished()}
        </main>
      </div>

      {/* Modal Bibliothèque */}
      {showLibraryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
              <h2 className="font-black text-xl flex items-center gap-3">
                <Library className="w-6 h-6 text-emerald-500" /> Ma Bibliothèque
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setShowLibraryModal(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>

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

            <div className="p-4 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs text-slate-400 text-center">
                Seules les sources <strong>Prêtes</strong> sont affichées.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}