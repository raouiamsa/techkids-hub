'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, BookOpen,
  Code, FileText, ArrowLeft, RefreshCw,
  Loader2, GraduationCap, ListChecks, Rocket, HelpCircle,
  AlertTriangle, CheckCircle
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import Link from 'next/link';
import { io } from 'socket.io-client';
import { useAuth } from '../../../contexts/auth.context';
import {
  Button,
  Badge,
  Card,
  CardContent,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Textarea,
  getDraftStatusVariant,
} from '@org/ui-components';

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
  const [isRectifying, setIsRectifying] = useState(false);
  const [feedback, setFeedback] = useState('');

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

      // On sauvegarde qu'on a vu ces drafts
      const pendingCount = list.filter((d: any) => d.status !== 'PUBLISHED' && d.status !== 'FAILED').length;
      localStorage.setItem('seenDraftsCount', pendingCount.toString());

      // Met à jour l'objet sélectionné avec les données fraîches sans perdre le focus
      if (selectedDraft) {
        const updated = list.find((d: any) => d.id === selectedDraft.id);
        if (updated) setSelectedDraft(updated);
      } else if (list.length > 0) {
        setSelectedDraft(list[0]);
      }
    } catch (err) {
      console.error('Erreur Fetching Drafts:', err);
    } finally {
      setLoading(false);
    }
  }, [token, selectedDraft?.id]);

  // Connexion WebSocket pour le temps réel (Ping Invalidation)
  useEffect(() => {
    fetchDrafts();

    // Le serveur WebSocket tourne sur la même adresse que l'API (sans le path /api)
    const socketUrl = API_URL.replace('/api', '');
    const socket = io(socketUrl, { transports: ['websocket'] });

    socket.on('connect', () => {
      console.log(' Connecté au temps réel (Brouillons)');
    });

    socket.on('draft_progress', (data) => {
      console.log(' Mise à jour WebSocket reçue pour le draft:', data.draftId);
      fetchDrafts(); // Fetch complet pour actualiser (Ping)
    });

    return () => {
      socket.disconnect();
    };
  }, [fetchDrafts]);

  // 2. Logique de Publication
  const handlePublish = async (id: string) => {
    if (!confirm('Voulez-vous vraiment publier ce cours ? Il sera visible par les élèves.')) return;
    setIsPublishing(true);
    try {
      const res = await fetch(`${API_URL}/ai/publish/${id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      alert(' Cours publié avec succès !');
      fetchDrafts();
    } catch {
      alert(' Erreur lors de la publication.');
    } finally {
      setIsPublishing(false);
    }
  };

  // 3. Logique de Rejet (Suppression)
  const handleReject = async (id: string) => {
    if (!confirm('Supprimer définitivement ce brouillon ?')) return;
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
      alert(' Erreur lors de la suppression.');
    } finally {
      setIsRejecting(false);
    }
  };

  // 4. Logique de Rectification (Human-in-the-loop)
  const handleRectify = async (id: string) => {
    if (!feedback.trim()) {
      alert('Veuillez écrire un feedback avant de régénérer.');
      return;
    }
    if (!confirm("Régénérer ce cours avec votre feedback ? L'IA va reprendre le travail.")) return;
    setIsRectifying(true);
    try {
      const res = await fetch(`${API_URL}/ai/rectify/${id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback }),
      });
      if (!res.ok) throw new Error();
      setFeedback('');
      alert(' Rédacteur a reçu votre feedback et relance la génération !');
      fetchDrafts();
    } catch {
      alert(" Erreur lors de l'envoi du feedback.");
    } finally {
      setIsRectifying(false);
    }
  };

  // 5. Helpers : Parsing des données riches renvoyées par le Canvas AI
  const parseRichContent = (d: any): DraftContent | null => {
    if (!d?.content || d.content.length === 0) return null;
    try {
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
          <Button variant="outline" size="sm" asChild>
            <Link href="/teacher/dashboard">
              <ArrowLeft size={16} /> Retour Dashboard
            </Link>
          </Button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* --- SIDEBAR : LISTE --- */}
          <aside className="lg:col-span-3 space-y-4 border-r border-white/5 pr-4">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 px-2">Brouillons en attente</h2>
            <div className="space-y-3">
              {drafts.length === 0 ? (
                <div className="text-center py-10 bg-slate-900/50 rounded-[2rem] border border-dashed border-slate-800 text-slate-600 text-xs italic">
                  Aucun brouillon détecté.
                </div>
              ) : drafts.map(d => (
                <Card
                  key={d.id}
                  onClick={() => setSelectedDraft(d)}
                  className={`p-5 cursor-pointer transition-all border-2 rounded-[2rem] ${selectedDraft?.id === d.id
                    ? 'bg-blue-600 border-blue-400 shadow-2xl scale-[1.02]'
                    : 'hover:border-slate-700'
                    }`}
                >
                  <CardContent className="p-0 space-y-2">
                    {/* Status + pourcentage */}
                    <div className="flex justify-between items-center">
                      <Badge variant={getDraftStatusVariant(d.status)}>
                        {d.status}
                      </Badge>
                      <span className="text-[10px] font-black">{d.progressPercent}%</span>
                    </div>

                    <h3 className="font-bold text-sm truncate">{d.title || d.source?.title || 'Cours sans titre'}</h3>

                    {/* Badge AI Score */}
                    {d.aiScore != null && (
                      <Badge variant={
                        d.aiScore >= 80 ? 'approved' :
                          d.aiScore >= 60 ? 'pending' : 'rejected'
                      }>
                        AI Score : {d.aiScore}/100
                      </Badge>
                    )}

                    {/* Barre de progression */}
                    <div className="w-full bg-black/20 h-1 rounded-full overflow-hidden">
                      <div className="bg-white h-full transition-all duration-700" style={{ width: `${d.progressPercent}%` }} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </aside>

          {/* --- MAIN : AUDIT --- */}
          <main className="lg:col-span-9 bg-slate-900/30 rounded-[3rem] border border-slate-800/50 overflow-hidden h-[850px] flex flex-col shadow-2xl shadow-blue-500/5">
            {!selectedDraft ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-600 italic">
                <FileText size={64} className="mb-4 opacity-10" />
                <p>Sélectionnez un brouillon pour auditer les ressources...</p>
              </div>
            ) : (
              <>
                {/* Navigation par Onglets (shadcn Tabs) */}
                <Tabs
                  value={activeTab}
                  onValueChange={(v) => setActiveTab(v as 'content' | 'exams' | 'project')}
                  className="flex flex-col flex-1 overflow-hidden"
                >
                  <TabsList>
                    <TabsTrigger value="content" disabled={selectedDraft.status === 'PROCESSING'}>
                      <BookOpen size={14} className="mr-2" /> Modules & Leçons
                    </TabsTrigger>
                    <TabsTrigger value="exams" disabled={selectedDraft.status === 'PROCESSING'}>
                      <ListChecks size={14} className="mr-2" /> Banques QCM
                    </TabsTrigger>
                    <TabsTrigger value="project" disabled={selectedDraft.status === 'PROCESSING'}>
                      <GraduationCap size={14} className="mr-2" /> Projet Final
                    </TabsTrigger>
                  </TabsList>

                  {/* Zone de Contenu */}
                  <div className="flex-1 overflow-y-auto p-10 bg-slate-900/30">

                    {/* État PROCESSING : Spinner global */}
                    {selectedDraft.status === 'PROCESSING' ? (
                      <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
                        <Loader2 className="animate-spin text-blue-500" size={64} />
                        <div className="space-y-2">
                          <p className="font-black text-blue-400 uppercase tracking-[0.3em] text-sm">Sophie Chen met à jour le cours...</p>
                          <p className="text-slate-500 text-xs italic">Progression : {selectedDraft.progressPercent}%</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* ─── Onglet Modules & Leçons ─── */}
                        <TabsContent value="content" className="space-y-12 mt-0">
                          {!richContent ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-600 gap-4">
                              <Loader2 className="animate-spin" size={32} />
                              <p className="italic">Génération du contenu pédagogique en cours...</p>
                            </div>
                          ) : richContent.modules.map((m: any, index: number) => (
                            <section key={m.id || `module-${m.order}-${index}`} className="space-y-6">
                              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <h4 className="text-2xl font-black text-blue-400 flex items-center gap-3">
                                  <span className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-sm">M{m.order}</span>
                                  {m.title}
                                </h4>
                                {selectedDraft.status === 'PENDING_REVIEW' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-amber-500 border-amber-500/50 hover:bg-amber-500/10"
                                    onClick={() => {
                                      setFeedback(prev => prev ? `${prev}\n'${m.title}' [A REVOIR: ]` : `'${m.title}' [A REVOIR: ]`);
                                      document.getElementById('feedback-box')?.scrollIntoView({ behavior: 'smooth' });
                                    }}
                                  >
                                    <RefreshCw size={14} className="mr-2" />
                                    Rectifier ce module
                                  </Button>
                                )}
                              </div>
                              <div className="prose prose-invert max-w-none bg-slate-800/40 p-8 rounded-[2.5rem] border border-slate-800 leading-relaxed italic text-slate-300">
                                <ReactMarkdown>{m.content}</ReactMarkdown>
                              </div>

                              {m.exercises_code?.length > 0 && (
                                <div className="grid gap-4 mt-8">
                                  <p className="text-[10px] font-black uppercase text-emerald-500 flex items-center gap-2 tracking-widest">
                                    <Code size={14} /> Solutions de Code vérifiées (Agent Qwen)
                                  </p>
                                  {m.exercises_code.map((ex: any, i: number) => (
                                    <Card key={i} className="bg-slate-950 border-emerald-500/10 rounded-[2rem]">
                                      <CardContent className="p-6 grid grid-cols-2 gap-8">
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
                                      </CardContent>
                                    </Card>
                                  ))}
                                </div>
                              )}
                            </section>
                          ))}
                        </TabsContent>

                        {/* ─── Onglet Banques QCM ─── */}
                        <TabsContent value="exams" className="space-y-10 mt-0">
                          {/* Diagnostic */}
                          <Card className="border-2 border-dashed border-amber-500/20 bg-amber-500/5 rounded-[3rem]">
                            <CardContent className="p-8 space-y-6">
                              <h3 className="font-black text-amber-500 flex items-center gap-3 uppercase tracking-tighter text-xl">
                                <ListChecks className="w-6 h-6" /> Test de Placement
                              </h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {placementExams.length > 0 ? placementExams.map((q: any, i: number) => (
                                  <Card key={i} className="bg-slate-800/50">
                                    <CardContent className="p-5 space-y-3">
                                      <p className="font-bold text-xs text-slate-200">{q.question}</p>
                                      <Badge variant="approved">
                                        <CheckCircle size={10} /> {q.correct_answer}
                                      </Badge>
                                    </CardContent>
                                  </Card>
                                )) : <p className="text-slate-600 text-sm italic">Aucun test de placement généré.</p>}
                              </div>
                            </CardContent>
                          </Card>

                          {/* Certification */}
                          <Card className="border-2 border-dashed border-blue-500/20 bg-blue-500/5 rounded-[3rem]">
                            <CardContent className="p-8 space-y-6">
                              <h3 className="font-black text-blue-500 flex items-center gap-3 uppercase tracking-tighter text-xl">
                                <GraduationCap className="w-6 h-6" /> Examen de Certification
                              </h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {certificationExams.length > 0 ? certificationExams.map((q: any, i: number) => (
                                  <Card key={i} className="bg-slate-800/50">
                                    <CardContent className="p-5 space-y-2">
                                      <p className="font-bold text-xs text-slate-200">{q.question}</p>
                                      <p className="text-[10px] text-blue-400 italic bg-blue-500/10 p-3 rounded-xl border border-blue-500/10 leading-snug">
                                        {q.explanation}
                                      </p>
                                    </CardContent>
                                  </Card>
                                )) : <p className="text-slate-600 text-sm italic">Aucun examen de certification généré.</p>}
                              </div>
                            </CardContent>
                          </Card>
                        </TabsContent>

                        {/* ─── Onglet Projet Final ─── */}
                        <TabsContent value="project" className="mt-0">
                          <div className="p-12 bg-gradient-to-br from-indigo-600/10 via-blue-600/10 to-transparent rounded-[4rem] border border-blue-500/20 space-y-8 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-10 opacity-5">
                              <Rocket size={200} />
                            </div>
                            {finalProject?.title ? (
                              <>
                                <div className="space-y-4">
                                  <Badge variant="processing" className="px-4 py-1.5 rounded-full text-[10px] bg-blue-600 text-white border-0">
                                    Capstone Project
                                  </Badge>
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
                        </TabsContent>
                      </>
                    )}
                  </div>
                </Tabs>

                {/* --- FOOTER --- */}
                <div className="bg-slate-900 border-t border-slate-800 relative z-10">

                  {/* Zone Feedback (visible uniquement si PENDING_REVIEW) */}
                  {selectedDraft.status === 'PENDING_REVIEW' && (
                    <div id="feedback-box" className="px-10 pt-8 pb-4 border-b border-slate-800/60 space-y-3">
                      <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-500 flex items-center gap-2">
                        <RefreshCw size={10} /> Feedback pour Régénération (Human-in-the-loop)
                      </p>
                      <Textarea
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        placeholder="Ex: Ajoute plus d'exemples concrets, simplifie le module 2, corrige l'exercice de boucles..."
                        rows={2}
                      />
                    </div>
                  )}

                  {/* Actions */}
                  <div className="p-8 flex justify-between items-center gap-4">
                    <div className="flex gap-3">
                      <Button
                        variant="destructive"
                        onClick={() => handleReject(selectedDraft.id)}
                        disabled={isRejecting || selectedDraft.status === 'APPROVED' || selectedDraft.status === 'PROCESSING'}
                      >
                        {isRejecting ? <Loader2 className="animate-spin w-4 h-4" /> : null}
                        Rejeter
                      </Button>

                      {selectedDraft.status === 'PENDING_REVIEW' && (
                        <Button
                          variant="amber"
                          onClick={() => handleRectify(selectedDraft.id)}
                          disabled={isRectifying || !feedback.trim()}
                        >
                          {isRectifying ? <Loader2 className="animate-spin w-4 h-4" /> : <RefreshCw size={14} />}
                          Régénérer avec feedback
                        </Button>
                      )}
                    </div>

                    <Button
                      size="lg"
                      onClick={() => handlePublish(selectedDraft.id)}
                      disabled={isPublishing || selectedDraft.status === 'APPROVED' || selectedDraft.status === 'PROCESSING'}
                      className="shadow-2xl shadow-blue-500/40"
                    >
                      {isPublishing ? <Loader2 className="animate-spin w-4 h-4" /> : <Rocket size={18} />}
                      {selectedDraft.status === 'APPROVED' ? 'COURS DÉPLOYÉ' : 'APPROUVER & PUBLIER'}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}