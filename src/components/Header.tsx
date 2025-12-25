import { BookOpen, PlusCircle, Library } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from './ui/button';

const Header = () => {
  const location = useLocation();

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
        
        <nav className="flex items-center gap-4">
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
        </nav>
      </div>
    </header>
  );
};

export default Header;
