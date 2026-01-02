import type { QZPayCreateCustomerInput, QZPayPaymentCustomerAdapter, QZPayProviderCustomer } from '@qazuor/qzpay-core';
/**
 * MercadoPago Customer Adapter
 */
import { Customer, type MercadoPagoConfig } from 'mercadopago';

export class QZPayMercadoPagoCustomerAdapter implements QZPayPaymentCustomerAdapter {
    private readonly customerApi: Customer;

    constructor(client: MercadoPagoConfig) {
        this.customerApi = new Customer(client);
    }

    async create(input: QZPayCreateCustomerInput): Promise<string> {
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

        const response = await this.customerApi.create({ body });

        if (!response.id) {
            throw new Error('Failed to create MercadoPago customer');
        }

        return response.id;
    }

    async update(providerCustomerId: string, input: Partial<QZPayCreateCustomerInput>): Promise<void> {
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
    }

    async delete(providerCustomerId: string): Promise<void> {
        await this.customerApi.remove({ customerId: providerCustomerId });
    }

    async retrieve(providerCustomerId: string): Promise<QZPayProviderCustomer> {
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
    }
}
