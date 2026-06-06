import { Copy, Check, FileText, FileImage, FileType, File } from 'lucide-react';
import { Message } from '@/types';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { useState, memo } from 'react';

interface MessageBubbleProps {
  message: Message;
}

export const MessageBubble = memo(function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isStreaming = message.status === 'streaming';
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const attachments = message.attachments;

  const getFileIcon = (type: string, className = 'w-4 h-4') => {
    if (type.includes('pdf')) return <FileText className={className} />;
    if (type.includes('image')) return <FileImage className={className} />;
    if (type.includes('powerpoint') || type.includes('presentation') || type.includes('ppt')) {
      return <FileType className={className} />;
    }
    return <File className={className} />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className={cn(
      'flex gap-3 group animate-in',
      isUser ? 'justify-end' : 'justify-start'
    )}>
      <div className={cn(
        'flex flex-col gap-1 max-w-[80%]',
        isUser && 'items-end'
      )}>
        {attachments && attachments.length > 0 && (
          <div className={cn(
            'flex flex-wrap gap-2 p-2 rounded-lg border',
            isUser
              ? 'border-primary/20 bg-primary/5'
              : 'border-border bg-muted/50'
          )}>
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center gap-2 px-2 py-1 bg-background border border-input rounded-md text-xs"
              >
                {getFileIcon(attachment.type, 'w-4 h-4 text-muted-foreground')}
                <span className="max-w-[120px] truncate">{attachment.name}</span>
                <span className="text-muted-foreground">
                  ({formatFileSize(attachment.size)})
                </span>
              </div>
            ))}
          </div>
        )}

        <div
          className={cn(
            'relative px-3.5 py-2.5 rounded-lg',
            'text-sm leading-relaxed',
            'transition-colors duration-150',
            'shadow-[var(--shadow-xs)]',
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-card text-card-foreground border border-border'
          )}
        >
          <div className="markdown-content prose prose-sm max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                p: ({ children }) => <p className="my-0 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="my-0 space-y-0">{children}</ul>,
                ol: ({ children }) => <ol className="my-0 space-y-0">{children}</ol>,
              }}
            >
              {message.content || (isStreaming ? '▊' : '')}
            </ReactMarkdown>
          </div>

          <button
            onClick={handleCopy}
            className={cn(
              'absolute top-2 right-2 p-1 rounded-md opacity-0 group-hover:opacity-100',
              'transition-opacity duration-150',
              'hover:bg-black/10',
              isUser ? 'text-primary-foreground/60 hover:text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
            title="Copy message"
            aria-label="Copy message to clipboard"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>

          {isStreaming && !isUser && <span className="typing-cursor" />}

          {message.status === 'error' && (
            <div className="mt-1 text-xs text-destructive">
              Failed to send
            </div>
          )}
        </div>

        {message.timestamp && (
          <span className="text-[10px] text-muted-foreground px-1">
            {formatRelativeTime(message.timestamp)}
          </span>
        )}
      </div>
    </div>
  );
});
