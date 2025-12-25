import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { 
  CheckCircle2, 
  Edit2, 
  Trash2, 
  Plus, 
  GripVertical,
  ArrowUp,
  ArrowDown,
  Sparkles
} from 'lucide-react';

interface SubTopic {
  id: string;
  title: string;
  description?: string;
  videoSources: string[];
}

interface TopicNode {
  id: string;
  title: string;
  description?: string;
  subtopics: SubTopic[];
  videoSources: string[];
  order: number;
}

interface UnifiedIndex {
  id: string;
  title: string;
  topics: TopicNode[];
  createdAt: string;
  updatedAt: string;
  videoCount: number;
  topicCount: number;
}

interface IndexReviewProps {
  index: UnifiedIndex;
  onApprove: (updatedIndex: UnifiedIndex) => void;
  onCancel?: () => void;
}

export function IndexReview({ index, onApprove, onCancel }: IndexReviewProps) {
  const [topics, setTopics] = useState<TopicNode[]>([...index.topics]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const startEdit = (topic: TopicNode) => {
    setEditingId(topic.id);
    setEditTitle(topic.title);
    setEditDescription(topic.description || '');
  };

  const saveEdit = (topicId: string) => {
    setTopics(topics.map(t => 
      t.id === topicId 
        ? { ...t, title: editTitle, description: editDescription }
        : t
    ));
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
    setEditDescription('');
  };

  const deleteTopic = (topicId: string) => {
    setTopics(topics.filter(t => t.id !== topicId));
  };

  const moveTopic = (topicId: string, direction: 'up' | 'down') => {
    const index = topics.findIndex(t => t.id === topicId);
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === topics.length - 1)
    ) {
      return;
    }

    const newTopics = [...topics];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    [newTopics[index], newTopics[targetIndex]] = [newTopics[targetIndex], newTopics[index]];
    
    // Update order property
    newTopics.forEach((topic, idx) => {
      topic.order = idx;
    });
    
    setTopics(newTopics);
  };

  const addNewTopic = () => {
    const newTopic: TopicNode = {
      id: `topic-${Date.now()}`,
      title: 'New Topic',
      description: '',
      subtopics: [],
      videoSources: [],
      order: topics.length
    };
    setTopics([...topics, newTopic]);
    startEdit(newTopic);
  };

  const handleApprove = () => {
    const updatedIndex: UnifiedIndex = {
      ...index,
      topics,
      topicCount: topics.length,
      updatedAt: new Date().toISOString()
    };
    onApprove(updatedIndex);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-yellow-500" />
            Review Generated Index
          </CardTitle>
          <CardDescription>
            Review and edit the topic structure before generating notes. You can reorder, edit, or remove topics.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <AlertDescription>
              <strong>{topics.length} topics</strong> identified from <strong>{index.videoCount} videos</strong>.
              Approve to continue with notes generation.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {topics.map((topic, idx) => (
          <Card key={topic.id} className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <div className="flex flex-col gap-1 mt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => moveTopic(topic.id, 'up')}
                    disabled={idx === 0}
                    className="h-6 w-6 p-0"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => moveTopic(topic.id, 'down')}
                    disabled={idx === topics.length - 1}
                    className="h-6 w-6 p-0"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </Button>
                </div>

                <GripVertical className="w-5 h-5 text-gray-400 mt-1" />
                
                <div className="flex-1">
                  {editingId === topic.id ? (
                    <div className="space-y-3">
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Topic title"
                        className="font-semibold"
                      />
                      <Textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Topic description (optional)"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveEdit(topic.id)}>
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={cancelEdit}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{idx + 1}</Badge>
                        <CardTitle className="text-lg">{topic.title}</CardTitle>
                      </div>
                      {topic.description && (
                        <CardDescription className="mt-2">
                          {topic.description}
                        </CardDescription>
                      )}
                      {topic.subtopics.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {topic.subtopics.slice(0, 5).map((st) => (
                            <Badge key={st.id} variant="outline" className="text-xs">
                              {st.title}
                            </Badge>
                          ))}
                          {topic.subtopics.length > 5 && (
                            <Badge variant="outline" className="text-xs">
                              +{topic.subtopics.length - 5} more
                            </Badge>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {editingId !== topic.id && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEdit(topic)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteTopic(topic.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={addNewTopic}
          className="flex-1"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Topic
        </Button>
      </div>

      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Button
              onClick={handleApprove}
              className="flex-1 bg-green-600 hover:bg-green-700"
              size="lg"
            >
              <CheckCircle2 className="w-5 h-5 mr-2" />
              Approve & Continue to Notes Generation
            </Button>
            {onCancel && (
              <Button
                onClick={onCancel}
                variant="outline"
                size="lg"
              >
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
