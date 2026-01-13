import { useTranslation } from 'react-i18next';
import { InvoiceList } from '@qazuor/qzpay-react';
import { exportPlaygroundData } from '../../../adapters/local-storage.adapter';
import { AlertCircle, UserX } from 'lucide-react';
import type { QZPayCustomer, QZPayInvoice } from '@qazuor/qzpay-core';

interface InvoiceListDemoProps {
  customer: QZPayCustomer | null;
}

export function InvoiceListDemo({ customer }: InvoiceListDemoProps) {
  const { t } = useTranslation('showcase');
  const data = exportPlaygroundData();
  const invoices = Object.values(data.invoices || {}) as QZPayInvoice[];

  if (!customer) {
    return (
      <div className="card p-6">
        <div className="flex items-center gap-3" style={{ color: 'var(--color-text-muted)' }}>
          <UserX className="h-5 w-5" />
          <p>{t('demos.selectCustomer')}</p>
        </div>
      </div>
    );
  }

  const customerInvoices = invoices.filter((inv) => inv.customerId === customer.id);

  const handlePayInvoice = (invoice: QZPayInvoice) => {
    console.log('Pay invoice:', invoice.id);
    // In a real app, this would initiate payment
  };

  const handleDownloadInvoice = (invoice: QZPayInvoice) => {
    console.log('Download invoice:', invoice.id);
    // In a real app, this would download a PDF
  };

  return (
    <div className="space-y-6">
      {/* Demo Description */}
      <div className="card p-4">
        <h3 className="font-medium mb-2" style={{ color: 'var(--color-text)' }}>
          {t('demos.invoiceList.title')}
        </h3>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {t('demos.invoiceList.description')}
        </p>
      </div>

      {/* Live Component */}
      <div className="card p-6">
        <h4 className="text-sm font-medium mb-4" style={{ color: 'var(--color-text-secondary)' }}>
          {t('demos.livePreview')}
        </h4>
        {customerInvoices.length > 0 ? (
          <InvoiceList
            customerId={customer.id}
            invoices={customerInvoices}
            onPayInvoice={handlePayInvoice}
            onDownloadInvoice={handleDownloadInvoice}
          />
        ) : (
          <div className="flex items-center gap-3 text-amber-400">
            <AlertCircle className="h-5 w-5" />
            <p>{t('demos.invoiceList.noInvoices')}</p>
          </div>
        )}
      </div>

      {/* Code Example */}
      <div className="card p-4">
        <h4 className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
          {t('demos.codeExample')}
        </h4>
        <pre
          className="p-4 rounded-lg text-sm overflow-x-auto"
          style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text-secondary)' }}
        >
{`import { InvoiceList, useInvoices } from '@qazuor/qzpay-react';

function BillingHistory({ customerId }) {
  const { isLoading } = useInvoices({ customerId });

  if (isLoading) return <p>Loading...</p>;

  return (
    <InvoiceList
      customerId={customerId}
      onPayInvoice={(invoice) => initiatePayment(invoice)}
      onDownloadInvoice={(invoice) => downloadPdf(invoice)}
    />
  );
}`}
        </pre>
      </div>
    </div>
  );
}
