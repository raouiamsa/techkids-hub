'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/auth.context';
import Link from 'next/link';
import {
  Library, Upload, Trash2, Eye, ExternalLink,
  FileText, Youtube, Globe, CheckCircle, Loader2,
  AlertCircle, ChevronLeft, BookOpen, Plus
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

type IndexingStatus = 'INDEXING' | 'READY' | 'ERROR';
type SourceType = 'PDF' | 'VIDEO' | 'WEBPAGE';

interface ContentSource {
  id: string;
  title: string;
  type: SourceType;
  url: string;
  indexingStatus: IndexingStatus;
  createdAt: string;
}

const StatusBadge = ({ status }: { status: IndexingStatus }) => {
  if (status === 'INDEXING') return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
      <Loader2 className="w-3 h-3 animate-spin" /> Indexation...
    </span>
  );
  if (status === 'READY') return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
      <CheckCircle className="w-3 h-3" /> Prêt
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
      <AlertCircle className="w-3 h-3" /> Erreur
    </span>
  );
};

const TypeIcon = ({ type }: { type: SourceType }) => {
  if (type === 'PDF') return <FileText className="w-5 h-5 text-red-500" />;
  if (type === 'VIDEO') return <Youtube className="w-5 h-5 text-red-600" />;
  return <Globe className="w-5 h-5 text-blue-500" />;
};

export default function LibraryPage() {
  const { token } = useAuth();
  const [sources, setSources] = useState<ContentSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urlType, setUrlType] = useState<'VIDEO' | 'WEBPAGE'>('VIDEO');
  const [urlTitle, setUrlTitle] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const fetchSources = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/ai/content-sources`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setSources(Array.isArray(data) ? data : []);
    } catch { /* Ignore */ }
    finally { setLoading(false); }
  }, [token]);

  // Polling automatique si des sources sont encore en INDEXING
  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  useEffect(() => {
    const hasIndexing = sources.some(s => s.indexingStatus === 'INDEXING');
    if (hasIndexing) {
      pollRef.current = setInterval(fetchSources, 5000);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [sources, fetchSources]);

  const uploadPdf = async (file: File) => {
    setUploading(true);
    setError('');
    const form = new FormData();
    form.append('file', file);
    form.append('type', 'PDF');
    try {
      const res = await fetch(`${API_URL}/ai/content-sources`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) throw new Error((await res.json()).message);
      await fetchSources();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const addUrl = async () => {
    if (!urlInput.trim() || !urlTitle.trim()) return;
    setUploading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/ai/content-sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: urlType, url: urlInput.trim(), title: urlTitle.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      setUrlInput('');
      setUrlTitle('');
      await fetchSources();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const deleteSource = async (id: string) => {
    if (!confirm('Supprimer cette source ? L\'action est irréversible.')) return;
    try {
      await fetch(`${API_URL}/ai/content-sources/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setSources(prev => prev.filter(s => s.id !== id));
    } catch { /* Ignore */ }
  };

  const openSource = (source: ContentSource) => {
    if (source.type === 'PDF') {
      // Extrait le nom du fichier depuis le chemin absolu
      const filename = source.url.split(/[\\/]/).pop();
      window.open(`${API_URL}/ai/files/${filename}`, '_blank');
    } else {
      window.open(source.url, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 md:p-10 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/teacher/dashboard" className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-black flex items-center gap-3">
              <Library className="w-8 h-8 text-blue-600" /> Ma Bibliothèque
            </h1>
            <p className="text-slate-500 text-sm mt-1">Gérez vos sources de connaissances pour la génération IA</p>
          </div>
        </div>
        <Link href="/teacher/courses/generator" className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition">
          <BookOpen className="w-4 h-4" /> Générer un cours
        </Link>
      </div>

      {/* Upload Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Upload PDF */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-red-500" /> Ajouter un PDF
          </h2>
          <p className="text-sm text-slate-500">Le document sera vectorisé automatiquement en arrière-plan. Vous pouvez quitter la page.</p>
          <input ref={fileInputRef} type="file" accept=".pdf" className="hidden"
            onChange={e => e.target.files?.[0] && uploadPdf(e.target.files[0])} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full py-4 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 rounded-2xl flex flex-col items-center gap-2 text-slate-500 hover:text-blue-600 transition disabled:opacity-50"
          >
            {uploading ? <Loader2 className="w-8 h-8 animate-spin" /> : <Upload className="w-8 h-8" />}
            <span className="font-semibold text-sm">{uploading ? 'Upload en cours...' : 'Cliquez pour sélectionner un PDF'}</span>
          </button>
        </div>

        {/* Ajouter URL */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-500" /> Ajouter une URL
          </h2>
          <div className="flex gap-2">
            {['VIDEO', 'WEBPAGE'].map(t => (
              <button key={t} onClick={() => setUrlType(t as any)}
                className={`flex-1 py-2 rounded-xl font-bold text-xs transition border-2 ${urlType === t ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}>
                {t === 'VIDEO' ? <><Youtube className="w-3 h-3 inline mr-1" />YouTube</> : <><Globe className="w-3 h-3 inline mr-1" />Page Web</>}
              </button>
            ))}
          </div>
          <input value={urlTitle} onChange={e => setUrlTitle(e.target.value)}
            placeholder="Titre de la ressource" className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 border-none text-sm focus:ring-2 focus:ring-blue-500" />
          <div className="flex gap-2">
            <input value={urlInput} onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addUrl()}
              placeholder="Coller une URL..." className="flex-1 px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 border-none text-sm focus:ring-2 focus:ring-blue-500" />
            <button onClick={addUrl} disabled={!urlInput.trim() || !urlTitle.trim() || uploading}
              className="p-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl transition">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-500/10 text-red-500 rounded-2xl border border-red-500/20 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" /> {error}
        </div>
      )}

      {/* Liste des sources */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="font-bold text-lg">Mes Sources ({sources.length})</h2>
          {sources.some(s => s.indexingStatus === 'INDEXING') && (
            <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Mise à jour automatique...
            </span>
          )}
        </div>

        {loading ? (
          <div className="p-16 flex flex-col items-center gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-sm">Chargement de la bibliothèque...</p>
          </div>
        ) : sources.length === 0 ? (
          <div className="p-16 flex flex-col items-center gap-3 text-slate-400">
            <Library className="w-12 h-12 opacity-40" />
            <p className="font-semibold">Bibliothèque vide</p>
            <p className="text-sm">Ajoutez des PDFs ou des liens pour commencer</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {sources.map(source => (
              <div key={source.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                <TypeIcon type={source.type} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{source.title}</p>
                  <p className="text-xs text-slate-400 truncate mt-0.5">{source.url}</p>
                </div>
                <StatusBadge status={source.indexingStatus} />
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => openSource(source)}
                    title={source.type === 'PDF' ? 'Visualiser le PDF' : 'Ouvrir le lien'}
                    className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition text-slate-600 dark:text-slate-400"
                  >
                    {source.type === 'PDF' ? <Eye className="w-4 h-4" /> : <ExternalLink className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => deleteSource(source.id)}
                    title="Supprimer"
                    className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-xl transition text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
