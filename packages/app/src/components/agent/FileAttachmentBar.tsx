/**
 * FileAttachmentBar Component
 * Display and manage file attachments
 */

import { X, FileText, Image } from 'lucide-react';
import { FileChip } from '@/components/ui/FileChip';
import { cn } from '@/lib/utils';
import type { AttachedFile } from '@/hooks/agent/useAgentInput';

interface FileAttachmentBarProps {
  files: AttachedFile[];
  onRemove: (id: string) => void;
  isDragOver?: boolean;
}

export function FileAttachmentBar({ files, onRemove, isDragOver = false }: FileAttachmentBarProps) {
  if (files.length === 0 && !isDragOver) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap gap-2 px-4 py-2",
        isDragOver && "bg-primary/5"
      )}
    >
      {files.map(file => (
        <FileChip
          key={file.id}
          file={{
            name: file.name,
            size: file.size,
            type: file.type
          }}
          onRemove={() => onRemove(file.id)}
        />
      ))}

      {isDragOver && (
        <div className="flex items-center gap-2 text-sm text-primary">
          <Upload className="w-4 h-4" />
          <span>Drop files to attach</span>
        </div>
      )}
    </div>
  );
}
