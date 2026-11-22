import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Plus,
  BookOpen,
  Layers,
  GitBranch,
  HelpCircle,
  Briefcase,
  Eye,
  Tv,
  Download,
  FolderDown,
  Printer,
  FileText,
  Share2,
  Trash2,
  Loader2,
  Settings2,
  Moon,
  Sun,
  ArrowLeft,
} from 'lucide-react';
import { useNavRail, TabType } from '@/context/NavRailContext';
import { useSettings } from '@/context/SettingsContext';
import { useTheme } from '@/context/ThemeContext';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export function AppNavRail() {
  const location = useLocation();
  const navigate = useNavigate();
  const { studioProps } = useNavRail();
  const { openSettings, settings } = useSettings();
  const { theme, toggleTheme } = useTheme();

  const enabledCount = settings.providers.filter(p => p.enabled).length;
  const isNotebookStudio = location.pathname.startsWith('/notebook') && studioProps !== null;
  const isCreate = location.pathname === '/';
  const isLibrary = location.pathname.startsWith('/library');

  const studioNavItems: { id: TabType; label: string; icon: any; count?: number }[] = studioProps
    ? [
        { id: 'index', label: 'Curriculum Index', icon: Layers, count: studioProps.topicsCount },
        { id: 'mindmap', label: 'Concept Map', icon: GitBranch },
        { id: 'quiz', label: 'Self-Check Quiz', icon: HelpCircle, count: studioProps.quizCount },
        { id: 'interview', label: 'Technical Q&A', icon: Briefcase, count: studioProps.interviewCount },
      ]
    : [];

  return (
    <aside className="h-full w-[64px] sm:w-[70px] shrink-0 border-r border-border/40 bg-card/25 backdrop-blur-xl flex flex-col justify-between items-center py-3.5 px-2 z-40 select-none">
      {/* ── Top Section: Logo / Back Action ──────────────────────────────────── */}
      <div className="flex flex-col items-center gap-2.5 shrink-0" data-tauri-drag-region>
        {isNotebookStudio ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/library')}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-secondary/50 hover:bg-secondary/90 text-muted-foreground hover:text-foreground transition-all shadow-xs"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-mono text-xs">
              Back to Library
            </TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => navigate('/')}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-card border border-border/50 hover:border-border/90 flex items-center justify-center p-1.5 shadow-xs transition-all hover:scale-105 group"
              >
                <img
                  src="/icon.png"
                  alt="NoteForge"
                  className="w-6 h-6 object-contain rounded-lg"
                />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-mono text-xs">
              NoteForge Studio
            </TooltipContent>
          </Tooltip>
        )}

        {/* Primary App Navigation Capsule */}
        <div className="bg-secondary/40 border border-border/40 rounded-full p-1.5 flex flex-col items-center gap-1.5 shadow-xs backdrop-blur-xl">
          {/* Create / Synthesize */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => navigate('/')}
                className={cn(
                  'w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all group',
                  isCreate
                    ? 'bg-foreground text-background shadow-md shadow-foreground/10 font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <Plus className={cn('w-4 h-4 transition-transform group-hover:scale-110', isCreate ? 'stroke-[2.5]' : 'stroke-[1.75]')} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-mono text-xs">
              Create Notebook
            </TooltipContent>
          </Tooltip>

          {/* Library / Vault */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => navigate('/library')}
                className={cn(
                  'w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all group',
                  isLibrary
                    ? 'bg-foreground text-background shadow-md shadow-foreground/10 font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <BookOpen className={cn('w-4 h-4 transition-transform group-hover:scale-105', isLibrary ? 'stroke-[2.2]' : 'stroke-[1.75]')} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-mono text-xs">
              Study Library
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* ── Middle Section: Contextual Studio Tabs Capsule ───────────────────── */}
      <div className="flex flex-col items-center gap-2 my-auto">
        {isNotebookStudio && studioProps && (
          <div className="bg-secondary/40 border border-border/40 rounded-full p-1.5 flex flex-col items-center gap-1.5 shadow-xs backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
            {studioNavItems.map((item) => {
              const isActive = studioProps.activeTab === item.id;
              const Icon = item.icon;

              return (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => studioProps.onTabChange(item.id)}
                      className={cn(
                        'relative w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all group',
                        isActive
                          ? 'bg-foreground text-background shadow-md shadow-foreground/10'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      )}
                    >
                      <Icon className={cn('w-4 h-4 transition-transform group-hover:scale-105', isActive ? 'stroke-[2]' : 'stroke-[1.75]')} />

                      {/* Micro Count / Activity Pip */}
                      {item.count !== undefined && item.count > 0 && !isActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-primary absolute top-1.5 right-1.5 ring-2 ring-background" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="font-mono text-xs">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Bottom Section: Studio & App Utilities ────────────────────────────── */}
      <div className="flex flex-col items-center gap-2.5 shrink-0">
        {/* Contextual Studio Utilities (Focus Mode, Export, Delete) */}
        {isNotebookStudio && studioProps && (
          <div className="bg-secondary/40 border border-border/40 rounded-full p-1.5 flex flex-col items-center gap-1.5 shadow-xs backdrop-blur-xl animate-in fade-in duration-200">
            {/* Focus Mode Toggle */}
            {studioProps.hasVideo && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={studioProps.onToggleStudioMode}
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center transition-all',
                      !studioProps.isStudioMode
                        ? 'bg-primary/20 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    )}
                  >
                    {!studioProps.isStudioMode ? <Eye className="w-3.5 h-3.5" /> : <Tv className="w-3.5 h-3.5" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-mono text-xs">
                  {studioProps.isStudioMode ? 'Focus Mode (Hide Video)' : 'Studio View (Show Video)'}
                </TooltipContent>
              </Tooltip>
            )}

            {/* Export Dropdown */}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all">
                      {studioProps.isExportingPdf ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-mono text-xs">
                  Export Package
                </TooltipContent>
              </Tooltip>

              <DropdownMenuContent side="right" align="end" className="w-48 font-sans">
                <DropdownMenuLabel className="text-[11px] font-mono text-muted-foreground">Export Options</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={studioProps.onExportPdf} disabled={studioProps.isExportingPdf} className="gap-2 text-xs cursor-pointer">
                  <Printer className="w-3.5 h-3.5 text-primary" />
                  <span>Print / Vector PDF</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={studioProps.onExportFolder} disabled={studioProps.isExportingFolder} className="gap-2 text-xs cursor-pointer">
                  <FolderDown className="w-3.5 h-3.5 text-amber-400" />
                  <span>Export Study Vault (Folder)</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={studioProps.onDownloadMarkdown} className="gap-2 text-xs cursor-pointer">
                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Download Markdown (.md)</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={studioProps.onExportCmsJson} className="gap-2 text-xs cursor-pointer">
                  <Share2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Export CMS JSON (.json)</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Delete / Move to Trash */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={studioProps.onDeleteNotebook}
                  disabled={studioProps.isDeleting}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  {studioProps.isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-mono text-xs text-destructive">
                {studioProps.isArchived ? 'Delete Notebook Permanently' : 'Move Notebook to Trash'}
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Global Utilities Capsule (Theme, Settings, SQLite status) */}
        <div className="bg-secondary/40 border border-border/40 rounded-full p-1.5 flex flex-col items-center gap-1.5 shadow-xs backdrop-blur-xl">
          {/* Theme Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggleTheme}
                className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                aria-label="Toggle theme"
              >
                {theme === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-mono text-xs">
              Toggle Theme
            </TooltipContent>
          </Tooltip>

          {/* AI Settings */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={openSettings}
                className="w-8 h-8 rounded-full flex items-center justify-center relative text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                aria-label="Open AI Settings"
              >
                <Settings2 className="w-3.5 h-3.5" />
                {enabledCount === 0 && (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-destructive rounded-full" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-mono text-xs">
              AI Provider Settings {enabledCount === 0 && '(No active providers)'}
            </TooltipContent>
          </Tooltip>

          {/* SQLite Vault Status Pip */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-8 h-8 rounded-full flex items-center justify-center cursor-default">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ring-2 ring-emerald-400/20" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-mono text-xs">
              SQLite Vault: Connected
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </aside>
  );
}

