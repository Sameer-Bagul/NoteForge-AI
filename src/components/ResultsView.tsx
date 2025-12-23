import { useState } from 'react';
import { BookOpen, List, FileText, ArrowLeft, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TopicIndex from './TopicIndex';
import NotesViewer from './NotesViewer';
import { VideoNotes, TopicIndex as TopicIndexType } from '@/types';

interface ResultsViewProps {
  notes: VideoNotes;
  onReset: () => void;
}

const ResultsView = ({ notes, onReset }: ResultsViewProps) => {
  const [activeTopicId, setActiveTopicId] = useState<string | undefined>(
    notes.index[0]?.id
  );

  const activeTopicNotes = notes.notes.find(n => n.topicId === activeTopicId);

  return (
    <div className="w-full fade-in">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={onReset} className="mb-2 -ml-2">
            <ArrowLeft className="w-4 h-4" />
            Process another video
          </Button>
          <h2 className="text-2xl font-bold text-foreground">{notes.title}</h2>
          <p className="text-muted-foreground mt-1">
            {notes.index.length} topics • {notes.notes.length} sections
          </p>
        </div>
        <Button variant="outline" className="hidden md:flex">
          <Download className="w-4 h-4" />
          Download All
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="notes" className="w-full">
        <TabsList className="w-full justify-start bg-secondary/50 p-1 rounded-xl mb-6">
          <TabsTrigger value="notes" className="flex items-center gap-2 rounded-lg">
            <FileText className="w-4 h-4" />
            Topic Notes
          </TabsTrigger>
          <TabsTrigger value="index" className="flex items-center gap-2 rounded-lg">
            <List className="w-4 h-4" />
            Index
          </TabsTrigger>
          <TabsTrigger value="full" className="flex items-center gap-2 rounded-lg">
            <BookOpen className="w-4 h-4" />
            Full Book
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notes" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4">
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
                    Select a topic to view notes
                  </p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="index" className="mt-0">
          <div className="max-w-2xl mx-auto">
            <TopicIndex topics={notes.index} />
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
