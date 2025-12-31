---
name: pdf-generator
category: utils
description: Generate professional PDF documents from data using templates and styling
usage: When creating invoices, reports, confirmations, contracts, or converting documentation to PDF
input: Content data, template requirements, styling specifications
output: Generated PDF files with proper formatting and metadata
---

# PDF Generator

## ⚙️ Configuration

| Setting | Description | Example |
|---------|-------------|---------|
| `pdf_library` | Generation library | `pdfkit`, `puppeteer`, `jspdf` |
| `page_size` | Default page size | `A4`, `LETTER` |
| `margin` | Default margins | `50` (points), `20mm` |
| `orientation` | Page orientation | `portrait`, `landscape` |
| `font_family` | Default font | `Helvetica`, `Arial` |
| `brand_primary` | Primary color | `#3B82F6` |
| `brand_secondary` | Secondary color | `#10B981` |

## Purpose

Generate professional PDF documents for invoices, reports, confirmations, and contracts with proper formatting and styling.

## Capabilities

- Generate invoices with calculations
- Create booking confirmations
- Produce business reports
- Convert HTML to PDF
- Add headers/footers
- Embed images and logos
- Apply consistent styling

## Library Selection

| Library | Use Case | Pros | Cons |
|---------|----------|------|------|
| **PDFKit** | Programmatic PDFs | Simple API, good control | No HTML/CSS |
| **Puppeteer** | HTML/CSS layouts | Full CSS support | Heavier, needs Chrome |
| **jsPDF** | Client-side | Browser-based | Limited features |
| **React-PDF** | React apps | Component-based | Learning curve |

## Setup

### PDFKit

```typescript
import PDFDocument from 'pdfkit';

interface PDFConfig {
  size?: 'A4' | 'LETTER';
  margin?: number;
  layout?: 'portrait' | 'landscape';
}

function createPDF(config: PDFConfig = {}) {
  return new PDFDocument({
    size: config.size || 'A4',
    margin: config.margin || 50,
    layout: config.layout || 'portrait',
  });
}
```

### Puppeteer

```typescript
import puppeteer from 'puppeteer';

async function generatePDFFromHTML(
  html: string,
  options = {}
): Promise<Buffer> {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });

  const pdf = await page.pdf({
    format: 'A4',
    margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
    printBackground: true,
    ...options
  });

  await browser.close();
  return pdf;
}
```

## Invoice Template

```typescript
interface InvoiceData {
  invoiceNumber: string;
  date: string;
  from: { name: string; address: string; email: string };
  to: { name: string; address: string; email: string };
  items: Array<{
    description: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  subtotal: number;
  tax: number;
  total: number;
}

function generateInvoice(data: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    // Header
    doc.fontSize(20).text('INVOICE', 50, 50);
    doc.fontSize(10)
       .text(`Invoice #: ${data.invoiceNumber}`, 50, 80)
       .text(`Date: ${data.date}`, 50, 95);

    // From/To sections
    doc.fontSize(12).text('From:', 50, 140);
    doc.fontSize(10).text(data.from.name, 50, 160);

    doc.fontSize(12).text('To:', 300, 140);
    doc.fontSize(10).text(data.to.name, 300, 160);

    // Items table
    let y = 250;
    data.items.forEach(item => {
      doc.text(item.description, 50, y);
      doc.text(item.quantity.toString(), 300, y);
      doc.text(`$${item.total.toFixed(2)}`, 450, y);
      y += 25;
    });

    // Totals
    y += 20;
    doc.text('Total:', 370, y);
    doc.text(`$${data.total.toFixed(2)}`, 450, y);

    doc.end();
  });
}
```

## HTML Template (Puppeteer)

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: Arial, sans-serif;
      padding: 40px;
    }
    .header {
      background: #3B82F6;
      color: white;
      padding: 30px;
      text-align: center;
    }
    .section {
      margin: 30px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th {
      background: #3B82F6;
      color: white;
      padding: 12px;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #E5E7EB;
    }
    .total {
      font-size: 24px;
      color: #3B82F6;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>INVOICE</h1>
    <p>Invoice #{{invoiceNumber}}</p>
  </div>

  <div class="section">
    <h2>Bill To</h2>
    <p>{{customer.name}}</p>
    <p>{{customer.address}}</p>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>Quantity</th>
        <th>Price</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      {{#each items}}
      <tr>
        <td>{{description}}</td>
        <td>{{quantity}}</td>
        <td>${{price}}</td>
        <td>${{total}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>

  <div class="total">
    Total: ${{total}}
  </div>
</body>
</html>
```

## Styling Best Practices

| Element | Recommendation |
|---------|----------------|
| **Fonts** | Use web-safe fonts or embed custom |
| **Images** | Optimize before embedding |
| **Colors** | Use brand colors consistently |
| **Layout** | Test print layout before finalizing |
| **Margins** | Standard: 20mm all sides |
| **Page breaks** | Set explicitly for long content |
| **Headers/Footers** | Include page numbers |

## Common Patterns

### Confirmation Document

```typescript
interface Confirmation {
  id: string;
  code: string;
  customerName: string;
  details: Record<string, string>;
  date: string;
}

async function generateConfirmation(data: Confirmation): Promise<Buffer> {
  const html = `
    <div class="header">
      <h1>Confirmation</h1>
      <div class="code">${data.code}</div>
    </div>
    <div class="details">
      <p><strong>Name:</strong> ${data.customerName}</p>
      <p><strong>Date:</strong> ${data.date}</p>
      ${Object.entries(data.details)
        .map(([key, value]) => `<p><strong>${key}:</strong> ${value}</p>`)
        .join('')}
    </div>
  `;

  return generatePDFFromHTML(html);
}
```

### Report with Charts

```typescript
async function generateReport(data: ReportData): Promise<Buffer> {
  const html = `
    <h1>Monthly Report</h1>
    <div class="metrics">
      <div class="metric">
        <div class="value">${data.totalSales}</div>
        <div class="label">Total Sales</div>
      </div>
    </div>
    <table>
      <thead><tr><th>Item</th><th>Value</th></tr></thead>
      <tbody>
        ${data.items.map(item => `
          <tr><td>${item.name}</td><td>${item.value}</td></tr>
        `).join('')}
      </tbody>
    </table>
  `;

  return generatePDFFromHTML(html);
}
```

## Metadata

```typescript
doc.info = {
  Title: 'Invoice #12345',
  Author: 'Company Name',
  Subject: 'Invoice',
  Keywords: 'invoice, billing',
  CreationDate: new Date(),
};
```

## Best Practices

| Practice | Description |
|----------|-------------|
| **Templates** | Reuse templates for consistency |
| **Validation** | Test with various data scenarios |
| **Compression** | Compress for web delivery |
| **Metadata** | Set title, author, subject |
| **Accessibility** | Include proper structure tags |
| **Testing** | Test on multiple PDF viewers |
| **File Size** | Optimize images and fonts |

## Checklist

- [ ] Library selected appropriately
- [ ] Template created and tested
- [ ] Styling matches brand guidelines
- [ ] All data rendered correctly
- [ ] Metadata configured
- [ ] File size optimized
- [ ] Tested in PDF viewers
- [ ] Responsive to data variations
