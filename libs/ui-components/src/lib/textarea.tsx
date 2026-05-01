import * as React from 'react';
import { cn } from './utils';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-xs text-slate-300 placeholder:text-slate-600',
          'focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition',
          'disabled:cursor-not-allowed disabled:opacity-50 resize-none',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea };
