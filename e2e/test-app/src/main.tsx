import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { App } from './App';
import { CheckoutButtonPage } from './pages/CheckoutButtonPage';
import { InvoiceListPage } from './pages/InvoiceListPage';
import { PaymentFormPage } from './pages/PaymentFormPage';
import { PaymentMethodManagerPage } from './pages/PaymentMethodManagerPage';
import { PricingTablePage } from './pages/PricingTablePage';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

createRoot(rootElement).render(
    <StrictMode>
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<App />} />
                <Route path="/payment-form" element={<PaymentFormPage />} />
                <Route path="/checkout-button" element={<CheckoutButtonPage />} />
                <Route path="/invoice-list" element={<InvoiceListPage />} />
                <Route path="/payment-methods" element={<PaymentMethodManagerPage />} />
                <Route path="/pricing-table" element={<PricingTablePage />} />
            </Routes>
        </BrowserRouter>
    </StrictMode>
);
