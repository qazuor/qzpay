# React Patterns

## Overview

React is a JavaScript library for building user interfaces. This skill provides patterns for building React applications.

---

## Component Patterns

### Functional Component with Props

```typescript
/**
 * Item card component
 * Displays item summary with image, title, and price
 */
interface ItemCardProps {
  item: Item;
  onSelect?: (id: string) => void;
  priority?: boolean;
}

export function ItemCard({
  item,
  onSelect,
  priority = false,
}: ItemCardProps) {
  const handleClick = () => {
    onSelect?.(item.id);
  };

  return (
    <article
      onClick={handleClick}
      className="cursor-pointer hover:shadow-lg"
      aria-label={`Item: ${item.title}`}
    >
      <img
        src={item.image}
        alt={item.title}
        loading={priority ? 'eager' : 'lazy'}
      />
      <h3>{item.title}</h3>
      <p>${item.price}</p>
    </article>
  );
}
```

### Memoized Component

```typescript
import { memo } from 'react';

interface ExpensiveListProps {
  items: Item[];
  onItemSelect: (id: string) => void;
}

function ExpensiveListComponent({ items, onItemSelect }: ExpensiveListProps) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item.id} onClick={() => onItemSelect(item.id)}>
          {item.title}
        </li>
      ))}
    </ul>
  );
}

// Memoize to prevent re-renders when props haven't changed
export const ExpensiveList = memo(ExpensiveListComponent);
```

### Compound Components

```typescript
import { createContext, useContext, useState, type ReactNode } from 'react';

// Context
interface AccordionContextValue {
  openItems: Set<string>;
  toggle: (id: string) => void;
}

const AccordionContext = createContext<AccordionContextValue | undefined>(undefined);

function useAccordion() {
  const context = useContext(AccordionContext);
  if (!context) {
    throw new Error('Accordion components must be used within Accordion');
  }
  return context;
}

// Root
interface AccordionProps {
  children: ReactNode;
  defaultOpen?: string[];
}

function Accordion({ children, defaultOpen = [] }: AccordionProps) {
  const [openItems, setOpenItems] = useState(new Set(defaultOpen));

  const toggle = (id: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <AccordionContext.Provider value={{ openItems, toggle }}>
      <div className="accordion">{children}</div>
    </AccordionContext.Provider>
  );
}

// Item
interface AccordionItemProps {
  id: string;
  children: ReactNode;
}

Accordion.Item = function Item({ id, children }: AccordionItemProps) {
  const { openItems } = useAccordion();
  const isOpen = openItems.has(id);

  return (
    <div className="accordion-item" data-open={isOpen}>
      {children}
    </div>
  );
};

// Trigger
Accordion.Trigger = function Trigger({ id, children }: AccordionItemProps) {
  const { toggle } = useAccordion();

  return (
    <button onClick={() => toggle(id)} className="accordion-trigger">
      {children}
    </button>
  );
};

// Content
Accordion.Content = function Content({ id, children }: AccordionItemProps) {
  const { openItems } = useAccordion();

  if (!openItems.has(id)) return null;

  return <div className="accordion-content">{children}</div>;
};

export { Accordion };
```

---

## Custom Hooks

### Data Fetching Hook

```typescript
import { useState, useEffect } from 'react';

interface UseFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useFetch<T>(url: string): UseFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const json = await response.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [url]);

  return { data, loading, error, refetch: fetchData };
}
```

### Local Storage Hook

```typescript
import { useState, useEffect } from 'react';

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = (value: T | ((prev: T) => T)) => {
    const valueToStore = value instanceof Function ? value(storedValue) : value;
    setStoredValue(valueToStore);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    }
  };

  return [storedValue, setValue];
}
```

### Debounce Hook

```typescript
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Usage
function SearchInput() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (debouncedQuery) {
      // Perform search
    }
  }, [debouncedQuery]);

  return <input value={query} onChange={(e) => setQuery(e.target.value)} />;
}
```

---

## Performance Patterns

### useMemo and useCallback

```typescript
import { useMemo, useCallback, useState } from 'react';

function ItemList({ items }: { items: Item[] }) {
  const [filter, setFilter] = useState('');

  // Memoize expensive calculation
  const filteredItems = useMemo(() => {
    return items.filter((item) =>
      item.title.toLowerCase().includes(filter.toLowerCase())
    );
  }, [items, filter]);

  // Memoize callback to prevent child re-renders
  const handleSelect = useCallback((id: string) => {
    console.log('Selected:', id);
  }, []);

  return (
    <div>
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter items..."
      />
      {filteredItems.map((item) => (
        <ItemCard key={item.id} item={item} onSelect={handleSelect} />
      ))}
    </div>
  );
}
```

### Code Splitting

```typescript
import { lazy, Suspense } from 'react';

// Lazy load components
const HeavyChart = lazy(() => import('./HeavyChart'));
const AdminPanel = lazy(() => import('./AdminPanel'));

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/analytics" element={<HeavyChart />} />
        <Route path="/admin" element={<AdminPanel />} />
      </Routes>
    </Suspense>
  );
}
```

### Virtual Lists

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

function VirtualList({ items }: { items: Item[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
  });

  return (
    <div
      ref={parentRef}
      style={{ height: '400px', overflow: 'auto' }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {items[virtualItem.index].title}
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Error Handling

### Error Boundary

```typescript
import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="error-fallback">
          <h2>Something went wrong</h2>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

---

## Testing

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ItemCard } from './ItemCard';

const mockItem = {
  id: '1',
  title: 'Test Item',
  price: 100,
  image: '/test.jpg',
};

describe('ItemCard', () => {
  it('should render item data', () => {
    render(<ItemCard item={mockItem} />);

    expect(screen.getByText('Test Item')).toBeInTheDocument();
    expect(screen.getByText('$100')).toBeInTheDocument();
  });

  it('should call onSelect when clicked', () => {
    const onSelect = vi.fn();
    render(<ItemCard item={mockItem} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('article'));

    expect(onSelect).toHaveBeenCalledWith('1');
  });

  it('should have proper accessibility attributes', () => {
    render(<ItemCard item={mockItem} />);

    expect(screen.getByRole('article')).toHaveAttribute(
      'aria-label',
      'Item: Test Item'
    );
  });

  it('should use lazy loading by default', () => {
    render(<ItemCard item={mockItem} />);

    expect(screen.getByRole('img')).toHaveAttribute('loading', 'lazy');
  });

  it('should use eager loading when priority is true', () => {
    render(<ItemCard item={mockItem} priority />);

    expect(screen.getByRole('img')).toHaveAttribute('loading', 'eager');
  });
});
```

---

## Best Practices

### Good

- Use functional components with hooks
- Extract reusable logic into custom hooks
- Memoize expensive calculations and callbacks
- Use proper TypeScript types for all props
- Implement error boundaries
- Use lazy loading for large components

### Bad

- Inline function definitions in JSX (causes re-renders)
- Over-memoization (adds overhead when not needed)
- Prop drilling (use context or state management)
- Missing loading and error states
- Not cleaning up effects
