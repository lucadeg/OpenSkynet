import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Conversation, Message, MessageStatus, ToolCallRecord } from '@/types';
import { getConversationService } from '@/services/conversationService';

interface ChatState {
  // State
  conversations: Conversation[];
  activeConversationId: string | null;
  version: number; // Increment to force re-renders
  _synced: boolean; // Track if we've synced with server

  // Computed
  activeConversation: Conversation | null;
  messages: Message[];

  // Actions
  syncWithServer: () => Promise<void>;
  createConversation: (title?: string) => Promise<Conversation>;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => Promise<void>;
  updateConversationTitle: (id: string, title: string) => Promise<void>;

  // Message actions
  addMessage: (conversationId: string, message: Omit<Message, 'id' | 'timestamp'> | Message) => Promise<void>;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<Message>) => Promise<void>;
  appendToMessage: (conversationId: string, messageId: string, delta: string) => void;
  setMessageStatus: (conversationId: string, messageId: string, status: MessageStatus) => Promise<void>;
  addToolCall: (conversationId: string, messageId: string, toolCall: ToolCallRecord) => Promise<void>;
  updateToolCall: (conversationId: string, messageId: string, toolCallId: string, updates: Partial<ToolCallRecord>) => Promise<void>;

  // Utility
  getConversation: (id: string) => Conversation | undefined;
}

const createDefaultConversation = (): Conversation => ({
  id: crypto.randomUUID(),
  title: 'New Chat',
  messages: [],
  createdAt: new Date(),
  updatedAt: new Date(),
});

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      // Initial state
      conversations: [],
      activeConversationId: null,
      version: 0,
      _synced: false,

      // Computed
      get activeConversation() {
        const { activeConversationId, conversations } = get();
        return conversations.find((c) => c.id === activeConversationId) || null;
      },

      get messages() {
        return get().activeConversation?.messages || [];
      },

      /**
       * Sync conversations with server
       * Merges server conversations with local ones
       */
      syncWithServer: async () => {
        const state = get();
        if (state._synced) return; // Already synced

        try {
          const service = getConversationService();
          const serverConvos = await service.getConversations();

          // Create a map of existing conversations by ID
          const localMap = new Map(state.conversations.map(c => [c.id, c]));
          const serverMap = new Map(serverConvos.map(c => [c.id, c]));

          // Merge conversations: server takes precedence for metadata,
          // but we preserve local messages that haven't been synced
          const mergedConversations: Conversation[] = [];

          // Add server conversations
          for (const [id, serverConvo] of serverMap) {
            const local = localMap.get(id);
            if (local) {
              // Merge: use server metadata but keep local messages if newer
              mergedConversations.push({
                ...serverConvo,
                messages: local.messages.length > 0 ? local.messages : serverConvo.messages,
              });
            } else {
              // New conversation from server
              mergedConversations.push(serverConvo);
            }
          }

          // Add local conversations that don't exist on server yet
          // (they'll be synced when created or modified)
          for (const [id, localConvo] of localMap) {
            if (!serverMap.has(id)) {
              mergedConversations.push(localConvo);
            }
          }

          set({
            conversations: mergedConversations,
            _synced: true,
          });

          console.log('[ChatStore] Synced with server:', mergedConversations.length, 'conversations');
        } catch (error) {
          console.error('[ChatStore] Failed to sync with server:', error);
          // Don't set synced=true on error, so we can retry
        }
      },

      /**
       * Create a new conversation (syncs to server)
       */
      createConversation: async (title) => {
        const newConversation: Conversation = {
          ...createDefaultConversation(),
          title: title || 'New Chat',
        };

        // Optimistic update
        set((state) => ({
          conversations: [newConversation, ...state.conversations],
          activeConversationId: newConversation.id,
        }));

        // Sync to server
        try {
          const service = getConversationService();
          const serverConvo = await service.createConversation(title);

          if (serverConvo) {
            // Update with server ID
            set((state) => ({
              conversations: state.conversations.map(c =>
                c.id === newConversation.id ? { ...c, id: serverConvo.id } : c
              ),
              activeConversationId: serverConvo.id,
            }));
            return serverConvo;
          }
        } catch (error) {
          console.error('[ChatStore] Failed to create conversation on server:', error);
        }

        return newConversation;
      },

      selectConversation: (id) => {
        set({ activeConversationId: id });
      },

      deleteConversation: async (id) => {
        // Optimistic update
        set((state) => ({
          conversations: state.conversations.filter((c) => c.id !== id),
          activeConversationId:
            state.activeConversationId === id ? null : state.activeConversationId,
        }));

        // Sync to server
        try {
          const service = getConversationService();
          await service.deleteConversation(id);
        } catch (error) {
          console.error('[ChatStore] Failed to delete conversation on server:', error);
        }
      },

      updateConversationTitle: async (id, title) => {
        // Optimistic update
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === id ? { ...c, title, updatedAt: new Date() } : c
          ),
        }));

        // Sync to server
        try {
          const service = getConversationService();
          await service.updateConversationTitle(id, title);
        } catch (error) {
          console.error('[ChatStore] Failed to update title on server:', error);
        }
      },

      addMessage: async (conversationId, message) => {
        const newMessage: Message = {
          ...message,
          id: 'id' in message && message.id ? message.id : crypto.randomUUID(),
          timestamp: 'timestamp' in message && message.timestamp ? message.timestamp : new Date(),
        };

        // Optimistic update
        set((state) => ({
          conversations: state.conversations.map((c) => {
            if (c.id === conversationId) {
              return {
                ...c,
                messages: [...c.messages, newMessage],
                updatedAt: new Date(),
              };
            }
            return c;
          }),
          version: state.version + 1,
        }));

        // Sync to server
        try {
          const service = getConversationService();
          const serverMessage = await service.addMessage(conversationId, {
            role: newMessage.role,
            content: newMessage.content,
            status: newMessage.status,
            thinking: newMessage.thinking,
          });

          if (serverMessage && serverMessage.id !== newMessage.id) {
            // Update with server ID
            set((state) => ({
              conversations: state.conversations.map((c) => {
                if (c.id === conversationId) {
                  return {
                    ...c,
                    messages: c.messages.map(m =>
                      m.id === newMessage.id ? { ...m, id: serverMessage.id } : m
                    ),
                  };
                }
                return c;
              }),
            }));
          }
        } catch (error) {
          console.error('[ChatStore] Failed to add message on server:', error);
        }
      },

      updateMessage: async (conversationId, messageId, updates) => {
        // Optimistic update
        set((state) => ({
          conversations: state.conversations.map((c) => {
            if (c.id === conversationId) {
              const updated = c.messages.map((m) =>
                m.id === messageId ? { ...m, ...updates } : m
              );
              return {
                ...c,
                messages: updated,
                updatedAt: new Date(),
              };
            }
            return c;
          }),
          version: state.version + 1,
        }));

        // Sync to server (debounced in practice, but immediate here)
        try {
          const service = getConversationService();
          await service.updateMessage(conversationId, messageId, updates);
        } catch (error) {
          console.error('[ChatStore] Failed to update message on server:', error);
        }
      },

      appendToMessage: (conversationId, messageId, delta) => {
        set((state) => ({
          conversations: state.conversations.map((c) => {
            if (c.id === conversationId) {
              return {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === messageId
                    ? { ...m, content: m.content + delta }
                    : m
                ),
              };
            }
            return c;
          }),
          version: state.version + 1,
        }));
      },

      setMessageStatus: async (conversationId, messageId, status) => {
        await get().updateMessage(conversationId, messageId, { status });
      },

      addToolCall: async (conversationId, messageId, toolCall) => {
        // Optimistic update
        set((state) => ({
          conversations: state.conversations.map((c) => {
            if (c.id === conversationId) {
              return {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === messageId
                    ? { ...m, toolCalls: [...(m.toolCalls || []), toolCall] }
                    : m
                ),
              };
            }
            return c;
          }),
          version: state.version + 1,
        }));

        // Sync to server
        try {
          const service = getConversationService();
          await service.addToolCall(conversationId, messageId, toolCall);
        } catch (error) {
          console.error('[ChatStore] Failed to add tool call on server:', error);
        }
      },

      updateToolCall: async (conversationId, messageId, toolCallId, updates) => {
        // Optimistic update
        set((state) => ({
          conversations: state.conversations.map((c) => {
            if (c.id === conversationId) {
              return {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === messageId
                    ? {
                        ...m,
                        toolCalls: (m.toolCalls || []).map((tc) =>
                          tc.id === toolCallId ? { ...tc, ...updates } : tc
                        ),
                      }
                    : m
                ),
              };
            }
            return c;
          }),
          version: state.version + 1,
        }));

        // Sync to server
        try {
          const service = getConversationService();
          await service.updateToolCall(conversationId, toolCallId, updates);
        } catch (error) {
          console.error('[ChatStore] Failed to update tool call on server:', error);
        }
      },

      getConversation: (id) => {
        return get().conversations.find((c) => c.id === id);
      },
    }),
    {
      name: 'openskynet-chat-store',
      partialize: (state) => ({
        conversations: state.conversations,
        activeConversationId: state.activeConversationId,
        // Don't persist _synced flag
        _synced: false,
      }),
    }
  )
);
