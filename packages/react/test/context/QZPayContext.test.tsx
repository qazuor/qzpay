/**
 * QZPay Context Tests
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCurrentCustomer, useQZPay, useQZPayContext, useQZPayLivemode } from '../../src/context/QZPayContext.js';
import { createMockBilling, createMockCustomer, createWrapper } from '../helpers/react-mocks.js';

describe('QZPayContext', () => {
    describe('QZPayProvider', () => {
        it('should provide billing instance to children', () => {
            const mockBilling = createMockBilling();

            const { result } = renderHook(() => useQZPay(), {
                wrapper: createWrapper(mockBilling)
            });

            expect(result.current).toBe(mockBilling);
        });

        it('should provide initial customer', () => {
            const mockBilling = createMockBilling();
            const mockCustomer = createMockCustomer();

            const { result } = renderHook(() => useCurrentCustomer(), {
                wrapper: createWrapper(mockBilling, mockCustomer)
            });

            expect(result.current[0]).toEqual(mockCustomer);
        });

        it('should provide null customer when not specified', () => {
            const mockBilling = createMockBilling();

            const { result } = renderHook(() => useCurrentCustomer(), {
                wrapper: createWrapper(mockBilling)
            });

            expect(result.current[0]).toBeNull();
        });
    });

    describe('useQZPayContext', () => {
        it('should throw when used outside provider', () => {
            expect(() => {
                renderHook(() => useQZPayContext());
            }).toThrow('useQZPayContext must be used within a QZPayProvider');
        });

        it('should return context value', () => {
            const mockBilling = createMockBilling();

            const { result } = renderHook(() => useQZPayContext(), {
                wrapper: createWrapper(mockBilling)
            });

            expect(result.current.billing).toBe(mockBilling);
            expect(result.current.isReady).toBe(true);
            expect(result.current.customer).toBeNull();
        });
    });

    describe('useQZPay', () => {
        it('should return billing instance', () => {
            const mockBilling = createMockBilling();

            const { result } = renderHook(() => useQZPay(), {
                wrapper: createWrapper(mockBilling)
            });

            expect(result.current).toBe(mockBilling);
            expect(result.current.customers).toBeDefined();
            expect(result.current.subscriptions).toBeDefined();
        });
    });

    describe('useQZPayLivemode', () => {
        it('should return false when not in livemode', () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.isLivemode).mockReturnValue(false);

            const { result } = renderHook(() => useQZPayLivemode(), {
                wrapper: createWrapper(mockBilling)
            });

            expect(result.current).toBe(false);
        });

        it('should return true when in livemode', () => {
            const mockBilling = createMockBilling();
            vi.mocked(mockBilling.isLivemode).mockReturnValue(true);

            const { result } = renderHook(() => useQZPayLivemode(), {
                wrapper: createWrapper(mockBilling)
            });

            expect(result.current).toBe(true);
        });
    });

    describe('useCurrentCustomer', () => {
        it('should return customer and setter', () => {
            const mockBilling = createMockBilling();
            const mockCustomer = createMockCustomer();

            const { result } = renderHook(() => useCurrentCustomer(), {
                wrapper: createWrapper(mockBilling, mockCustomer)
            });

            expect(result.current[0]).toEqual(mockCustomer);
            expect(typeof result.current[1]).toBe('function');
        });

        it('should update customer when setter called', () => {
            const mockBilling = createMockBilling();
            const mockCustomer = createMockCustomer();
            const newCustomer = createMockCustomer({ id: 'cus_new', name: 'New Customer' });

            const { result } = renderHook(() => useCurrentCustomer(), {
                wrapper: createWrapper(mockBilling, mockCustomer)
            });

            expect(result.current[0]?.id).toBe('cus_123');

            act(() => {
                result.current[1](newCustomer);
            });

            expect(result.current[0]?.id).toBe('cus_new');
            expect(result.current[0]?.name).toBe('New Customer');
        });

        it('should allow setting customer to null', () => {
            const mockBilling = createMockBilling();
            const mockCustomer = createMockCustomer();

            const { result } = renderHook(() => useCurrentCustomer(), {
                wrapper: createWrapper(mockBilling, mockCustomer)
            });

            act(() => {
                result.current[1](null);
            });

            expect(result.current[0]).toBeNull();
        });
    });
});
