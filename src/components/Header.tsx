import { BookOpen, PlusCircle, Library, Settings } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from './ui/button';
import { useSettings } from '@/context/SettingsContext';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from './ui/tooltip';

const Header = () => {
  const location = useLocation();
  const { openSettings, settings } = useSettings();

  const enabledCount = settings.providers.filter(p => p.enabled).length;

  return (
    <header className="w-full border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-glow">
            <BookOpen className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">NoteForge</h1>
            <p className="text-xs text-muted-foreground">YouTube → Knowledge</p>
          </div>
        </Link>

        <nav className="flex items-center gap-2">
          <Link to="/">
            <Button variant={location.pathname === '/' ? 'default' : 'ghost'} size="sm" className="gap-2">
              <PlusCircle className="w-4 h-4" />
              Create New
            </Button>
          </Link>
          <Link to="/library">
            <Button variant={location.pathname.startsWith('/library') ? 'default' : 'ghost'} size="sm" className="gap-2">
              <Library className="w-4 h-4" />
              Library
            </Button>
          </Link>

          {/* Settings */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                onClick={openSettings}
                aria-label="Open AI Provider Settings"
              >
                <Settings className="w-4 h-4" />
                {enabledCount === 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>AI Provider Settings</p>
              {enabledCount === 0 && <p className="text-destructive text-xs">⚠ No providers enabled</p>}
            </TooltipContent>
          </Tooltip>
        </nav>
      </div>
    </header>
  );
};

export default Header;

