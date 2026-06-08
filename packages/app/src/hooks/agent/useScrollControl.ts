/**
 * useScrollControl Hook
 * Manages scroll functionality for message lists
 */

import { useState, useCallback, useEffect, useRef } from 'react';

export function useScrollControl() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Scroll to bottom
  const scrollToBottom = useCallback((smooth = true) => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
    }
  }, []);

  // Handle scroll events
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setShowScrollButton(scrollHeight - scrollTop - clientHeight > 80);
  }, []);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (!messagesEndRef.current) return;
    scrollToBottom(true);
  }, [messagesEndRef.current, scrollToBottom]);

  return {
    scrollRef,
    messagesEndRef,
    showScrollButton,
    scrollToBottom,
    handleScroll
  };
}
