import { useState } from 'react';
import { Youtube, Sparkles, ArrowRight, List, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface UrlInputProps {
  onSubmit: (url: string) => void;
  isLoading?: boolean;
}

const UrlInput = ({ onSubmit, isLoading }: UrlInputProps) => {
  const [url, setUrl] = useState('');
  const [inputType, setInputType] = useState<'video' | 'playlist' | null>(null);

  const detectInputType = (value: string) => {
    if (value.includes('playlist') || value.includes('list=')) {
      setInputType('playlist');
    } else if (value.includes('youtube.com') || value.includes('youtu.be')) {
      setInputType('video');
    } else {
      setInputType(null);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUrl(value);
    detectInputType(value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onSubmit(url.trim());
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto slide-up">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent rounded-full text-accent-foreground text-sm font-medium mb-6">
          <Sparkles className="w-4 h-4" />
          Transform videos into structured knowledge
        </div>
        <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
          Turn YouTube into
          <span className="gradient-text block">Beautiful Notes</span>
        </h2>
        <p className="text-lg text-muted-foreground max-w-lg mx-auto">
          Paste any YouTube video or playlist URL and get organized, topic-wise notes ready to study.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
            <Youtube className="w-5 h-5" />
          </div>
          <Input
            type="url"
            placeholder="Paste YouTube video or playlist URL..."
            value={url}
            onChange={handleChange}
            className="pl-12 pr-4 h-14 text-base rounded-xl border-2 focus:border-primary bg-card shadow-sm"
            disabled={isLoading}
          />
          {inputType && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${
                inputType === 'playlist' 
                  ? 'bg-accent text-accent-foreground' 
                  : 'bg-secondary text-secondary-foreground'
              }`}>
                {inputType === 'playlist' ? (
                  <>
                    <List className="w-3 h-3" />
                    Playlist
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3" />
                    Video
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <Button 
          type="submit" 
          size="xl" 
          variant="hero"
          className="w-full"
          disabled={!url.trim() || isLoading}
        >
          {isLoading ? (
            <>
              <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              Processing...
            </>
          ) : (
            <>
              Generate Notes
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </Button>
      </form>

      <div className="flex items-center justify-center gap-6 mt-8 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-success" />
          Supports long videos
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-success" />
          Playlist support
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-success" />
          100% free
        </div>
      </div>
    </div>
  );
};

export default UrlInput;
