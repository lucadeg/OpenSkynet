import { cn } from '@/lib/utils';

interface SuggestionChipProps {
  label: string;
  onClick?: () => void;
  className?: string;
}

export function SuggestionChip({ label, onClick, className }: SuggestionChipProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-full',
        'bg-muted/50 border border-border/50',
        'text-xs text-muted-foreground',
        'hover:bg-muted hover:text-foreground hover:border-border',
        'transition-all duration-200',
        'hover:scale-[1.02] active:scale-100',
        className
      )}
    >
      {label}
    </button>
  );
}
