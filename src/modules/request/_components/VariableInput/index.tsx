import { inputBaseClasses } from '@/shared/components/ui/Input';
import { cn } from '@/shared/utils/cn';
import {
    forwardRef,
    useEffect,
    useId,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type ChangeEvent,
    type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { useVariablesStore } from '../../_store/variables';
import { findActiveVariableToken, findVariableTokens } from '../../_utils/variable-tokens';

interface VariableInputProps extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    'type' | 'value'
> {
    value: string;
    onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

interface DropdownPosition {
    top: number;
    left: number;
    width: number;
}

export const VariableInput = forwardRef<HTMLInputElement, VariableInputProps>(
    function VariableInput(
        { value, onChange, className, onKeyDown, onBlur, ...props },
        forwardedRef
    ) {
        const listboxId = useId();
        const inputRef = useRef<HTMLInputElement>(null);
        const backdropRef = useRef<HTMLDivElement>(null);
        const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
        const variables = useVariablesStore((s) => s.variables);

        const [activeToken, setActiveToken] = useState<{ start: number; query: string } | null>(
            null
        );
        const [activeIndex, setActiveIndex] = useState(0);
        const [position, setPosition] = useState<DropdownPosition | null>(null);

        const matches = useMemo(() => {
            if (!activeToken) return [];
            const query = activeToken.query.trim().toLowerCase();
            const candidates = variables.filter((v) => v.enabled && v.key);
            const filtered = candidates.filter((v) => v.key.toLowerCase().includes(query));
            filtered.sort((a, b) => {
                const aStarts = a.key.toLowerCase().startsWith(query);
                const bStarts = b.key.toLowerCase().startsWith(query);
                if (aStarts !== bStarts) return aStarts ? -1 : 1;
                return a.key.localeCompare(b.key);
            });
            return filtered.slice(0, 50);
        }, [activeToken, variables]);

        const open = activeToken !== null && matches.length > 0;

        useEffect(() => {
            setActiveIndex(0);
        }, [activeToken?.start, activeToken?.query]);

        useEffect(() => {
            itemRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
        }, [activeIndex]);

        useLayoutEffect(() => {
            if (backdropRef.current && inputRef.current) {
                backdropRef.current.scrollLeft = inputRef.current.scrollLeft;
            }
        });

        useLayoutEffect(() => {
            if (!open) return;

            const updatePosition = () => {
                const rect = inputRef.current?.getBoundingClientRect();
                if (!rect) return;
                setPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
            };

            updatePosition();
            window.addEventListener('scroll', updatePosition, true);
            window.addEventListener('resize', updatePosition);
            return () => {
                window.removeEventListener('scroll', updatePosition, true);
                window.removeEventListener('resize', updatePosition);
            };
        }, [open]);

        const setRefs = (el: HTMLInputElement | null) => {
            inputRef.current = el;
            if (typeof forwardedRef === 'function') forwardedRef(el);
            else if (forwardedRef) forwardedRef.current = el;
        };

        const syncActiveToken = (el: HTMLInputElement) => {
            const caret = el.selectionStart ?? el.value.length;
            setActiveToken(findActiveVariableToken(el.value, caret));
        };

        const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
            onChange(e);
            syncActiveToken(e.target);
        };

        const closeDropdown = () => setActiveToken(null);

        const selectMatch = (key: string) => {
            const input = inputRef.current;
            if (!input || !activeToken) return;

            const before = value.slice(0, activeToken.start);
            const after = value.slice(activeToken.start + 2 + activeToken.query.length);
            const inserted = `{{${key}}}`;
            const nextValue = before + inserted + after;
            const nextCaret = before.length + inserted.length;

            const setter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype,
                'value'
            )?.set;
            setter?.call(input, nextValue);
            input.dispatchEvent(new Event('input', { bubbles: true }));

            closeDropdown();
            requestAnimationFrame(() => input.setSelectionRange(nextCaret, nextCaret));
        };

        const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
            if (open) {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setActiveIndex((i) => (i + 1) % matches.length);
                    return;
                }
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setActiveIndex((i) => (i - 1 + matches.length) % matches.length);
                    return;
                }
                if (e.key === 'Enter' || e.key === 'Tab') {
                    e.preventDefault();
                    selectMatch(matches[activeIndex].key);
                    return;
                }
                if (e.key === 'Escape') {
                    e.preventDefault();
                    closeDropdown();
                    return;
                }
            }

            onKeyDown?.(e);

            requestAnimationFrame(() => {
                if (inputRef.current) syncActiveToken(inputRef.current);
            });
        };

        return (
            <div className={cn(inputBaseClasses, className, 'relative')}>
                <div
                    ref={backdropRef}
                    aria-hidden
                    className={cn(
                        inputBaseClasses,
                        className,
                        'pointer-events-none absolute inset-0 overflow-hidden whitespace-pre border-transparent bg-transparent shadow-none'
                    )}
                >
                    {renderHighlighted(value)}
                </div>
                <input
                    {...props}
                    ref={setRefs}
                    type="text"
                    value={value}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    onClick={(e) => syncActiveToken(e.currentTarget)}
                    onFocus={(e) => syncActiveToken(e.currentTarget)}
                    onBlur={(e) => {
                        closeDropdown();
                        onBlur?.(e);
                    }}
                    className={cn(
                        inputBaseClasses,
                        className,
                        'absolute inset-0 border-transparent bg-transparent text-transparent shadow-none caret-[var(--color-text)]'
                    )}
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={open}
                    aria-controls={open ? listboxId : undefined}
                />
                {open &&
                    position &&
                    createPortal(
                        <div
                            id={listboxId}
                            role="listbox"
                            style={{
                                position: 'fixed',
                                top: position.top,
                                left: position.left,
                                minWidth: Math.max(position.width, 224),
                            }}
                            className="z-50 max-h-56 overflow-y-auto rounded-md border border-(--color-border) bg-popover py-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
                        >
                            {matches.map((v, i) => (
                                <button
                                    key={v.id}
                                    ref={(el) => {
                                        itemRefs.current[i] = el;
                                    }}
                                    type="button"
                                    role="option"
                                    aria-selected={i === activeIndex}
                                    onMouseDown={(e) => e.preventDefault()}
                                    onMouseEnter={() => setActiveIndex(i)}
                                    onClick={() => selectMatch(v.key)}
                                    className={cn(
                                        'flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-xs transition-colors',
                                        i === activeIndex
                                            ? 'bg-accent text-accent-foreground'
                                            : 'hover:bg-accent hover:text-accent-foreground'
                                    )}
                                >
                                    <span className="font-mono font-medium text-(--color-success)">
                                        {v.key}
                                    </span>
                                    <span className="ml-3 truncate text-(--color-text-subtle)">
                                        {v.value || '(empty)'}
                                    </span>
                                </button>
                            ))}
                        </div>,
                        document.body
                    )}
            </div>
        );
    }
);

function renderHighlighted(value: string) {
    const tokens = findVariableTokens(value);
    if (tokens.length === 0) return value;

    const parts: React.ReactNode[] = [];
    let cursor = 0;
    tokens.forEach((token, i) => {
        if (token.start > cursor) parts.push(value.slice(cursor, token.start));
        parts.push(
            <span key={i} className="font-semibold text-(--color-success)">
                {token.text}
            </span>
        );
        cursor = token.end;
    });
    if (cursor < value.length) parts.push(value.slice(cursor));

    return parts;
}
