import { NotebookShell } from '@/components/notebook/NotebookShell';
import { VideoNotes } from '@/types';

interface ResultsViewProps {
  notes: VideoNotes;
  onReset: () => void;
}

const ResultsView = ({ notes, onReset }: ResultsViewProps) => {
  return <NotebookShell notes={notes} onReset={onReset} />;
};

export default ResultsView;
