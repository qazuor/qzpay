/**
 * HintIcon Component
 * Displays a help icon with hover/click tooltip for contextual help
 */
import { HelpCircle } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';

interface HintIconProps {
    /** Tooltip content - can be string or JSX for formatted content */
    content: ReactNode;
    /** Optional title shown in bold at top of tooltip */
    title?: string;
    /** Position of tooltip relative to icon */
    position?: 'top' | 'bottom' | 'left' | 'right';
    /** Icon size in pixels */
    size?: number;
    /** Additional class names */
    className?: string;
}

export function HintIcon({ content, title, position = 'top', size = 16, className = '' }: HintIconProps) {
    const [isOpen, setIsOpen] = useState(false);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close tooltip when clicking outside
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    // Position classes
    const positionClasses = {
        top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
        bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
        left: 'right-full top-1/2 -translate-y-1/2 mr-2',
        right: 'left-full top-1/2 -translate-y-1/2 ml-2'
    };

    // Arrow classes
    const arrowClasses = {
        top: 'top-full left-1/2 -translate-x-1/2 border-t-[var(--color-card)] border-x-transparent border-b-transparent',
        bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-[var(--color-card)] border-x-transparent border-t-transparent',
        left: 'left-full top-1/2 -translate-y-1/2 border-l-[var(--color-card)] border-y-transparent border-r-transparent',
        right: 'right-full top-1/2 -translate-y-1/2 border-r-[var(--color-card)] border-y-transparent border-l-transparent'
    };

    return (
        <div ref={containerRef} className={`relative inline-flex items-center ${className}`}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                onMouseEnter={() => setIsOpen(true)}
                onMouseLeave={() => setIsOpen(false)}
                className="transition-colors opacity-60 hover:opacity-100 focus:opacity-100 focus:outline-none"
                style={{ color: 'var(--color-text-muted)' }}
                aria-label="Help"
                aria-expanded={isOpen}
            >
                <HelpCircle style={{ width: size, height: size }} />
            </button>

            {isOpen && (
                <div
                    ref={tooltipRef}
                    role="tooltip"
                    className={`
            absolute z-[100] w-72 p-3 rounded-lg shadow-xl
            border animate-in fade-in-0 zoom-in-95 duration-200
            ${positionClasses[position]}
          `}
                    style={{
                        backgroundColor: 'var(--color-card)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text)'
                    }}
                >
                    {/* Arrow */}
                    <div className={`absolute w-0 h-0 border-[6px] ${arrowClasses[position]}`} />

                    {/* Content */}
                    {title && (
                        <h4 className="font-semibold text-sm mb-2" style={{ color: 'var(--color-text)' }}>
                            {title}
                        </h4>
                    )}
                    <div className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'var(--color-text-secondary)' }}>
                        {content}
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * Inline hint text with icon
 */
interface HintTextProps {
    children: ReactNode;
    hint: ReactNode;
    title?: string;
}

export function HintText({ children, hint, title }: HintTextProps) {
    return (
        <span className="inline-flex items-center gap-1.5">
            {children}
            <HintIcon content={hint} title={title} size={14} />
        </span>
    );
}
