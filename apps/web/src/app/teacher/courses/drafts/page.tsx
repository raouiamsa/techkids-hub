'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, BookOpen, CheckCircle,
  Code, FileText, ArrowLeft,
  Loader2, GraduationCap, ListChecks, Rocket, HelpCircle, AlertTriangle
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import Link from 'next/link';
import { useAuth } from '../../../contexts/auth.context';

// --- Configuration de l'API ---
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

/**
 * Interface pour le contenu structuré envoyé par Sophie Chen (v2)
 */
interface DraftContent {
  courseTitle: string;
  modules: {
    order: number;
    title: string;
    content: string;
    summary?: string;
    exercises_text: any[];
    exercises_code: any[];
  }[];
  finalProject?: {
    title: string;
    description: string;
    steps: string[];
    solution_hint: string;
  };
}

export default function DraftManagementPage() {
  const { token } = useAuth();
  const [drafts, setDrafts] = useState<any[]>([]);
  const [selectedDraft, setSelectedDraft] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'content' | 'exams' | 'project'>('content');
  const [isPublishing, setIsPublishing] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  // 1. Récupération des brouillons (avec logique de synchronisation de sélection)
  const fetchDrafts = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/ai/drafts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setDrafts(list);

      // Met à jour l'objet sélectionné avec les données fraîches sans perdre le focus
      if (selectedDraft) {
        const updated = list.find((d: any) => d.id === selectedDraft.id);
        if (updated) setSelectedDraft(updated);
      } else if (list.length > 0) {
        setSelectedDraft(list[0]);
      }
    } catch (err) {
      console.error("Erreur Fetching Drafts:", err);
    } finally {
      setLoading(false);
    }
  }, [token, selectedDraft?.id]); // On ne dépend que de l'ID pour éviter les boucles infinies

  // Polling stable toutes les 5 secondes (Télémétrie en temps réel)
  useEffect(() => {
    fetchDrafts();
    const interval = setInterval(fetchDrafts, 5000);
    return () => clearInterval(interval);
  }, [fetchDrafts]);

  // 2. Logique de Publication
  const handlePublish = async (id: string) => {
    if (!confirm("Voulez-vous vraiment publier ce cours ? Il sera visible par les élèves.")) return;
    setIsPublishing(true);
    try {
      const res = await fetch(`${API_URL}/ai/publish/${id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      alert("✅ Cours publié avec succès !");
      fetchDrafts();
    } catch {
      alert("❌ Erreur lors de la publication.");
    } finally {
      setIsPublishing(false);
    }
  };

  // 3. Logique de Rejet (Suppression)
  const handleReject = async (id: string) => {
    if (!confirm("Supprimer définitivement ce brouillon ?")) return;
    setIsRejecting(true);
    try {
      const res = await fetch(`${API_URL}/ai/reject/${id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      setSelectedDraft(null);
      fetchDrafts();
    } catch {
      alert("❌ Erreur lors de la suppression.");
    } finally {
      setIsRejecting(false);
    }
  };

  // 4. Helpers : Parsing des données riches renvoyées par le Canvas AI
  const parseRichContent = (d: any): DraftContent | null => {
    if (!d?.content || d.content.length === 0) return null;
    try {
      // On prend le dernier élément du tableau (version la plus récente)
      const lastEntry = d.content[d.content.length - 1];
      return typeof lastEntry === 'string' ? JSON.parse(lastEntry) : lastEntry;
    } catch {
      return null;
    }
  };

  const parseJSONField = (field: any) => {
    try {
      return typeof field === 'string' ? JSON.parse(field) : (field ?? []);
    } catch {
      return [];
    }
  };

  const richContent = parseRichContent(selectedDraft);
  const placementExams = parseJSONField(selectedDraft?.placementBank);
  const certificationExams = parseJSONField(selectedDraft?.certificationBank);

  // Le projet final peut être dans richContent (v2) ou dans sa propre colonne
  const finalProject = richContent?.finalProject ?? parseJSONField(selectedDraft?.finalProject);

  if (loading && drafts.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <Loader2 className="animate-spin mb-4 text-blue-500" size={48} />
        <p className="animate-pulse font-bold uppercase tracking-widest text-xs">Synchronisation avec Sophie Chen...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <header className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-black flex items-center gap-3 tracking-tighter">
              <LayoutDashboard className="text-blue-500" /> HUB DE <span className="text-blue-500">GESTION</span>
            </h1>
            <p className="text-slate-400 mt-2 italic font-medium">Révision et audit des contenus générés par l'IA (v2).</p>
          </div>
          <Link href="/teacher/dashboard" className="flex items-center gap-2 text-slate-400 hover:text-white transition bg-slate-900 px-6 py-3 rounded-2xl border border-slate-800 font-bold text-xs uppercase tracking-widest">
            <ArrowLeft size={16} /> Retour Dashboard
          </Link>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* --- SIDEBAR : LISTE --- */}
          <aside className="lg:col-span-3 space-y-4">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 px-2">Brouillons en attente</h2>
            <div className="space-y-3">
              {drafts.length === 0 ? (
                <div className="text-center py-10 bg-slate-900/50 rounded-[2rem] border border-dashed border-slate-800 text-slate-600 text-xs italic">
                  Aucun brouillon détecté.
                </div>
              ) : drafts.map(d => (
                <div
                  key={d.id}
                  onClick={() => setSelectedDraft(d)}
                  className={`p-5 rounded-[2rem] border-2 cursor-pointer transition-all ${selectedDraft?.id === d.id
                    ? 'bg-blue-600 border-blue-400 shadow-2xl scale-[1.02]'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                >
                  <div className="flex justify-between mb-3">
                    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${selectedDraft?.id === d.id ? 'bg-white/20' : 'bg-slate-800 text-slate-400'}`}>
                      {d.status}
                    </span>
                    <span className="text-[10px] font-black">{d.progressPercent}%</span>
                  </div>
                  <h3 className="font-bold text-sm truncate">{d.title || d.source?.title || 'Cours sans titre'}</h3>
                  {/* AI Score badge */}
                  {d.aiScore != null && (
                    <div className={`mt-2 flex items-center gap-1.5 text-[10px] font-black px-2 py-1 rounded-lg w-fit ${
                      d.aiScore >= 80 ? 'bg-emerald-500/20 text-emerald-400' :
                      d.aiScore >= 60 ? 'bg-amber-500/20 text-amber-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      🤖 AI Score : {d.aiScore}/100
                    </div>
                  )}
                  <div className="w-full bg-black/20 h-1 mt-3 rounded-full overflow-hidden">
                    <div className="bg-white h-full transition-all duration-700" style={{ width: `${d.progressPercent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </aside>

          {/* --- MAIN : AUDIT --- */}
          <main className="lg:col-span-9 bg-slate-900 rounded-[3rem] border border-slate-800 overflow-hidden h-[850px] flex flex-col shadow-2xl">
            {!selectedDraft ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-600 italic">
                <FileText size={64} className="mb-4 opacity-10" />
                <p>Sélectionnez un brouillon pour auditer les ressources...</p>
              </div>
            ) : (
              <>
                {/* Navigation par Onglets */}
                <div className="flex border-b border-slate-800 bg-slate-900/50 backdrop-blur-md">
                  <button onClick={() => setActiveTab('content')} className={`flex-1 py-6 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${activeTab === 'content' ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-500/5' : 'text-slate-500'}`}>
                    <BookOpen size={16} className="inline mr-2" /> Modules & Leçons
                  </button>
                  <button onClick={() => setActiveTab('exams')} className={`flex-1 py-6 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${activeTab === 'exams' ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-500/5' : 'text-slate-500'}`}>
                    <ListChecks size={16} className="inline mr-2" /> Banques QCM
                  </button>
                  <button onClick={() => setActiveTab('project')} className={`flex-1 py-6 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${activeTab === 'project' ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-500/5' : 'text-slate-500'}`}>
                    <GraduationCap size={16} className="inline mr-2" /> Projet Final
                  </button>
                </div>

                {/* Zone de Contenu */}
                <div className="flex-1 overflow-y-auto p-10 space-y-12 bg-slate-900/30 custom-scrollbar">

                  {activeTab === 'content' && (
                    <div className="space-y-12">
                      {!richContent ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-600 gap-4">
                          <Loader2 className="animate-spin" size={32} />
                          <p className="italic">Génération du contenu pédagogique en cours...</p>
                        </div>
                      ) : richContent.modules.map((m: any) => (
                        <section key={m.order} className="space-y-6">
                          <h4 className="text-2xl font-black text-blue-400 flex items-center gap-3">
                            <span className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-sm">M{m.order}</span>
                            {m.title}
                          </h4>
                          <div className="prose prose-invert max-w-none bg-slate-800/40 p-8 rounded-[2.5rem] border border-slate-800 leading-relaxed italic text-slate-300">
                            <ReactMarkdown>{m.content}</ReactMarkdown>
                          </div>

                          {/* Corrigés de Code (Propulsés par Qwen) */}
                          {m.exercises_code?.length > 0 && (
                            <div className="grid gap-4 mt-8">
                              <p className="text-[10px] font-black uppercase text-emerald-500 flex items-center gap-2 tracking-widest">
                                <Code size={14} /> Solutions de Code vérifiées (Agent Qwen)
                              </p>
                              {m.exercises_code.map((ex: any, i: number) => (
                                <div key={i} className="bg-slate-950 p-6 rounded-[2rem] border border-emerald-500/10 grid grid-cols-2 gap-8">
                                  <div className="space-y-2">
                                    <p className="text-[10px] text-slate-500 font-bold uppercase">Énoncé</p>
                                    <p className="text-sm text-slate-400">{ex.instructions}</p>
                                  </div>
                                  <div className="space-y-2">
                                    <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">Code Solution</p>
                                    <pre className="bg-slate-900 p-4 rounded-2xl text-[10px] text-emerald-400 overflow-x-auto font-mono leading-relaxed">
                                      {ex.solution}
                                    </pre>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </section>
                      ))}
                    </div>
                  )}

                  {activeTab === 'exams' && (
                    <div className="space-y-10">
                      {/* Diagnostic */}
                      <div className="p-8 border-2 border-dashed border-amber-500/20 rounded-[3rem] space-y-6 bg-amber-500/5">
                        <h3 className="font-black text-amber-500 flex items-center gap-3 uppercase tracking-tighter text-xl">
                          <ListChecks className="w-6 h-6" /> Test de Placement
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {placementExams.length > 0 ? placementExams.map((q: any, i: number) => (
                            <div key={i} className="p-5 bg-slate-800/50 rounded-3xl border border-slate-800">
                              <p className="font-bold text-xs mb-3 text-slate-200">{q.question}</p>
                              <div className="flex items-center gap-2 text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-3 py-1.5 rounded-xl w-fit">
                                <CheckCircle size={12} /> {q.correct_answer}
                              </div>
                            </div>
                          )) : <p className="text-slate-600 text-sm italic">Aucun test de placement généré.</p>}
                        </div>
                      </div>

                      {/* Certification */}
                      <div className="p-8 border-2 border-dashed border-blue-500/20 rounded-[3rem] space-y-6 bg-blue-500/5">
                        <h3 className="font-black text-blue-500 flex items-center gap-3 uppercase tracking-tighter text-xl">
                          <GraduationCap className="w-6 h-6" /> Examen de Certification
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {certificationExams.length > 0 ? certificationExams.map((q: any, i: number) => (
                            <div key={i} className="p-5 bg-slate-800/50 rounded-3xl border border-slate-800">
                              <p className="font-bold text-xs mb-2 text-slate-200">{q.question}</p>
                              <p className="text-[10px] text-blue-400 italic bg-blue-500/10 p-3 rounded-xl border border-blue-500/10 leading-snug">
                                {q.explanation}
                              </p>
                            </div>
                          )) : <p className="text-slate-600 text-sm italic">Aucun examen de certification généré.</p>}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'project' && (
                    <div className="p-12 bg-gradient-to-br from-indigo-600/10 via-blue-600/10 to-transparent rounded-[4rem] border border-blue-500/20 space-y-8 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-10 opacity-5">
                        <Rocket size={200} />
                      </div>
                      {finalProject?.title ? (
                        <>
                          <div className="space-y-4">
                            <span className="px-4 py-1.5 bg-blue-600 rounded-full text-[10px] font-black tracking-widest uppercase shadow-lg shadow-blue-500/20">Capstone Project</span>
                            <h3 className="text-4xl font-black text-white tracking-tighter">{finalProject.title}</h3>
                            <p className="text-slate-300 leading-relaxed text-lg italic max-w-2xl">"{finalProject.description}"</p>
                          </div>

                          <div className="space-y-4 mt-8">
                            <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.3em]">Feuille de Route</p>
                            <div className="grid gap-3">
                              {finalProject.steps?.map((s: string, i: number) => (
                                <div key={i} className="flex items-center gap-5 bg-slate-950/40 p-5 rounded-3xl border border-white/5 transition-all hover:border-blue-500/30">
                                  <span className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-black text-xs shadow-lg">{i + 1}</span>
                                  <p className="text-sm font-semibold text-slate-200">{s}</p>
                                </div>
                              ))}
                            </div>
                          </div>

                          {finalProject.solution_hint && (
                            <div className="mt-8 p-6 bg-emerald-500/5 border border-emerald-500/10 rounded-3xl flex gap-4 items-start shadow-inner">
                              <HelpCircle className="text-emerald-500 mt-1 shrink-0" />
                              <div>
                                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Guide de correction</p>
                                <p className="text-xs text-emerald-100/60 leading-relaxed italic">{finalProject.solution_hint}</p>
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-center py-20 text-slate-500 italic flex flex-col items-center gap-4">
                          <AlertTriangle className="opacity-20" size={48} />
                          <p>Le projet final est en cours de conception par l'Agent Architecte.</p>
                        </div>
                      )}
                    </div>
                  )}

                </div>

                {/* --- FOOTER --- */}
                <div className="p-10 bg-slate-900 border-t border-slate-800 flex justify-end gap-4 shadow-2xl relative z-10">
                  <button
                    onClick={() => handleReject(selectedDraft.id)}
                    disabled={isRejecting || selectedDraft.status === 'APPROVED'}
                    className="px-10 py-4 bg-slate-800 hover:bg-red-500/20 hover:text-red-500 text-white rounded-[1.5rem] font-black text-xs transition uppercase tracking-[0.2em] border border-white/5 disabled:opacity-40"
                  >
                    {isRejecting ? <Loader2 className="animate-spin w-4 h-4 inline" /> : 'Rejeter'}
                  </button>
                  <button
                    onClick={() => handlePublish(selectedDraft.id)}
                    disabled={isPublishing || selectedDraft.status === 'APPROVED'}
                    className="px-12 py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:grayscale text-white rounded-[1.5rem] font-black text-xs transition uppercase tracking-[0.2em] shadow-2xl shadow-blue-500/40 flex items-center gap-3 active:scale-95"
                  >
                    {isPublishing ? <Loader2 className="animate-spin w-4 h-4" /> : <Rocket size={18} />}
                    {selectedDraft.status === 'APPROVED' ? 'COURS DÉPLOYÉ' : 'APPROUVER & PUBLIER'}
                  </button>
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}