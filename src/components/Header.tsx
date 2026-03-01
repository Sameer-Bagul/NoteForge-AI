import { BookOpen, PlusCircle, Library, Settings, Moon, Sun } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { Button } from './ui/button';
import { useSettings } from '@/context/SettingsContext';
import { useTheme } from '@/context/ThemeContext';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from './ui/tooltip';

const Header = () => {
  const location = useLocation();
  const { openSettings, settings } = useSettings();
  const { theme, toggleTheme } = useTheme();

  const enabledCount = settings.providers.filter(p => p.enabled).length;

  return (
    <header className="w-full border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity group">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-glow relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" />
            <BookOpen className="w-5 h-5 text-primary-foreground relative z-10" />
          </motion.div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">NoteForge</h1>
            <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">YouTube → Knowledge</p>
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

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
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

