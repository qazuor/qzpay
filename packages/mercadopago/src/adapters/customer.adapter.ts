import type {
    QZPayPaymentCustomerAdapter,
    QZPayProviderCreateCustomerInput,
    QZPayProviderCustomer,
    QZPaySavedCard
} from '@qazuor/qzpay-core';
/**
 * MercadoPago Customer Adapter
 */
import { Customer, type MercadoPagoConfig } from 'mercadopago';
import { isCustomerExistsError, wrapAdapterMethod } from '../utils/error-mapper.js';

export class QZPayMercadoPagoCustomerAdapter implements QZPayPaymentCustomerAdapter {
    private readonly customerApi: Customer;

    constructor(client: MercadoPagoConfig) {
        this.customerApi = new Customer(client);
    }

    async create(input: QZPayProviderCreateCustomerInput): Promise<string> {
        return wrapAdapterMethod('Create customer', async () => {
            const body: Parameters<Customer['create']>[0]['body'] = {
                email: input.email
            };

            // Add name fields only if present
            if (input.name) {
                const [firstName, ...lastNameParts] = input.name.split(' ');
                if (firstName) {
                    body.first_name = firstName;
                }
                const lastName = lastNameParts.join(' ');
                if (lastName) {
                    body.last_name = lastName;
                }
            }

            try {
                const response = await this.customerApi.create({ body });

                if (!response.id) {
                    throw new Error('Failed to create MercadoPago customer');
                }

                return response.id;
            } catch (error) {
                // Check if customer already exists (error code 101)
                if (isCustomerExistsError(error)) {
                    const existingCustomer = await this.findByEmail(input.email);
                    if (existingCustomer) {
                        return existingCustomer;
                    }
                }
                throw error;
            }
        });
    }

    async findByEmail(email: string): Promise<string | null> {
        return wrapAdapterMethod('Find customer by email', async () => {
            const response = await this.customerApi.search({ options: { email } });
            const results = response.results;

            if (results && results.length > 0) {
                const firstResult = results[0];
                if (firstResult?.id) {
                    return firstResult.id;
                }
            }

            return null;
        });
    }

    async update(providerCustomerId: string, input: Partial<QZPayProviderCreateCustomerInput>): Promise<void> {
        return wrapAdapterMethod('Update customer', async () => {
            const body: Parameters<Customer['update']>[0]['body'] = {};

            if (input.email !== undefined) {
                body.email = input.email;
            }

            if (input.name !== undefined && input.name !== null) {
                const [firstName, ...lastNameParts] = input.name.split(' ');
                if (firstName) {
                    body.first_name = firstName;
                }
                const lastName = lastNameParts.join(' ');
                if (lastName) {
                    body.last_name = lastName;
                }
            }

            await this.customerApi.update({
                customerId: providerCustomerId,
                body
            });
        });
    }

    async delete(providerCustomerId: string): Promise<void> {
        return wrapAdapterMethod('Delete customer', async () => {
            await this.customerApi.remove({ customerId: providerCustomerId });
        });
    }

    async retrieve(providerCustomerId: string): Promise<QZPayProviderCustomer> {
        return wrapAdapterMethod('Retrieve customer', async () => {
            const customer = await this.customerApi.get({ customerId: providerCustomerId });

            const firstName = customer.first_name ?? '';
            const lastName = customer.last_name ?? '';
            const fullName = [firstName, lastName].filter(Boolean).join(' ') || null;

            return {
                id: customer.id ?? providerCustomerId,
                email: customer.email ?? '',
                name: fullName,
                metadata: {}
            };
        });
    }

    /**
     * Save a card to the customer using a token
     * This is the key step for Card on File flow - saves the card for future payments
     */
    async saveCard(providerCustomerId: string, token: string): Promise<QZPaySavedCard> {
        return wrapAdapterMethod('Save card', async () => {
            const response = await this.customerApi.createCard({
                customerId: providerCustomerId,
                body: { token }
            });

            if (!response.id) {
                throw new Error('Failed to save card to MercadoPago customer');
            }

            const savedCard: QZPaySavedCard = {
                id: response.id,
                provider: 'mercadopago',
                lastFourDigits: response.last_four_digits ?? '****',
                expirationMonth: response.expiration_month ?? 0,
                expirationYear: response.expiration_year ?? 0,
                createdAt: response.date_created ? new Date(response.date_created) : new Date()
            };

            // Add optional fields only if defined
            if (response.first_six_digits) savedCard.firstSixDigits = response.first_six_digits;
            if (response.cardholder?.name) savedCard.cardholderName = response.cardholder.name;
            if (response.payment_method?.id) savedCard.paymentMethodId = response.payment_method.id;
            if (response.payment_method?.name) savedCard.paymentMethodName = response.payment_method.name;
            const thumbnail = response.payment_method?.secure_thumbnail ?? response.payment_method?.thumbnail;
            if (thumbnail) savedCard.paymentMethodThumbnail = thumbnail;

            return savedCard;
        });
    }

    /**
     * List all saved cards for a customer
     */
    async listCards(providerCustomerId: string): Promise<QZPaySavedCard[]> {
        return wrapAdapterMethod('List saved cards', async () => {
            const cards = await this.customerApi.listCards({ customerId: providerCustomerId });

            return cards.map((card) => {
                const savedCard: QZPaySavedCard = {
                    id: card.id ?? '',
                    provider: 'mercadopago',
                    lastFourDigits: card.last_four_digits ?? '****',
                    expirationMonth: card.expiration_month ?? 0,
                    expirationYear: card.expiration_year ?? 0,
                    createdAt: card.date_created ? new Date(card.date_created) : new Date()
                };

                // Add optional fields only if defined
                if (card.first_six_digits) savedCard.firstSixDigits = card.first_six_digits;
                if (card.cardholder?.name) savedCard.cardholderName = card.cardholder.name;
                if (card.payment_method?.id) savedCard.paymentMethodId = card.payment_method.id;
                if (card.payment_method?.name) savedCard.paymentMethodName = card.payment_method.name;
                const thumbnail = card.payment_method?.secure_thumbnail ?? card.payment_method?.thumbnail;
                if (thumbnail) savedCard.paymentMethodThumbnail = thumbnail;

                return savedCard;
            });
        });
    }

    /**
     * Remove a saved card from a customer
     */
    async removeCard(providerCustomerId: string, cardId: string): Promise<void> {
        return wrapAdapterMethod('Remove saved card', async () => {
            await this.customerApi.removeCard({
                customerId: providerCustomerId,
                cardId
            });
        });
    }
}
