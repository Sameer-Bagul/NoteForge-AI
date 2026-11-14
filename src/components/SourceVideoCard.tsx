import { VideoInfo } from '@/types';
import { Youtube, Clock, Layers, User, Loader2 } from 'lucide-react';

interface SourceVideoCardProps {
  videoInfo?: VideoInfo;
  videoCount?: number;
  totalSegments?: number;
  sourceUrl?: string;
}

export const SourceVideoCard = ({
  videoInfo,
  videoCount,
  totalSegments,
  sourceUrl,
}: SourceVideoCardProps) => {
  const hasMetadata = Boolean(videoInfo?.title || videoCount);

  return (
    <div className="rounded-xl border border-border/70 bg-card/60 p-4 transition-all">
      <div className="flex gap-4 items-center">
        {videoInfo?.thumbnail ? (
          <div className="relative w-36 aspect-video rounded-lg overflow-hidden border border-border/40 shrink-0 bg-muted">
            <img
              src={videoInfo.thumbnail}
              alt={videoInfo.title || 'Video thumbnail'}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            {videoInfo.duration && (
              <span className="absolute bottom-1 right-1 bg-black/85 text-white font-mono text-[10px] px-1.5 py-0.5 rounded leading-none">
                {videoInfo.duration}
              </span>
            )}
          </div>
        ) : (
          <div className="w-16 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
            {hasMetadata ? <Youtube className="w-6 h-6" /> : <Loader2 className="w-5 h-5 animate-spin" />}
          </div>
        )}

        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border/40 uppercase tracking-wider">
              {videoCount && videoCount > 1 ? `Playlist • ${videoCount} Videos` : 'YouTube Lecture'}
            </span>
            {videoInfo?.channel ? (
              <span className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                <User className="w-3 h-3 text-muted-foreground/70" />
                {videoInfo.channel}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground/60 font-mono">
                InnerTube Source
              </span>
            )}
          </div>

          <h3 className="text-sm font-semibold text-foreground tracking-tight line-clamp-1 leading-snug">
            {videoInfo?.title || (sourceUrl ? `Source: ${sourceUrl}` : 'Resolving Video Metadata...')}
          </h3>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {videoInfo?.duration && (
              <span className="flex items-center gap-1 font-mono text-[11px]">
                <Clock className="w-3 h-3" />
                {videoInfo.duration}
              </span>
            )}
            {totalSegments !== undefined && totalSegments > 0 ? (
              <span className="flex items-center gap-1 font-mono text-[11px] text-emerald-500">
                <Layers className="w-3 h-3" />
                {totalSegments.toLocaleString()} caption segments
              </span>
            ) : (
              <span className="text-[11px] text-muted-foreground/60 font-mono flex items-center gap-1">
                <Layers className="w-3 h-3" />
                Extracting transcript stream...
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
