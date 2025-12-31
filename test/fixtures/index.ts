/**
 * Test Fixtures for QZPay
 *
 * Provides factory functions for creating test data.
 * Uses @faker-js/faker for generating realistic test data.
 */

import { faker } from '@faker-js/faker';

// Type placeholders until actual types are implemented
type QZPayCustomer = {
  id: string;
  externalId: string;
  email: string;
  name: string | null;
  phone: string | null;
  providerCustomerIds: Record<string, string>;
  metadata: Record<string, unknown>;
  livemode: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type QZPaySubscription = {
  id: string;
  customerId: string;
  planId: string;
  status: string;
  interval: string;
  quantity: number;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialStart: Date | null;
  trialEnd: Date | null;
  cancelAt: Date | null;
  canceledAt: Date | null;
  cancelAtPeriodEnd: boolean;
  providerSubscriptionIds: Record<string, string>;
  metadata: Record<string, unknown>;
  livemode: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type QZPayPayment = {
  id: string;
  customerId: string;
  subscriptionId: string | null;
  invoiceId: string | null;
  amount: number;
  currency: string;
  status: string;
  providerPaymentIds: Record<string, string>;
  metadata: Record<string, unknown>;
  livemode: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Factory for creating test customers
 */
export function createTestCustomer(
  overrides?: Partial<QZPayCustomer>
): QZPayCustomer {
  const now = new Date();
  return {
    id: faker.string.uuid(),
    externalId: `user_${faker.string.alphanumeric(16)}`,
    email: faker.internet.email(),
    name: faker.person.fullName(),
    phone: faker.phone.number(),
    providerCustomerIds: {},
    metadata: {},
    livemode: false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

/**
 * Factory for creating test subscriptions
 */
export function createTestSubscription(
  overrides?: Partial<QZPaySubscription>
): QZPaySubscription {
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  return {
    id: faker.string.uuid(),
    customerId: faker.string.uuid(),
    planId: faker.helpers.arrayElement([
      'plan_starter_monthly',
      'plan_pro_monthly',
      'plan_enterprise_monthly',
    ]),
    status: 'active',
    interval: 'month',
    quantity: 1,
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    trialStart: null,
    trialEnd: null,
    cancelAt: null,
    canceledAt: null,
    cancelAtPeriodEnd: false,
    providerSubscriptionIds: {},
    metadata: {},
    livemode: false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

/**
 * Factory for creating test subscriptions in trial
 */
export function createTestTrialSubscription(
  overrides?: Partial<QZPaySubscription>
): QZPaySubscription {
  const now = new Date();
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + 14);

  return createTestSubscription({
    status: 'trialing',
    trialStart: now,
    trialEnd: trialEnd,
    currentPeriodStart: now,
    currentPeriodEnd: trialEnd,
    ...overrides,
  });
}

/**
 * Factory for creating test payments
 */
export function createTestPayment(
  overrides?: Partial<QZPayPayment>
): QZPayPayment {
  const now = new Date();
  return {
    id: faker.string.uuid(),
    customerId: faker.string.uuid(),
    subscriptionId: null,
    invoiceId: null,
    amount: faker.number.int({ min: 100, max: 100000 }),
    currency: 'USD',
    status: 'succeeded',
    providerPaymentIds: {},
    metadata: {},
    livemode: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Factory for creating webhook event payloads
 */
export function createTestWebhookEvent(
  type: string,
  data?: Record<string, unknown>
): {
  id: string;
  type: string;
  created: number;
  livemode: boolean;
  data: { object: Record<string, unknown> };
} {
  return {
    id: `evt_${faker.string.alphanumeric(24)}`,
    type,
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    data: {
      object: data ?? {},
    },
  };
}

/**
 * Factory for creating idempotency keys
 */
export function createIdempotencyKey(prefix = 'test'): string {
  return `${prefix}_${faker.string.alphanumeric(24)}_${Date.now()}`;
}

/**
 * Helper to create a date N days from now
 */
export function daysFromNow(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

/**
 * Helper to create a date N days ago
 */
export function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

/**
 * Helper to set time to midnight UTC
 */
export function toMidnightUTC(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
