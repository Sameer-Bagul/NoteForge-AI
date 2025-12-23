import { BookOpen } from 'lucide-react';

const Header = () => {
  return (
    <header className="w-full border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-glow">
            <BookOpen className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">NoteForge</h1>
            <p className="text-xs text-muted-foreground">YouTube → Knowledge</p>
          </div>
        </div>
        
        <nav className="hidden md:flex items-center gap-6">
          <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">How it works</a>
          <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Examples</a>
        </nav>
      </div>
    </header>
  );
};

export default Header;
