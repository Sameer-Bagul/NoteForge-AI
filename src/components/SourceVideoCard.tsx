import { VideoInfo } from '@/types';
import { Youtube, Clock, Layers, User } from 'lucide-react';

interface SourceVideoCardProps {
  videoInfo?: VideoInfo;
  videoCount?: number;
  totalSegments?: number;
}

export const SourceVideoCard = ({ videoInfo, videoCount, totalSegments }: SourceVideoCardProps) => {
  if (!videoInfo && !videoCount) return null;

  return (
    <div className="rounded-xl border border-border/70 bg-card/60 p-4 transition-all">
      <div className="flex gap-4 items-center">
        {videoInfo?.thumbnail ? (
          <div className="relative w-32 aspect-video rounded-lg overflow-hidden border border-border/40 shrink-0 bg-muted">
            <img
              src={videoInfo.thumbnail}
              alt={videoInfo.title || 'Video thumbnail'}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            {videoInfo.duration && (
              <span className="absolute bottom-1 right-1 bg-black/80 text-white font-mono text-[10px] px-1 py-0.5 rounded leading-none">
                {videoInfo.duration}
              </span>
            )}
          </div>
        ) : (
          <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
            <Youtube className="w-6 h-6" />
          </div>
        )}

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border/40">
              {videoCount && videoCount > 1 ? `Playlist (${videoCount} Videos)` : 'YouTube Lecture'}
            </span>
            {videoInfo?.channel && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                <User className="w-3 h-3" />
                {videoInfo.channel}
              </span>
            )}
          </div>

          <h3 className="text-sm font-semibold text-foreground tracking-tight line-clamp-2 leading-snug">
            {videoInfo?.title || 'Synthesizing Source Video'}
          </h3>

          <div className="flex items-center gap-3 text-xs text-muted-foreground pt-0.5">
            {videoInfo?.duration && (
              <span className="flex items-center gap-1 font-mono text-[11px]">
                <Clock className="w-3 h-3" />
                {videoInfo.duration}
              </span>
            )}
            {totalSegments !== undefined && totalSegments > 0 && (
              <span className="flex items-center gap-1 font-mono text-[11px]">
                <Layers className="w-3 h-3" />
                {totalSegments.toLocaleString()} segments
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
