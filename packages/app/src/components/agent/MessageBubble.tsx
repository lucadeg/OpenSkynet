/**
 * Apple-Level Message Bubble
 * Premium message display with subtle animations and beautiful typography
 */

import { Copy, Check, FileText, FileImage, FileType, File, Bot, Sparkles, ChevronDown, ChevronRight } from 'lucide-react';
import { Message } from '@/types';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { useState, memo, useCallback } from 'react';
import { ExecutionDisplay } from './ExecutionDisplay';
import { formatThinkLabel } from '@/utils/thinkTagParser';

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

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onCopy?.();
  }, [message.content, onCopy]);

  const attachments = message.attachments;

  const getFileIcon = (type: string) => {
    const iconClass = 'w-4 h-4';
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

  // Parse thinking content
  let thinkBlocks: Array<{ content: string; label?: string }> = [];
  if (message.thinking) {
    if (typeof message.thinking === 'string') {
      thinkBlocks = [{ content: message.thinking, label: 'Reasoning' }];
    } else {
      thinkBlocks = message.thinking.map(tb => ({
        content: tb.content,
        label: formatThinkLabel(tb),
      }));
    }
  }

  const hasThinking = thinkBlocks.length > 0;

  return (
    <div className={cn(
      'flex gap-3 group animate-in fade-in slide-in-from-bottom-2 duration-500',
      isUser ? 'justify-end' : 'justify-start'
    )}>
      {/* Avatar for assistant */}
      {!isUser && (
        <div className={cn(
          "w-9 h-9 rounded-full flex items-center justify-center shrink-0",
          "bg-gradient-to-br from-violet-500/20 to-purple-600/20",
          "border border-violet-500/20",
          "shadow-lg"
        )}>
          <Bot className="w-5 h-5 text-violet-300" />
        </div>
      )}

      <div className={cn(
        'flex flex-col gap-2.5 max-w-[85%] sm:max-w-[75%] md:max-w-[65%] lg:max-w-[55%]',
        isUser && 'items-end'
      )}>
        {/* Attachments */}
        {attachments && attachments.length > 0 && (
          <div className={cn(
            'flex flex-wrap gap-2 p-3 rounded-2xl border',
            'backdrop-blur-sm',
            isUser
              ? 'border-violet-500/20 bg-violet-500/5'
              : 'border-white/10 bg-white/5'
          )}>
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-xl',
                  'bg-background/80 border border-white/10',
                  'transition-all duration-200',
                  'hover:bg-background hover:border-white/20'
                )}
              >
                <div className={cn(
                  'p-1.5 rounded-lg',
                  isUser ? 'bg-violet-500/10 text-violet-300' : 'bg-white/5 text-white/60'
                )}>
                  {getFileIcon(attachment.type)}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-white/90 max-w-[120px] truncate">
                    {attachment.name}
                  </span>
                  <span className="text-xs text-white/40">
                    {formatFileSize(attachment.size)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tool Calls - Using new ExecutionDisplay */}
        {message.toolCalls && message.toolCalls.length > 0 && !isStreaming && (
          <div className="max-w-full">
            <ExecutionDisplay
              steps={message.toolCalls.map(tc => ({
                id: tc.id,
                type: 'tool' as const,
                timestamp: tc.startedAt,
                duration: tc.completedAt ? tc.completedAt - tc.startedAt : undefined,
                status: tc.status,
                action: tc.action,
                detail: tc.detail,
                observation: tc.observation,
                error: tc.status === 'error' ? {
                  message: tc.observation || 'An error occurred',
                  code: tc.error?.code,
                  suggestion: tc.error?.suggestion,
                  retryable: tc.error?.retryable ?? true
                } : undefined
              }))}
              showSummary
            />
          </div>
        )}

        {/* Loading skeleton for streaming messages */}
        {isStreaming && !isUser && !content && (
          <div className="space-y-3 px-5 py-4 rounded-2xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-violet-500/30 animate-pulse" />
              <div className="h-3 bg-white/10 rounded-full animate-pulse w-24" />
            </div>
            <div className="space-y-2">
              <div className="h-2 bg-white/5 rounded-full animate-pulse w-3/4" />
              <div className="h-2 bg-white/5 rounded-full animate-pulse w-1/2" />
              <div className="h-2 bg-white/5 rounded-full animate-pulse w-5/6" />
            </div>
          </div>
        )}

        {/* Main content */}
        <div
          className={cn(
            'relative px-5 py-4 rounded-2xl text-sm leading-relaxed',
            'transition-all duration-300',
            isUser
              ? cn(
                  'bg-gradient-to-br from-violet-600 to-purple-700',
                  'text-white shadow-lg shadow-violet-900/20'
                )
              : cn(
                  'bg-white/5 border border-white/10',
                  'backdrop-blur-sm',
                  'text-white/90'
                )
          )}
        >
          <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-0 prose-ul:my-0 prose-ol:my-0">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                p: ({ children }) => <p className="my-0 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="my-0 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="my-0 space-y-1">{children}</ol>,
                code: ({ children, className }) => (
                  <code className={cn(
                    'px-1.5 py-0.5 rounded text-xs',
                    isUser
                      ? 'bg-white/10 text-white/90'
                      : 'bg-white/10 text-white/90 font-mono'
                  )}>
                    {children}
                  </code>
                ),
                pre: ({ children }) => (
                  <pre className={cn(
                    'p-3 rounded-xl overflow-x-auto text-xs',
                    isUser
                      ? 'bg-white/10 text-white/90'
                      : 'bg-white/5 border border-white/10 text-white/70'
                  )}>
                    {children}
                  </pre>
                )
              }}
            >
              {content}
            </ReactMarkdown>
          </div>

          {/* Copy button */}
          <button
            onClick={handleCopy}
            className={cn(
              'absolute top-3 right-3 p-2 rounded-xl',
              'opacity-0 group-hover:opacity-100',
              'transition-all duration-200',
              'hover:scale-110',
              isUser
                ? 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70'
            )}
            title="Copy"
            aria-label="Copy to clipboard"
          >
            {copied ? (
              <Check className="w-4 h-4" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>

          {isStreaming && !isUser && <span className="typing-cursor" />}
        </div>

        {/* Timestamp */}
        {message.timestamp && (
          <span className="text-[11px] text-white/30 px-1">
            {formatRelativeTime(message.timestamp)}
          </span>
        )}
      </div>
    </div>
  );
});
