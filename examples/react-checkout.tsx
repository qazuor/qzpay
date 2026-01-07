/**
 * React Checkout Example
 *
 * This example shows how to use QZPay React hooks
 * to build a checkout flow.
 */
import type { QZPayPlan, QZPayPrice, QZPaySubscription } from '@qazuor/qzpay-core';
import { QZPayProvider, useCreateSubscription, useCustomer, usePlans, useSubscriptions } from '@qazuor/qzpay-react';
import { useState } from 'react';

// API client configuration
const apiConfig = {
    baseUrl: '/api/billing',
    headers: {
        'Content-Type': 'application/json'
    }
};

// Main App with Provider
export function App() {
    return (
        <QZPayProvider config={apiConfig}>
            <CheckoutPage />
        </QZPayProvider>
    );
}

// Checkout Page Component
function CheckoutPage() {
    const { customer, isLoading: customerLoading } = useCustomer();
    const { plans, isLoading: plansLoading } = usePlans();
    const { subscriptions } = useSubscriptions(customer?.id);
    const [selectedPlan, setSelectedPlan] = useState<QZPayPlan | null>(null);

    if (customerLoading || plansLoading) {
        return <div>Loading...</div>;
    }

    if (!customer) {
        return <div>Please log in to continue</div>;
    }

    const hasActiveSubscription = subscriptions?.some((s: QZPaySubscription) => s.status === 'active');

    return (
        <div className="checkout-page">
            <h1>Choose Your Plan</h1>

            {hasActiveSubscription ? (
                <div className="current-subscription">
                    <h2>Current Subscription</h2>
                    <SubscriptionDetails subscription={subscriptions?.find((s: QZPaySubscription) => s.status === 'active')} />
                </div>
            ) : (
                <>
                    <div className="plans-grid">
                        {plans?.map((plan: QZPayPlan) => (
                            <PlanCard
                                key={plan.id}
                                plan={plan}
                                selected={selectedPlan?.id === plan.id}
                                onSelect={() => setSelectedPlan(plan)}
                            />
                        ))}
                    </div>

                    {selectedPlan && <SubscribeButton customerId={customer.id} planId={selectedPlan.id} />}
                </>
            )}
        </div>
    );
}

// Plan Card Component
function PlanCard({
    plan,
    selected,
    onSelect
}: {
    plan: QZPayPlan;
    selected: boolean;
    onSelect: () => void;
}) {
    const price = plan.prices?.[0] as QZPayPrice | undefined;

    return (
        <div className={`plan-card ${selected ? 'selected' : ''}`} onClick={onSelect}>
            <h3>{plan.name}</h3>
            <p>{plan.description}</p>
            {price && (
                <div className="price">
                    ${(price.amount / 100).toFixed(2)}/{price.interval}
                </div>
            )}
        </div>
    );
}

// Subscribe Button Component
function SubscribeButton({ customerId, planId }: { customerId: string; planId: string }) {
    const { createSubscription, isLoading, error } = useCreateSubscription();

    const handleSubscribe = async () => {
        try {
            await createSubscription({ customerId, planId });
            // Redirect to success page or show success message
        } catch (err) {
            console.error('Subscription failed:', err);
        }
    };

    return (
        <div className="subscribe-section">
            <button onClick={handleSubscribe} disabled={isLoading}>
                {isLoading ? 'Processing...' : 'Subscribe Now'}
            </button>
            {error && <p className="error">{error.message}</p>}
        </div>
    );
}

// Subscription Details Component
function SubscriptionDetails({ subscription }: { subscription?: QZPaySubscription }) {
    if (!subscription) return null;

    return (
        <div className="subscription-details">
            <p>
                <strong>Status:</strong> {subscription.status}
            </p>
            <p>
                <strong>Current Period:</strong>
                {subscription.currentPeriodStart?.toLocaleDateString()} - {subscription.currentPeriodEnd?.toLocaleDateString()}
            </p>
        </div>
    );
}

export default App;
