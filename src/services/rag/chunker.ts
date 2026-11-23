import { VideoNotes, TopicNotes } from '@/types';

export interface TextChunk {
  id: string;
  notebookId: string;
  chapterId?: string;
  chapterTitle?: string;
  chunkIndex: number;
  text: string;
  startTime?: number;
  endTime?: number;
  timeDisplay?: string;
}

export function chunkNotebook(notes: VideoNotes, maxChunkLength: number = 800, overlap: number = 100): TextChunk[] {
  const chunks: TextChunk[] = [];
  let globalChunkIndex = 0;

  // Process each chapter / topic
  (notes.notes || []).forEach((topicNote: TopicNotes, topicIdx: number) => {
    const topicInfo = notes.index?.[topicIdx];
    const chapterId = (topicNote as any).topicId || topicNote.id || topicInfo?.id || `ch-${topicIdx}`;
    const chapterTitle = (topicNote as any).topicTitle || topicNote.title || topicInfo?.title || `Chapter ${topicIdx + 1}`;
    const startTime = topicInfo?.startTime;
    const endTime = topicInfo?.endTime;
    const timeDisplay = topicInfo?.timeDisplay;

    const fullChapterText = [
      `Chapter: ${chapterTitle}`,
      topicNote.content || '',
      topicNote.keyTakeaways?.length ? `Key Takeaways:\n${topicNote.keyTakeaways.join('\n')}` : '',
    ].filter(Boolean).join('\n\n');

    // Split chapter text into paragraphs
    const paragraphs = fullChapterText.split(/\n\s*\n/);
    let currentChunk = '';

    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (!trimmed) continue;

      if ((currentChunk + '\n\n' + trimmed).length <= maxChunkLength) {
        currentChunk = currentChunk ? `${currentChunk}\n\n${trimmed}` : trimmed;
      } else {
        if (currentChunk) {
          chunks.push({
            id: `${notes.notebookId || notes.videoId}_${globalChunkIndex++}`,
            notebookId: notes.notebookId || notes.videoId,
            chapterId,
            chapterTitle,
            chunkIndex: globalChunkIndex,
            text: currentChunk,
            startTime,
            endTime,
            timeDisplay,
          });
        }

        // If a single paragraph is longer than maxChunkLength, slice it
        if (trimmed.length > maxChunkLength) {
          let start = 0;
          while (start < trimmed.length) {
            const slice = trimmed.slice(start, start + maxChunkLength);
            chunks.push({
              id: `${notes.notebookId || notes.videoId}_${globalChunkIndex++}`,
              notebookId: notes.notebookId || notes.videoId,
              chapterId,
              chapterTitle,
              chunkIndex: globalChunkIndex,
              text: slice,
              startTime,
              endTime,
              timeDisplay,
            });
            start += maxChunkLength - overlap;
          }
          currentChunk = '';
        } else {
          currentChunk = trimmed;
        }
      }
    }

    if (currentChunk.trim()) {
      chunks.push({
        id: `${notes.notebookId || notes.videoId}_${globalChunkIndex++}`,
        notebookId: notes.notebookId || notes.videoId,
        chapterId,
        chapterTitle,
        chunkIndex: globalChunkIndex,
        text: currentChunk.trim(),
        startTime,
        endTime,
        timeDisplay,
      });
    }
  });

  return chunks;
}

