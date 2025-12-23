import { useState } from 'react';
import { BookOpen, List, FileText, ArrowLeft, Download, Clock, Hash, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TopicIndex from './TopicIndex';
import NotesViewer from './NotesViewer';
import { VideoNotes } from '@/types';
import { toast } from '@/hooks/use-toast';

interface ResultsViewProps {
  notes: VideoNotes;
  onReset: () => void;
}

const ResultsView = ({ notes, onReset }: ResultsViewProps) => {
  const [activeTopicId, setActiveTopicId] = useState<string | undefined>(
    notes.index[0]?.id
  );
  const [downloadingAll, setDownloadingAll] = useState(false);

  const activeTopicNotes = notes.notes.find(n => n.topicId === activeTopicId);

  // Calculate stats
  const wordCount = notes.fullContent.split(/\s+/).length;
  const readingTime = Math.ceil(wordCount / 200); // Average reading speed

  const handleDownloadAll = async () => {
    setDownloadingAll(true);
    
    // Create a zip-like bundle as a single markdown file
    const content = `# ${notes.title}\n\n---\n\n## Topic Index\n\n${notes.index.map((t, i) => `${i + 1}. ${t.title}`).join('\n')}\n\n---\n\n${notes.fullContent}`;
    
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${notes.title.replace(/[^a-z0-9]/gi, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    setDownloadingAll(false);
    toast({
      title: "Downloaded!",
      description: "Your notes have been downloaded as Markdown.",
    });
  };

  return (
    <div className="w-full fade-in">
      {/* Header */}
      <div className="mb-8">
        <Button variant="ghost" size="sm" onClick={onReset} className="mb-4 -ml-2">
          <ArrowLeft className="w-4 h-4" />
          Process another video
        </Button>
        
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">{notes.title}</h2>
            <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Hash className="w-4 h-4" />
                {notes.index.length} topics
              </div>
              <div className="flex items-center gap-1.5">
                <FileText className="w-4 h-4" />
                {wordCount.toLocaleString()} words
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {readingTime} min read
              </div>
            </div>
          </div>
          
          <Button 
            variant="default" 
            onClick={handleDownloadAll}
            disabled={downloadingAll}
            className="shrink-0"
          >
            {downloadingAll ? (
              <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Download All
          </Button>
        </div>
      </div>

      {/* Success banner */}
      <div className="mb-6 p-4 bg-accent rounded-xl border border-accent-foreground/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center">
            <Check className="w-4 h-4 text-success" />
          </div>
          <div>
            <p className="font-medium text-accent-foreground">Notes generated successfully!</p>
            <p className="text-sm text-accent-foreground/70">Browse topics or view the complete book below.</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="notes" className="w-full">
        <TabsList className="w-full justify-start bg-secondary/50 p-1 rounded-xl mb-6 overflow-x-auto">
          <TabsTrigger value="notes" className="flex items-center gap-2 rounded-lg">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Topic Notes</span>
            <span className="sm:hidden">Notes</span>
          </TabsTrigger>
          <TabsTrigger value="index" className="flex items-center gap-2 rounded-lg">
            <List className="w-4 h-4" />
            <span className="hidden sm:inline">Topic Index</span>
            <span className="sm:hidden">Index</span>
          </TabsTrigger>
          <TabsTrigger value="full" className="flex items-center gap-2 rounded-lg">
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:inline">Full Book</span>
            <span className="sm:hidden">Book</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notes" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 lg:sticky lg:top-20 lg:self-start">
              <TopicIndex 
                topics={notes.index} 
                onTopicClick={setActiveTopicId}
                activeTopicId={activeTopicId}
              />
            </div>
            <div className="lg:col-span-8">
              {activeTopicNotes ? (
                <NotesViewer 
                  content={activeTopicNotes.content} 
                  title={activeTopicNotes.title}
                />
              ) : (
                <div className="bg-card rounded-xl border border-border p-8 text-center">
                  <p className="text-muted-foreground">
                    Select a topic from the index to view notes
                  </p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="index" className="mt-0">
          <div className="max-w-2xl mx-auto">
            <TopicIndex 
              topics={notes.index}
              onTopicClick={(id) => {
                setActiveTopicId(id);
                // Switch to notes tab
                const notesTab = document.querySelector('[data-state="inactive"][value="notes"]') as HTMLButtonElement;
                notesTab?.click();
              }}
            />
          </div>
        </TabsContent>

        <TabsContent value="full" className="mt-0">
          <div className="max-w-4xl mx-auto">
            <NotesViewer 
              content={notes.fullContent} 
              title={notes.title}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ResultsView;
