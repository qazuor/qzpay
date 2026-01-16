# Validation Setup for QZPay NestJS

This package includes DTOs with class-validator decorators for automatic request validation. To enable validation, you need to configure the global ValidationPipe in your application.

## Installation

The required dependencies are already included in the package:
- `class-validator`
- `class-transformer`
- `@nestjs/mapped-types`

## Setup

### Option 1: Global Validation Pipe (Recommended)

Configure the ValidationPipe in your `main.ts` file:

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable validation globally
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,        // Automatically transform payloads to DTO instances
      whitelist: true,        // Strip properties that don't have decorators
      forbidNonWhitelisted: true, // Throw error if non-whitelisted properties are present
      transformOptions: {
        enableImplicitConversion: true, // Enable implicit type conversion
      },
    })
  );

  await app.listen(3000);
}
bootstrap();
```

### Option 2: Module-Level Validation

Configure validation at the module level:

```typescript
import { Module } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';

@Module({
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    },
  ],
})
export class AppModule {}
```

### Option 3: Controller-Specific Validation

Apply validation to specific controllers:

```typescript
import { Controller, UsePipes, ValidationPipe } from '@nestjs/common';
import { QZPayCustomersController } from '@qazuor/qzpay-nestjs';

@Controller('billing')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class BillingController extends QZPayCustomersController {}
```

## Exception Handling

The package includes a `QZPayExceptionFilter` that automatically maps QZPay errors to appropriate HTTP status codes.

### Global Exception Filter

```typescript
import { NestFactory } from '@nestjs/core';
import { QZPayExceptionFilter } from '@qazuor/qzpay-nestjs';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable global exception filter
  app.useGlobalFilters(new QZPayExceptionFilter());

  await app.listen(3000);
}
bootstrap();
```

### Controller-Specific Exception Filter

```typescript
import { Controller, UseFilters } from '@nestjs/common';
import { QZPayExceptionFilter } from '@qazuor/qzpay-nestjs';

@Controller('billing')
@UseFilters(QZPayExceptionFilter)
export class BillingController {}
```

## Available DTOs

The package provides validated DTOs for all operations:

### Customer DTOs
- `CreateCustomerDto` - Create a customer
- `UpdateCustomerDto` - Update customer details

### Subscription DTOs
- `CreateSubscriptionDto` - Create a subscription
- `UpdateSubscriptionDto` - Update subscription
- `CancelSubscriptionDto` - Cancel subscription with options

### Payment DTOs
- `ProcessPaymentDto` - Process a payment
- `RefundPaymentDto` - Refund a payment

### Invoice DTOs
- `CreateInvoiceDto` - Create an invoice
- `CreateInvoiceLineDto` - Invoice line item
- `MarkPaidDto` - Mark invoice as paid

## Validation Examples

### Creating a Customer

```typescript
import { Body, Controller, Post } from '@nestjs/common';
import { CreateCustomerDto, QZPayService } from '@qazuor/qzpay-nestjs';

@Controller('billing/customers')
export class CustomersController {
  constructor(private readonly qzpay: QZPayService) {}

  @Post()
  async create(@Body() dto: CreateCustomerDto) {
    // dto is automatically validated
    // email must be a valid email
    // externalId is required
    return this.qzpay.createCustomer(dto);
  }
}
```

### Processing a Payment

```typescript
import { Body, Controller, Post } from '@nestjs/common';
import { ProcessPaymentDto, QZPayService } from '@qazuor/qzpay-nestjs';

@Controller('billing/payments')
export class PaymentsController {
  constructor(private readonly qzpay: QZPayService) {}

  @Post()
  async process(@Body() dto: ProcessPaymentDto) {
    // dto is automatically validated
    // amount must be >= 1
    // currency must be one of the supported currencies
    return this.qzpay.processPayment(dto);
  }
}
```

## Error Responses

When validation fails, the API will return a 400 Bad Request with details:

```json
{
  "statusCode": 400,
  "message": [
    "email must be an email",
    "amount must be a positive number"
  ],
  "error": "Bad Request"
}
```

When QZPay operations fail, the exception filter will return appropriate status codes:

- `404 Not Found` - Resource not found
- `400 Bad Request` - Invalid input or validation error
- `401 Unauthorized` - Authentication required
- `402 Payment Required` - Payment failed
- `409 Conflict` - Resource already exists
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Unexpected errors

## Complete Example

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { QZPayExceptionFilter } from '@qazuor/qzpay-nestjs';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  );

  // Enable exception handling
  app.useGlobalFilters(new QZPayExceptionFilter());

  await app.listen(3000);
}
bootstrap();
```

```typescript
// billing.module.ts
import { Module } from '@nestjs/common';
import { QZPayModule } from '@qazuor/qzpay-nestjs';
import { createBilling } from './billing.config';

@Module({
  imports: [
    QZPayModule.forRoot({
      billing: createBilling(),
    }),
  ],
})
export class BillingModule {}
```

## Migration from Interface DTOs

If you were using the old interface-based DTOs from controllers, they are still available as legacy exports but are deprecated. Update your imports:

```typescript
// Old (deprecated)
import type { CreateCustomerDto } from '@qazuor/qzpay-nestjs';

// New (with validation)
import { CreateCustomerDto } from '@qazuor/qzpay-nestjs';
```

The new DTOs are classes with validation decorators, while the old ones were TypeScript interfaces.
