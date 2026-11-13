import { BookOpen, Plus, Library, Settings2, Moon, Sun } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from './ui/button';
import { useSettings } from '@/context/SettingsContext';
import { useTheme } from '@/context/ThemeContext';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from './ui/tooltip';
import { cn } from '@/lib/utils';

const Header = () => {
  const location = useLocation();
  const { openSettings, settings } = useSettings();
  const { theme, toggleTheme } = useTheme();

  const enabledCount = settings.providers.filter(p => p.enabled).length;

  return (
    <header
      data-tauri-drag-region
      className="w-full h-12 border-b border-border/60 bg-card/75 backdrop-blur-md px-4 flex items-center justify-between shrink-0 select-none z-50"
    >
      {/* Brand / Logo */}
      <div className="flex items-center gap-6">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
            <BookOpen className="w-4 h-4" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors">
              NoteForge
            </span>
            <span className="text-[11px] font-mono text-muted-foreground/80">
              studio
            </span>
          </div>
        </Link>

        {/* Desktop Segmented Navigation */}
        <nav className="flex items-center p-0.5 rounded-lg bg-muted/50 border border-border/40 text-xs">
          <Link
            to="/"
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-all",
              location.pathname === '/'
                ? "bg-background text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create</span>
          </Link>
          <Link
            to="/library"
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-all",
              location.pathname.startsWith('/library')
                ? "bg-background text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Library className="w-3.5 h-3.5" />
            <span>Library</span>
          </Link>
        </nav>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-1.5">
        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={toggleTheme}
          aria-label="Toggle theme"
        >
          {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </Button>

        {/* Settings */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 relative text-muted-foreground hover:text-foreground"
              onClick={openSettings}
              aria-label="Open AI Provider Settings"
            >
              <Settings2 className="w-4 h-4" />
              {enabledCount === 0 && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-destructive rounded-full" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <p>AI Provider Settings</p>
            {enabledCount === 0 && <p className="text-destructive text-[11px]">No providers active</p>}
          </TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
};

export default Header;


