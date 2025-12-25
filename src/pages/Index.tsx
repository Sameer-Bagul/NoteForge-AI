import { Helmet } from 'react-helmet-async';
import Header from '@/components/Header';
import UrlInput from '@/components/UrlInput';
import ProcessingView from '@/components/ProcessingView';
import ResultsView from '@/components/ResultsView';
import { IndexReview } from '@/components/IndexReview';
import { useProcessing } from '@/hooks/useProcessing';

const Index = () => {
  const { state, startProcessing, approveIndex, reset } = useProcessing();

  const renderContent = () => {
    console.log('🎨 Rendering content for status:', state.status);
    
    switch (state.status) {
      case 'idle':
        return (
          <UrlInput 
            onSubmit={startProcessing} 
            isLoading={false}
          />
        );
      
      case 'extracting-transcripts':
      case 'analyzing-content':
      case 'generating-index':
      case 'extracting':
      case 'indexing':
      case 'generating-notes':
      case 'assembling-notebook':
      case 'generating':
      case 'assembling':
        console.log('📊 Showing ProcessingView with', state.steps.length, 'steps');
        return (
          <ProcessingView 
            steps={state.steps}
            currentStep={state.currentStep}
            videoInfo={state.videoInfo}
            videoCount={state.videoCount}
            processedVideos={state.processedVideos}
          />
        );
      
      case 'awaiting-approval':
        console.log('📋 Showing IndexReview, index available:', !!state.index);
        return state.index ? (
          <IndexReview
            index={state.index}
            onApprove={approveIndex}
          />
        ) : null;
      
      case 'complete':
        console.log('✅ Showing ResultsView, notes available:', !!state.notes);
        return state.notes ? (
          <ResultsView 
            notes={state.notes}
            onReset={reset}
          />
        ) : null;
      
      default:
        console.log('⚠️ Unknown status:', state.status);
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
