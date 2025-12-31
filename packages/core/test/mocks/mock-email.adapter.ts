/**
 * Mock email adapter for testing
 */
import { vi } from 'vitest';
import type { QZPayEmailAdapter, QZPayEmailParams, QZPayEmailResult } from '../../src/adapters/email.adapter.js';

/**
 * Sent email record for testing assertions
 */
export interface QZPaySentEmail extends QZPayEmailParams {
    sentAt: Date;
}

/**
 * Configuration for mock email behavior
 */
export interface QZPayMockEmailConfig {
    /**
     * Whether email sending should succeed
     */
    shouldSucceed?: boolean;

    /**
     * Delay in ms before resolving
     */
    delay?: number;

    /**
     * Custom error message when failing
     */
    errorMessage?: string;
}

/**
 * Create a mock email adapter for testing
 */
export function createMockEmailAdapter(config?: QZPayMockEmailConfig): QZPayEmailAdapter & {
    sentEmails: QZPaySentEmail[];
    reset: () => void;
} {
    const shouldSucceed = config?.shouldSucceed ?? true;
    const delay = config?.delay ?? 0;
    const errorMessage = config?.errorMessage ?? 'Email sending failed';

    const sentEmails: QZPaySentEmail[] = [];
    let messageIdCounter = 0;

    const maybeDelay = async (): Promise<void> => {
        if (delay > 0) {
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    };

    return {
        sentEmails,

        reset: () => {
            sentEmails.length = 0;
            messageIdCounter = 0;
        },

        send: vi.fn(async (params) => {
            await maybeDelay();

            if (!shouldSucceed) {
                const result: QZPayEmailResult = {
                    success: false,
                    error: errorMessage
                };
                return result;
            }

            sentEmails.push({
                ...params,
                sentAt: new Date()
            });

            const result: QZPayEmailResult = {
                success: true,
                messageId: `msg_test_${++messageIdCounter}`
            };

            return result;
        }),

        sendTemplate: vi.fn(async (params) => {
            await maybeDelay();

            if (!shouldSucceed) {
                const result: QZPayEmailResult = {
                    success: false,
                    error: errorMessage
                };
                return result;
            }

            sentEmails.push({
                to: params.to,
                subject: `Template: ${params.templateId}`,
                html: `<p>Template ${params.templateId} with variables: ${JSON.stringify(params.variables)}</p>`,
                from: params.from,
                sentAt: new Date()
            });

            const result: QZPayEmailResult = {
                success: true,
                messageId: `msg_template_${++messageIdCounter}`
            };

            return result;
        })
    };
}

/**
 * Create a mock email adapter that always fails
 */
export function createFailingEmailAdapter(errorMessage = 'Email sending failed'): ReturnType<typeof createMockEmailAdapter> {
    return createMockEmailAdapter({
        shouldSucceed: false,
        errorMessage
    });
}

/**
 * Assert that an email was sent to a specific address
 */
export function assertEmailSentTo(
    sentEmails: QZPaySentEmail[],
    toAddress: string,
    options?: {
        subject?: string;
        count?: number;
    }
): void {
    const matching = sentEmails.filter((email) => {
        const recipients = Array.isArray(email.to) ? email.to : [email.to];
        if (!recipients.includes(toAddress)) return false;
        if (options?.subject && !email.subject.includes(options.subject)) return false;
        return true;
    });

    if (matching.length === 0) {
        throw new Error(`No email sent to ${toAddress}${options?.subject ? ` with subject containing "${options.subject}"` : ''}`);
    }

    if (options?.count !== undefined && matching.length !== options.count) {
        throw new Error(`Expected ${options.count} emails to ${toAddress}, but found ${matching.length}`);
    }
}

/**
 * Assert that no emails were sent
 */
export function assertNoEmailsSent(sentEmails: QZPaySentEmail[]): void {
    if (sentEmails.length > 0) {
        throw new Error(`Expected no emails to be sent, but ${sentEmails.length} were sent`);
    }
}
