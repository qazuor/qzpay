# Security Guidelines

## Safe HTML Rendering

### Problem

Previously, the playground used `dangerouslySetInnerHTML` to render i18n translations containing HTML formatting. This posed a security risk as it could allow XSS attacks if user input or untrusted content was ever included in translations.

### Solution

We created a safe alternative: `SafeFormattedText` component that only allows `<strong>` tags for text emphasis, which is the only HTML formatting used in our i18n files.

### Usage

**Before (UNSAFE):**
```tsx
<p dangerouslySetInnerHTML={{ __html: t('some.key') }} />
```

**After (SAFE):**
```tsx
import { SafeFormattedText } from '../../hooks/useSafeTranslation';

<p>
  <SafeFormattedText text={t('some.key')} />
</p>
```

### How It Works

1. **Whitelist Approach**: Only `<strong>` tags are parsed and converted to React elements
2. **All Other HTML**: Rendered as plain text (not executed)
3. **XSS Protection**: Script tags, event handlers, and other dangerous HTML are neutralized

### Example

```tsx
// i18n JSON file
{
  "message": "Go to <strong>Settings</strong> to configure"
}

// Component
function MyComponent() {
  const { t } = useTranslation();

  return (
    <p>
      <SafeFormattedText text={t('message')} />
    </p>
  );
}

// Renders as:
// <p>Go to <strong>Settings</strong> to configure</p>
```

### Security Features

- **No Script Execution**: `<script>` tags are rendered as text
- **No Event Handlers**: `onclick`, `onerror`, etc. are ignored
- **Limited Tag Support**: Only `<strong>` is converted to HTML
- **XSS Prevention**: Malicious HTML is automatically escaped

### Testing

See `useSafeTranslation.test.tsx` for comprehensive security tests.

### Best Practices

1. **Never use `dangerouslySetInnerHTML`** in the playground
2. **Use `SafeFormattedText`** for formatted i18n content
3. **Keep i18n files simple** - only use `<strong>` for emphasis
4. **If you need more formatting**, use React components instead of HTML

### Alternative: React Components

For more complex formatting needs, consider using React components:

```tsx
// Instead of HTML in i18n:
// "message": "Click <a href='/link'>here</a>"

// Use component composition:
function MyComponent() {
  return (
    <p>
      Click <Link to="/link">here</Link>
    </p>
  );
}
```

## Content Security Policy

The playground should eventually implement a Content Security Policy (CSP) to further protect against XSS attacks:

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'">
```

This is a future enhancement that would provide defense-in-depth alongside the safe rendering approach.
