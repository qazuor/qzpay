---
name: i18n-patterns
category: i18n
description: Internationalization patterns for React and Next.js applications
usage: Use when implementing multi-language support, locale routing, and content translation
input: Supported locales, default locale, translation keys
output: i18n configuration, translation files, locale-aware components
  i18n_library: "i18n library being used"
  supported_locales: "List of supported locale codes"
  default_locale: "Default/fallback locale"
  locale_routing: "Locale routing strategy"
  rtl_locales: "Right-to-left language locales"
---

# i18n Patterns

## ⚙️ Configuration

| Setting | Description | Example |
|---------|-------------|---------|
| `i18n_library` | Internationalization library | next-intl, react-i18next, i18next |
| `supported_locales` | Supported locale codes | `['en', 'es', 'fr', 'de']` |
| `default_locale` | Default/fallback locale | `'en'` |
| `locale_routing` | URL locale prefix strategy | `'as-needed'`, `'always'`, `'never'` |
| `rtl_locales` | Right-to-left locales | `['ar', 'he', 'fa']` |

## Purpose

Implement internationalization with:
- Locale detection and routing
- Type-safe translation keys
- Pluralization and formatting
- Date, number, and currency formatting
- RTL language support

## Core Setup

### Configuration (Next.js)

```typescript
// i18n.ts
import { getRequestConfig } from 'next-intl/server';

export const locales = ['en', 'es', 'fr'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export default getRequestConfig(async ({ locale }) => {
  if (!locales.includes(locale as Locale)) notFound();

  return {
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
```

### Middleware

```typescript
// middleware.ts
import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n';

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'as-needed', // or 'always' | 'never'
});

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
```

## Translation Files

### Structure

```json
// messages/en.json
{
  "common": {
    "welcome": "Welcome, {name}!",
    "items": "{count, plural, =0 {No items} =1 {One item} other {# items}}"
  },
  "navigation": {
    "home": "Home",
    "about": "About"
  },
  "forms": {
    "validation": {
      "required": "This field is required",
      "email": "Invalid email address"
    }
  }
}
```

### Type Safety

```typescript
// types/i18n.d.ts
import en from '../messages/en.json';

type Messages = typeof en;

declare global {
  interface IntlMessages extends Messages {}
}
```

## Component Usage

### Server Components

```typescript
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';

export default function HomePage() {
  const t = useTranslations('common');
  return <h1>{t('welcome', { name: 'John' })}</h1>;
}

// Metadata
export async function generateMetadata({ params: { locale } }) {
  const t = await getTranslations({ locale, namespace: 'metadata' });
  return {
    title: t('title'),
    description: t('description'),
  };
}
```

### Client Components

```typescript
'use client';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const switchLocale = (newLocale: string) => {
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPath);
  };

  return (
    <select value={locale} onChange={(e) => switchLocale(e.target.value)}>
      <option value="en">English</option>
      <option value="es">Español</option>
      <option value="fr">Français</option>
    </select>
  );
}
```

## Formatting

### Dates and Numbers

```typescript
import { useFormatter } from 'next-intl';

function FormattedContent({ date, amount, currency }: Props) {
  const format = useFormatter();

  return (
    <div>
      {/* Date */}
      <p>{format.dateTime(date, { dateStyle: 'full' })}</p>

      {/* Relative time */}
      <p>{format.relativeTime(date)}</p>

      {/* Currency */}
      <p>{format.number(amount, { style: 'currency', currency })}</p>

      {/* Percentage */}
      <p>{format.number(0.15, { style: 'percent' })}</p>

      {/* List */}
      <p>{format.list(['Alice', 'Bob', 'Charlie'], { type: 'conjunction' })}</p>
    </div>
  );
}
```

## RTL Support

```typescript
const rtlLocales = ['ar', 'he', 'fa'];

export function RTLProvider({ children }: { children: React.ReactNode }) {
  const locale = useLocale();
  const isRTL = rtlLocales.includes(locale);

  return <div dir={isRTL ? 'rtl' : 'ltr'}>{children}</div>;
}
```

## Translation Key Organization

| Category | Purpose | Example Keys |
|----------|---------|--------------|
| `common` | Shared translations | `welcome`, `items`, `loading` |
| `navigation` | Nav items | `home`, `about`, `contact` |
| `forms` | Form labels/validation | `validation.required`, `validation.email` |
| `actions` | Button/action labels | `save`, `cancel`, `delete`, `confirm` |
| `pages` | Page-specific content | `home.title`, `about.description` |
| `errors` | Error messages | `notFound`, `serverError` |

## Best Practices

| Practice | Description |
|----------|-------------|
| **Namespace Keys** | Use hierarchical namespacing for organization |
| **Fallback Locale** | Always provide default/fallback language |
| **Type Safety** | Use TypeScript for translation key validation |
| **Lazy Loading** | Load translations on demand for performance |
| **RTL Support** | Support right-to-left languages if needed |
| **Built-in Formatters** | Use library formatters for dates, numbers, currency |
| **Context for Translators** | Add comments in translation files for context |
| **Pluralization** | Use ICU message format for pluralization |

## Pluralization Examples

```json
{
  "items": "{count, plural, =0 {No items} =1 {One item} other {# items}}",
  "minutes": "{value, plural, =0 {just now} =1 {1 minute ago} other {# minutes ago}}"
}
```

## When to Use

- Multi-language applications
- Global user bases
- E-commerce with multiple markets
- Content-heavy applications
- Applications requiring RTL support

## Related Skills

- `brand-guidelines` - Maintain brand voice across locales
- `web-app-testing` - Test i18n implementations
