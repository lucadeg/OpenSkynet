import { useState, useRef, useEffect, useCallback } from 'react';
import { Monitor, Paperclip, Send, AlertCircle, Upload, Bot, Square, ChevronDown } from 'lucide-react';
import { useRPCConnection } from '@/hooks/useRPCConnection';
import { useChatStore } from '@/stores/useChatStore';
import { useSandboxStore } from '@/stores/useSandboxStore';
import { useAppStore } from '@/stores/useAppStore';
import { getChatService } from '@/services/chatService';
import { FileUploadZone } from '@/elements/form/FileUploadZone';
import { StreamingIndicator } from '@/components/agent/StreamingIndicator';
import { MessageBubble } from '@/components/agent/MessageBubble';
import { SuggestionChip } from '@/components/ui/SuggestionChip';
import { FileChip } from '@/components/ui/FileChip';
import { thinkTagParser } from '@/utils/thinkTagParser';
import { cn } from '@/lib/utils';
import type { Message } from '@/types';

interface AttachedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  status: 'uploading' | 'done' | 'error';
}

export function AgentPage() {
  const { createConversation, selectConversation, addMessage, updateMessage, appendToMessage, conversations } = useChatStore();
  const setOpenSandbox = useSandboxStore((state) => state.setOpen);
  const model = useAppStore((state) => state.model);
  const provider = useAppStore((state) => state.provider);
  const agentStatus = useAppStore((state) => state.agentStatus);

  // Enable connection checking
  useRPCConnection();

  // Force connection status to true (backend is running)
  useEffect(() => {
    if (!agentStatus.rpcConnected) {
      fetch('http://localhost:3001/api/health')
        .then(res => {
          if (res.ok) {
            const setAgentStatus = useAppStore.getState().setAgentStatus;
            setAgentStatus({ rpcConnected: true });
          }
        })
        .catch(err => {
          console.log('Connection check failed:', err);
        });
    }
  }, [agentStatus.rpcConnected]);

  // State
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingPhase, setStreamingPhase] = useState<'thinking' | 'planning' | 'executing' | 'reflecting' | 'retrying'>('thinking');
  const [currentAction, setCurrentAction] = useState<string | undefined>();
  const [currentDetail, setCurrentDetail] = useState<string | undefined>();
  const [retryProgress, setRetryProgress] = useState<{ attempt: number; max: number; countdown: number } | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [expandedThinkingMessages, setExpandedThinkingMessages] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Tool call history for better visibility
  const [toolCallHistory, setToolCallHistory] = useState<Array<{ action: string; detail: string; status: 'pending' | 'success' | 'error', timestamp: number }>>([]);
  const [intervention, setIntervention] = useState<{ active: boolean; message: string; id: number } | null>(null);

  // Use messages directly from store - no local state duplication
  const activeConversation = conversations.find(c => c.id === conversationId);
  const messages = activeConversation?.messages || [];

  // Initialize conversation on mount
  useEffect(() => {
    if (!conversationId) {
      const existingConvos = conversations;
      if (existingConvos.length > 0) {
        const sortedConvos = [...existingConvos].sort((a, b) => {
          const aTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
          const bTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
          return bTime - aTime;
        });
        const latestConv = sortedConvos[0];
        setConversationId(latestConv.id);
        selectConversation(latestConv.id);
      } else {
        const newConv = createConversation('New Chat');
        setConversationId(newConv.id);
        selectConversation(newConv.id);
      }
    }
  }, []);

  const [showScrollButton, setShowScrollButton] = useState(false);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setShowScrollButton(scrollHeight - scrollTop - clientHeight > 80);
  }, []);

  useEffect(() => {
    if (scrollRef.current && messages.length > 0) {
      if (!showScrollButton) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
  }, [messages.length, messages.reduce((s, m) => s + m.content.length, 0)]);

  const handleSend = async () => {
    const messageText = input.trim();
    if (!messageText || !conversationId || isStreaming) return;

    if (!agentStatus.rpcConnected) {
      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: messageText,
        status: 'done',
        timestamp: new Date(),
      };
      addMessage(conversationId, userMsg);

      const errorMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Backend disconnected. Run: bun run backend',
        status: 'error',
        timestamp: new Date(),
      };
      addMessage(conversationId, errorMsg);

      setInput('');
      return;
    }

    setInput('');
    setAttachedFiles([]);

    const userMsgId = crypto.randomUUID();
    const userMsg: Message = {
      id: userMsgId,
      role: 'user',
      content: messageText,
      status: 'done',
      timestamp: new Date(),
    };
    addMessage(conversationId, userMsg);

    const assistantMsgId = crypto.randomUUID();
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      status: 'streaming',
      timestamp: new Date(),
    };
    addMessage(conversationId, assistantMsg);

    setIsStreaming(true);
    setStreamingPhase('thinking');
    setRetryProgress(null);
    setToolCallHistory([]);

    try {
      const chatService = getChatService();

      await chatService.runTask(messageText, {
        onChunk: (delta: string, phase = 'responding') => {
          if (phase === 'planning') setStreamingPhase('planning');
          else if (phase === 'executing') setStreamingPhase('executing');
          else if (phase === 'thinking') setStreamingPhase('thinking');
          else if (phase === 'reflecting') setStreamingPhase('reflecting');

          const currentMessage = useChatStore.getState().conversations
            .find(c => c.id === conversationId)
            ?.messages.find(m => m.id === assistantMsgId);

          if (currentMessage && currentMessage.content && delta.startsWith(currentMessage.content)) {
            const newContent = delta.substring(currentMessage.content.length);
            appendToMessage(conversationId, assistantMsgId, newContent);
          } else {
            appendToMessage(conversationId, assistantMsgId, delta);
          }
        },
        onProgress: (progress: { phase: string; detail?: string; action?: string; url?: string; observation?: string; success?: boolean }) => {
          setCurrentAction(progress.action);
          setCurrentDetail(progress.detail || progress.observation);

          if (progress.action && progress.phase === 'executing') {
            if (progress.success === undefined) {
              const toolCallId = `tc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
              useChatStore.getState().addToolCall(conversationId, assistantMsgId, {
                id: toolCallId,
                action: progress.action,
                detail: progress.detail || '',
                status: 'pending',
                startedAt: Date.now(),
              });
              setToolCallHistory(prev => [...prev, {
                action: progress.action,
                detail: progress.detail || '',
                status: 'pending' as const,
                timestamp: Date.now(),
                _id: toolCallId,
              } as any]);
            } else {
              const lastPending = useChatStore.getState().conversations
                .find(c => c.id === conversationId)
                ?.messages.find(m => m.id === assistantMsgId)
                ?.toolCalls?.find(tc => tc.action === progress.action && tc.status === 'pending');

              if (lastPending) {
                useChatStore.getState().updateToolCall(conversationId, assistantMsgId, lastPending.id, {
                  status: progress.success ? 'success' : 'error',
                  observation: progress.observation || '',
                  completedAt: Date.now(),
                });
              }

              setToolCallHistory(prev => prev.map(tc => {
                if (tc.action === progress.action && tc.status === 'pending') {
                  return { ...tc, status: progress.success ? 'success' : 'error', detail: progress.observation || progress.detail || '' };
                }
                return tc;
              }));
            }
          }

          // Auto-open browser panel when agent uses browser tools
          if (progress.phase === 'planning' || progress.phase === 'executing') {
            const action = progress.action?.toLowerCase() || '';
            const detail = progress.detail?.toLowerCase() || '';

            const isBrowserAction =
              action.includes('navigate') ||
              action.includes('click') ||
              action.includes('screenshot') ||
              action.includes('browser') ||
              action.includes('snapshot') ||
              action.includes('extract') ||
              detail.includes('navigate') ||
              detail.includes('browser') ||
              progress.url;

            if (isBrowserAction) {
              const isOpen = useSandboxStore.getState().isOpen;
              if (!isOpen) {
                setOpenSandbox(true);
              }

              if (action === 'browser_navigate' && progress.detail) {
                try {
                  const detailObj = JSON.parse(progress.detail);
                  if (detailObj.url) {
                    import('@/services/BrowserService').then(({ browserService }) => {
                      browserService.serverNavigated(detailObj.url);
                    });
                  }
                } catch (e) {
                  console.log('[AgentPage] Failed to parse browser detail:', e);
                }
              }
            }
          }

          if (progress.phase === 'retrying') {
            setStreamingPhase('retrying');
            const match = progress.detail?.match(/attempt (\d+)\/(\d+)/);
            if (match) {
              setRetryProgress({
                attempt: parseInt(match[1]),
                max: parseInt(match[2]),
                countdown: 0
              });
            }
          }
        },
        onDone: (_result) => {
          const currentMessage = useChatStore.getState().conversations
            .find(c => c.id === conversationId)
            ?.messages.find(m => m.id === assistantMsgId);

          if (currentMessage && !currentMessage.content && _result?.result) {
            const parsed = thinkTagParser.parse(_result.result);
            updateMessage(conversationId, assistantMsgId, {
              content: parsed.visible,
              thinking: parsed.thinking || undefined,
              status: 'done',
            });
          } else if (currentMessage && currentMessage.content) {
            const parsed = thinkTagParser.parse(currentMessage.content);
            updateMessage(conversationId, assistantMsgId, {
              content: parsed.visible,
              thinking: parsed.thinking || undefined,
              status: 'done',
            });
          } else {
            updateMessage(conversationId, assistantMsgId, {
              status: 'done',
            });
          }

          setIsStreaming(false);
          setRetryProgress(null);
        },
        onError: (error: string) => {
          console.warn('[AgentPage] Non-fatal agent error (agent may recover):', error);
        },
        onIntervention: (message: string, id: number) => {
          setIntervention({ active: true, message, id });
          try {
            new Notification('Agent Needs Your Help', { body: message, silent: false });
          } catch {}
        },
      },
      { model, provider }
      );
    } catch (error) {
      console.error('Send error:', error);
      setIsStreaming(false);
      setRetryProgress(null);
    }
  };

  const handleStop = async () => {
    try {
      await getChatService().stopCurrentTask();
    } catch {}
    setIsStreaming(false);
    setStreamingPhase('thinking');
    setRetryProgress(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isStreaming) setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (isStreaming) return;
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      setAttachedFiles(Array.from(files).map(f => ({
        id: crypto.randomUUID(),
        name: f.name,
        size: f.size,
        type: f.type,
        status: 'uploading' as const
      })));
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <div
      className="flex flex-col h-full bg-background"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Connection Warning (Subtle) */}
      {!agentStatus.rpcConnected && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-warning/10 border-b border-warning/20 text-warning-foreground">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-warning animate-pulse" />
            <span className="font-medium">Disconnected</span>
            <span className="text-muted-foreground">— Backend not responding</span>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="text-xs underline hover:text-foreground transition-colors"
          >
            Reconnect
          </button>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto relative" ref={scrollRef} onScroll={handleScroll}>
        {/* Scroll to bottom button */}
        {showScrollButton && (
          <button
            onClick={scrollToBottom}
            className="fixed bottom-32 right-8 z-40 w-8 h-8 rounded-full bg-card border border-border shadow-lg flex items-center justify-center hover:bg-muted transition-colors"
          >
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
        <div className="max-w-4xl mx-auto">
          {!hasMessages ? (
            <div className="h-96 flex items-center justify-center p-12">
              <div className="text-center max-w-md">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted/50 flex items-center justify-center">
                  <Bot className="w-8 h-8 text-muted-foreground" />
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  Start a conversation
                </h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Ask questions, request tasks, or give instructions
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <SuggestionChip label="Analyze a file" />
                  <SuggestionChip label="Browse the web" />
                  <SuggestionChip label="Write code" />
                </div>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {messages.map((message) => {
                const parsedThinking = thinkTagParser.parse(message.content);
                const displayContent = parsedThinking.visible;
                const displayThinking = message.thinking || parsedThinking.thinking;
                const effectiveThinking = message.status === 'streaming'
                  ? (parsedThinking.thinking || null)
                  : displayThinking;

                return (
                  <div key={message.id} className="p-8">
                    <MessageBubble
                      message={{
                        ...message,
                        content: displayContent || message.content,
                        thinking: effectiveThinking || undefined
                      }}
                      isStreaming={message.status === 'streaming'}
                      onToggleThinking={displayThinking ? () => {
                        setExpandedThinkingMessages(prev => {
                          const newSet = new Set(prev);
                          if (newSet.has(message.id)) {
                            newSet.delete(message.id);
                          } else {
                            newSet.add(message.id);
                          }
                          return newSet;
                        });
                      } : undefined}
                      isThinkingExpanded={expandedThinkingMessages.has(message.id)}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Drag Overlay (Elegant) */}
      {isDragOver && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="p-8 rounded-2xl border-2 border-dashed border-border bg-card shadow-xl text-center animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground">
              Drop to attach files
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PDF, images, documents supported
            </p>
          </div>
        </div>
      )}

      {/* Streaming Indicator */}
      {isStreaming && <StreamingIndicator phase={streamingPhase} retryProgress={retryProgress} action={currentAction} detail={currentDetail} toolCallHistory={toolCallHistory} />}

      {/* Intervention Banner */}
      {intervention?.active && (
        <div className="mx-4 my-2 p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950 border-2 border-amber-400 dark:border-amber-600 shadow-lg animate-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-400 dark:bg-amber-600 flex items-center justify-center shrink-0 animate-pulse">
              <AlertCircle className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-amber-900 dark:text-amber-100 mb-1">Agent Needs Your Help</h3>
              <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed">{intervention.message}</p>
              <button
                onClick={async () => {
                  try {
                    await fetch(`${import.meta.env?.VITE_API_BASE || 'http://localhost:3001'}/api/browser/intervention-done`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ message: 'User completed the task' }),
                    });
                  } catch {}
                  setIntervention(null);
                }}
                className="mt-3 px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold shadow-md hover:shadow-lg transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-border/50 bg-card px-4 py-4">
        <div className="max-w-3xl mx-auto space-y-3">
          {/* Attachments */}
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachedFiles.map(file => (
                <FileChip
                  key={file.id}
                  {...file}
                  onRemove={(id) => setAttachedFiles(prev => prev.filter(f => f.id !== id))}
                />
              ))}
            </div>
          )}

          {/* File Upload Zone */}
          {showFileUpload && (
            <div className="relative mb-3">
              <FileUploadZone
                onFilesUploaded={(files) => {
                  setAttachedFiles(files);
                  setShowFileUpload(false);
                }}
                acceptedTypes={['.pdf', '.ppt', '.pptx', '.doc', '.docx', '.txt', '.png', '.jpg', '.jpeg']}
                maxSize={100}
              />
              <button
                onClick={() => setShowFileUpload(false)}
                className="absolute top-2 right-2 p-1 rounded hover:bg-muted transition-colors"
              >
                <AlertCircle className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          )}

          {/* Input */}
          <div className={cn(
            'flex items-end gap-3 p-1.5 rounded-xl border-2 bg-background transition-all duration-200',
            'focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10',
            isDragOver ? 'border-primary border-dashed' : 'border-border'
          )}>
            {/* Attachment button */}
            <button
              onClick={() => setShowFileUpload(!showFileUpload)}
              disabled={isStreaming}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50 transition-colors duration-150"
              title="Attach files"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              placeholder="Message OpenSkynet..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isStreaming}
              rows={1}
              className="flex-1 py-2.5 px-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground/50 resize-none overflow-hidden textarea-autoresize disabled:opacity-50"
            />

            {/* Action buttons */}
            <div className="flex items-center gap-1 pb-0.5">
              <button
                onClick={() => setOpenSandbox(true)}
                disabled={isStreaming}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50 transition-colors duration-150"
                title="Open browser"
              >
                <Monitor className="w-4 h-4" />
              </button>

              <button
                onClick={isStreaming ? handleStop : handleSend}
                disabled={!isStreaming && !input.trim()}
                className={cn(
                  'p-2 rounded-lg transition-all duration-150 shadow-sm',
                  isStreaming
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-primary text-primary-foreground hover:opacity-90',
                  'disabled:opacity-30 disabled:hover:opacity-30'
                )}
                title={isStreaming ? 'Stop' : 'Send (⌘↵)'}
              >
                {isStreaming ? (
                  <Square className="w-4 h-4" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Press Shift + Enter for new line</span>
            {provider && model && (
              <span className="flex items-center gap-1.5">
                <span className="font-medium">{provider}</span>
                <span className="text-muted-foreground/50">•</span>
                <span>{model}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
