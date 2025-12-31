---
name: component-library-specialist
category: tech
description: Implement and customize component library systems with consistent theming and accessibility
usage: When adding UI components, customizing themes, or ensuring design system consistency
input: Component requirements, theme configuration, accessibility standards
output: Component implementations with proper theming and WCAG compliance
---

# Component Library Specialist

## ⚙️ Configuration

| Setting | Description | Example |
|---------|-------------|---------|
| `library_name` | Component library | `shadcn-ui`, `chakra-ui`, `material-ui` |
| `component_path` | Components directory | `src/components/ui` |
| `theme_file` | Theme config location | `src/styles/theme.css` |
| `base_color` | Primary theme color | `slate`, `blue`, `neutral` |
| `css_variables` | Use CSS variables | `true` (recommended) |
| `wcag_level` | Accessibility level | `AA` (minimum), `AAA` (enhanced) |

## Purpose

Expert guidance on implementing component library systems with consistent theming, proper accessibility (WCAG 2.1), and design system best practices.

## Capabilities

- Component installation and configuration
- Theme customization with CSS variables
- Variant creation for custom designs
- Accessibility compliance (WCAG AA/AAA)
- Form integration with validation
- Responsive design implementation

## Installation

### Setup Component Library

```bash
# Install specific component
npx library-cli add button input form

# Configure registry
{
  "style": "default",
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/styles/globals.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

## Theme Customization

### CSS Variables

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --destructive: 0 84.2% 60.2%;
    --border: 214.3 31.8% 91.4%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --primary: 217.2 91.2% 59.8%;
  }
}
```

## Component Patterns

### Form with Validation

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Form, FormField, Input } from '@/components/ui';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export function LoginForm() {
  const form = useForm({
    resolver: zodResolver(schema),
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField name="email" render={...} />
        <FormField name="password" render={...} />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  );
}
```

### Dialog/Modal

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui';

export function ConfirmDialog({ onConfirm }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Delete</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Action</DialogTitle>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button variant="destructive" onClick={onConfirm}>
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### Custom Variants

```tsx
import { cva } from 'class-variance-authority';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        destructive: 'bg-destructive text-destructive-foreground',
        // Custom variants
        success: 'bg-green-600 text-white',
        warning: 'bg-yellow-600 text-white',
      },
      size: {
        default: 'h-10 px-4',
        sm: 'h-9 px-3',
        lg: 'h-11 px-8',
      },
    },
  }
);
```

## Accessibility

### ARIA Labels

```tsx
<Button aria-label="Close dialog">
  <X className="h-4 w-4" />
</Button>
```

### Keyboard Navigation

- Tab for focus movement
- Enter/Space for activation
- Escape for closing modals
- Arrow keys for lists/menus

### Focus Management

```tsx
const closeButtonRef = useRef<HTMLButtonElement>(null);

useEffect(() => {
  if (open) {
    closeButtonRef.current?.focus();
  }
}, [open]);
```

### Color Contrast

- Normal text: ≥ 4.5:1 contrast ratio
- Large text: ≥ 3:1 contrast ratio
- Test in both light and dark modes

## Testing

```tsx
import { render, screen } from '@testing-library/react';

describe('Button', () => {
  it('renders and handles clicks', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);

    screen.getByText('Click').click();
    expect(handleClick).toHaveBeenCalled();
  });

  it('applies variant classes', () => {
    const { container } = render(<Button variant="destructive">Delete</Button>);
    expect(container.firstChild).toHaveClass('bg-destructive');
  });
});
```

## Best Practices

| Practice | Description |
|----------|-------------|
| **Theme Tokens** | Always use CSS variables, never hardcode colors |
| **Composition** | Combine primitives for complex components |
| **Accessibility** | ARIA labels, keyboard nav, focus management |
| **TypeScript** | Leverage component prop types |
| **Variants** | Use CVA for consistent variant patterns |
| **Testing** | ≥ 90% coverage for all components |
| **Responsive** | Test mobile, tablet, desktop |
| **Dark Mode** | Test both light and dark themes |

## Checklist

- [ ] Components installed correctly
- [ ] Theme matches brand guidelines
- [ ] WCAG compliance level met
- [ ] Keyboard accessible
- [ ] Focus management correct
- [ ] Color contrast compliant
- [ ] Tests passing (≥ 90% coverage)
- [ ] Responsive on all devices
