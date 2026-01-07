# NestJS + MercadoPago Example

Complete example of QZPay integration with NestJS and MercadoPago for payment processing in Latin America.

## Features

- Full MercadoPago integration with QZPay
- NestJS module and service architecture
- Webhook/IPN handling with signature verification
- Subscription management
- 3D Secure support
- Customer management

## Prerequisites

- Node.js 18+
- NestJS CLI
- MercadoPago account with API credentials

## Environment Variables

```bash
MERCADOPAGO_ACCESS_TOKEN=APP_USR-xxx
MERCADOPAGO_WEBHOOK_SECRET=xxx
DATABASE_URL=postgres://localhost/qzpay
NODE_ENV=development
```

## Project Structure

```
nestjs-mercadopago/
├── README.md
├── billing.module.ts      # QZPay billing module
├── billing.service.ts     # Billing service with MercadoPago
├── webhooks.controller.ts # IPN webhook handling
├── customers.controller.ts
├── subscriptions.controller.ts
├── payments.controller.ts
└── types.ts               # Type definitions
```

## Usage

### 1. Import the Module

```typescript
// app.module.ts
import { BillingModule } from './billing/billing.module';

@Module({
  imports: [
    BillingModule.forRoot({
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
      webhookSecret: process.env.MERCADOPAGO_WEBHOOK_SECRET!,
    }),
  ],
})
export class AppModule {}
```

### 2. Use the Service

```typescript
// any.service.ts
import { BillingService } from './billing/billing.service';

@Injectable()
export class YourService {
  constructor(private billing: BillingService) {}

  async createSubscription(userId: string, planId: string) {
    return this.billing.createSubscription(userId, planId);
  }
}
```

### 3. Configure Webhooks

Set your MercadoPago webhook URL to: `https://yourdomain.com/webhooks/mercadopago`

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /customers | Create customer |
| GET | /customers/:id | Get customer |
| POST | /subscriptions | Create subscription |
| GET | /subscriptions/:id | Get subscription |
| DELETE | /subscriptions/:id | Cancel subscription |
| POST | /payments | Create payment |
| GET | /payments/:id | Get payment |
| POST | /payments/:id/refund | Refund payment |
| POST | /webhooks/mercadopago | Webhook endpoint |

## Notes

- This example uses in-memory storage. For production, use `@qazuor/qzpay-drizzle`.
- MercadoPago has regional limitations. See the MercadoPago README for details.
- 3D Secure flows require frontend handling to redirect users.
