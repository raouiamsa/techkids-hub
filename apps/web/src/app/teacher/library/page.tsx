'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/auth.context';
import { io } from 'socket.io-client';
import Link from 'next/link';
import {
  Library, Upload, Trash2, Eye, ExternalLink,
  FileText, Youtube, Globe, CheckCircle, Loader2,
  AlertCircle, ChevronLeft, BookOpen, Plus
} from 'lucide-react';
import { Button, Badge, Card, CardContent, CardHeader, CardTitle, Input } from '@org/ui-components';

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

// Remplacé par le composant Badge de @org/ui-components
const StatusBadge = ({ status }: { status: IndexingStatus }) => {
  if (status === 'INDEXING') return (
    <Badge variant="pending">
      <Loader2 className="w-3 h-3 animate-spin" /> Indexation...
    </Badge>
  );
  if (status === 'READY') return (
    <Badge variant="approved">
      <CheckCircle className="w-3 h-3" /> Prêt
    </Badge>
  );
  return (
    <Badge variant="rejected">
      <AlertCircle className="w-3 h-3" /> Erreur
    </Badge>
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

  const fetchSources = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/ai/content-sources`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const sourcesList = Array.isArray(data) ? data : [];
      setSources(sourcesList);
      
      // On compte uniquement celles qui sont prêtes pour effacer les notifications du dashboard
      const readySourcesCount = sourcesList.filter((s: any) => s.indexingStatus === 'READY').length;
      localStorage.setItem('seenReadySources', readySourcesCount.toString());
    } catch { /* Ignore */ }
    finally { setLoading(false); }
  }, [token]);

  // Temps réel WebSocket pour l'indexation
  useEffect(() => {
    fetchSources();

    const socketUrl = API_URL.replace('/api', '');
    const socket = io(socketUrl, { transports: ['websocket'] });

    socket.on('connect', () => {
      console.log('✅ Connecté au temps réel (Sources)');
    });

    socket.on('source_indexed', (data) => {
      console.log('🔄 Indexation WebSocket reçue pour:', data.sourceId);
      fetchSources(); // Ping => Refetch
    });

    return () => {
      socket.disconnect();
    };
  }, [fetchSources]);

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
    if (!confirm("Supprimer cette source ? L'action est irréversible.")) return;
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
      const filename = source.url.split(/[\\\/]/).pop();
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
          <Button variant="ghost" size="icon" asChild>
            <Link href="/teacher/dashboard">
              <ChevronLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-black flex items-center gap-3">
              <Library className="w-8 h-8 text-blue-600" /> Ma Bibliothèque
            </h1>
            <p className="text-slate-500 text-sm mt-1">Gérez vos sources de connaissances pour la génération IA</p>
          </div>
        </div>
        <Button asChild>
          <Link href="/teacher/courses/generator">
            <BookOpen className="w-4 h-4" /> Générer un cours
          </Link>
        </Button>
      </div>

      {/* Upload Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Upload PDF */}
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="w-5 h-5 text-red-500" /> Ajouter un PDF
            </CardTitle>
            <p className="text-sm text-slate-500">Le document sera vectorisé automatiquement en arrière-plan.</p>
          </CardHeader>
          <CardContent>
            <input ref={fileInputRef} type="file" accept=".pdf" className="hidden"
              onChange={e => e.target.files?.[0] && uploadPdf(e.target.files[0])} />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full h-24 border-2 border-dashed flex-col gap-2 rounded-2xl hover:border-blue-500 hover:text-blue-600 normal-case tracking-normal font-semibold text-sm"
            >
              {uploading ? <Loader2 className="w-8 h-8 animate-spin" /> : <Upload className="w-8 h-8" />}
              {uploading ? 'Upload en cours...' : 'Cliquez pour sélectionner un PDF'}
            </Button>
          </CardContent>
        </Card>

        {/* Ajouter URL */}
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Globe className="w-5 h-5 text-blue-500" /> Ajouter une URL
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              {(['VIDEO', 'WEBPAGE'] as const).map(t => (
                <Button
                  key={t}
                  variant={urlType === t ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setUrlType(t)}
                  className="flex-1 normal-case tracking-normal font-bold text-xs"
                >
                  {t === 'VIDEO' ? <><Youtube className="w-3 h-3" />YouTube</> : <><Globe className="w-3 h-3" />Page Web</>}
                </Button>
              ))}
            </div>
            <Input
              value={urlTitle}
              onChange={e => setUrlTitle(e.target.value)}
              placeholder="Titre de la ressource"
            />
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
                disabled={!urlInput.trim() || !urlTitle.trim() || uploading}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-500/10 text-red-500 rounded-2xl border border-red-500/20 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" /> {error}
        </div>
      )}

      {/* Liste des sources */}
      <Card className="rounded-3xl overflow-hidden">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Mes Sources ({sources.length})</CardTitle>
            {sources.some(s => s.indexingStatus === 'INDEXING') && (
              <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Mise à jour automatique...
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
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
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openSource(source)}
                      title={source.type === 'PDF' ? 'Visualiser le PDF' : 'Ouvrir le lien'}
                    >
                      {source.type === 'PDF' ? <Eye className="w-4 h-4" /> : <ExternalLink className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteSource(source.id)}
                      title="Supprimer"
                      className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
