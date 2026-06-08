import { X, FileText, FileImage, FileType, File } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileChipProps {
  id: string;
  name: string;
  size: number;
  type: string;
  status?: 'uploading' | 'done' | 'error';
  onRemove: (id: string) => void;
  className?: string;
}

export function FileChip({ id, name, size, type, status = 'done', onRemove, className }: FileChipProps) {
  const getFileIcon = () => {
    const iconClass = 'w-3.5 h-3.5 text-muted-foreground';
    if (type.includes('pdf')) return <FileText className={iconClass} />;
    if (type.includes('image')) return <FileImage className={iconClass} />;
    if (type.includes('powerpoint') || type.includes('presentation') || type.includes('ppt')) {
      return <FileType className={iconClass} />;
    }
    return <File className={iconClass} />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className={cn(
      'inline-flex items-center gap-2 px-3 py-1.5',
      'rounded-lg bg-muted/50 border border-border/50',
      'text-xs',
      className
    )}>
      {status === 'uploading' && (
        <div className="w-3.5 h-3.5 rounded-full border-2 border-muted-foreground border-t-transparent animate-spin" />
      )}
      {status === 'done' && getFileIcon()}
      {status === 'error' && <X className="w-3.5 h-3.5 text-destructive" />}

      <span className="max-w-[120px] truncate">{name}</span>
      <span className="text-muted-foreground/70">({formatFileSize(size)})</span>

      <button
        onClick={() => onRemove(id)}
        className="p-0.5 rounded hover:bg-muted transition-colors"
        title="Remove"
      >
        <X className="w-3 h-3 text-muted-foreground hover:text-foreground" />
      </button>
    </div>
  );
}
