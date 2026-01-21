// These libraries use browser-only APIs, so we'll import them dynamically
// to avoid SSR issues

export interface InvoiceData {
  invoiceNumber?: string;
  date: string;
  customerName?: string;
  customerEmail?: string;
  customerAddress?: string;
  dueDate?: string;
  notes?: string;
  lineItems: Array<{
    date: string;
    service: string;
    description: string;
    qty: string;
    rate: string;
  }>;
  subtotal: number;
  tax: number;
  discountPercentage?: number;
  discountAmount?: number;
  amountPaid?: number;
  total: number;
  currency: string;
  paymentLink?: string;
  validUntil?: string;
  companyName?: string;
  terms?: string;
}

/**
 * Formats a number with thousand separators
 */
function formatNumber(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0.00';
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Formats a date string (DD/MM/YYYY, HH:mm:ss) to a readable format
 */
function formatDate(dateString: string): string {
  if (!dateString) return '';
  // Handle DD/MM/YYYY, HH:mm:ss format
  const parts = dateString.split(',');
  if (parts.length === 2) {
    return parts[0].trim(); // Return just the date part
  }
  return dateString;
}

/**
 * Dynamically generates line item rows in HTML tables
 * Finds rows with line item placeholders and replaces them with actual line items
 */
function generateDynamicLineItems(html: string, data: InvoiceData): string {
  // Check if we're in a browser environment
  if (typeof document === 'undefined') {
    throw new Error('generateDynamicLineItems can only be called in a browser environment');
  }
  
  // Create a temporary DOM element to parse and manipulate HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  // Find all tables
  const tables = tempDiv.querySelectorAll('table');
  
  tables.forEach((table) => {
    // Find rows that contain line item placeholders (line_0_*, line_1_*, etc.)
    const rows = Array.from(table.querySelectorAll('tr'));
    const templateRows: HTMLTableRowElement[] = [];
    
    // Identify template rows (rows containing line item variables)
    rows.forEach((row) => {
      const rowText = row.innerHTML;
      // Check if this row contains line item placeholders
      if (rowText.includes('{{line_') || rowText.includes('{line_')) {
        templateRows.push(row);
      }
    });

    if (templateRows.length === 0) {
      return; // No line item rows found in this table, skip
    }

    // Use the first template row as the pattern (they should all have the same structure)
    const templateRow = templateRows[0];
    const templateRowHtml = templateRow.outerHTML;

    // Find the parent element (tbody or table) and the insertion point
    const parentElement = templateRow.parentElement || table;
    const insertBeforeElement = templateRow;

    // Generate all new rows first (as HTML strings), then insert them all at once
    const newRowHtmls: string[] = [];
    
    data.lineItems.forEach((item, index) => {
      const qty = parseFloat(item.qty) || 0;
      const rate = parseFloat(item.rate) || 0;
      const amount = qty * rate;
      
      // Format date - remove any prefix that might be in the template (like "07/01/")
      let formattedDate = item.date || '';
      if (formattedDate.includes(',')) {
        formattedDate = formattedDate.split(',')[0].trim();
      }

      // Start with the template row HTML
      let newRowHtml = templateRowHtml;

      // Replace all line item placeholders in the new row
      // Handle both line_0_*, line_1_*, etc. patterns (replace any line_N_* with current data)
      const lineItemFields = ['date', 'service', 'description', 'qty', 'rate', 'amount'];
      
      lineItemFields.forEach((field) => {
        // Replace line_0_*, line_1_*, etc. with current data
        // Handle both {{var}} and {var} (missing brace) patterns
        const patterns = [
          new RegExp(`\\{\\{line_\\d+_${field}\\}\\}`, 'g'), // {{line_0_date}}
          new RegExp(`\\{line_\\d+_${field}\\}`, 'g'),     // {line_0_date} (missing brace)
        ];
        
        let replacement = '';
        switch (field) {
          case 'date':
            replacement = formattedDate;
            break;
          case 'service':
            replacement = item.service || '';
            break;
          case 'description':
            replacement = item.description || '';
            break;
          case 'qty':
            replacement = qty.toString();
            break;
          case 'rate':
            replacement = formatNumber(rate);
            break;
          case 'amount':
            replacement = formatNumber(amount);
            break;
        }
        
        patterns.forEach((pattern) => {
          newRowHtml = newRowHtml.replace(pattern, replacement);
        });
      });

      // Handle date prefix pattern (e.g., "07/01/{{line_0_date}}" or "07/01/{line_0_date}")
      // This preserves any date prefix that exists in the template
      newRowHtml = newRowHtml.replace(/(\d{2}\/\d{2}\/)?\{\{?line_\d+_date\}?\}?\}/g, (match, prefix) => {
        return (prefix || '') + formattedDate;
      });

      // Also replace currency_code if it appears before rate/amount
      // Handle patterns like "{{currency_code}}{{line_0_rate}}"
      const currencyCode = data.currency || '';
      newRowHtml = newRowHtml.replace(/\{\{currency_code\}\}\{\{?line_\d+_(rate|amount)\}?\}?\}/g, (match, field) => {
        if (field === 'rate') {
          return currencyCode + formatNumber(rate);
        } else if (field === 'amount') {
          return currencyCode + formatNumber(amount);
        }
        return match;
      });

      // Store the processed HTML
      newRowHtmls.push(newRowHtml);
    });

    // Create a temporary container to parse all rows at once
    const tempContainer = document.createElement('tbody');
    tempContainer.innerHTML = newRowHtmls.join('');
    const newRows = Array.from(tempContainer.querySelectorAll('tr'));

    // Insert all new rows before the first template row
    // Insert in reverse order so they appear in the correct sequence
    for (let i = newRows.length - 1; i >= 0; i--) {
      const row = newRows[i];
      // Clone the row to avoid issues with moving nodes between containers
      const clonedRow = row.cloneNode(true) as HTMLTableRowElement;
      parentElement.insertBefore(clonedRow, insertBeforeElement);
    }

    // Remove all template rows (they've been replaced with actual data rows)
    templateRows.forEach((row) => {
      if (row.parentElement) {
        row.remove();
      }
    });
  });

  return tempDiv.innerHTML;
}

/**
 * Replaces placeholders in HTML with invoice data
 */
function replacePlaceholders(html: string, data: InvoiceData): string {
  let rendered = html;

  // Calculate amounts
  const amountPaid = data.amountPaid || 0;
  const discountAmount = data.discountAmount || 0;
  const discountPercentage = data.discountPercentage || 0;
  const balanceDue = data.total; // Total is already the balance due

  // Replace simple placeholders (using snake_case to match template)
  const replacements: Record<string, string> = {
    invoice_number: data.invoiceNumber || '',
    date: data.date || '',
    customer_name: data.customerName || '',
    customer_email_address: data.customerEmail || '',
    customer_address: data.customerAddress || '',
    due_date: data.dueDate || '',
    notes: data.notes || '',
    sub_total: formatNumber(data.subtotal),
    tax: formatNumber(data.tax),
    discount_amount: formatNumber(discountAmount),
    amount_paid: formatNumber(amountPaid),
    balance_due: formatNumber(balanceDue),
    total: formatNumber(data.total),
    currency_code: data.currency || '',
    payment_link: data.paymentLink || '',
    valid_until: data.validUntil ? formatDate(data.validUntil) : '',
    company_name: data.companyName || '',
    discount_in_percentage: discountPercentage.toString(),
    terms: data.terms || (data.validUntil ? `Valid until ${formatDate(data.validUntil)}` : ''),
  };

  // Replace all simple placeholders
  Object.entries(replacements).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    rendered = rendered.replace(regex, value);
  });

  // Generate dynamic line items (this replaces template rows with actual data rows)
  rendered = generateDynamicLineItems(rendered, data);

  // Remove any remaining unreplaced placeholders (replace with empty string)
  rendered = rendered.replace(/\{\{[\w_]+\}\}/g, '');

  return rendered;
}

/**
 * Generates an invoice PDF from a Word template
 */
export async function generateInvoicePdf(
  templatePath: string,
  invoiceData: InvoiceData
): Promise<Blob> {
  // Check if we're in a browser environment
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('generateInvoicePdf can only be called in a browser environment');
  }
  
  try {
    // 1. Load the Word template file
    const response = await fetch(templatePath);
    if (!response.ok) {
      throw new Error(`Failed to load template: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();

    // 2. Convert Word document to HTML using mammoth
    // Dynamically import mammoth to avoid SSR issues
    const mammoth = (await import('mammoth')).default;
    
    const mammothOptions = {
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='Title'] => h1.title:fresh",
        "p[style-name='Subtitle'] => h2.subtitle:fresh",
        "r[style-name='Strong'] => strong",
        "r[style-name='Emphasis'] => em",
      ],
      includeDefaultStyleMap: true,
      preserveEmptyParagraphs: true, // Preserve empty paragraphs for layout
      convertImage: mammoth.images.imgElement((image) => {
        return image.read("base64").then((imageBuffer) => {
          return {
            src: "data:" + image.contentType + ";base64," + imageBuffer
          };
        });
      }),
    };

    const result = await mammoth.convertToHtml({ arrayBuffer }, mammothOptions);
    let html = result.value;
    
    // Log warnings if any (for debugging)
    if (result.messages && result.messages.length > 0) {
      console.warn('Mammoth conversion warnings:', result.messages);
    }

    // 3. Replace placeholders with invoice data
    html = replacePlaceholders(html, invoiceData);
    
    // 3.5. Post-process HTML to better preserve Word styling
    // Mammoth sometimes doesn't preserve all inline styles, so we try to enhance them
    // This is a workaround - ideally mammoth would preserve everything, but it doesn't always
    html = html.replace(/<p([^>]*)>/gi, (match, attrs) => {
      // Preserve existing style attributes
      if (!attrs.includes('style=')) {
        return `<p${attrs} style="margin: 0; padding: 0;">`;
      }
      return match;
    });

    // 4. Preserve inline styles from mammoth output and wrap with minimal styling
    // Mammoth already includes inline styles, so we just need to ensure they're preserved
    // and add minimal base styles that don't override Word's formatting
    const styledHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * {
            box-sizing: border-box;
          }
          body {
            font-family: 'Times New Roman', serif;
            font-size: 12pt;
            color: #000;
            background: white;
            margin: 0;
            padding: 0;
          }
          /* Preserve all inline styles from Word - don't override */
          p, div, span, td, th {
            margin: 0;
            padding: 0;
          }
          /* Only add minimal table defaults if not already styled */
          table {
            border-collapse: collapse;
            width: 100%;
          }
          /* Preserve images */
          img {
            max-width: 100%;
            height: auto;
          }
        </style>
      </head>
      <body style="margin: 0; padding: 0;">
        ${html}
      </body>
      </html>
    `;

    // 5. Convert HTML to PDF using html2pdf.js
    const element = document.createElement('div');
    element.innerHTML = styledHtml;
    document.body.appendChild(element);

    const opt = {
      margin: [0, 0, 0, 0] as [number, number, number, number], // No margins to preserve Word layout
      filename: `invoice-${invoiceData.invoiceNumber || Date.now()}.pdf`,
      image: { type: 'jpeg' as const, quality: 1.0 },
      html2canvas: { 
        scale: 2, // Higher scale for better quality
        useCORS: true,
        letterRendering: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 816, // Standard letter width in pixels at 96 DPI
        windowHeight: element.scrollHeight,
        allowTaint: true,
        removeContainer: false,
        onclone: (clonedDoc: Document) => {
          // Ensure all styles are preserved in the cloned document
          const clonedElement = clonedDoc.querySelector('body > div');
          if (clonedElement instanceof HTMLElement) {
            clonedElement.style.width = '816px';
            clonedElement.style.margin = '0';
            clonedElement.style.padding = '0';
          }
        },
      },
      jsPDF: { 
        unit: 'in', 
        format: 'letter', 
        orientation: 'portrait' as const,
        precision: 16,
        compress: false, // Don't compress to preserve quality
      },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
    };

    // Dynamically import html2pdf to avoid SSR issues
    const html2pdf = (await import('html2pdf.js')).default;
    const pdfBlob = await html2pdf().set(opt).from(element).outputPdf('blob');
    
    // Clean up
    document.body.removeChild(element);

    return pdfBlob;
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    throw error;
  }
}

/**
 * Converts a Blob to base64 string for email attachment
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

