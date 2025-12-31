---
name: zustand-patterns
category: state
description: Zustand lightweight state management patterns for React applications
usage: Use when implementing simple global client state without Redux boilerplate
input: State structure, actions, persistence needs
output: Store definitions, hooks, middleware configuration
  state_organization: "How state is organized (single store vs slices)"
  persistence: "What state needs to be persisted"
  storage_type: "Storage mechanism for persistence"
  devtools: "Whether to enable Redux DevTools integration"
---

# Zustand Patterns

## ⚙️ Configuration

| Setting | Description | Example |
|---------|-------------|---------|
| `state_organization` | State organization strategy | Single store, multiple stores, slices |
| `persistence` | State to persist | User preferences, auth tokens, cart |
| `storage_type` | Storage mechanism | localStorage, sessionStorage, AsyncStorage |
| `devtools` | Redux DevTools integration | `true`, `false` |

## Purpose

Implement lightweight state management with:
- Minimal boilerplate
- TypeScript-first design
- Works outside React components
- Middleware support (persist, immer, devtools)
- No providers needed

## Basic Store

```typescript
import { create } from 'zustand';

interface CounterState {
  count: number;
  increment: () => void;
  decrement: () => void;
  reset: () => void;
}

export const useCounterStore = create<CounterState>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
  reset: () => set({ count: 0 }),
}));
```

## Async Actions

```typescript
interface UserState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  fetchUser: (id: string) => Promise<void>;
  updateUser: (data: Partial<User>) => Promise<void>;
  clearUser: () => void;
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  isLoading: false,
  error: null,

  fetchUser: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/users/${id}`);
      if (!response.ok) throw new Error('Failed to fetch');
      const user = await response.json();
      set({ user, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  updateUser: async (data: Partial<User>) => {
    const currentUser = get().user;
    if (!currentUser) return;

    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/users/${currentUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      const updatedUser = await response.json();
      set({ user: updatedUser, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  clearUser: () => set({ user: null, error: null }),
}));
```

## Slices Pattern

```typescript
import { create, StateCreator } from 'zustand';

// Auth slice
interface AuthSlice {
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const createAuthSlice: StateCreator<AppStore, [], [], AuthSlice> = (set) => ({
  token: null,
  isAuthenticated: false,
  login: (token) => set({ token, isAuthenticated: true }),
  logout: () => set({ token: null, isAuthenticated: false }),
});

// User slice
interface UserSlice {
  user: User | null;
  setUser: (user: User | null) => void;
}

const createUserSlice: StateCreator<AppStore, [], [], UserSlice> = (set) => ({
  user: null,
  setUser: (user) => set({ user }),
});

// Combined store
type AppStore = AuthSlice & UserSlice;

export const useAppStore = create<AppStore>()((...args) => ({
  ...createAuthSlice(...args),
  ...createUserSlice(...args),
}));
```

## Middleware

### Persist

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface SettingsState {
  theme: 'light' | 'dark';
  language: string;
  notifications: boolean;
  setTheme: (theme: 'light' | 'dark') => void;
  setLanguage: (lang: string) => void;
  toggleNotifications: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'light',
      language: 'en',
      notifications: true,
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      toggleNotifications: () => set((state) => ({ notifications: !state.notifications })),
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        theme: state.theme,
        language: state.language,
        notifications: state.notifications,
      }),
    }
  )
);
```

### Immer

```typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface TodoState {
  todos: Todo[];
  addTodo: (text: string) => void;
  toggleTodo: (id: string) => void;
  removeTodo: (id: string) => void;
}

export const useTodoStore = create<TodoState>()(
  immer((set) => ({
    todos: [],
    addTodo: (text) =>
      set((state) => {
        state.todos.push({
          id: crypto.randomUUID(),
          text,
          completed: false,
        });
      }),
    toggleTodo: (id) =>
      set((state) => {
        const todo = state.todos.find((t) => t.id === id);
        if (todo) todo.completed = !todo.completed;
      }),
    removeTodo: (id) =>
      set((state) => {
        state.todos = state.todos.filter((t) => t.id !== id);
      }),
  }))
);
```

## Usage Patterns

### Selecting State

```typescript
// Select single value (re-renders only when count changes)
const count = useCounterStore((state) => state.count);

// Select action (stable reference)
const increment = useCounterStore((state) => state.increment);

// Select multiple with shallow comparison
import { useShallow } from 'zustand/react/shallow';

const { user, isLoading } = useUserStore(
  useShallow((state) => ({ user: state.user, isLoading: state.isLoading }))
);
```

### Outside React

```typescript
// Get current state
const currentCount = useCounterStore.getState().count;

// Call actions
useCounterStore.getState().increment();

// Subscribe to changes
const unsubscribe = useCounterStore.subscribe((state) => {
  console.log('Count changed:', state.count);
});
```

### Computed Values

```typescript
interface CartState {
  items: CartItem[];
}

export const useCartStore = create<CartState>(() => ({
  items: [],
}));

// Use selectors for computed values
export const useCartTotal = () =>
  useCartStore((state) =>
    state.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  );

export const useCartItemCount = () =>
  useCartStore((state) =>
    state.items.reduce((sum, item) => sum + item.quantity, 0)
  );
```

## Best Practices

| Practice | Description |
|----------|-------------|
| **Use Selectors** | Always use selectors to minimize re-renders |
| **Actions in Store** | Keep actions in the store, not components |
| **TypeScript** | Use TypeScript interfaces for full type safety |
| **Slices for Large Stores** | Split large stores into slices |
| **Persist User Preferences** | Use persist middleware for settings |
| **Immer for Nested Updates** | Use immer for complex nested state |

## When to Use

- Small to medium React applications
- When Redux is overkill
- Need state outside React components
- Simple global state needs
- With TanStack Query for server state

## Related Skills

- `redux-toolkit-patterns` - For complex state needs
- `tanstack-query-patterns` - For server state
