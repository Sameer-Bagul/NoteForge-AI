import { Helmet } from 'react-helmet-async';
import Header from '@/components/Header';
import UrlInput from '@/components/UrlInput';
import ProcessingView from '@/components/ProcessingView';
import ResultsView from '@/components/ResultsView';
import { useProcessing } from '@/hooks/useProcessing';

const Index = () => {
  const { state, startProcessing, reset } = useProcessing();

  const renderContent = () => {
    switch (state.status) {
      case 'idle':
        return (
          <UrlInput 
            onSubmit={startProcessing} 
            isLoading={false}
          />
        );
      
      case 'extracting':
      case 'indexing':
      case 'generating':
      case 'assembling':
        return (
          <ProcessingView 
            steps={state.steps}
            currentStep={state.currentStep}
            videoTitle={state.videoInfo?.title}
          />
        );
      
      case 'complete':
        return state.notes ? (
          <ResultsView 
            notes={state.notes}
            onReset={reset}
          />
        ) : null;
      
      default:
        return null;
    }
  };

  return (
    <>
      <Helmet>
        <title>NoteForge - Transform YouTube Videos into Structured Notes</title>
        <meta name="description" content="Turn any YouTube video or playlist into beautiful, organized notes. Extract transcripts, generate topic indexes, and create book-like documentation." />
      </Helmet>
      
      <div className="min-h-screen bg-background">
        <Header />
        
        <main className="container mx-auto px-4 py-12 md:py-16">
          {renderContent()}
        </main>

        {/* Background decoration */}
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/30 rounded-full blur-3xl" />
        </div>
      </div>
    </>
  );
};

export default Index;
