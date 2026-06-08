/**
 * useConversationManager Hook
 * Manages conversation state and operations
 */

import { useState, useEffect, useCallback } from 'react';
import { useChatStore } from '@/stores/useChatStore';
import type { Conversation } from '@/types';

export function useConversationManager() {
  const { createConversation, selectConversation, conversations, syncWithServer } = useChatStore();
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Get active conversation
  const activeConversation = conversations.find(c => c.id === conversationId);
  const messages = activeConversation?.messages || [];

  // Initialize conversation on mount
  useEffect(() => {
    if (!conversationId) {
      const existingConvos = conversations;
      if (existingConvos.length > 0) {
        // Sort by updated time
        const sortedConvos = [...existingConvos].sort((a, b) => {
          const aTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
          const bTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
          return bTime - aTime;
        });
        const latestConv = sortedConvos[0];
        setConversationId(latestConv.id);
        selectConversation(latestConv.id);
      } else {
        // Create new conversation
        createConversation('New Chat').then(newConv => {
          setConversationId(newConv.id);
          selectConversation(newConv.id);
        });
      }
    }
  }, [conversationId, conversations, createConversation, selectConversation]);

  // Create new conversation
  const createNewConversation = useCallback(async () => {
    const newConv = await createConversation('New Chat');
    setConversationId(newConv.id);
    selectConversation(newConv.id);
    return newConv;
  }, [createConversation, selectConversation]);

  // Switch conversation
  const switchConversation = useCallback((convId: string) => {
    setConversationId(convId);
    selectConversation(convId);
  }, [selectConversation]);

  // Refresh conversations from server
  const refreshConversations = useCallback(() => {
    syncWithServer();
  }, [syncWithServer]);

  return {
    conversationId,
    activeConversation,
    messages,
    conversations,
    setConversationId,
    createNewConversation,
    switchConversation,
    refreshConversations
  };
}
