import { useEffect, useState, useRef } from 'react';
import { Monitor } from 'lucide-react';
import { useChatStore } from '@/stores/useChatStore';
import { useSandboxStore } from '@/stores/useSandboxStore';
import { useAppStore } from '@/stores/useAppStore';
import { getChatService } from '@/services/chatService';
import { Button } from '@/components/shared/Button';
import { Textarea } from '@/components/shared/Textarea';
import { ScrollArea } from '@/components/shared/ScrollArea';
import { MessageBubble } from '@/components/agent/MessageBubble';
import { StreamingIndicator } from '@/components/agent/StreamingIndicator';
import { cn } from '@/lib/utils';

const SUGGESTIONS = [
  'What can you do?',
  'Help me browse a website',
  'Analyze the current page',
  'Record a new skill',
];

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

    if (!overrideInput) setInput('');

    addMessage(activeConversationId, {
      role: 'user',
      content: messageText,
      status: 'done',
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
        messageText,
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const hasMessages = activeConversation?.messages && activeConversation.messages.length > 0;

  return (
    <div className="flex flex-col h-full bg-background">
      <ScrollArea className="flex-1">
        <div ref={scrollRef} className={cn(
          "mx-auto transition-all duration-200 w-full px-4",
          hasMessages ? "max-w-4xl py-4 space-y-3" : "max-w-2xl py-16"
        )}>
          {hasMessages ? (
            activeConversation?.messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center text-center space-y-6 py-16">
              <div>
                <h2 className="text-sm font-medium text-foreground">
                  New conversation
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Type a message or try a suggestion below.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 max-w-sm">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSend(suggestion)}
                    className="text-left text-xs px-3 py-2 rounded border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {isStreaming && (
        <StreamingIndicator phase={streamingPhase} retryProgress={retryProgress} />
      )}

      <div className="p-4 border-t border-border bg-background">
        <div className="max-w-4xl mx-auto">
          <Textarea
            ref={textareaRef}
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="text-xs min-h-[60px] resize-none w-full p-3 rounded-sm border border-border bg-background text-foreground"
          />
          <div className="flex justify-between items-center mt-2">
            <div className="text-xs text-muted-foreground">
              <span>Enter to send</span>
              <span className="mx-1">\u00B7</span>
              <span>Shift+Enter for new line</span>
              {model && <span className="ml-2 text-muted-foreground/60">{model}</span>}
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSandbox}
                title="Toggle browser"
                aria-label="Toggle browser panel"
                className="text-xs"
              >
                <Monitor className="w-3 h-3" />
                Browser
              </Button>
              <Button
                size="sm"
                onClick={() => handleSend()}
                disabled={!input.trim() || isStreaming}
                className={cn(
                  "text-xs",
                  !input.trim() || isStreaming
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                )}
              >
                {isStreaming ? 'Sending...' : 'Send'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
