/**
 * MercadoPago CardToken Adapter Tests
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QZPayMercadoPagoCardTokenAdapterImpl } from '../src/adapters/card-token.adapter.js';

// Mock CardToken API
function createMockCardTokenApi() {
    return {
        create: vi.fn()
    };
}

// Mock MercadoPago CardToken response
function createMockCardToken(overrides: Record<string, unknown> = {}) {
    return {
        id: 'card_token_123456',
        card_id: 'card_123',
        first_six_digits: '411111',
        last_four_digits: '1111',
        expiration_month: 12,
        expiration_year: 2025,
        cardholder: {
            name: 'JOHN DOE'
        },
        security_code_length: 3,
        date_created: new Date().toISOString(),
        date_last_updated: new Date().toISOString(),
        date_due: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        live_mode: false,
        ...overrides
    };
}

// Mock the mercadopago module
vi.mock('mercadopago', () => ({
    CardToken: vi.fn().mockImplementation(() => createMockCardTokenApi()),
    MercadoPagoConfig: vi.fn()
}));

describe('QZPayMercadoPagoCardTokenAdapter', () => {
    let adapter: QZPayMercadoPagoCardTokenAdapterImpl;
    let mockCardTokenApi: ReturnType<typeof createMockCardTokenApi>;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockCardTokenApi = createMockCardTokenApi();
        const { CardToken } = await import('mercadopago');
        vi.mocked(CardToken).mockImplementation(() => mockCardTokenApi as never);

        adapter = new QZPayMercadoPagoCardTokenAdapterImpl({} as never);
    });

    describe('create', () => {
        it('should create a card token from card_id', async () => {
            mockCardTokenApi.create.mockResolvedValue(createMockCardToken());

            const result = await adapter.create('card_123');

            expect(result).toBe('card_token_123456');
            expect(mockCardTokenApi.create).toHaveBeenCalledWith({
                body: {
                    card_id: 'card_123'
                }
            });
        });

        it('should create a card token with security code', async () => {
            mockCardTokenApi.create.mockResolvedValue(createMockCardToken());

            const result = await adapter.create('card_123', '123');

            expect(result).toBe('card_token_123456');
            expect(mockCardTokenApi.create).toHaveBeenCalledWith({
                body: {
                    card_id: 'card_123',
                    security_code: '123'
                }
            });
        });

        it('should throw error when token creation fails', async () => {
            mockCardTokenApi.create.mockResolvedValue({});

            await expect(adapter.create('card_123')).rejects.toThrow('Failed to create card token from card ID');
        });

        it('should handle API errors', async () => {
            mockCardTokenApi.create.mockRejectedValue(new Error('Invalid card_id'));

            await expect(adapter.create('invalid_card')).rejects.toThrow();
        });

        it('should create token without security code', async () => {
            mockCardTokenApi.create.mockResolvedValue(
                createMockCardToken({
                    id: 'token_no_cvv'
                })
            );

            const result = await adapter.create('card_456');

            expect(result).toBe('token_no_cvv');
            expect(mockCardTokenApi.create).toHaveBeenCalledWith({
                body: {
                    card_id: 'card_456'
                }
            });
        });
    });
});
