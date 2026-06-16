import { useEffect, useRef } from 'react';
import { useFocusable } from '@noriginmedia/norigin-spatial-navigation';

// Keep the focused field visible inside a scrolling dialog body; instant
// (`auto`) keeps quick arrow navigation responsive (scroll-padding adds the
// margin), and `nearest` scrolls just enough rather than recentering.
const SCROLL_OPTIONS: ScrollIntoViewOptions = {
  behavior: 'auto',
  block: 'nearest',
};

export type FocusableFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  focusKey?: string;
  type?: 'text' | 'password';
  placeholder?: string;
};

/**
 * A focusable text field. The wrapper is what the engine navigates to with the
 * arrow keys; when it gains focus we focus the real <input> so typed characters
 * land here. Arrow/Enter keys are handled by the engine (not the input), so the
 * field never traps navigation — only letters reach the input.
 */
export function FocusableField({
  label,
  value,
  onChange,
  focusKey,
  type = 'text',
  placeholder,
}: FocusableFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { ref, focused } = useFocusable({
    focusKey,
    onFocus: ({ node }) => node?.scrollIntoView(SCROLL_OPTIONS),
  });

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    if (focused) el.focus();
    else el.blur();
  }, [focused]);

  return (
    <div
      ref={ref}
      className={[
        'flex flex-col gap-1 rounded-xl px-4 py-3 transition-all duration-150',
        focused ? 'bg-white' : 'bg-neutral-800',
      ].join(' ')}
    >
      <span
        className={[
          'text-xs font-medium tracking-wide uppercase',
          focused ? 'text-neutral-500' : 'text-neutral-400',
        ].join(' ')}
      >
        {label}
      </span>
      <input
        ref={inputRef}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        tabIndex={-1}
        className={[
          'bg-transparent text-lg outline-none',
          focused
            ? 'text-black placeholder:text-neutral-400'
            : 'text-neutral-200 placeholder:text-neutral-500',
        ].join(' ')}
      />
    </div>
  );
}
