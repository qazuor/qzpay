/**
 * Plans REST Controller
 */
import { Controller, Get, Param, Query } from '@nestjs/common';
import type { QZPayService } from '../qzpay.service.js';

/**
 * Plans REST Controller
 *
 * Provides REST endpoints for plan listing (read-only).
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [QZPayModule.forRoot(options)],
 *   controllers: [QZPayPlansController],
 * })
 * export class BillingModule {}
 * ```
 */
@Controller('billing/plans')
export class QZPayPlansController {
    constructor(private readonly qzpay: QZPayService) {}

    /**
     * Get all plans
     * GET /billing/plans
     */
    @Get()
    findAll(@Query('active') active?: string) {
        const plans = this.qzpay.getPlans();

        if (active === 'true') {
            return plans.filter((p) => p.active);
        }

        return plans;
    }

    /**
     * Get a plan by ID
     * GET /billing/plans/:id
     */
    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.qzpay.getPlan(id);
    }
}
