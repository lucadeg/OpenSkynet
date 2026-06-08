/**
 * AgentInput Component
 * Premium input area with modern design and smooth interactions
 */

import { forwardRef, useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { Send, Square, AlertCircle, Paperclip, Upload, Sparkles } from 'lucide-react';
import { Button } from '@/elements/actions/Button';
import { cn } from '@/lib/utils';
import { SuggestionChip } from '@/components/ui/SuggestionChip';
import { useAgentInput, SLASH_COMMANDS } from '@/hooks/agent/useAgentInput';

// ============================================================================
// Component
// ============================================================================

interface AgentInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop?: () => void;
  isSending?: boolean;
  sendError?: boolean;
  disabled?: boolean;
  placeholder?: string;
  showSlashCommands?: boolean;
  filteredSlashCommands?: typeof SLASH_COMMANDS;
  onSelectSlashCommand?: (command: typeof SLASH_COMMANDS[number]) => void;
  onToggleFileUpload?: () => void;
  showFileUpload?: boolean;
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export const AgentInput = forwardRef<HTMLTextAreaElement, AgentInputProps>(
  ({
    value,
    onChange,
    onSend,
    onStop,
    isSending = false,
    sendError = false,
    disabled = false,
    placeholder = 'Tell me what you need...',
    showSlashCommands = false,
    filteredSlashCommands = [],
    onSelectSlashCommand,
    onToggleFileUpload,
    showFileUpload = false,
    textareaRef,
    onKeyDown
  }, ref) => {
    const internalTextareaRef = useRef<HTMLTextAreaElement>(null);
    const activeTextareaRef = (ref as any) || textareaRef || internalTextareaRef;
    const [isFocused, setIsFocused] = useState(false);

    // Auto-resize textarea
    useEffect(() => {
      const textarea = activeTextareaRef.current;
      if (!textarea) return;

      const autoResize = () => {
        textarea.style.height = 'auto';
        const scrollHeight = textarea.scrollHeight;
        const newHeight = Math.min(Math.max(scrollHeight, 44), 180);
        textarea.style.height = `${newHeight}px`;
      };

      autoResize();
      textarea.addEventListener('input', autoResize);
      return () => textarea.removeEventListener('input', autoResize);
    }, [activeTextareaRef]);

    // Handle keyboard shortcuts
    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (value.trim() && !isSending) onSend();
      }
      onKeyDown?.(e);
    }, [value, isSending, onSend, onKeyDown]);

    const hasContent = value.trim().length > 0;

    return (
      <div className="relative group">
        {/* Slash Commands Dropdown */}
        {showSlashCommands && filteredSlashCommands.length > 0 && (
          <div className="absolute bottom-full left-0 right-0 mb-3 bg-[#1a1a2e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50">
            <div className="p-2">
              <div className="text-xs text-white/40 px-3 py-2 mb-1 font-medium">Quick Actions</div>
              {filteredSlashCommands.map(cmd => (
                <SuggestionChip
                  key={cmd.id}
                  icon={cmd.icon}
                  label={cmd.label}
                  description={cmd.description}
                  onClick={() => onSelectSlashCommand?.(cmd)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Input Container */}
        <div
          className={cn(
            "relative flex items-end gap-2 p-3 rounded-2xl",
            "transition-all duration-300 ease-out",
            "backdrop-blur-xl",
            // Background gradient
            "bg-gradient-to-br from-white/5 to-white/[0.02]",
            // Border
            "border",
            sendError
              ? "border-red-500/30 shadow-[0_0_0_4px_rgba(239,68,68,0.1)]"
              : cn(
                  "border-white/10",
                  isFocused && "border-primary/50 shadow-[0_0_0_4px_rgba(139,92,246,0.15)]",
                  !isFocused && "hover:border-white/20"
                ),
            // Shadow
            !sendError && !isFocused && "shadow-xl shadow-black/20",
            isFocused && "shadow-2xl shadow-primary/20"
          )}
        >
          {/* Ambient glow effect */}
          <div className={cn(
            "absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500",
            "bg-gradient-to-r from-violet-500/20 via-purple-500/20 to-fuchsia-500/20 blur-xl",
            isFocused && "opacity-100"
          )} />

          {/* File Upload Button */}
          <button
            onClick={onToggleFileUpload}
            disabled={disabled}
            className={cn(
              "relative z-10 h-10 w-10 shrink-0 rounded-xl",
              "flex items-center justify-center",
              "transition-all duration-200",
              "disabled:opacity-40",
              showFileUpload
                ? "bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg"
                : cn(
                    "text-white/40 hover:text-white/70",
                    "hover:bg-white/5"
                  )
            )}
          >
            {showFileUpload ? (
              <Upload className="w-4 h-4" />
            ) : (
              <Paperclip className="w-4 h-4" />
            )}
          </button>

          {/* Textarea */}
          <textarea
            ref={activeTextareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isSending}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className={cn(
              "relative z-10 flex-1 bg-transparent outline-none resize-none",
              "text-white placeholder:text-white/30",
              "text-[15px] leading-relaxed",
              "min-h-[44px] max-h-[180px] py-2.5",
              "transition-all duration-200",
              disabled && "cursor-not-allowed opacity-50"
            )}
            style={{ height: 44 }}
          />

          {/* Send Button */}
          <button
            onClick={isSending ? onStop : onSend}
            disabled={disabled || (!hasContent && !isSending)}
            className={cn(
              "relative z-10 h-10 px-4 shrink-0 rounded-xl",
              "flex items-center justify-center gap-2",
              "font-semibold text-sm",
              "transition-all duration-200",
              "disabled:opacity-40 disabled:cursor-not-allowed",
              // Active/Sending state
              isSending
                ? cn(
                    "bg-gradient-to-r from-red-500 to-orange-500",
                    "text-white shadow-lg",
                    "hover:shadow-xl hover:scale-105"
                  )
                : cn(
                    // Has content
                    hasContent
                      ? cn(
                          "bg-gradient-to-r from-violet-500 to-purple-600",
                          "text-white shadow-lg",
                          "hover:shadow-xl hover:scale-105 hover:from-violet-600 hover:to-purple-700"
                        )
                      : cn(
                          // Empty state
                          "bg-white/5 text-white/40",
                          "hover:bg-white/10"
                        )
                  )
            )}
          >
            {isSending ? (
              <>
                <Square className="w-4 h-4" fill="currentColor" />
                <span className="hidden sm:inline">Stop</span>
              </>
            ) : (
              <>
                {hasContent ? (
                  <>
                    <Send className="w-4 h-4" />
                    <span className="hidden sm:inline">Send</span>
                  </>
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
              </>
            )}
          </button>
        </div>

        {/* Error Indicator */}
        {sendError && (
          <div className="absolute -top-12 left-0 flex items-center gap-2 text-red-400 text-sm animate-slideDown">
            <AlertCircle className="w-4 h-4" />
            <span>Failed to send. Please try again.</span>
          </div>
        )}

        {/* Character Counter */}
        {value.length > 800 && (
          <div className="absolute -bottom-8 right-0 text-xs text-white/30">
            {value.length.toLocaleString()}
          </div>
        )}
      </div>
    );
  }
);

AgentInput.displayName = 'AgentInput';

export default AgentInput;
