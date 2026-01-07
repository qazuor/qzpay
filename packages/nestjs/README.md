# @qazuor/qzpay-nestjs

NestJS integration for the QZPay billing library.

## Installation

```bash
pnpm add @qazuor/qzpay-nestjs @nestjs/common @nestjs/core
```

## Features

- **Module Configuration**: Easy setup with NestJS modules
- **Service Injection**: Injectable billing service
- **Decorators**: Custom decorators for billing operations
- **Guards**: Protection guards for billing routes
- **TypeScript**: Full type safety

## Usage

### Module Setup

```typescript
import { Module } from '@nestjs/common';
import { QZPayModule } from '@qazuor/qzpay-nestjs';

@Module({
  imports: [
    QZPayModule.forRoot({
      storage: storageAdapter,
      provider: providerAdapter,
      livemode: true
    })
  ]
})
export class AppModule {}
```

### Async Configuration

```typescript
import { Module } from '@nestjs/common';
import { QZPayModule } from '@qazuor/qzpay-nestjs';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    QZPayModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        storage: createStorageAdapter(config),
        provider: createProviderAdapter(config),
        livemode: config.get('NODE_ENV') === 'production'
      })
    })
  ]
})
export class AppModule {}
```

### Service Injection

```typescript
import { Injectable } from '@nestjs/common';
import { QZPayService } from '@qazuor/qzpay-nestjs';

@Injectable()
export class BillingService {
  constructor(private readonly qzpay: QZPayService) {}

  async createCustomer(email: string, name: string) {
    return this.qzpay.customers.create({ email, name });
  }

  async createSubscription(customerId: string, planId: string) {
    return this.qzpay.subscriptions.create({ customerId, planId });
  }

  async processPayment(customerId: string, amount: number) {
    return this.qzpay.payments.process({
      customerId,
      amount,
      currency: 'USD'
    });
  }
}
```

### Controller Example

```typescript
import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { QZPayService } from '@qazuor/qzpay-nestjs';

@Controller('billing')
export class BillingController {
  constructor(private readonly qzpay: QZPayService) {}

  @Post('customers')
  async createCustomer(@Body() data: { email: string; name: string }) {
    return this.qzpay.customers.create(data);
  }

  @Get('customers/:id')
  async getCustomer(@Param('id') id: string) {
    return this.qzpay.customers.get(id);
  }

  @Post('subscriptions')
  async createSubscription(
    @Body() data: { customerId: string; planId: string }
  ) {
    return this.qzpay.subscriptions.create(data);
  }
}
```

### Guards

```typescript
import { Controller, UseGuards } from '@nestjs/common';
import { QZPayLivemodeGuard } from '@qazuor/qzpay-nestjs';

@Controller('billing')
@UseGuards(QZPayLivemodeGuard)
export class BillingController {
  // Only accessible in livemode
}
```

### Decorators

```typescript
import { Controller } from '@nestjs/common';
import { InjectQZPay } from '@qazuor/qzpay-nestjs';
import type { QZPayBilling } from '@qazuor/qzpay-core';

@Controller('billing')
export class BillingController {
  constructor(
    @InjectQZPay() private readonly billing: QZPayBilling
  ) {}
}
```

## Module Options

```typescript
interface QZPayModuleOptions {
  storage: QZPayStorageAdapter;
  provider: QZPayPaymentProviderAdapter;
  livemode: boolean;
  events?: {
    onCustomerCreated?: (customer) => void;
    onSubscriptionCreated?: (subscription) => void;
    onPaymentSucceeded?: (payment) => void;
  };
}
```

## Testing

```typescript
import { Test } from '@nestjs/testing';
import { QZPayModule, QZPayService } from '@qazuor/qzpay-nestjs';

describe('BillingService', () => {
  let service: QZPayService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        QZPayModule.forRoot({
          storage: mockStorageAdapter,
          provider: mockProviderAdapter,
          livemode: false
        })
      ]
    }).compile();

    service = module.get<QZPayService>(QZPayService);
  });

  it('should create customer', async () => {
    const customer = await service.customers.create({
      email: 'test@example.com',
      name: 'Test User'
    });
    expect(customer.id).toBeDefined();
  });
});
```

## License

MIT
