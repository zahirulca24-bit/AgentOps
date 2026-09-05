import React, { useState, useId } from 'react';
import { cn } from '@/lib/utils';

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export function Tooltip({
  content,
  children,
  position = 'top',
  className,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipId = useId();

  const handleMouseEnter = () => setIsVisible(true);
  const handleMouseLeave = () => setIsVisible(false);
  const handleFocus = () => setIsVisible(true);
  const handleBlur = () => setIsVisible(false);

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {React.cloneElement(children, {
        onFocus: handleFocus,
        onBlur: handleBlur,
        'aria-describedby': isVisible ? tooltipId : undefined,
      } as any)}

      {isVisible && (
        <div
          id={tooltipId}
          role="tooltip"
          className={cn(
            'absolute z-50 px-2 py-1 text-xs font-mono tracking-tight text-foreground bg-surface-elevated border border-border rounded-md shadow-md whitespace-nowrap pointer-events-none transition-opacity duration-150',
            position === 'top' && 'bottom-full mb-1.5 left-1/2 -translate-x-1/2',
            position === 'bottom' && 'top-full mt-1.5 left-1/2 -translate-x-1/2',
            position === 'right' && 'left-full ml-2 top-1/2 -translate-y-1/2',
            position === 'left' && 'right-full mr-2 top-1/2 -translate-y-1/2',
            className
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
}
