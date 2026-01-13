# Accessibility Guide

Complete guide to accessibility features in QZPay React components (WCAG 2.1 AA compliant).

## Overview

All QZPay React components are built with accessibility as a priority:

- **WCAG 2.1 AA Compliance**: Meets international accessibility standards
- **Screen Reader Support**: Full support for NVDA, JAWS, VoiceOver
- **Keyboard Navigation**: All interactions accessible via keyboard
- **ARIA Attributes**: Proper use of ARIA roles, labels, and states
- **Focus Management**: Logical focus order and visible focus indicators
- **Color Contrast**: Sufficient contrast ratios for text and UI elements

## Component Accessibility

### PricingTable

```tsx
import { PricingTable } from '@qazuor/qzpay-react';

function PricingPage() {
  return (
    <PricingTable
      plans={plans}
      onSelect={handlePlanSelect}
      // Automatically includes:
      // - role="region"
      // - aria-label="Pricing plans"
      // - Keyboard navigation between plans
      // - Focus indicators on plan cards
    />
  );
}
```

**Accessibility Features**:
- `role="region"` for landmark navigation
- `aria-label="Pricing plans"` for screen readers
- `aria-describedby` linking plan descriptions
- Keyboard navigation with Tab and Enter
- Focus visible indicators on interactive elements
- Sufficient color contrast (4.5:1 minimum)

### SubscriptionStatus

```tsx
import { SubscriptionStatus } from '@qazuor/qzpay-react';

function Dashboard() {
  return (
    <SubscriptionStatus
      subscription={subscription}
      // Automatically includes:
      // - aria-live="polite" for status changes
      // - Semantic status indicators
      // - Screen reader announcements
    />
  );
}
```

**Accessibility Features**:
- `aria-live="polite"` for dynamic status updates
- Status badge with semantic meaning
- Screen reader friendly status descriptions
- Color-independent status indicators (icons + text)

### PaymentForm

```tsx
import { PaymentForm } from '@qazuor/qzpay-react';

function CheckoutPage() {
  return (
    <PaymentForm
      onSubmit={handlePayment}
      // Automatically includes:
      // - Form field labels with htmlFor
      // - aria-invalid for validation errors
      // - aria-describedby for error messages
      // - Required field indicators
    />
  );
}
```

**Accessibility Features**:
- Proper `<label>` elements with `htmlFor` attributes
- `aria-invalid="true"` on invalid fields
- `aria-describedby` linking to error messages
- `aria-required="true"` on required fields
- Error messages with `role="alert"`
- Keyboard accessible submit button

### InvoiceList

```tsx
import { InvoiceList } from '@qazuor/qzpay-react';

function InvoicesPage() {
  return (
    <InvoiceList
      customerId={customerId}
      // Automatically includes:
      // - Semantic table structure
      // - Column headers with scope
      // - Row descriptions
      // - Sortable headers (if enabled)
    />
  );
}
```

**Accessibility Features**:
- Semantic `<table>` with proper structure
- `<th scope="col">` for column headers
- `<caption>` describing table content
- Sortable headers with `aria-sort`
- Keyboard accessible row actions

### CheckoutButton

```tsx
import { CheckoutButton } from '@qazuor/qzpay-react';

function ProductPage() {
  return (
    <CheckoutButton
      planId="plan_pro"
      onSuccess={handleSuccess}
      // Automatically includes:
      // - aria-label describing action
      // - Loading state announcement
      // - Disabled state handling
    />
  );
}
```

**Accessibility Features**:
- Descriptive `aria-label`
- `aria-busy="true"` during loading
- `disabled` state with visual indicator
- Focus visible on keyboard navigation

## ARIA Patterns

### Live Regions

Use live regions to announce dynamic content changes:

```tsx
import { SubscriptionStatus } from '@qazuor/qzpay-react';

function StatusWidget() {
  return (
    <div>
      {/* aria-live="polite" announces changes without interrupting */}
      <SubscriptionStatus
        subscription={subscription}
        aria-live="polite"
      />

      {/* For critical alerts, use assertive */}
      <div role="alert" aria-live="assertive">
        Payment failed. Please try again.
      </div>
    </div>
  );
}
```

**Live Region Politeness Levels**:
- `polite`: Announces when user is idle (status updates, success messages)
- `assertive`: Announces immediately (errors, critical alerts)
- `off`: No announcements (default)

### Form Validation

Proper error handling with ARIA:

```tsx
import { useState } from 'react';

function AccessibleForm() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');

  return (
    <div>
      <label htmlFor="email">
        Email Address
        <span aria-label="required">*</span>
      </label>

      <input
        id="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        aria-invalid={!!emailError}
        aria-describedby={emailError ? 'email-error' : undefined}
        aria-required="true"
      />

      {emailError && (
        <div
          id="email-error"
          role="alert"
          aria-live="assertive"
        >
          {emailError}
        </div>
      )}
    </div>
  );
}
```

### Dialog/Modal Accessibility

```tsx
import { useState } from 'react';

function AccessibleModal({ isOpen, onClose, children }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
      hidden={!isOpen}
    >
      <h2 id="modal-title">Payment Confirmation</h2>
      <div id="modal-description">
        {children}
      </div>

      <button
        onClick={onClose}
        aria-label="Close payment confirmation"
      >
        Close
      </button>
    </div>
  );
}
```

## Keyboard Navigation

### Standard Shortcuts

All QZPay components support standard keyboard navigation:

| Key | Action |
|-----|--------|
| Tab | Move to next focusable element |
| Shift + Tab | Move to previous focusable element |
| Enter/Space | Activate button or link |
| Escape | Close modal or cancel action |
| Arrow Keys | Navigate within component (lists, tabs) |

### Focus Management

```tsx
import { useRef, useEffect } from 'react';

function FocusManagement() {
  const firstFocusableRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Set focus when component mounts
    firstFocusableRef.current?.focus();
  }, []);

  return (
    <div>
      <button ref={firstFocusableRef}>
        First Focusable Element
      </button>

      {/* Focus visible styles */}
      <style>{`
        button:focus-visible {
          outline: 2px solid #0066cc;
          outline-offset: 2px;
        }
      `}</style>
    </div>
  );
}
```

### Focus Trapping in Modals

```tsx
import { useEffect, useRef } from 'react';

function FocusTrap({ children, isOpen }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const container = containerRef.current;
    if (!container) return;

    // Get all focusable elements
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    // Handle Tab key
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    container.addEventListener('keydown', handleTab);
    firstElement?.focus();

    return () => {
      container.removeEventListener('keydown', handleTab);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} role="dialog" aria-modal="true">
      {children}
    </div>
  );
}
```

## Screen Reader Support

### Descriptive Labels

```tsx
// ❌ Bad - No context
<button>Submit</button>

// ✅ Good - Clear purpose
<button aria-label="Submit payment for Premium Plan ($29.99/month)">
  Submit
</button>

// ✅ Good - Using aria-describedby
<button aria-describedby="payment-description">
  Submit Payment
</button>
<div id="payment-description" className="sr-only">
  You will be charged $29.99 per month for the Premium Plan
</div>
```

### Hidden Text for Screen Readers

```tsx
// CSS class for screen-reader-only text
const styles = {
  srOnly: {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: 0,
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: 0
  }
};

function AccessiblePricing() {
  return (
    <div>
      <h2>Premium Plan</h2>
      <div>
        <span style={styles.srOnly}>Price:</span>
        $29.99
        <span style={styles.srOnly}>per month</span>
      </div>
    </div>
  );
}
```

### Skip Links

```tsx
function AccessibleLayout() {
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <nav aria-label="Main navigation">
        {/* Navigation items */}
      </nav>

      <main id="main-content" tabIndex={-1}>
        {/* Main content */}
      </main>

      <style>{`
        .skip-link {
          position: absolute;
          top: -40px;
          left: 0;
          background: #000;
          color: #fff;
          padding: 8px;
          z-index: 100;
        }

        .skip-link:focus {
          top: 0;
        }
      `}</style>
    </>
  );
}
```

## Color and Contrast

### Minimum Contrast Ratios

WCAG 2.1 AA requirements:
- **Normal text**: 4.5:1 contrast ratio
- **Large text** (18pt+ or 14pt+ bold): 3:1 contrast ratio
- **UI components**: 3:1 contrast ratio

```tsx
// ✅ Good contrast
const theme = {
  colors: {
    text: '#1a1a1a',        // On white: 16:1 contrast
    background: '#ffffff',
    primary: '#0066cc',     // On white: 4.54:1 contrast
    error: '#d32f2f',       // On white: 4.53:1 contrast
    success: '#388e3c',     // On white: 4.51:1 contrast
  }
};

// ❌ Bad contrast
const badTheme = {
  colors: {
    text: '#999999',        // On white: 2.85:1 contrast (too low)
    primary: '#ffcc00',     // On white: 1.98:1 contrast (too low)
  }
};
```

### Color-Independent Information

```tsx
// ❌ Bad - Only color indicates status
<div style={{ color: 'red' }}>Error</div>

// ✅ Good - Icon + color + text
<div style={{ color: '#d32f2f' }}>
  <span role="img" aria-label="Error">❌</span>
  <span>Error: Payment failed</span>
</div>

// ✅ Good - Semantic status with multiple indicators
<div className="status-error" role="status">
  <svg aria-hidden="true">
    <use xlinkHref="#icon-error" />
  </svg>
  <span>Payment Failed</span>
</div>
```

## Testing Accessibility

### Automated Testing

```typescript
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

describe('PricingTable Accessibility', () => {
  it('should not have accessibility violations', async () => {
    const { container } = render(
      <PricingTable plans={mockPlans} onSelect={jest.fn()} />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper ARIA labels', () => {
    const { getByRole } = render(
      <PricingTable plans={mockPlans} onSelect={jest.fn()} />
    );

    const region = getByRole('region', { name: 'Pricing plans' });
    expect(region).toBeInTheDocument();
  });
});
```

### Manual Testing Checklist

- [ ] Navigate entire component using only keyboard
- [ ] Test with screen reader (NVDA, JAWS, or VoiceOver)
- [ ] Verify focus indicators are visible
- [ ] Check color contrast with tools (WAVE, axe DevTools)
- [ ] Test with browser zoom at 200%
- [ ] Verify text can be resized without loss of functionality
- [ ] Test in high contrast mode
- [ ] Verify all interactive elements have accessible names
- [ ] Check that form validation errors are announced
- [ ] Test with keyboard navigation only (no mouse)

### Screen Reader Testing Commands

**NVDA (Windows)**:
- Start/Stop: Ctrl + Alt + N
- Read next item: Down Arrow
- Read previous item: Up Arrow
- Read line: Insert + Up Arrow
- Navigate by heading: H
- Navigate by button: B
- Navigate by form field: F

**VoiceOver (macOS)**:
- Start/Stop: Cmd + F5
- Navigate: VO + Arrow Keys (VO = Ctrl + Option)
- Read next item: VO + Right Arrow
- Navigate by heading: VO + Cmd + H
- Interact with element: VO + Space

**JAWS (Windows)**:
- Start: Insert + J
- Read next item: Down Arrow
- Navigate by heading: H
- Navigate by button: B
- List all elements: Insert + F7

## Best Practices

### 1. Use Semantic HTML

```tsx
// ✅ Good - Semantic elements
<main>
  <article>
    <h1>Pricing Plans</h1>
    <section>
      <h2>Premium Plan</h2>
      <p>$29.99/month</p>
    </section>
  </article>
</main>

// ❌ Bad - Non-semantic divs
<div>
  <div>
    <div>Pricing Plans</div>
    <div>
      <div>Premium Plan</div>
      <div>$29.99/month</div>
    </div>
  </div>
</div>
```

### 2. Provide Alternative Text

```tsx
// ✅ Good - Descriptive alt text
<img src="plan-icon.png" alt="Premium plan features icon" />

// ✅ Good - Decorative image
<img src="decoration.png" alt="" role="presentation" />

// ❌ Bad - No alt text
<img src="plan-icon.png" />
```

### 3. Use ARIA Appropriately

```tsx
// ✅ Good - ARIA enhances semantic HTML
<button
  aria-label="Close payment modal"
  aria-expanded={isOpen}
>
  <span aria-hidden="true">×</span>
</button>

// ❌ Bad - ARIA replacing semantic HTML
<div role="button" tabIndex={0} onClick={handleClick}>
  Submit
</div>
// Use <button> instead
```

### 4. Maintain Focus Order

```tsx
// ✅ Good - Logical tab order
<form>
  <input tabIndex={0} /> {/* Default tab order */}
  <input tabIndex={0} />
  <button tabIndex={0}>Submit</button>
</form>

// ❌ Bad - Broken tab order
<form>
  <input tabIndex={3} />
  <input tabIndex={1} />
  <button tabIndex={2}>Submit</button>
</form>
```

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [WAVE Browser Extension](https://wave.webaim.org/extension/)

## Related Documentation

- [React Components](../../packages/react/README.md) - React component documentation
- [Error Handling Guide](./error-handling.md) - Accessible error messaging
- [Testing Guide](./testing.md) - Accessibility testing
