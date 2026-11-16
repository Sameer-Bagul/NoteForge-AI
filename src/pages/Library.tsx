import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { JobStatus, Notebook } from '@/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  BookOpen,
  Star,
  Clock,
  Trash2,
  Plus,
  Search,
  Filter,
  LayoutGrid,
  List,
  MoreHorizontal,
  Video,
  Calendar,
  Layers,
  Sparkles,
  Terminal,
  Code2,
  Box,
  Database,
  Network,
  GitBranch,
  Cpu,
  Loader2,
  ExternalLink,
  RotateCcw,
  Check,
  X,
  RefreshCw,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';

// ─── Tag Types & Palettes ──────────────────────────────────────────────────────

type NavCategory = 'all' | 'favorites' | 'recent' | 'trash';

const TAG_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  'DSA': { label: 'DSA', color: '#f97316', bg: 'bg-orange-500/10 text-orange-400', border: 'border-orange-500/30' },
  'AI / ML': { label: 'AI / ML', color: '#ec4899', bg: 'bg-pink-500/10 text-pink-400', border: 'border-pink-500/30' },
  'System Design': { label: 'System Design', color: '#10b981', bg: 'bg-emerald-500/10 text-emerald-400', border: 'border-emerald-500/30' },
  'DevOps': { label: 'DevOps', color: '#06b6d4', bg: 'bg-cyan-500/10 text-cyan-400', border: 'border-cyan-500/30' },
  'Others': { label: 'Others', color: '#a855f7', bg: 'bg-purple-500/10 text-purple-400', border: 'border-purple-500/30' },
};

function inferNotebookTag(title: string, content?: string): string {
  const lower = (title + ' ' + (content || '')).toLowerCase();
  if (lower.includes('dsa') || lower.includes('algorithm') || lower.includes('data structure') || lower.includes('leetcode')) return 'DSA';
  if (lower.includes('ai') || lower.includes('ml') || lower.includes('llm') || lower.includes('gpt') || lower.includes('machine learning') || lower.includes('neural') || lower.includes('rag') || lower.includes('agent')) return 'AI / ML';
  if (lower.includes('system design') || lower.includes('architecture') || lower.includes('distributed') || lower.includes('hld') || lower.includes('lld') || lower.includes('microservice') || lower.includes('database') || lower.includes('network')) return 'System Design';
  if (lower.includes('devops') || lower.includes('docker') || lower.includes('kubernetes') || lower.includes('k8s') || lower.includes('ci/cd') || lower.includes('linux') || lower.includes('aws') || lower.includes('cloud') || lower.includes('rust')) return 'DevOps';
  return 'Others';
}

function getTopicBadge(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes('rust')) return { icon: Cpu, label: 'Rust', color: '#f97316', bg: 'bg-orange-500/15 text-orange-400 border-orange-500/30' };
  if (lower.includes('python')) return { icon: Terminal, label: 'Python', color: '#eab308', bg: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' };
  if (lower.includes('javascript') || lower.includes('js')) return { icon: Code2, label: 'JS', color: '#f59e0b', bg: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
  if (lower.includes('typescript') || lower.includes('ts')) return { icon: Code2, label: 'TS', color: '#3b82f6', bg: 'bg-blue-500/15 text-blue-400 border-blue-500/30' };
  if (lower.includes('docker') || lower.includes('container')) return { icon: Box, label: 'Docker', color: '#06b6d4', bg: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' };
  if (lower.includes('linux') || lower.includes('bash')) return { icon: Terminal, label: 'Linux', color: '#14b8a6', bg: 'bg-teal-500/15 text-teal-400 border-teal-500/30' };
  if (lower.includes('ai') || lower.includes('llm') || lower.includes('agent') || lower.includes('gpt') || lower.includes('rag')) return { icon: Sparkles, label: 'AI', color: '#a855f7', bg: 'bg-purple-500/15 text-purple-400 border-purple-500/30' };
  if (lower.includes('database') || lower.includes('sql') || lower.includes('postgres')) return { icon: Database, label: 'DB', color: '#10b981', bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
  if (lower.includes('system design') || lower.includes('architecture') || lower.includes('hld') || lower.includes('lld')) return { icon: Layers, label: 'System', color: '#8b5cf6', bg: 'bg-violet-500/15 text-violet-400 border-violet-500/30' };
  if (lower.includes('network')) return { icon: Network, label: 'Network', color: '#6366f1', bg: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30' };
  if (lower.includes('dsa') || lower.includes('algo')) return { icon: GitBranch, label: 'DSA', color: '#f59e0b', bg: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
  return { icon: BookOpen, label: 'Notes', color: '#64748b', bg: 'bg-slate-500/15 text-slate-400 border-slate-500/30' };
}

type SortOption = 'newest' | 'oldest' | 'title' | 'chapters';

export default function Library() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Navigation & Filter State
  const [activeCategory, setActiveCategory] = useState<NavCategory>('all');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Deletion & Trash State
  const [jobToDelete, setJobToDelete] = useState<JobStatus | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isEmptyTrashOpen, setIsEmptyTrashOpen] = useState(false);
  const [isEmptyingTrash, setIsEmptyingTrash] = useState(false);
  const [isClearAllDialogOpen, setIsClearAllDialogOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Search input ref for Ctrl+K
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const { data: jobs, isLoading, error, refetch } = useQuery({
    queryKey: ['jobs'],
    queryFn: api.getJobs,
    refetchInterval: 5000,
  });

  // Toggle Favorite
  const handleToggleFavorite = async (e: React.MouseEvent, item: JobStatus) => {
    e.stopPropagation();
    const nbId = item.notebook?.id || item.notebookId || item.id;
    const newFav = !item.isFavorite;

    try {
      await api.toggleFavorite(nbId, newFav);
      await queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast({
        title: newFav ? 'Added to favorites' : 'Removed from favorites',
        description: `"${item.notebook?.title || item.videos?.[0]?.title || 'Notebook'}"`,
      });
    } catch (err: any) {
      console.error('Failed to toggle favorite:', err);
      toast({
        title: 'Update failed',
        description: err?.message || 'Could not update favorite state.',
        variant: 'destructive',
      });
    }
  };

  // Toggle Archived / Trash (with Interactive Undo Action)
  const handleToggleTrash = async (e: React.MouseEvent | undefined, item: JobStatus, shouldTrash: boolean) => {
    e?.stopPropagation();
    const nbId = item.notebook?.id || item.notebookId || item.id;
    const notebookTitle = item.notebook?.title || item.videos?.[0]?.title || 'Notebook';

    try {
      await api.toggleArchived(nbId, shouldTrash);
      await queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast({
        title: shouldTrash ? 'Moved to trash' : 'Restored from trash',
        description: `"${notebookTitle}"`,
        action: (
          <ToastAction
            altText="Undo action"
            onClick={() => handleToggleTrash(undefined, item, !shouldTrash)}
          >
            Undo
          </ToastAction>
        ),
      });
    } catch (err: any) {
      console.error('Failed to update trash state:', err);
      toast({
        title: 'Action failed',
        description: err?.message || 'Could not update notebook status.',
        variant: 'destructive',
      });
    }
  };

  // Empty Trash (Purge all trashed notebooks permanently)
  const handleConfirmEmptyTrash = async () => {
    try {
      setIsEmptyingTrash(true);
      const trashedItems = processedNotebooks.filter(n => n.isArchived);
      await Promise.all(
        trashedItems.map(item => {
          const nbId = item.notebook?.id || item.notebookId || item.id;
          return Promise.all([
            api.deleteNotebook(nbId).catch(() => {}),
            api.deleteJob(item.id).catch(() => {}),
          ]);
        })
      );
      await queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast({
        title: 'Trash emptied',
        description: `Permanently removed ${trashedItems.length} notebook${trashedItems.length === 1 ? '' : 's'}.`,
      });
    } catch (err: any) {
      console.error('Failed to empty trash:', err);
      toast({
        title: 'Failed to empty trash',
        description: err?.message || 'Could not purge all items.',
        variant: 'destructive',
      });
    } finally {
      setIsEmptyingTrash(false);
      setIsEmptyTrashOpen(false);
    }
  };

  // Confirm Permanent Delete
  const handleConfirmDelete = async () => {
    if (!jobToDelete) return;
    const title = jobToDelete.notebook?.title || jobToDelete.videos?.[0]?.title || `Notebook ${jobToDelete.id.slice(0, 8)}`;
    const nbId = jobToDelete.notebook?.id || jobToDelete.notebookId || jobToDelete.id;

    try {
      setDeletingId(jobToDelete.id);
      await api.deleteNotebook(nbId).catch(() => {});
      await api.deleteJob(jobToDelete.id).catch(() => {});
      await queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast({
        title: 'Notebook deleted permanently',
        description: `"${title}" has been removed.`,
      });
    } catch (err: any) {
      console.error('Failed to delete item:', err);
      toast({
        title: 'Delete failed',
        description: err?.message || 'Failed to delete item.',
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
      setJobToDelete(null);
    }
  };

  // Clear Entire Library
  const handleConfirmClearAll = async () => {
    try {
      setIsClearing(true);
      await api.clearAllData();
      await queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast({
        title: 'Library cleared',
        description: 'All notebooks have been removed from local SQLite vault.',
      });
    } catch (err: any) {
      console.error('Failed to clear library:', err);
      toast({
        title: 'Clear failed',
        description: err?.message || 'Failed to clear library.',
        variant: 'destructive',
      });
    } finally {
      setIsClearing(false);
      setIsClearAllDialogOpen(false);
    }
  };

  // Aggregate and Categorize Notebooks
  const processedNotebooks = useMemo(() => {
    if (!jobs) return [];

    return jobs.map(j => {
      const title = j.notebook?.title || j.videos?.[0]?.title || j.index?.title || `Notebook ${j.id.slice(0, 8)}`;
      const assignedTag = (j.tags && j.tags[0]) || (j.notebook?.tags && j.notebook.tags[0]) || inferNotebookTag(title, j.notebook?.description);
      const isFav = Boolean(j.isFavorite ?? j.notebook?.isFavorite);
      const isArch = Boolean(j.isArchived ?? j.notebook?.isArchived);
      const topicCount = j.notebook?.metadata?.totalTopics || j.notebook?.chapters?.[0]?.topics?.length || j.index?.topics?.length || 1;
      const videoCount = j.notebook?.metadata?.totalVideos || j.videos?.length || 1;
      const createdDate = j.createdAt || j.notebook?.createdAt || new Date().toISOString();

      return {
        ...j,
        resolvedTitle: title,
        assignedTag,
        isFavorite: isFav,
        isArchived: isArch,
        topicCount,
        videoCount,
        createdDate,
      };
    });
  }, [jobs]);

  // Sidebar Counts
  const counts = useMemo(() => {
    const active = processedNotebooks.filter(n => !n.isArchived);
    const trash = processedNotebooks.filter(n => n.isArchived);
    const favorites = active.filter(n => n.isFavorite);

    // Recent: modified in last 7 days or top 10
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = active.filter(n => new Date(n.createdDate).getTime() >= oneWeekAgo);

    // Tag counts (from active items only)
    const tagCounts: Record<string, number> = {
      'DSA': 0,
      'AI / ML': 0,
      'System Design': 0,
      'DevOps': 0,
      'Others': 0,
    };
    active.forEach(n => {
      if (tagCounts[n.assignedTag] !== undefined) {
        tagCounts[n.assignedTag]++;
      } else {
        tagCounts['Others']++;
      }
    });

    return {
      all: active.length,
      favorites: favorites.length,
      recent: recent.length,
      trash: trash.length,
      tags: tagCounts,
    };
  }, [processedNotebooks]);

  // Filtered & Sorted Notebooks for Main Area
  const filteredNotebooks = useMemo(() => {
    let list = processedNotebooks;

    // 1. Primary Category Filter
    if (activeCategory === 'trash') {
      list = list.filter(n => n.isArchived);
    } else {
      list = list.filter(n => !n.isArchived);

      if (activeCategory === 'favorites') {
        list = list.filter(n => n.isFavorite);
      } else if (activeCategory === 'recent') {
        const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        list = list.filter(n => new Date(n.createdDate).getTime() >= oneWeekAgo);
      }
    }

    // 2. Tag Filter
    if (activeTag && activeCategory !== 'trash') {
      list = list.filter(n => n.assignedTag === activeTag);
    }

    // 3. Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(n =>
        n.resolvedTitle.toLowerCase().includes(q) ||
        n.assignedTag.toLowerCase().includes(q)
      );
    }

    // 4. Sorting
    const sorted = [...list];
    if (sortOption === 'newest') {
      sorted.sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());
    } else if (sortOption === 'oldest') {
      sorted.sort((a, b) => new Date(a.createdDate).getTime() - new Date(b.createdDate).getTime());
    } else if (sortOption === 'title') {
      sorted.sort((a, b) => a.resolvedTitle.localeCompare(b.resolvedTitle));
    } else if (sortOption === 'chapters') {
      sorted.sort((a, b) => b.topicCount - a.topicCount);
    }

    return sorted;
  }, [processedNotebooks, activeCategory, activeTag, searchQuery, sortOption]);

  const liveActiveJobs = useMemo(() => {
    return jobs?.filter(j => j.isLive && j.status !== 'complete') || [];
  }, [jobs]);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
        <p className="text-xs text-muted-foreground font-mono">Loading library from SQLite vault...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] text-center p-8 max-w-sm mx-auto space-y-4">
        <div className="w-10 h-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
          <Trash2 className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-foreground">Could not load library</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {error instanceof Error ? error.message : 'Unable to connect to local database.'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5 text-xs h-8">
          <RefreshCw className="w-3 h-3" />
          <span>Retry</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden w-full h-full bg-background select-none">
      {/* ── Left Navigation Sidebar (Unslop Standard) ───────────────────────── */}
      <aside className="w-60 sm:w-64 border-r border-border/40 bg-card/25 backdrop-blur-xl flex flex-col justify-between shrink-0 p-3 sm:p-4 overflow-y-auto">
        <div className="space-y-6">
          {/* Main Category Links */}
          <div className="space-y-1">
            <button
              onClick={() => { setActiveCategory('all'); setActiveTag(null); }}
              className={cn(
                "w-full h-9 px-3 rounded-xl flex items-center justify-between text-xs transition-colors",
                activeCategory === 'all' && !activeTag
                  ? "bg-foreground text-background font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40 font-medium"
              )}
            >
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-4 h-4 shrink-0 stroke-[1.75]" />
                <span>Notebooks</span>
              </div>
              <span className={cn(
                "text-[11px] font-mono px-2 py-0.5 rounded-md",
                activeCategory === 'all' && !activeTag
                  ? "bg-background/20 text-background font-medium"
                  : "text-muted-foreground font-normal"
              )}>
                {counts.all}
              </span>
            </button>

            <button
              onClick={() => { setActiveCategory('favorites'); setActiveTag(null); }}
              className={cn(
                "w-full h-9 px-3 rounded-xl flex items-center justify-between text-xs transition-colors",
                activeCategory === 'favorites' && !activeTag
                  ? "bg-foreground text-background font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40 font-medium"
              )}
            >
              <div className="flex items-center gap-2.5">
                <Star className="w-4 h-4 shrink-0 stroke-[1.75]" />
                <span>Favorites</span>
              </div>
              <span className={cn(
                "text-[11px] font-mono px-2 py-0.5 rounded-md",
                activeCategory === 'favorites' && !activeTag
                  ? "bg-background/20 text-background font-medium"
                  : "text-muted-foreground font-normal"
              )}>
                {counts.favorites}
              </span>
            </button>

            <button
              onClick={() => { setActiveCategory('recent'); setActiveTag(null); }}
              className={cn(
                "w-full h-9 px-3 rounded-xl flex items-center justify-between text-xs transition-colors",
                activeCategory === 'recent' && !activeTag
                  ? "bg-foreground text-background font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40 font-medium"
              )}
            >
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 shrink-0 stroke-[1.75]" />
                <span>Recent</span>
              </div>
              {counts.recent > 0 && (
                <span className={cn(
                  "text-[11px] font-mono px-2 py-0.5 rounded-md",
                  activeCategory === 'recent' && !activeTag
                    ? "bg-background/20 text-background font-medium"
                    : "text-muted-foreground font-normal"
                )}>
                  {counts.recent}
                </span>
              )}
            </button>

            <button
              onClick={() => { setActiveCategory('trash'); setActiveTag(null); }}
              className={cn(
                "w-full h-9 px-3 rounded-xl flex items-center justify-between text-xs transition-colors",
                activeCategory === 'trash'
                  ? "bg-foreground text-background font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40 font-medium"
              )}
            >
              <div className="flex items-center gap-2.5">
                <Trash2 className="w-4 h-4 shrink-0 stroke-[1.75]" />
                <span>Trash</span>
              </div>
              {counts.trash > 0 && (
                <span className={cn(
                  "text-[11px] font-mono px-2 py-0.5 rounded-md",
                  activeCategory === 'trash'
                    ? "bg-background/20 text-background font-medium"
                    : "text-muted-foreground font-normal"
                )}>
                  {counts.trash}
                </span>
              )}
            </button>
          </div>

          {/* Tags Section */}
          <div className="space-y-2 pt-2 border-t border-border/40">
            <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground/70 px-3 font-semibold block">
              Tags
            </span>

            <div className="space-y-1">
              {Object.entries(TAG_CONFIG).map(([tagKey, cfg]) => {
                const count = counts.tags[tagKey] || 0;
                const isSelected = activeTag === tagKey;

                return (
                  <button
                    key={tagKey}
                    onClick={() => {
                      if (activeCategory === 'trash') setActiveCategory('all');
                      setActiveTag(isSelected ? null : tagKey);
                    }}
                    className={cn(
                      "w-full h-8 px-3 rounded-xl flex items-center justify-between text-xs transition-colors",
                      isSelected
                        ? "bg-secondary text-foreground font-semibold shadow-xs border border-border/60"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/30 font-medium"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full shrink-0 shadow-xs"
                        style={{ backgroundColor: cfg.color }}
                      />
                      <span className="truncate">{cfg.label}</span>
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground/80 font-normal">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom Vault Controls */}
        <div className="pt-4 border-t border-border/40 space-y-2">
          {counts.all > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsClearAllDialogOpen(true)}
              className="w-full h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 justify-start px-3 gap-2"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Entire Library</span>
            </Button>
          )}

          <div className="px-3 py-1.5 rounded-lg bg-secondary/30 border border-border/30 text-[10px] font-mono text-muted-foreground flex items-center justify-between">
            <span>SQLite Vault</span>
            <span className="text-emerald-400 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Connected
            </span>
          </div>
        </div>
      </aside>

      {/* ── Main Content Area ─────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-background">
        {/* Sticky Sub-Header Toolbar */}
        <header className="px-6 py-4 border-b border-border/40 bg-background/50 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-card border border-border/60 flex items-center justify-center text-primary shadow-xs shrink-0">
              {activeCategory === 'favorites' ? (
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              ) : activeCategory === 'trash' ? (
                <Trash2 className="w-4 h-4 text-destructive" />
              ) : activeCategory === 'recent' ? (
                <Clock className="w-4 h-4 text-cyan-400" />
              ) : (
                <BookOpen className="w-4 h-4 text-primary" />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-semibold tracking-tight text-foreground truncate">
                {activeCategory === 'favorites'
                  ? 'Favorite Notebooks'
                  : activeCategory === 'recent'
                  ? 'Recent Notebooks'
                  : activeCategory === 'trash'
                  ? 'Archived Trash'
                  : activeTag
                  ? `${activeTag} Notebooks`
                  : 'Your Notebooks'}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {filteredNotebooks.length} {filteredNotebooks.length === 1 ? 'notebook' : 'notebooks'} · Notes, summaries, diagrams and more
              </p>
            </div>
          </div>

          {/* Right Toolbar Controls */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Search Input with Ctrl K */}
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search notebooks..."
                className="h-8 pl-8 pr-12 rounded-xl bg-card border border-border/50 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-foreground/30 transition-colors w-44 sm:w-56 shadow-xs"
              />
              {searchQuery ? (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 text-muted-foreground hover:text-foreground p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              ) : (
                <kbd className="absolute right-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/60 border border-border/60 text-muted-foreground/80 pointer-events-none hidden sm:inline">
                  Ctrl K
                </kbd>
              )}
            </div>

            {/* Filter / Sort Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs rounded-xl gap-1.5 border-border/50 text-muted-foreground hover:text-foreground">
                  <Filter className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">
                    {sortOption === 'newest' ? 'Newest' : sortOption === 'oldest' ? 'Oldest' : sortOption === 'title' ? 'A-Z' : 'Most Notes'}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 rounded-xl shadow-md border-border/50">
                <DropdownMenuItem onClick={() => setSortOption('newest')} className="text-xs gap-2">
                  {sortOption === 'newest' && <Check className="w-3.5 h-3.5" />}
                  <span>Newest first</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortOption('oldest')} className="text-xs gap-2">
                  {sortOption === 'oldest' && <Check className="w-3.5 h-3.5" />}
                  <span>Oldest first</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortOption('title')} className="text-xs gap-2">
                  {sortOption === 'title' && <Check className="w-3.5 h-3.5" />}
                  <span>Alphabetical (A-Z)</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortOption('chapters')} className="text-xs gap-2">
                  {sortOption === 'chapters' && <Check className="w-3.5 h-3.5" />}
                  <span>Most notes & chapters</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* View Mode Toggle */}
            <div className="flex items-center rounded-xl border border-border/50 bg-secondary/30 p-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  "p-1.5 rounded-lg transition-colors",
                  viewMode === 'grid'
                    ? "bg-foreground text-background shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Grid view"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  "p-1.5 rounded-lg transition-colors",
                  viewMode === 'list'
                    ? "bg-foreground text-background shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="List view"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Empty Trash Button (Visible when viewing Trash and has items) */}
            {activeCategory === 'trash' && counts.trash > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setIsEmptyTrashOpen(true)}
                className="h-8 px-2.5 sm:px-3 text-xs rounded-xl gap-1.5 font-medium shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Empty Trash</span>
                <span className="sm:hidden">Empty</span>
              </Button>
            )}
          </div>
        </header>

        {/* Scrollable Gallery Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {/* Active Synthesis In Progress Alert */}
          {liveActiveJobs.length > 0 && activeCategory !== 'trash' && (
            <div className="p-4 rounded-2xl border border-cyan-500/30 bg-cyan-500/5 flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2.5 text-xs text-cyan-300">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400 shrink-0" />
                <span className="font-semibold">Synthesizing in progress:</span>
                <span className="text-foreground truncate max-w-sm sm:max-w-md">
                  {liveActiveJobs[0].videos?.[0]?.title || `Job ${liveActiveJobs[0].id.slice(0, 8)}`}
                </span>
              </div>
              <Link to={`/process/${liveActiveJobs[0].id}`}>
                <Button size="sm" variant="outline" className="h-7 text-xs border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10 rounded-lg">
                  View Progress
                </Button>
              </Link>
            </div>
          )}

          {/* Empty State */}
          {filteredNotebooks.length === 0 ? (
            <div className="h-72 flex flex-col items-center justify-center text-center p-8 border border-dashed border-border/60 rounded-2xl bg-card/10 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-secondary/50 border border-border/40 flex items-center justify-center text-muted-foreground">
                <BookOpen className="w-6 h-6 stroke-[1.5]" />
              </div>
              <div className="space-y-1 max-w-sm">
                <h3 className="text-sm font-semibold text-foreground">
                  {searchQuery ? 'No matching notebooks' : activeCategory === 'trash' ? 'Trash is empty' : activeCategory === 'favorites' ? 'No favorites yet' : 'No notebooks found'}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {searchQuery
                    ? 'Try searching with different keywords or clearing tag filters.'
                    : activeCategory === 'trash'
                    ? 'Deleted notebooks will appear here before permanent removal.'
                    : activeCategory === 'favorites'
                    ? 'Star any notebook to pin it to your favorites list.'
                    : 'Synthesize any YouTube video or playlist to create your first notebook.'}
                </p>
              </div>
              {searchQuery && (
                <Button size="sm" variant="outline" onClick={() => setSearchQuery('')} className="h-7 text-xs rounded-lg mt-2">
                  Clear Search
                </Button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            /* ── Responsive Card Grid ────────────────────────────────────────── */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-5">
              {/* Card 1: + New Notebook (Only in non-trash views) */}
              {activeCategory !== 'trash' && !searchQuery && !activeTag && (
                <div
                  onClick={() => navigate('/')}
                  className="h-[185px] rounded-2xl border-2 border-dashed border-border/60 hover:border-foreground/40 bg-card/20 hover:bg-card/40 transition-all flex flex-col items-center justify-center text-center p-5 cursor-pointer group shadow-xs hover:shadow-sm"
                >
                  <div className="w-10 h-10 rounded-xl bg-secondary/60 border border-border/40 group-hover:bg-foreground group-hover:text-background flex items-center justify-center transition-all">
                    <Plus className="w-5 h-5 transition-transform group-hover:scale-110" />
                  </div>
                  <h4 className="text-sm font-semibold text-foreground mt-3.5">
                    New Notebook
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[170px] leading-relaxed">
                    Create from video, link or upload
                  </p>
                </div>
              )}

              {/* Notebook Cards */}
              {filteredNotebooks.map(item => {
                const targetLink = item.status === 'complete'
                  ? `/notebook/${item.notebook?.id || item.notebookId || item.id}`
                  : `/process/${item.id}`;
                const badgeInfo = getTopicBadge(item.resolvedTitle);
                const BadgeIcon = badgeInfo.icon;
                const formattedDate = format(new Date(item.createdDate), 'd MMM yyyy');

                return (
                  <div
                    key={item.id}
                    onClick={() => navigate(targetLink)}
                    className={cn(
                      "h-[185px] rounded-2xl border transition-all duration-200 p-5 flex flex-col justify-between relative group cursor-pointer shadow-xs hover:shadow-md overflow-hidden select-none",
                      item.isArchived
                        ? "border-amber-500/35 hover:border-amber-500/60 bg-card/60"
                        : "border-border/50 hover:border-border/80 bg-card/70 hover:bg-card/95"
                    )}
                    style={{
                      background: item.isArchived
                        ? `linear-gradient(145deg, hsl(var(--card)) 0%, hsl(var(--card)) 75%, rgba(245, 158, 11, 0.06) 100%)`
                        : `linear-gradient(145deg, hsl(var(--card)) 0%, hsl(var(--card)) 75%, ${badgeInfo.color}10 100%)`,
                    }}
                  >
                    {/* Top Row: Topic Badge & Action Buttons */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "w-8 h-8 rounded-xl border flex items-center justify-center font-bold text-xs shadow-xs",
                            badgeInfo.bg
                          )}
                          title={badgeInfo.label}
                        >
                          <BadgeIcon className="w-4 h-4" />
                        </div>
                        {item.isArchived && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            Trash
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {item.isArchived ? (
                          <>
                            {/* Direct Restore Button */}
                            <button
                              onClick={e => handleToggleTrash(e, item, false)}
                              className="h-7 px-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 text-[11px] font-medium transition-colors"
                              title="Restore notebook"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span className="hidden sm:inline">Restore</span>
                            </button>
                            {/* Direct Delete Forever Button */}
                            <button
                              onClick={e => { e.stopPropagation(); setJobToDelete(item); }}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
                              title="Delete permanently"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          /* Star Favorite Button */
                          <button
                            onClick={e => handleToggleFavorite(e, item)}
                            className={cn(
                              "w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
                              item.isFavorite
                                ? "text-amber-400 hover:text-amber-300"
                                : "text-muted-foreground/30 group-hover:text-muted-foreground/60 hover:!text-amber-400"
                            )}
                            title={item.isFavorite ? "Remove favorite" : "Mark as favorite"}
                          >
                            <Star className={cn("w-4 h-4", item.isFavorite ? "fill-amber-400" : "fill-none")} />
                          </button>
                        )}

                        {/* Three Dots Menu */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              onClick={e => e.stopPropagation()}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/40 group-hover:text-muted-foreground/80 hover:!text-foreground hover:bg-muted/40 transition-colors"
                              title="Notebook actions"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40 rounded-xl shadow-md border-border/50">
                            <DropdownMenuItem onClick={() => navigate(targetLink)} className="text-xs gap-2">
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Open notebook</span>
                            </DropdownMenuItem>
                            {!item.isArchived && (
                              <DropdownMenuItem onClick={e => handleToggleFavorite(e, item)} className="text-xs gap-2">
                                <Star className="w-3.5 h-3.5" />
                                <span>{item.isFavorite ? 'Unfavorite' : 'Favorite'}</span>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {item.isArchived ? (
                              <>
                                <DropdownMenuItem onClick={e => handleToggleTrash(e, item, false)} className="text-xs gap-2 text-emerald-400">
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  <span>Restore notebook</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={e => { e.stopPropagation(); setJobToDelete(item); }} className="text-xs gap-2 text-destructive">
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Delete forever</span>
                                </DropdownMenuItem>
                              </>
                            ) : (
                              <DropdownMenuItem onClick={e => handleToggleTrash(e, item, true)} className="text-xs gap-2 text-destructive">
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Move to trash</span>
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Middle: Title */}
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold tracking-tight text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                        {item.resolvedTitle}
                      </h3>
                    </div>

                    {/* Bottom Row: Metadata & Timestamp */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground/80 pt-2.5 border-t border-border/25">
                      <div className="flex items-center gap-1.5 truncate">
                        <Video className="w-3.5 h-3.5 shrink-0 text-muted-foreground/60" />
                        <span className="truncate">
                          {item.videoCount} {item.videoCount === 1 ? 'video' : 'videos'} · {item.topicCount} notes
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 font-mono text-[11px] text-muted-foreground/60">
                        <Calendar className="w-3 h-3" />
                        <span>{formattedDate}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ── Compact Table / List View ─────────────────────────────────────── */
            <div className="rounded-2xl border border-border/40 bg-card/40 overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/30 bg-muted/20 text-muted-foreground text-[11px] font-mono uppercase tracking-wider">
                    <th className="py-3 px-4 font-semibold">Title</th>
                    <th className="py-3 px-4 font-semibold hidden md:table-cell">Tag</th>
                    <th className="py-3 px-4 font-semibold hidden sm:table-cell">Videos</th>
                    <th className="py-3 px-4 font-semibold hidden sm:table-cell">Notes</th>
                    <th className="py-3 px-4 font-semibold">Date</th>
                    <th className="py-3 px-4 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {filteredNotebooks.map(item => {
                    const targetLink = item.status === 'complete'
                      ? `/notebook/${item.notebook?.id || item.notebookId || item.id}`
                      : `/process/${item.id}`;
                    const badgeInfo = getTopicBadge(item.resolvedTitle);
                    const formattedDate = format(new Date(item.createdDate), 'd MMM yyyy');

                    return (
                      <tr
                        key={item.id}
                        onClick={() => navigate(targetLink)}
                        className="hover:bg-muted/30 transition-colors cursor-pointer group"
                      >
                        <td className="py-3 px-4 font-medium text-foreground">
                          <div className="flex items-center gap-2.5">
                            {!item.isArchived && (
                              <button
                                onClick={e => handleToggleFavorite(e, item)}
                                className={cn(
                                  "p-1 rounded transition-colors",
                                  item.isFavorite ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30 hover:text-amber-400"
                                )}
                              >
                                <Star className={cn("w-3.5 h-3.5", item.isFavorite ? "fill-amber-400" : "fill-none")} />
                              </button>
                            )}
                            {item.isArchived && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0">
                                Trash
                              </span>
                            )}
                            <span className="truncate max-w-xs sm:max-w-md md:max-w-lg group-hover:text-primary transition-colors">
                              {item.resolvedTitle}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 hidden md:table-cell">
                          <span
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono border"
                            style={{
                              borderColor: `${TAG_CONFIG[item.assignedTag]?.color || '#8b5cf6'}40`,
                              backgroundColor: `${TAG_CONFIG[item.assignedTag]?.color || '#8b5cf6'}15`,
                              color: TAG_CONFIG[item.assignedTag]?.color || '#8b5cf6',
                            }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: TAG_CONFIG[item.assignedTag]?.color || '#8b5cf6' }}
                            />
                            {item.assignedTag}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-muted-foreground hidden sm:table-cell">
                          {item.videoCount}
                        </td>
                        <td className="py-3 px-4 font-mono text-muted-foreground hidden sm:table-cell">
                          {item.topicCount}
                        </td>
                        <td className="py-3 px-4 font-mono text-muted-foreground/80">
                          {formattedDate}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {item.isArchived && (
                              <>
                                <button
                                  onClick={e => handleToggleTrash(e, item, false)}
                                  className="h-7 px-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 text-[11px] font-medium transition-colors"
                                  title="Restore notebook"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Restore</span>
                                </button>
                                <button
                                  onClick={e => { e.stopPropagation(); setJobToDelete(item); }}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
                                  title="Delete permanently"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  onClick={e => e.stopPropagation()}
                                  className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-foreground hover:bg-muted/40 transition-colors"
                                >
                                  <MoreHorizontal className="w-4 h-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-36 rounded-xl shadow-md border-border/50">
                                <DropdownMenuItem onClick={() => navigate(targetLink)} className="text-xs gap-2">
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  <span>Open</span>
                                </DropdownMenuItem>
                                {!item.isArchived && (
                                  <DropdownMenuItem onClick={e => handleToggleFavorite(e, item)} className="text-xs gap-2">
                                    <Star className="w-3.5 h-3.5" />
                                    <span>{item.isFavorite ? 'Unfavorite' : 'Favorite'}</span>
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                {item.isArchived ? (
                                  <>
                                    <DropdownMenuItem onClick={e => handleToggleTrash(e, item, false)} className="text-xs gap-2 text-emerald-400">
                                      <RotateCcw className="w-3.5 h-3.5" />
                                      <span>Restore</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={e => { e.stopPropagation(); setJobToDelete(item); }} className="text-xs gap-2 text-destructive">
                                      <Trash2 className="w-3.5 h-3.5" />
                                      <span>Delete forever</span>
                                    </DropdownMenuItem>
                                  </>
                                ) : (
                                  <DropdownMenuItem onClick={e => handleToggleTrash(e, item, true)} className="text-xs gap-2 text-destructive">
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Move to trash</span>
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={jobToDelete !== null}
        onOpenChange={open => !open && setJobToDelete(null)}
        title="Delete notebook permanently"
        description={`Permanently delete "${jobToDelete?.notebook?.title || jobToDelete?.videos?.[0]?.title || 'this item'}"? All synthesized study notes, architecture diagrams, quizzes, and Q&A will be erased.`}
        confirmText="Delete permanently"
        isLoading={deletingId !== null}
        onConfirm={handleConfirmDelete}
      />

      {/* Empty Trash Confirmation Dialog */}
      <ConfirmDialog
        open={isEmptyTrashOpen}
        onOpenChange={setIsEmptyTrashOpen}
        title="Empty Trash?"
        description={`Permanently purge all ${counts.trash} notebook${counts.trash > 1 ? 's' : ''} currently in the trash? All content and concept maps will be permanently erased.`}
        confirmText="Empty trash"
        variant="destructive"
        isLoading={isEmptyingTrash}
        onConfirm={handleConfirmEmptyTrash}
      />

      {/* Clear Entire Library Dialog */}
      <ConfirmDialog
        open={isClearAllDialogOpen}
        onOpenChange={setIsClearAllDialogOpen}
        title="Clear entire SQLite library"
        description="Permanently erase all notebooks and pipeline history from your local SQLite database? This cannot be undone."
        confirmText="Clear library"
        isLoading={isClearing}
        onConfirm={handleConfirmClearAll}
      />
    </div>
  );
}
