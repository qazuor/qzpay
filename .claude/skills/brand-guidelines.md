---
name: brand-guidelines
category: design
description: Apply brand guidelines consistently across UI components
usage: When creating or reviewing UI components for brand consistency
input: Component or page to validate
output: Brand-compliant implementation or validation report
---

# Brand Guidelines Skill

## ⚙️ Configuration Required

Before using this skill, configure your brand in the project:

| Setting | Description | Example |
|---------|-------------|---------|
| `brand_name` | Your product/brand name | "MyApp" |
| `primary_color` | Main brand color | `#3b82f6` (blue) |
| `secondary_color` | Accent color | `#f97316` (orange) |
| `font_family` | Primary font | "Inter", "Roboto" |
| `tone_of_voice` | Communication style | "friendly", "professional" |

**Configuration location:** Create `.claude/config/brand.json` or add to project's design system.

---

## Purpose

Apply brand guidelines consistently across all UI components, ensuring visual coherence in colors, typography, tone of voice, and design system elements.

---

## Capabilities

- Apply color palette consistently
- Enforce typography standards
- Maintain tone of voice in copy
- Validate brand compliance
- Create brand-compliant components
- Ensure responsive design standards

---

## Brand Identity Template

### Brand Essence
```markdown
**{{BRAND_NAME}}** is a {{PRODUCT_TYPE}} for {{TARGET_AUDIENCE}}.

**Brand Personality:**
- {{TRAIT_1}}: Description
- {{TRAIT_2}}: Description
- {{TRAIT_3}}: Description

**Brand Promise:**
"{{BRAND_PROMISE}}"
```

---

## Color System

### Palette Structure
```css
/* Primary - Main brand color */
--primary-50:  /* Lightest */
--primary-500: /* Main */
--primary-900: /* Darkest */

/* Secondary - Accent color */
--secondary-50:
--secondary-500:
--secondary-900:

/* Neutral - Text and backgrounds */
--gray-50 to --gray-900

/* Semantic - Feedback colors */
--success-500: /* Green - confirmations */
--warning-500: /* Yellow - alerts */
--error-500:   /* Red - errors */
--info-500:    /* Blue - information */
```

### Color Usage
| Element | Color | Example Class |
|---------|-------|---------------|
| Primary CTA | Primary-500 | `bg-primary-500 text-white` |
| Secondary CTA | Secondary-500 | `bg-secondary-500 text-white` |
| Headings | Gray-900 | `text-gray-900` |
| Body text | Gray-600 | `text-gray-600` |
| Borders | Gray-200 | `border-gray-200` |
| Light backgrounds | Gray-50 | `bg-gray-50` |

---

## Typography

### Type Scale
| Element | Size | Weight | Class |
|---------|------|--------|-------|
| Display | 4xl-6xl | Bold | `text-4xl md:text-6xl font-bold` |
| H1 | 3xl-4xl | Bold | `text-3xl md:text-4xl font-bold` |
| H2 | 2xl-3xl | Semibold | `text-2xl md:text-3xl font-semibold` |
| H3 | xl-2xl | Semibold | `text-xl md:text-2xl font-semibold` |
| Body | base | Normal | `text-base` |
| Small | sm | Normal | `text-sm` |
| Caption | xs | Normal | `text-xs text-gray-500` |

### Font Weights
- `font-normal` (400): Body text
- `font-medium` (500): Emphasis, labels
- `font-semibold` (600): Subheadings
- `font-bold` (700): Headings, CTAs

---

## Spacing System

### Base Unit: 4px (Tailwind)
| Token | Size | Usage |
|-------|------|-------|
| `p-1` | 4px | Tight spacing |
| `p-2` | 8px | Small elements |
| `p-4` | 16px | Button padding |
| `p-6` | 24px | Card padding |
| `p-8` | 32px | Section padding |
| `p-12` | 48px | Large sections |

### Component Standards
- **Card padding**: `p-6`
- **Button padding**: `px-4 py-2`
- **Section spacing**: `py-12 md:py-16`
- **Element gaps**: `space-y-4` or `gap-4`
- **Container**: `container mx-auto px-4 md:px-6`

---

## Tone of Voice

### Guidelines
- **{{TONE_STYLE}}**: Adapt to configured tone
- **Clear and concise**: Avoid jargon
- **Helpful**: Guide users, don't lecture
- **Authentic**: Be genuine, not salesy

### Copy Patterns
```markdown
**Headers:**
✓ Action-oriented, benefit-focused
✗ Technical or feature-focused

**CTAs:**
✓ Clear, specific action ("Save changes", "Create account")
✗ Vague ("Submit", "Click here")

**Errors:**
✓ Helpful, solution-oriented ("Email not found. Try another or create account")
✗ Technical ("Error 404: Resource not found")

**Confirmations:**
✓ Positive, reassuring ("Changes saved!")
✗ Cold ("Operation completed")
```

---

## Responsive Breakpoints

| Breakpoint | Size | Usage |
|------------|------|-------|
| `sm` | 640px | Landscape phones |
| `md` | 768px | Tablets |
| `lg` | 1024px | Desktop |
| `xl` | 1280px | Large desktop |
| `2xl` | 1536px | Extra large |

**Approach**: Mobile-first (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`)

---

## Accessibility Requirements

### Color Contrast (WCAG AA)
- Normal text: 4.5:1 minimum
- Large text (≥18px): 3:1 minimum

### Touch Targets
- Minimum size: 44x44px
- `min-h-[44px] min-w-[44px]`

### Focus States
- Always visible: `focus:ring-2 focus:ring-primary-500 focus:ring-offset-2`

---

## Brand Checklist

When creating UI components, verify:

### Visual
- [ ] Colors from approved palette
- [ ] Typography follows scale
- [ ] Spacing uses standard increments
- [ ] Responsive on all breakpoints

### Interactive
- [ ] Hover states defined
- [ ] Focus states visible
- [ ] Touch targets ≥44px
- [ ] Loading states implemented

### Content
- [ ] Tone matches brand voice
- [ ] Copy is clear and helpful
- [ ] Error messages are friendly
- [ ] CTAs are action-oriented

### Accessibility
- [ ] Color contrast meets WCAG AA
- [ ] Images have alt text
- [ ] Keyboard navigable
- [ ] Screen reader compatible

---

## Deliverables

When applying this skill, produce:

1. **Brand-compliant components** using correct colors, typography, spacing
2. **Validation report** if reviewing existing components
3. **Recommendations** for brand inconsistencies found
