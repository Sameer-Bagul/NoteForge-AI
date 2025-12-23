import { Clock, User } from 'lucide-react';
import { VideoInfo } from '@/types';

interface VideoPreviewProps {
  video: VideoInfo;
}

const VideoPreview = ({ video }: VideoPreviewProps) => {
  return (
    <div className="flex items-center gap-4 p-4 bg-secondary/50 rounded-xl border border-border">
      <div className="w-24 h-16 rounded-lg bg-muted overflow-hidden flex-shrink-0">
        {video.thumbnail ? (
          <img 
            src={video.thumbnail} 
            alt={video.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <User className="w-8 h-8" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-foreground truncate">{video.title}</h4>
        {video.duration && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
            <Clock className="w-3.5 h-3.5" />
            {video.duration}
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoPreview;
