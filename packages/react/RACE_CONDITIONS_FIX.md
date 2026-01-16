# Race Conditions Fix

## Overview

Fixed race conditions in React hooks that could cause:
1. Double-submit of payment requests
2. Stale data overwriting fresh data when parameters change quickly
3. Memory leaks and state updates after component unmount

## Changes Made

### 1. usePayment.ts

**Problem**: If user clicks payment button twice quickly, both requests execute in parallel.

**Solution**:
- Added `requestIdRef` to track fetch requests and ignore stale responses
- Added `isProcessingRef` flag to prevent double-submit on `process()` method
- Only update state if request ID matches (prevents stale data)

```typescript
// Before: No protection against double-submit
const process = async (input) => {
    setIsLoading(true);
    const payment = await billing.payments.process(input);
    setData([payment, ...data]);
    return payment;
};

// After: Protected with isProcessingRef flag
const isProcessingRef = useRef(false);
const process = async (input) => {
    if (isProcessingRef.current) {
        throw new Error('Payment is already being processed');
    }
    isProcessingRef.current = true;
    try {
        const payment = await billing.payments.process(input);
        setData([payment, ...data]);
        return payment;
    } finally {
        isProcessingRef.current = false;
    }
};
```

### 2. usePlans.ts

**Problem**: If `activeOnly` prop changes while request is in-flight, stale response can overwrite fresh data.

**Solution**:
- Added `requestIdRef` to track which request is most recent
- Only update state if `currentRequestId === requestIdRef.current`

```typescript
// Before: No request tracking
const fetchPlans = async () => {
    const plans = await billing.plans.getActive();
    setData(plans); // Always updates, even if stale
};

// After: With request ID tracking
const requestIdRef = useRef(0);
const fetchPlans = async () => {
    const currentRequestId = ++requestIdRef.current;
    const plans = await billing.plans.getActive();

    // Only update if this is still the most recent request
    if (currentRequestId === requestIdRef.current) {
        setData(plans);
    }
};
```

### 3. useLimits.ts

**Problem**: Similar to usePlans, rapid `customerId` changes could cause race conditions.

**Solution**:
- Applied same `requestIdRef` pattern
- Only update state for most recent request

### 4. useCustomer.ts

**Problem**: If `customerId` changes while fetching previous customer.

**Solution**:
- Applied `requestIdRef` pattern

### 5. useEntitlements.ts

**Problem**: Race condition when `customerId` changes rapidly.

**Solution**:
- Applied `requestIdRef` pattern

### 6. useInvoices.ts

**Problem**: Race condition when `customerId` changes.

**Solution**:
- Applied `requestIdRef` pattern

### 7. useSubscription.ts

**Problem**: Race condition when `customerId` or `subscriptionId` changes.

**Solution**:
- Applied `requestIdRef` pattern
- Handles both single subscription and list scenarios

### 8. LimitGate.tsx

**Problem**: Missing cleanup in useEffect. If `effectiveCustomerId` or `limitKey` changes while `checkLimit()` is pending, old response can overwrite new state.

**Solution**:
- Added cleanup function with `cancelled` flag
- Check `!cancelled` before all state updates

```typescript
// Before: No cleanup
useEffect(() => {
    const check = async () => {
        const result = await checkLimit(limitKey);
        setWithinLimit(result.allowed); // Always updates
    };
    void check();
}, [effectiveCustomerId, limitKey]);

// After: With cleanup
useEffect(() => {
    let cancelled = false;

    const check = async () => {
        const result = await checkLimit(limitKey);
        if (!cancelled) { // Only update if not cancelled
            setWithinLimit(result.allowed);
        }
    };

    void check();

    return () => {
        cancelled = true; // Cleanup function
    };
}, [effectiveCustomerId, limitKey]);
```

## Testing Recommendations

To test these fixes:

1. **Double-submit protection**:
   ```tsx
   // Rapidly click payment button
   <button onClick={handlePayment}>Pay</button>
   ```
   Expected: Second click throws error or is ignored

2. **Race condition in data fetching**:
   ```tsx
   // Toggle activeOnly rapidly
   <button onClick={() => setActiveOnly(!activeOnly)}>Toggle</button>
   ```
   Expected: Only final request's data is shown

3. **Component unmount**:
   ```tsx
   // Mount/unmount component rapidly
   {show && <LimitGate limitKey="api_calls">...</LimitGate>}
   ```
   Expected: No "Can't perform state update on unmounted component" warnings

## Performance Impact

Minimal performance impact:
- `requestIdRef` uses simple counter (no overhead)
- `isProcessingRef` is single boolean flag
- Cleanup functions are standard React pattern

## Backward Compatibility

All changes are internal implementation details. Public API remains unchanged.

## Related Patterns

These fixes follow React best practices:
- [React Docs: Cleanup Functions](https://react.dev/learn/synchronizing-with-effects#cleanup)
- [Request ID Pattern](https://beta.reactjs.org/learn/you-might-not-need-an-effect#fetching-data)
- [Preventing Double Submit](https://kentcdodds.com/blog/stop-using-isloading-booleans)
