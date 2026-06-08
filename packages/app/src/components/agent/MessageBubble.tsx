import { Copy, Check, FileText, FileImage, FileType, File, Bot, ChevronDown, ChevronRight } from 'lucide-react';
import { Message } from '@/types';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { useState, memo } from 'react';
import { ToolCallList } from './ToolCallDisplay';

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
  onCopy?: () => void;
  onToggleThinking?: () => void;
  isThinkingExpanded?: boolean;
}

export const MessageBubble = memo(function MessageBubble({
  message,
  isStreaming = false,
  onCopy,
  onToggleThinking,
  isThinkingExpanded = false
}: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onCopy?.();
  };

  const attachments = message.attachments;

  const getFileIcon = (type: string) => {
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

  const content = message.content || (isStreaming ? '▊' : '');
  const hasThinking = message.thinking && message.thinking.length > 0;

  return (
    <div className={cn(
      'flex gap-3 group animate-in fade-in slide-in-from-bottom-2 duration-300',
      isUser ? 'justify-end' : 'justify-start'
    )}>
      {/* Avatar for assistant */}
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Bot className="w-4 h-4 text-primary" />
        </div>
      )}

      <div className={cn(
        'flex flex-col gap-2 max-w-[85%]',
        isUser && 'items-end'
      )}>
        {/* Attachments */}
        {attachments && attachments.length > 0 && (
          <div className={cn(
            'flex flex-wrap gap-2 p-2 rounded-lg border',
            isUser
              ? 'border-primary/20 bg-primary/5'
              : 'border-border/50 bg-muted/30'
          )}>
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center gap-2 px-2 py-1.5 bg-background rounded-md text-xs border border-border/50"
              >
                {getFileIcon(attachment.type)}
                <span className="max-w-[120px] truncate">{attachment.name}</span>
                <span className="text-muted-foreground/70">
                  ({formatFileSize(attachment.size)})
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Thinking section (collapsible) */}
        {hasThinking && onToggleThinking && (
          <div className="rounded-lg border border-amber-200 dark:border-amber-800 overflow-hidden bg-amber-50/50 dark:bg-amber-950/20">
            <button
              onClick={onToggleThinking}
              className="w-full px-3 py-2 flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-100/50 dark:hover:bg-amber-900/30 transition-colors"
            >
              {isThinkingExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
              <span>Reasoning</span>
            </button>
            {isThinkingExpanded && (
              <div className="px-3 py-2 bg-amber-100/30 dark:bg-amber-900/10 border-t border-amber-200 dark:border-amber-800">
                <div className="prose prose-sm max-w-none dark:prose-invert text-xs text-amber-900 dark:text-amber-200">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {message.thinking || ''}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tool Calls */}
        {message.toolCalls && message.toolCalls.length > 0 && !isStreaming && (
          <div className="max-w-full">
            <ToolCallList toolCalls={message.toolCalls} />
          </div>
        )}

        {/* Main content */}
        <div
          className={cn(
            'relative px-4 py-3 rounded-xl text-sm leading-relaxed shadow-sm transition-all duration-200',
            isUser
              ? 'bg-primary text-primary-foreground rounded-tr-sm'
              : 'bg-card text-card-foreground border border-border/50 rounded-tl-sm'
          )}
        >
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                p: ({ children }) => <p className="my-0 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="my-0 space-y-0">{children}</ul>,
                ol: ({ children }) => <ol className="my-0 space-y-0">{children}</ol>,
              }}
            >
              {content}
            </ReactMarkdown>
          </div>

          {/* Copy button */}
          <button
            onClick={handleCopy}
            className={cn(
              'absolute top-2 right-2 p-1.5 rounded-md',
              'opacity-0 group-hover:opacity-100',
              'transition-opacity duration-200',
              'hover:bg-black/10 dark:hover:bg-white/10',
              isUser
                ? 'text-primary-foreground/70 hover:text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title="Copy"
            aria-label="Copy to clipboard"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>

          {isStreaming && !isUser && <span className="typing-cursor" />}

          {message.status === 'error' && (
            <div className="mt-1.5 text-xs text-destructive">
              Failed to send
            </div>
          )}
        </div>

        {/* Timestamp */}
        {message.timestamp && (
          <span className="text-[11px] text-muted-foreground/70 px-1">
            {formatRelativeTime(message.timestamp)}
          </span>
        )}
      </div>
    </div>
  );
});
