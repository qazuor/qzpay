import type { QZPayPlan, QZPayPrice } from '@qazuor/qzpay-core';
import { PricingTable } from '@qazuor/qzpay-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

// Mock plans with prices
const mockPlans: QZPayPlan[] = [
    {
        id: 'plan_free',
        name: 'Free',
        description: 'Perfect for getting started',
        isActive: true,
        metadata: {
            features: ['1 user', '100 API calls/month', 'Email support']
        },
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        id: 'plan_pro',
        name: 'Pro',
        description: 'Best for growing teams',
        isActive: true,
        metadata: {
            features: ['5 users', '10,000 API calls/month', 'Priority support', 'Advanced analytics'],
            popular: true
        },
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        id: 'plan_enterprise',
        name: 'Enterprise',
        description: 'For large organizations',
        isActive: true,
        metadata: {
            features: ['Unlimited users', 'Unlimited API calls', '24/7 support', 'Custom integrations', 'SLA guarantee']
        },
        createdAt: new Date(),
        updatedAt: new Date()
    }
];

const mockPrices: QZPayPrice[] = [
    // Free plan - $0
    {
        id: 'price_free',
        planId: 'plan_free',
        currency: 'USD',
        unitAmount: 0,
        interval: 'month',
        isActive: true,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
    },
    // Pro plan - monthly and annual
    {
        id: 'price_pro_monthly',
        planId: 'plan_pro',
        currency: 'USD',
        unitAmount: 2999,
        interval: 'month',
        isActive: true,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        id: 'price_pro_annual',
        planId: 'plan_pro',
        currency: 'USD',
        unitAmount: 29900,
        interval: 'year',
        isActive: true,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
    },
    // Enterprise plan - annual only
    {
        id: 'price_enterprise_annual',
        planId: 'plan_enterprise',
        currency: 'USD',
        unitAmount: 99900,
        interval: 'year',
        isActive: true,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
    }
];

export function PricingTablePage() {
    const [selectedPlan, setSelectedPlan] = useState<{ planId: string; priceId: string } | null>(null);
    const [interval, setInterval] = useState<'month' | 'year'>('month');

    const handleSelectPlan = (planId: string, priceId: string) => {
        setSelectedPlan({ planId, priceId });
    };

    return (
        <div className="container" style={{ maxWidth: '1000px' }}>
            <nav>
                <Link to="/">← Back</Link>
            </nav>
            <h1>Pricing Table Test</h1>

            <div style={{ marginBottom: '24px', textAlign: 'center' }}>
                <button
                    type="button"
                    onClick={() => setInterval('month')}
                    style={{
                        padding: '8px 16px',
                        backgroundColor: interval === 'month' ? '#2563eb' : 'transparent',
                        color: interval === 'month' ? 'white' : '#374151',
                        border: '1px solid #2563eb',
                        borderRadius: '4px 0 0 4px',
                        cursor: 'pointer'
                    }}
                    data-testid="interval-month"
                >
                    Monthly
                </button>
                <button
                    type="button"
                    onClick={() => setInterval('year')}
                    style={{
                        padding: '8px 16px',
                        backgroundColor: interval === 'year' ? '#2563eb' : 'transparent',
                        color: interval === 'year' ? 'white' : '#374151',
                        border: '1px solid #2563eb',
                        borderRadius: '0 4px 4px 0',
                        cursor: 'pointer'
                    }}
                    data-testid="interval-year"
                >
                    Annual
                </button>
            </div>

            <PricingTable
                plans={mockPlans}
                prices={mockPrices}
                onSelectPlan={handleSelectPlan}
                currentPlanId={selectedPlan?.planId}
                billingInterval={interval}
            />

            {selectedPlan && (
                <div
                    data-testid="selected-plan"
                    style={{ marginTop: '24px', padding: '16px', backgroundColor: '#dcfce7', borderRadius: '4px', textAlign: 'center' }}
                >
                    <h3>Selected Plan</h3>
                    <p>Plan ID: {selectedPlan.planId}</p>
                    <p>Price ID: {selectedPlan.priceId}</p>
                </div>
            )}
        </div>
    );
}
