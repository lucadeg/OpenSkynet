import { useState, memo } from 'react';
import { MessageSquare, Edit2, Trash2, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChatStore } from '@/stores/useChatStore';
import { Button } from '@/components/shared/Button';
import { ScrollArea } from '@/components/shared/ScrollArea';

interface ConversationItemProps {
  id: string;
  title: string;
  isActive: boolean;
  isEditing: boolean;
  editTitle: string;
  onSelect: (id: string) => void;
  onStartEdit: (id: string, title: string) => void;
  onSaveEdit: (id: string) => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
  onEditTitleChange: (value: string) => void;
}

const ConversationItem = memo(function ConversationItem({
  id,
  title,
  isActive,
  isEditing,
  editTitle,
  onSelect,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onEditTitleChange,
}: ConversationItemProps) {
  return (
    <div
      className={cn(
        'group flex items-center gap-2 px-3 py-2 text-sm',
        'transition-all duration-150',
        'border-l-2',
        isActive
          ? 'border-primary text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50'
      )}
    >
      <button
        onClick={() => onSelect(id)}
        className="flex-1 text-left flex items-center gap-2 min-w-0"
      >
        <MessageSquare className="h-3.5 w-3.5 shrink-0" />
        {isEditing ? (
          <input
            type="text"
            value={editTitle}
            onChange={(e) => onEditTitleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSaveEdit(id);
              if (e.key === 'Escape') onCancelEdit();
            }}
            className="flex-1 bg-background border border-border rounded px-2 py-0.5 text-xs min-w-0"
            autoFocus
            aria-label="Edit conversation title"
          />
        ) : (
          <span className="truncate">{title}</span>
        )}
      </button>

      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0">
        {isEditing ? (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={() => onSaveEdit(id)}
              aria-label="Save title"
            >
              <Check className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={onCancelEdit}
              aria-label="Cancel editing"
            >
              <X className="h-3 w-3" />
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={() => onStartEdit(id, title)}
              aria-label={`Rename "${title}"`}
            >
              <Edit2 className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-destructive hover:text-destructive"
              onClick={() => {
                if (confirm(`Delete "${title}"?`)) {
                  onDelete(id);
                }
              }}
              aria-label={`Delete "${title}"`}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
});

export function SidebarAgent() {
  const conversations = useChatStore((state) => state.conversations);
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const selectConversation = useChatStore((state) => state.selectConversation);
  const deleteConversation = useChatStore((state) => state.deleteConversation);
  const updateConversationTitle = useChatStore((state) => state.updateConversationTitle);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const handleStartEdit = (id: string, title: string) => {
    setEditingId(id);
    setEditTitle(title);
  };

  const handleSaveEdit = (id: string) => {
    if (editTitle.trim()) {
      updateConversationTitle(id, editTitle);
    }
    setEditingId(null);
    setEditTitle('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
  };

  return (
    <div className="space-y-2">
      <div className="px-3 py-2">
        <span className="text-xs font-medium uppercase tracking-wider text-foreground">
          Conversations
        </span>
      </div>

      {conversations.length === 0 ? (
        <p className="text-xs text-muted-foreground px-3 py-2">
          No conversations yet
        </p>
      ) : (
        <ScrollArea className="h-44">
          <nav className="space-y-0" aria-label="Conversations">
            {conversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                id={conversation.id}
                title={conversation.title}
                isActive={activeConversationId === conversation.id}
                isEditing={editingId === conversation.id}
                editTitle={editTitle}
                onSelect={selectConversation}
                onStartEdit={handleStartEdit}
                onSaveEdit={handleSaveEdit}
                onCancelEdit={handleCancelEdit}
                onDelete={deleteConversation}
                onEditTitleChange={setEditTitle}
              />
            ))}
          </nav>
        </ScrollArea>
      )}
    </div>
  );
}
