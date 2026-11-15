import { describe, it, expect } from 'vitest';
import {
  formatTimeDisplay,
  getTranscriptDuration,
  analyzeVideoSyllabus,
  buildLectureWiseOutline,
} from '../nativePipeline';
import type { ExtractedTranscript } from '../tauri';

describe('Hybrid Playlist Chaptering & Adaptive Slicing', () => {
  it('formats seconds into human-readable timestamps correctly', () => {
    expect(formatTimeDisplay(0)).toBe('0:00');
    expect(formatTimeDisplay(45)).toBe('0:45');
    expect(formatTimeDisplay(605)).toBe('10:05');
    expect(formatTimeDisplay(3600)).toBe('1:00:00');
    expect(formatTimeDisplay(5432)).toBe('1:30:32');
  });

  it('calculates total transcript duration accurately from segments', () => {
    const mockTranscript: ExtractedTranscript = {
      video_id: 'vid-short',
      video_info: { id: 'vid-short', title: 'Short Lesson', thumbnail: '' },
      segments: [
        { start: 0, duration: 30, text: 'Hello' },
        { start: 30, duration: 45, text: 'World' },
        { start: 500, duration: 15, text: 'Conclusion' },
      ],
      full_text: 'Hello World Conclusion',
    };

    expect(getTranscriptDuration(mockTranscript)).toBe(515);
  });

  it('correctly handles atomic short videos vs compound multi-hour lectures', () => {
    const shortLesson: ExtractedTranscript = {
      video_id: 'vid-1',
      video_info: {
        id: 'vid-1',
        title: 'Episode 1: Execution Context',
        thumbnail: '',
      },
      segments: [
        { start: 0, duration: 10, text: 'Intro' },
        { start: 590, duration: 10, text: 'Outro' },
      ],
      full_text: 'Intro Outro',
    };

    const longMasterclassWithChapters: ExtractedTranscript = {
      video_id: 'vid-2',
      video_info: {
        id: 'vid-2',
        title: 'Episode 2: The 5-Hour Deep Dive',
        thumbnail: '',
        chapters: [
          { title: 'Call Stack & Memory', start_seconds: 0, end_seconds: 2700, time_display: '0:00' },
          { title: 'Closures & Scope', start_seconds: 2700, end_seconds: 7200, time_display: '45:00' },
          { title: 'Event Loop & Microtasks', start_seconds: 7200, end_seconds: 14400, time_display: '2:00:00' },
          { title: 'Prototypes & Inheritance', start_seconds: 14400, end_seconds: 18000, time_display: '4:00:00' },
        ],
      },
      segments: [
        { start: 0, duration: 10, text: 'Start' },
        { start: 17990, duration: 10, text: 'End' },
      ],
      full_text: 'Start End',
    };

    const longVideoWithoutChapters: ExtractedTranscript = {
      video_id: 'vid-3',
      video_info: {
        id: 'vid-3',
        title: 'Episode 3: Unchaptered 1-Hour Lecture',
        thumbnail: '',
      },
      segments: [
        { start: 0, duration: 10, text: 'Start' },
        { start: 3590, duration: 10, text: 'End' },
      ],
      full_text: 'Start End',
    };

    const analyses = analyzeVideoSyllabus([
      shortLesson,
      longMasterclassWithChapters,
      longVideoWithoutChapters,
    ]);

    expect(analyses).toHaveLength(3);

    // 1. Short lesson is atomic:
    expect(analyses[0].isLongOrCompound).toBe(false);
    expect(analyses[0].chapters).toHaveLength(0);

    // 2. 5-hour video with chapters expands to its 4 explicit chapters:
    expect(analyses[1].isLongOrCompound).toBe(true);
    expect(analyses[1].chapters).toHaveLength(4);
    expect(analyses[1].chapters[1].title).toBe('Closures & Scope');
    expect(analyses[1].chapters[1].time_display).toBe('45:00');

    // 3. 1-hour video without chapters auto-synthesizes 15-minute windows:
    expect(analyses[2].isLongOrCompound).toBe(true);
    expect(analyses[2].chapters.length).toBeGreaterThanOrEqual(4);
    expect(analyses[2].chapters[0].title).toContain('Part 1');
    expect(analyses[2].chapters[1].title).toContain('Part 2');
    expect(analyses[2].chapters[1].start_seconds).toBe(900);
  });

  it('builds lecture-wise outline dividing big videos into 10.1, 10.2 sub-notes', () => {
    // 9 small videos + 1 big video with 3 chapters
    const smallVideos: ExtractedTranscript[] = Array.from({ length: 9 }, (_, i) => ({
      video_id: `vid-${i + 1}`,
      video_info: {
        id: `vid-${i + 1}`,
        title: `Episode ${i + 1}: Lesson ${i + 1} Overview`,
        thumbnail: '',
      },
      segments: [
        { start: 0, duration: 10, text: 'Start' },
        { start: 600, duration: 10, text: 'End' },
      ],
      full_text: `Lesson ${i + 1} content`,
    }));

    const bigVideo10: ExtractedTranscript = {
      video_id: 'vid-10',
      video_info: {
        id: 'vid-10',
        title: 'Lecture 10: Complete Advanced JavaScript Masterclass',
        thumbnail: '',
        chapters: [
          { title: 'Asynchronous Architecture', start_seconds: 0, end_seconds: 3600, time_display: '0:00' },
          { title: 'Promises & Microtask Queue', start_seconds: 3600, end_seconds: 7200, time_display: '1:00:00' },
          { title: 'V8 Engine Internals', start_seconds: 7200, end_seconds: 14400, time_display: '2:00:00' },
        ],
      },
      segments: [
        { start: 0, duration: 10, text: 'Masterclass Start' },
        { start: 14390, duration: 10, text: 'Masterclass End' },
      ],
      full_text: 'Complete Masterclass transcript',
    };

    const allAnalyses = analyzeVideoSyllabus([...smallVideos, bigVideo10]);
    const outline = buildLectureWiseOutline(allAnalyses);

    // 9 small videos + 3 chapters for big video 10 = 12 total topics
    expect(outline).toHaveLength(12);

    // Lectures 1 through 9:
    expect(outline[0].title).toBe('Lecture 1: Lesson 1 Overview');
    expect(outline[0].videoId).toBe('vid-1');
    expect(outline[8].title).toBe('Lecture 9: Lesson 9 Overview');
    expect(outline[8].videoId).toBe('vid-9');

    // Lecture 10 is broken down into 10.1, 10.2, 10.3:
    expect(outline[9].title).toContain('Lecture 10.1: Asynchronous Architecture');
    expect(outline[9].videoId).toBe('vid-10');
    expect(outline[9].startTime).toBe(0);

    expect(outline[10].title).toContain('Lecture 10.2: Promises & Microtask Queue');
    expect(outline[10].videoId).toBe('vid-10');
    expect(outline[10].startTime).toBe(3600);

    expect(outline[11].title).toContain('Lecture 10.3: V8 Engine Internals');
    expect(outline[11].videoId).toBe('vid-10');
    expect(outline[11].startTime).toBe(7200);
  });
});

