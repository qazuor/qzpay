import { Link } from 'react-router-dom';

export function App() {
    return (
        <div className="container">
            <h1>QZPay E2E Test App</h1>
            <p>Select a component to test:</p>
            <nav>
                <Link to="/payment-form" data-testid="nav-payment-form">
                    Payment Form
                </Link>
                <Link to="/checkout-button" data-testid="nav-checkout-button">
                    Checkout Button
                </Link>
                <Link to="/invoice-list" data-testid="nav-invoice-list">
                    Invoice List
                </Link>
                <Link to="/payment-methods" data-testid="nav-payment-methods">
                    Payment Methods
                </Link>
                <Link to="/pricing-table" data-testid="nav-pricing-table">
                    Pricing Table
                </Link>
            </nav>
        </div>
    );
}
