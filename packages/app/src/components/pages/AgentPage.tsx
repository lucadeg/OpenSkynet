import { useEffect, useState, useRef, useCallback } from 'react';
import { Monitor, Paperclip, X, Send } from 'lucide-react';
import { useChatStore } from '@/stores/useChatStore';
import { useSandboxStore } from '@/stores/useSandboxStore';
import { useAppStore } from '@/stores/useAppStore';
import { getChatService } from '@/services/chatService';
import { Button } from '@/components/shared/Button';
import { Textarea } from '@/components/shared/Textarea';
import { ScrollArea } from '@/components/shared/ScrollArea';
import { MessageBubble } from '@/components/agent/MessageBubble';
import { StreamingIndicator } from '@/components/agent/StreamingIndicator';
import { FileUploadZone } from '@/components/shared/FileUploadZone';
import { cn } from '@/lib/utils';


interface AttachedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  status: 'uploading' | 'done' | 'error';
}

export function AgentPage() {
  const conversations = useChatStore((state) => state.conversations);
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const activeConversation = useChatStore((state) => state.activeConversation);
  const createConversation = useChatStore((state) => state.createConversation);
  const selectConversation = useChatStore((state) => state.selectConversation);
  const addMessage = useChatStore((state) => state.addMessage);
  const setMessageStatus = useChatStore((state) => state.setMessageStatus);
  const appendToMessage = useChatStore((state) => state.appendToMessage);
  const toggleSandbox = useSandboxStore((state) => state.togglePanel);
  const model = useAppStore((state) => state.model);

  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingPhase, setStreamingPhase] = useState<'thinking' | 'planning' | 'executing' | 'reflecting' | 'retrying'>('thinking');
  const [retryProgress, setRetryProgress] = useState<{ attempt: number; max: number; countdown: number } | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (conversations.length === 0) {
      const conversation = createConversation('New Chat');
      selectConversation(conversation.id);
    } else if (!activeConversationId && conversations.length > 0) {
      selectConversation(conversations[0].id);
    }
  }, [conversations, activeConversationId, createConversation, selectConversation]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeConversation?.messages]);

  const handleSend = async (overrideInput?: string) => {
    const messageText = overrideInput || input.trim();
    if (!messageText || !activeConversationId || isStreaming) return;

    // Include file info in message if there are attachments
    let finalMessage = messageText;
    if (attachedFiles.length > 0) {
      const fileInfo = attachedFiles.map(f => `[${f.name}]`).join(', ');
      finalMessage = `${messageText}\n\nAttached files: ${fileInfo}`;
    }

    if (!overrideInput) {
      setInput('');
      setAttachedFiles([]);
    }

    addMessage(activeConversationId, {
      role: 'user',
      content: finalMessage,
      status: 'done',
      attachments: attachedFiles.length > 0 ? attachedFiles : undefined,
    });

    addMessage(activeConversationId, {
      role: 'assistant',
      content: '',
      status: 'streaming',
    });

    setIsStreaming(true);
    setStreamingPhase('thinking');
    setRetryProgress(null);

    try {
      const chatService = getChatService();
      const messages = activeConversation?.messages || [];
      const lastMessage = messages[messages.length - 1];

      await chatService.runTask(
        finalMessage,
        {
          onChunk: (delta: string, phase = 'responding') => {
            if (phase === 'planning') {
              setStreamingPhase('planning');
            } else if (phase === 'executing') {
              setStreamingPhase('executing');
            } else if (phase === 'thinking') {
              setStreamingPhase('thinking');
            } else if (phase === 'reflecting') {
              setStreamingPhase('reflecting');
            }

            if (phase === 'planning' || phase === 'thinking' || phase === 'reflecting') {
              if (lastMessage) {
                appendToMessage(activeConversationId, lastMessage.id, delta);
              }
            } else if (phase === 'progress') {
              try {
                const progress = JSON.parse(delta);
                if (progress.retry) {
                  setStreamingPhase('retrying');
                  setRetryProgress({
                    attempt: progress.retry.attempt,
                    max: progress.retry.max,
                    countdown: progress.retry.countdown
                  });
                }
              } catch {
                if (lastMessage) {
                  appendToMessage(activeConversationId, lastMessage.id, delta);
                }
              }
            } else {
              if (lastMessage) {
                appendToMessage(activeConversationId, lastMessage.id, delta);
              }
            }
          },
          onProgress: (progress: { phase: string; detail?: string }) => {
            if (progress.phase === 'retrying') {
              setStreamingPhase('retrying');
              const detail = progress.detail || '';
              const match = detail.match(/attempt (\d+)\/(\d+)/);
              if (match) {
                setRetryProgress({
                  attempt: parseInt(match[1]),
                  max: parseInt(match[2]),
                  countdown: 0
                });
              }
            }
          },
          onDone: () => {
            if (lastMessage) {
              setMessageStatus(activeConversationId, lastMessage.id, 'done');
            }
            setIsStreaming(false);
            setRetryProgress(null);
          },
          onError: (error: string) => {
            if (lastMessage) {
              setMessageStatus(activeConversationId, lastMessage.id, 'error');
              appendToMessage(activeConversationId, lastMessage.id, `\n\nError: ${error}`);
            }
            setIsStreaming(false);
            setRetryProgress(null);
          },
        }
      );
    } catch (error) {
      setIsStreaming(false);
      setRetryProgress(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Allow default behavior (Enter for new line)
    // Only send with Cmd/Ctrl+Enter (Apple-style)
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFilesUploaded = useCallback((files: AttachedFile[]) => {
    setAttachedFiles(files);
    setShowFileUpload(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isStreaming) {
      setIsDragOver(true);
    }
  }, [isStreaming]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (isStreaming) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const newFiles: AttachedFile[] = Array.from(files).map(file => ({
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'uploading' as const
      }));

      setAttachedFiles(prev => [...prev, ...newFiles]);
      setShowFileUpload(false);
    }
  }, [isStreaming]);

  const removeAttachment = (fileId: string) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const hasMessages = activeConversation?.messages && activeConversation.messages.length > 0;

  return (
    <div
      className="flex flex-col h-full w-full overflow-hidden bg-background"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Messages Area */}
      <div className="flex-1 overflow-hidden bg-gradient-to-b from-background to-muted/20">
        <ScrollArea className="h-full">
          <div
            ref={scrollRef}
            className={cn(
              "mx-auto px-6 py-8",
              hasMessages ? "max-w-4xl space-y-6" : "max-w-2xl min-h-[60vh] flex items-center justify-center"
            )}
          >
            {hasMessages ? (
              activeConversation?.messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-16 space-y-4">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <Monitor className="w-10 h-10 text-primary/60" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                    New conversation
                  </h2>
                  <p className="text-base text-muted-foreground">
                    Ask me anything. I can help with browsing, automation, and more.
                  </p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Drag Overlay */}
      {isDragOver && (
        <div className="fixed inset-0 z-50 bg-primary/10 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center p-8 bg-background border-2 border-primary rounded-xl shadow-lg max-w-md">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <Paperclip className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Drop files to analyze
            </h3>
            <p className="text-sm text-muted-foreground">
              PDFs, documents, images supported
            </p>
          </div>
        </div>
      )}

      {/* Streaming Indicator */}
      {isStreaming && (
        <StreamingIndicator phase={streamingPhase} retryProgress={retryProgress} />
      )}

      {/* Input Area */}
      <div className="flex-shrink-0 border-t border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-4xl mx-auto px-6 py-4 space-y-3">
          {/* Attached Files */}
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-xl border border-border/50">
              {attachedFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-2 px-3 py-2 bg-background border border-border/50 rounded-lg text-sm shadow-sm"
                >
                  <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="max-w-[150px] truncate font-medium">{file.name}</span>
                  <button
                    onClick={() => removeAttachment(file.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors rounded-full p-0.5 hover:bg-destructive/10"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* File Upload Zone */}
          {showFileUpload && (
            <div className="relative">
              <FileUploadZone
                onFilesUploaded={handleFilesUploaded}
                acceptedTypes={['.pdf', '.ppt', '.pptx', '.doc', '.docx', '.txt', '.png', '.jpg', '.jpeg']}
                maxSize={100}
              />
              <button
                onClick={() => setShowFileUpload(false)}
                className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-all bg-background/80 backdrop-blur shadow-sm"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Input Controls */}
          <div className="flex items-end gap-3">
            {/* File Upload Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFileUpload(!showFileUpload)}
              disabled={isStreaming}
              className={cn(
                "flex-shrink-0 h-11 w-11 rounded-xl transition-all",
                showFileUpload ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted"
              )}
              title="Attach files"
            >
              <Paperclip className="w-4 h-4" />
            </Button>

            {/* Text Input */}
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                placeholder="Type a message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isStreaming}
                className="min-h-[52px] resize-none pr-14 rounded-xl border-border/50 focus:border-primary/50 focus:ring-0"
              />

              {/* Send Button - Absolute positioned */}
              <div className="absolute right-2 bottom-2">
                <Button
                  size="sm"
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isStreaming}
                  className={cn(
                    "h-9 w-9 p-0 rounded-lg shadow-sm transition-all",
                    input.trim() && !isStreaming ? "bg-primary text-primary-foreground hover:shadow-md" : "opacity-50 cursor-not-allowed bg-muted"
                  )}
                >
                  {isStreaming ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      <span className="sr-only">Send message</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Browser Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSandbox}
              disabled={isStreaming}
              className={cn(
                "flex-shrink-0 h-11 w-11 rounded-xl transition-all",
                "hover:bg-muted"
              )}
              title="Toggle browser"
            >
              <Monitor className="w-4 h-4" />
            </Button>
          </div>

          {/* Helper Text */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              {attachedFiles.length > 0 && <span>{attachedFiles.length} file(s) attached</span>}
              <span className="text-[10px] opacity-60">⌘/Ctrl+Enter to send</span>
            </div>
            {model && <span className="px-2 py-0.5 bg-muted rounded text-[11px] font-medium">{model}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
