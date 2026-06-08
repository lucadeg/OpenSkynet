/**
 * AgentPage Component
 * Main agent UI page - Refactored with custom hooks and components
 */

import { useState, useCallback, useEffect } from 'react';
import { Upload } from 'lucide-react';
import { useRPCConnection } from '@/hooks/useRPCConnection';
import { useAppStore } from '@/stores/useAppStore';
import { useSandboxStore } from '@/stores/useSandboxStore';
import { getChatService } from '@/services/chatService';
import { FileUploadZone } from '@/elements/form/FileUploadZone';
import { ExecutionDisplay, type ExecutionStep } from '@/components/agent/ExecutionDisplay';
import { AgentMessages } from '@/components/agent/AgentMessages';
import { AgentInput } from '@/components/agent/AgentInput';
import { FileAttachmentBar } from '@/components/agent/FileAttachmentBar';
import { useAgentInput } from '@/hooks/agent/useAgentInput';
import { useAgentStreaming } from '@/hooks/agent/useAgentStreaming';
import { useScrollControl } from '@/hooks/agent/useScrollControl';
import { useFileAttachments } from '@/hooks/agent/useFileAttachments';
import { useConversationManager } from '@/hooks/agent/useConversationManager';
import { cn } from '@/lib/utils';
import type { Message } from '@/types';

export function AgentPage() {
  // Store hooks
  const setOpenSandbox = useSandboxStore((state) => state.setOpen);
  const model = useAppStore((state) => state.model);
  const provider = useAppStore((state) => state.provider);
  const agentStatus = useAppStore((state) => state.agentStatus);

  // Enable connection checking
  useRPCConnection();

  // Custom hooks
  const {
    messages,
    conversationId,
    createNewConversation
  } = useConversationManager();

  const {
    scrollRef,
    messagesEndRef,
    showScrollButton,
    scrollToBottom,
    handleScroll
  } = useScrollControl();

  const textareaRef = useState<HTMLTextAreaElement>(null)[0];

  const {
    input,
    setInput,
    isSending,
    sendError,
    triggerSend,
    handleKeyDown,
    showSlashCommands,
    slashCommandFilter,
    filteredSlashCommands,
    selectSlashCommand
  } = useAgentInput({
    onSubmit: handleSend,
    textareaRef: { current: textareaRef }
  });

  const {
    isStreaming,
    streamingPhase,
    currentAction,
    currentDetail,
    retryProgress,
    executionSteps,
    startStreaming,
    stopStreaming,
    updatePhase,
    updateAction,
    addExecutionStep,
    updateLastExecutionStep
  } = useAgentStreaming();

  const {
    attachedFiles,
    showFileUpload,
    isDragOver,
    addFile,
    removeFile,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    toggleFileUpload
  } = useFileAttachments();

  // Thinking messages expansion state
  const [expandedThinkingMessages, setExpandedThinkingMessages] = useState<Set<string>>(new Set());

  // Force connection status to true (backend is running) and sync conversations
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

  // Handle send message
  async function handleSend(inputText: string) {
    if (!inputText.trim() || isStreaming) return;

    // Create new conversation if needed
    let currentConversationId = conversationId;
    if (!currentConversationId) {
      const newConv = await createNewConversation();
      currentConversationId = newConv.id;
    }

    // Add user message
    const chatService = getChatService();
    await chatService.sendMessage(currentConversationId, inputText);

    // Start streaming
    startStreaming();

    // Stream response
    const response = await chatService.streamResponse(currentConversationId, {
      onPhase: (phase) => updatePhase(phase),
      onAction: (action, detail) => updateAction(action, detail),
      onStep: (step) => addExecutionStep(step),
      onUpdateStep: (updates) => updateLastExecutionStep(updates),
      onRetry: (progress) => updateRetryProgress(progress),
      onComplete: () => stopStreaming()
    });

    return response;
  }

  // Handle file paste
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          addFile({
            id: `${file.name}-${Date.now()}`,
            name: file.name,
            size: file.size,
            type: file.type,
            status: 'done'
          });
        }
      }
    }
  };

  // Toggle thinking expansion
  const toggleThinking = useCallback((messageId: string) => {
    setExpandedThinkingMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  }, []);

  const hasMessages = messages.length > 0;

  return (
    <div
      className="flex flex-col h-full bg-background"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Connection Warning */}
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
      <AgentMessages
        messages={messages}
        isStreaming={isStreaming}
        streamingPhase={streamingPhase}
        currentAction={currentAction}
        currentDetail={currentDetail}
        retryProgress={retryProgress}
        executionSteps={executionSteps}
        scrollRef={scrollRef}
        messagesEndRef={messagesEndRef}
        onScroll={handleScroll}
        showScrollButton={showScrollButton}
        onScrollToBottom={() => scrollToBottom(true)}
        expandedThinkingMessages={expandedThinkingMessages}
        onToggleThinking={toggleThinking}
      />

      {/* File Upload Zone */}
      {showFileUpload && (
        <FileUploadZone
          onFilesAdded={(files) => files.forEach(file => addFile({
            id: `${file.name}-${Date.now()}`,
            name: file.name,
            size: file.size,
            type: file.type,
            status: 'done'
          }))}
          onClose={() => toggleFileUpload()}
        />
      )}

      {/* File Attachments Bar */}
      <FileAttachmentBar
        files={attachedFiles}
        onRemove={removeFile}
        isDragOver={isDragOver}
      />

      {/* Input Area */}
      <div className="border-t border-border bg-background">
        <div className="max-w-4xl mx-auto p-4">
          <AgentInput
            value={input}
            onChange={setInput}
            onSend={triggerSend}
            onStop={stopStreaming}
            isSending={isStreaming}
            sendError={sendError}
            disabled={!agentStatus.rpcConnected}
            placeholder={agentStatus.rpcConnected ? "Message agent..." : "Waiting for connection..."}
            showSlashCommands={showSlashCommands}
            filteredSlashCommands={filteredSlashCommands}
            onSelectSlashCommand={selectSlashCommand}
            onToggleFileUpload={toggleFileUpload}
            showFileUpload={showFileUpload}
            textareaRef={textareaRef}
            onKeyDown={handleKeyDown}
          />

          {/* Status Bar */}
          <div className="flex items-center justify-between mt-2 px-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {agentStatus.rpcConnected ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span>Connected</span>
                  {model && <span>• {model}</span>}
                  {provider && <span>• {provider}</span>}
                </>
              ) : (
                <>
                  <div className="w-2 h-2 rounded-full bg-warning" />
                  <span>Disconnected</span>
                </>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {hasMessages && `${messages.length} message${messages.length !== 1 ? 's' : ''}`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
