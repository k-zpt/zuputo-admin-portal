'use client';

import { AdminLayout } from "@/components/AdminLayout";
import { Tabs } from "@/components/Tabs";
import { paymentLinkService, countryService, currencyService, customerService, notifierService, messageTemplateService, notificationService, offlineInvoiceService } from "@/lib/api/services";
import { DEFAULT_PAYMENT_LINK_EMAIL_TEMPLATE, renderEmailTemplate, formatNumber, formatDate } from "@/lib/emailTemplates";
import { PAYMENT_LINK_BASE_URL, FINANCE_EMAIL } from "@/lib/api/config";
import { useState, useEffect, useRef } from "react";
import type { AdhocRequest, CreateAdhocRequestPayload, ApiResponse, Country, Currency, Customer, MessageTemplate, CreateOfflineInvoicePayload } from "@/lib/api/types";

type GenerationMethod = 'copy' | 'email' | 'customer';
type PaymentType = 'ADHOC_PAYMENT' | 'INVOICE';

interface InvoiceLineItem {
  date: string;
  service: string;
  description: string;
  qty: string;
  rate: string;
}

// Shared email validator
// Require at least 2 alpha chars in TLD to avoid partials like ".c"
const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(email.trim());

// Email Tag Input Component
interface EmailTagInputProps {
  emails: string[];
  onChange: (emails: string[]) => void;
  placeholder?: string;
  fixedEmails?: string[]; // Emails that cannot be removed
  label: string;
  required?: boolean;
}

function EmailTagInput({ emails, onChange, placeholder, fixedEmails = [], label, required }: EmailTagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addEmail();
    } else if (e.key === 'Backspace' && inputValue === '' && emails.length > 0) {
      // Remove last email if backspace on empty input (unless it's fixed)
      const lastEmail = emails[emails.length - 1];
      if (!fixedEmails.includes(lastEmail)) {
        removeEmail(emails.length - 1);
      }
    }
  };

  const addEmail = () => {
    const trimmed = inputValue.trim();
    if (trimmed && isValidEmail(trimmed) && !emails.includes(trimmed)) {
      onChange([...emails, trimmed]);
      setInputValue('');
    }
  };

  const removeEmail = (index: number) => {
    const email = emails[index];
    if (fixedEmails.includes(email)) return; // Don't remove fixed emails
    onChange(emails.filter((_, i) => i !== index));
  };

  const handleBlur = () => {
    if (inputValue.trim()) {
      addEmail();
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label} {required && '*'}
      </label>
      <div
        className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900 shadow-sm focus-within:border-blue-500 focus-within:outline-none focus-within:ring-1 focus-within:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus-within:border-blue-400 dark:focus-within:ring-blue-400 min-h-[42px] flex flex-wrap gap-1 items-center cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {emails.map((email, index) => {
          const isFixed = fixedEmails.includes(email);
          return (
            <span
              key={index}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs ${
                isFixed
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
              }`}
            >
              {email}
              {!isFixed && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeEmail(index);
                  }}
                  className="hover:text-red-600 dark:hover:text-red-400"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </span>
          );
        })}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleInputKeyDown}
          onBlur={handleBlur}
          placeholder={emails.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] bg-transparent border-0 outline-none px-1 py-1 text-sm"
        />
      </div>
    </div>
  );
}

export default function PaymentLinksPage() {
  const [paymentType, setPaymentType] = useState<PaymentType>('ADHOC_PAYMENT');
  const [activeMethod, setActiveMethod] = useState<GenerationMethod>('copy');
  const [countries, setCountries] = useState<Country[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [generatedLink, setGeneratedLink] = useState<AdhocRequest | null>(null);
  const [formData, setFormData] = useState({
    countryId: '',
    label: '',
    description: '',
    price: '',
    currencyId: '',
    discountProgramIds: [] as string[],
  });
  
  // Invoice-specific form data
  const [invoiceData, setInvoiceData] = useState({
    countryId: '',
    currencyId: '',
    currencyCode: '', // Store currency code when currency is selected
    tax: '',
    discountPercentage: '',
    amountPaid: '',
    dueDate: '',
    billTo: {
      name: '',
      email: '',
      address: '',
    },
    notes: '',
    lineItems: [{ date: '', service: '', description: '', qty: '1', rate: '' }] as InvoiceLineItem[],
  });
  
  // Additional form data for email and customer methods
  const [emailData, setEmailData] = useState({
    recipients: [] as string[],
    cc: [] as string[],
    bcc: [FINANCE_EMAIL] as string[], // Prepopulate with fixed BCC
    message: '',
  });
  
  const [emailTemplate, setEmailTemplate] = useState<string>(DEFAULT_PAYMENT_LINK_EMAIL_TEMPLATE);
  const [emailTemplateTitle, setEmailTemplateTitle] = useState<string>('');
  const [invoiceEmailTemplate, setInvoiceEmailTemplate] = useState<string>('');
  const [invoiceEmailTemplateTitle, setInvoiceEmailTemplateTitle] = useState<string>('');
  const [notificationTemplate, setNotificationTemplate] = useState<MessageTemplate | null>(null);
  const [templateLoaded, setTemplateLoaded] = useState(false);
  
  const [customerData, setCustomerData] = useState({
    customerId: '',
  });
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const prevCustomerEmailRef = useRef<string>(''); // track previous customer email to avoid duplicates/partials

  useEffect(() => {
    loadCountries();
    loadCurrencies();
    loadEmailTemplate();
    if (activeMethod === 'customer') {
      loadCustomers();
    }
  }, [activeMethod]);

  // Prepopulate recipients with a valid customer email (non-removable) and enforce finance BCC.
  // Also clean out any invalid/partial emails and remove the previous customer email when it changes.
  useEffect(() => {
    if (activeMethod !== 'email') return;

    const financeEmail = FINANCE_EMAIL;

    // Keep only valid emails
    let recipients = emailData.recipients.filter(isValidEmail);
    let bcc = emailData.bcc.filter(isValidEmail);

    // Remove previous customer email if present (so we don't accumulate)
    const prevCustomer = prevCustomerEmailRef.current;
    if (prevCustomer) {
      recipients = recipients.filter(r => r !== prevCustomer);
    }

    // Add current customer email if valid
    let currentCustomer = '';
    if (paymentType === 'INVOICE' && invoiceData.billTo.email) {
      const customerEmail = invoiceData.billTo.email.trim();
      if (isValidEmail(customerEmail)) {
        currentCustomer = customerEmail;
        if (!recipients.includes(customerEmail)) {
          recipients = [customerEmail, ...recipients.filter(r => r !== customerEmail)];
        }
      }
    }
    prevCustomerEmailRef.current = currentCustomer;

    // Ensure finance BCC is always present
    if (!bcc.includes(financeEmail)) {
      bcc = [financeEmail, ...bcc.filter(e => e !== financeEmail)];
    }

    const updates: Partial<typeof emailData> = {};
    if (JSON.stringify(recipients) !== JSON.stringify(emailData.recipients)) {
      updates.recipients = recipients;
    }
    if (JSON.stringify(bcc) !== JSON.stringify(emailData.bcc)) {
      updates.bcc = bcc;
    }

    if (Object.keys(updates).length > 0) {
      setEmailData(prev => ({ ...prev, ...updates }));
    }
  }, [paymentType, invoiceData.billTo.email, activeMethod, emailData.recipients, emailData.bcc]);

  // Close customer dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
        setIsCustomerDropdownOpen(false);
      }
    };

    if (isCustomerDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isCustomerDropdownOpen]);

  // Auto-resize description textareas when line items change
  useEffect(() => {
    if (paymentType === 'INVOICE') {
      // Use requestAnimationFrame to ensure DOM is fully rendered
      requestAnimationFrame(() => {
        invoiceData.lineItems.forEach((_, index) => {
          const textarea = document.querySelector(`textarea[data-line-item-index="${index}"]`) as HTMLTextAreaElement;
          if (textarea) {
            // Measure a nearby input in the same row to get exact height
            const row = textarea.closest('tr');
            const input = row?.querySelector('input[type="date"], input[type="text"], input[type="number"]') as HTMLInputElement;
            const inputHeight = input ? input.offsetHeight : 28;
            
            textarea.style.height = 'auto';
            textarea.style.height = `${Math.max(inputHeight, textarea.scrollHeight)}px`;
          }
        });
      });
    }
  }, [invoiceData.lineItems, paymentType]);

  const loadCountries = async () => {
    try {
      const response: ApiResponse<Country[]> = await countryService.list({ limit: 100 });
      setCountries(response.data);
    } catch (err) {
      console.error('Failed to load countries:', err);
    }
  };

  const loadCurrencies = async () => {
    try {
      const response: ApiResponse<Currency[]> = await currencyService.list({ limit: 100 });
      setCurrencies(response.data);
    } catch (err) {
      console.error('Failed to load currencies:', err);
    }
  };

  const loadCustomers = async () => {
    try {
      const response: ApiResponse<Customer[]> = await customerService.list({ limit: 100 });
      setCustomers(response.data);
    } catch (err) {
      console.error('Failed to load customers:', err);
    }
  };

  const loadEmailTemplate = async () => {
    if (templateLoaded) return;
    try {
      // Load the payment link email template by code
      const response: ApiResponse<MessageTemplate[]> = await messageTemplateService.list({ code: 'PAYMENT_LINK' });
      const emailTemplate = response.data.find(
        t => t.type?.toUpperCase() === 'EMAIL' && t.code === 'PAYMENT_LINK'
      );
      if (emailTemplate) {
        if (emailTemplate.content) {
          // Convert <br> back to \n for editing
          const contentForEdit = emailTemplate.content.replace(/<br\s*\/?>/gi, '\n');
          setEmailTemplate(contentForEdit);
        }
        if (emailTemplate.title) {
          setEmailTemplateTitle(emailTemplate.title);
        }
      }
      
      // Load the payment link notification template
      const notificationTemplate = response.data.find(
        t => t.type?.toUpperCase() === 'NOTIFICATION' && t.code === 'PAYMENT_LINK'
      );
      if (notificationTemplate) {
        setNotificationTemplate(notificationTemplate);
      } else {
        console.log('Notification template not found. Available templates:', response.data.map(t => ({ type: t.type, code: t.code })));
      }
      
      // Load the invoice email template (optional - if it doesn't exist, we'll use the default)
      try {
        const invoiceResponse: ApiResponse<MessageTemplate[]> = await messageTemplateService.list({ code: 'INVOICE_PAYMENT_LINK' });
        const invoiceTemplate = invoiceResponse.data.find(
          t => t.type?.toUpperCase() === 'EMAIL' && t.code === 'INVOICE_PAYMENT_LINK'
        );
        if (invoiceTemplate) {
          if (invoiceTemplate.content) {
            setInvoiceEmailTemplate(invoiceTemplate.content);
          }
          if (invoiceTemplate.title) {
            setInvoiceEmailTemplateTitle(invoiceTemplate.title);
          }
        }
      } catch (invoiceErr) {
        // Invoice template doesn't exist yet - that's okay, we'll use the default
        console.log('Invoice email template not found, will use default payment link template:', invoiceErr);
      }
      
      setTemplateLoaded(true);
    } catch (err) {
      // If template doesn't exist or endpoint fails, use default
      console.error('Failed to load email template, using default:', err);
      setTemplateLoaded(true);
    }
  };

  const getSupportedCurrencies = (countryId: string): Currency[] => {
    if (!countryId) return currencies;
    const country = countries.find(c => c.id === countryId);
    if (!country) return currencies;
    
    const supportedCurrencyCodes = country.currencies.map(c => 
      typeof c === 'string' ? c : c.code
    );
    
    return currencies.filter(c => supportedCurrencyCodes.includes(c.code));
  };

  const generatePaymentLink = async (): Promise<AdhocRequest> => {
    // validUntil: use epoch millis at 00:00 (no time component) for API compatibility
    let validUntil: number | undefined;
    if (paymentType === 'INVOICE' && invoiceData.dueDate) {
      const dueDate = new Date(invoiceData.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      validUntil = dueDate.getTime();
    } else {
      // Default: 2 weeks from now, truncated to midnight
      const futureDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      futureDate.setHours(0, 0, 0, 0);
      validUntil = futureDate.getTime();
    }

    let payload: CreateAdhocRequestPayload;

    if (paymentType === 'INVOICE') {
      // Calculate balance using new formula:
      // total_item_price = sum of (qty * rate) for all line items
      const totalItemPrice = invoiceData.lineItems.reduce((sum, item) => {
        const qty = parseFloat(item.qty) || 0;
        const rate = parseFloat(item.rate) || 0;
        return sum + (qty * rate);
      }, 0);
      
      // discount_amount = total_item_price * (discountPercentage / 100)
      // Applied BEFORE tax
      const discountPercent = parseFloat(invoiceData.discountPercentage) || 0;
      const discountAmount = totalItemPrice * (discountPercent / 100);
      
      // after_discount = total_item_price - discount
      const afterDiscount = totalItemPrice - discountAmount;
      
      // tax (fixed amount)
      const taxAmount = parseFloat(invoiceData.tax) || 0;
      
      // subtotal = after_discount + tax
      const subtotal = afterDiscount + taxAmount;
      
      // amount_paid
      const amountPaid = parseFloat(invoiceData.amountPaid) || 0;
      
      // balance = subtotal - amount_paid
      const total = subtotal - amountPaid;

      // For invoice, use the total as the price
      payload = {
        countryId: invoiceData.countryId,
        label: `Invoice - ${new Date().toLocaleDateString()}`,
        description: `Invoice with ${invoiceData.lineItems.length} line item(s)`,
        pricingInfo: {
          price: Number(total),
          currency: invoiceData.currencyId,
        },
        discountProgramIds: undefined,
        customerId: activeMethod === 'customer' ? customerData.customerId : undefined,
        validUntil: validUntil,
      };
    } else {
      // ADHOC_PAYMENT - original logic
      payload = {
      countryId: formData.countryId,
      label: formData.label,
      description: formData.description || undefined,
      pricingInfo: {
          price: Number(formData.price),
        currency: formData.currencyId,
      },
      discountProgramIds: formData.discountProgramIds.length > 0 ? formData.discountProgramIds : undefined,
      customerId: activeMethod === 'customer' ? customerData.customerId : undefined,
        validUntil: validUntil,
    };
    }

    const response: ApiResponse<AdhocRequest> = await paymentLinkService.generate(payload);
    return response.data;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      setGeneratedLink(null);

      const link = await generatePaymentLink();
      setGeneratedLink(link);

      // Construct payment link URL using base URL
      const paymentLinkUrl = `${PAYMENT_LINK_BASE_URL}/adhoc-payments/${link.paymentToken}`;

      // Handle different methods
      if (activeMethod === 'copy') {
        setSuccess('Payment link generated successfully! You can copy it below.');
      } else if (activeMethod === 'email') {
        // Send email with payment link
        const recipients = emailData.recipients.filter(isValidEmail);
        const cc = emailData.cc.length > 0 ? emailData.cc.filter(isValidEmail) : undefined;
        const bcc = emailData.bcc.length > 0 ? emailData.bcc.filter(isValidEmail) : undefined;
        
        // Get data based on payment type
        let label: string;
        let description: string;
        let price: string;
        let currencyCode: string;
        
        if (paymentType === 'INVOICE') {
          label = `Invoice - ${new Date().toLocaleDateString()}`;
          description = `Invoice with ${invoiceData.lineItems.length} line item(s)`;
          price = calculateInvoiceTotal().toFixed(2);
          // Use stored currencyCode, fallback to lookup if not set
          currencyCode = invoiceData.currencyCode || currencies.find(c => c.id === invoiceData.currencyId)?.code || '';
        } else {
          label = formData.label;
          description = formData.description;
          price = formData.price;
          const selectedCurrency = currencies.find(c => c.id === formData.currencyId);
          currencyCode = selectedCurrency?.code || '';
        }
        
        // Helper function to strip HTML document structure tags (DOCTYPE, html, head, body) from email templates
        const stripHtmlDocumentTags = (html: string): string => {
          return html
            .replace(/<!DOCTYPE[^>]*>/gi, '')
            .replace(/<html[^>]*>/gi, '')
            .replace(/<\/html>/gi, '')
            .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
            .replace(/<body[^>]*>/gi, '')
            .replace(/<\/body>/gi, '')
            .trim();
        };
        
        // Use custom message if provided, otherwise render the template
        let emailContent: string;
        let templateToUse: string;
        let templateTitle: string;
        
        if (paymentType === 'INVOICE') {
          templateToUse = emailData.message || invoiceEmailTemplate || emailTemplate;
          templateTitle = invoiceEmailTemplateTitle || emailTemplateTitle;
        } else {
          templateToUse = emailData.message || emailTemplate;
          templateTitle = emailTemplateTitle;
        }
        
        // Strip HTML document tags if present (email templates should only contain body content)
        templateToUse = stripHtmlDocumentTags(templateToUse);
        
        // Check if template contains placeholders (indicating it's a template, not custom text)
        const hasPlaceholders = templateToUse.includes('{{label}}') || 
                                templateToUse.includes('{{url}}') || 
                                templateToUse.includes('{{price}}') ||
                                templateToUse.includes('{{invoice_number}}') ||
                                templateToUse.includes('{{lineItems}}');
        
        if (hasPlaceholders) {
          if (paymentType === 'INVOICE') {
            // For invoices, render with invoice-specific placeholders
          emailContent = renderEmailTemplate(templateToUse, {
              label,
              description,
            url: paymentLinkUrl,
            validUntil: link.validUntil,
              price,
            currency: currencyCode,
              invoice_number: `INV-${Date.now()}`,
              date: new Date().toLocaleDateString(),
              customer_name: invoiceData.billTo.name,
              customer_email_address: invoiceData.billTo.email,
              customer_address: invoiceData.billTo.address,
              due_date: invoiceData.dueDate ? new Date(invoiceData.dueDate).toLocaleDateString() : '',
              notes: invoiceData.notes,
              terms: calculateTerms(),
              subtotal: formatNumber(calculateInvoiceSubtotal()),
              tax: formatNumber(calculateInvoiceTax()),
              discount_percentage: invoiceData.discountPercentage || '0',
              discount_amount: formatNumber(calculateInvoiceDiscount()),
              amount_paid: formatNumber(calculateInvoiceAmountPaid()),
              balance_due: formatNumber(calculateInvoiceTotal()),
              total: formatNumber(calculateInvoiceTotal()),
              lineItems: `
                <table style="width: 100%; border-collapse: collapse; margin: 1em 0;">
                  <thead>
                    <tr style="background-color: #f0f0f0;">
                      <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Date</th>
                      <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Service</th>
                      <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Description</th>
                      <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Qty</th>
                      <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Rate</th>
                      <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${invoiceData.lineItems.map((item, idx) => {
                      const qty = parseFloat(item.qty) || 0;
                      const rate = parseFloat(item.rate) || 0;
                      const amount = qty * rate;
                      return `
                        <tr>
                          <td style="padding: 8px; border: 1px solid #ddd;">${item.date || ''}</td>
                          <td style="padding: 8px; border: 1px solid #ddd;">${item.service || ''}</td>
                          <td style="padding: 8px; border: 1px solid #ddd;">${item.description || ''}</td>
                          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formatNumber(qty)}</td>
                          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${currencyCode} ${formatNumber(rate)}</td>
                          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${currencyCode} ${formatNumber(amount)}</td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              `,
            });
          } else {
            emailContent = renderEmailTemplate(templateToUse, {
              label,
              description,
              url: paymentLinkUrl,
              validUntil: link.validUntil,
              price,
              currency: currencyCode,
            });
          }
        } else {
          // Use as-is (custom message without placeholders)
          emailContent = templateToUse;
        }
        
        // Convert newlines to <br> for email content
        const formattedContent = emailContent.replace(/\n/g, '<br>');
        
        // Use template title as subject (render placeholders if present), or fallback
        let emailSubject = templateTitle || `Payment Link: ${label}`;
        if (templateTitle && templateTitle.includes('{{label}}')) {
          emailSubject = templateTitle.replace(/\{\{label\}\}/g, label);
        }
        
        if (paymentType === 'INVOICE') {
          // Build offline invoice payload and let backend send the email using the INVOICE_PAYMENT_LINK template content
          const invoiceDate = new Date();
          const validUntilDate = invoiceData.dueDate ? new Date(invoiceData.dueDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
          
          const offlinePayload: CreateOfflineInvoicePayload = {
            invoiceInfo: {
              date: invoiceDate.getTime(),
              validUntil: validUntilDate.getTime(),
              terms: calculateTerms() || undefined,
              items: invoiceData.lineItems.map(item => ({
                date: item.date ? new Date(item.date).getTime() : invoiceDate.getTime(),
                service: item.service,
                description: item.description,
                quantity: parseInt(item.qty) || 0,
                rate: parseFloat(item.rate) || 0,
              })),
              notes: invoiceData.notes || undefined,
              tax: parseFloat(invoiceData.tax) || 0,
              discountRate: (parseFloat(invoiceData.discountPercentage) || 0) / 100,
              amountPaid: parseFloat(invoiceData.amountPaid) || 0,
              currencyId: invoiceData.currencyId,
              countryId: invoiceData.countryId,
              customerInfo: {
                name: invoiceData.billTo.name,
                address: invoiceData.billTo.address,
                emailAddress: invoiceData.billTo.email,
              },
            },
            emailInfo: {
              content: formattedContent,
              recipients,
              ccRecipients: cc,
              bccRecipients: bcc,
              subject: emailSubject,
            },
          };

          await offlineInvoiceService.create(offlinePayload);
          setSuccess(`Offline invoice created and emailed to ${recipients.length} recipient(s)!`);
        } else {
          // Use new mail compose API for adhoc payments (supports bcc/cc)
          await notifierService.composeEmail({
          recipients,
          subject: emailSubject,
          content: formattedContent,
            format: 'html',
            ccRecipients: cc,
            bccRecipients: bcc,
        });
        
          setSuccess(`Payment link generated and sent via email to ${recipients.length} recipient(s)!`);
        }
      } else if (activeMethod === 'customer') {
        // Customer ID is already included in the initial POST call
        const customer = customers.find(c => c.id === customerData.customerId);
        const customerName = customer 
          ? [customer.firstName, customer.otherNames, customer.lastName].filter(Boolean).join(' ') || customer.emailAddress || 'Customer'
          : 'Customer';
        
        // Get data based on payment type
        let label: string;
        let description: string;
        let price: string;
        let currencyCode: string;
        
        if (paymentType === 'INVOICE') {
          label = `Invoice - ${new Date().toLocaleDateString()}`;
          description = `Invoice with ${invoiceData.lineItems.length} line item(s)`;
          price = calculateInvoiceTotal().toFixed(2);
          // Use stored currencyCode, fallback to lookup if not set
          currencyCode = invoiceData.currencyCode || currencies.find(c => c.id === invoiceData.currencyId)?.code || '';
        } else {
          label = formData.label;
          description = formData.description;
          price = formData.price;
        const selectedCurrency = currencies.find(c => c.id === formData.currencyId);
          currencyCode = selectedCurrency?.code || '';
        }
        
        // 1. Create payment link (already done above)
        // 2. Send notification FIRST using PAYMENT_LINK notification template
        if (notificationTemplate) {
          // Render notification template with placeholders
          let notificationContent = notificationTemplate.content;
          notificationContent = notificationContent.replace(/\{\{label\}\}/g, label);
          notificationContent = notificationContent.replace(/\{\{url\}\}/g, paymentLinkUrl);
          notificationContent = notificationContent.replace(/\{\{validUntil\}\}/g, formatDate(link.validUntil));
          notificationContent = notificationContent.replace(/\{\{price\}\}/g, formatNumber(price));
          notificationContent = notificationContent.replace(/\{\{currency\}\}/g, currencyCode);
          if (description) {
            notificationContent = notificationContent.replace(/\{\{description\}\}/g, description);
          }
          
          // Convert <br> back to \n for notification content (if any)
          notificationContent = notificationContent.replace(/<br\s*\/?>/gi, '\n');
          
          // Get header from template title, or use a default
          let notificationHeader = notificationTemplate.title || label;
          if (notificationHeader.includes('{{label}}')) {
            notificationHeader = notificationHeader.replace(/\{\{label\}\}/g, label);
          }
          
          await notificationService.create({
            header: notificationHeader,
            content: notificationContent,
            recipientId: customerData.customerId,
            type: 'SERVICE_REQUEST',
            source: 'PORTAL',
          });
        }
        
        // 3. Send email to customer using appropriate email template
        if (customer?.emailAddress) {
          let emailContent: string;
          let templateToUse: string;
          let templateTitle: string;
          
          // Helper function to strip HTML document structure tags (DOCTYPE, html, head, body) from email templates
          const stripHtmlDocumentTags = (html: string): string => {
            return html
              .replace(/<!DOCTYPE[^>]*>/gi, '')
              .replace(/<html[^>]*>/gi, '')
              .replace(/<\/html>/gi, '')
              .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
              .replace(/<body[^>]*>/gi, '')
              .replace(/<\/body>/gi, '')
              .trim();
          };

          if (paymentType === 'INVOICE') {
            templateToUse = invoiceEmailTemplate || emailTemplate;
            templateTitle = invoiceEmailTemplateTitle || emailTemplateTitle;
          } else {
            templateToUse = emailTemplate;
            templateTitle = emailTemplateTitle;
          }
          
          // Strip HTML document tags if present
          templateToUse = stripHtmlDocumentTags(templateToUse);
          
          // Check if template contains placeholders
          const hasPlaceholders = templateToUse.includes('{{label}}') || 
                                  templateToUse.includes('{{url}}') || 
                                  templateToUse.includes('{{price}}') ||
                                  templateToUse.includes('{{invoice_number}}');
          
          if (hasPlaceholders) {
            if (paymentType === 'INVOICE') {
              // For invoices, render with invoice-specific placeholders
              // Use stored currencyCode, fallback to lookup if not set
              if (!currencyCode) {
                currencyCode = invoiceData.currencyCode || currencies.find(c => c.id === invoiceData.currencyId)?.code || '';
              }
              emailContent = renderEmailTemplate(templateToUse, {
                label,
                description,
            url: paymentLinkUrl,
            validUntil: link.validUntil,
                price,
            currency: currencyCode,
                currency_code: currencyCode,
                invoice_number: `INV-${Date.now()}`,
                date: new Date().toLocaleDateString(),
                customer_name: invoiceData.billTo.name || customerName,
                customer_email_address: invoiceData.billTo.email || customer.emailAddress,
                customer_address: invoiceData.billTo.address,
                due_date: invoiceData.dueDate ? new Date(invoiceData.dueDate).toLocaleDateString() : '',
                notes: invoiceData.notes,
                terms: calculateTerms(),
                subtotal: formatNumber(calculateInvoiceSubtotal()),
                tax: formatNumber(calculateInvoiceTax()),
                discount_percentage: invoiceData.discountPercentage || '0',
                discount_amount: formatNumber(calculateInvoiceDiscount()),
                amount_paid: formatNumber(calculateInvoiceAmountPaid()),
                balance_due: formatNumber(calculateInvoiceTotal()),
                total: formatNumber(calculateInvoiceTotal()),
              });
            } else {
              emailContent = renderEmailTemplate(templateToUse, {
                label,
                description,
                url: paymentLinkUrl,
                validUntil: link.validUntil,
                price,
                currency: currencyCode,
              });
            }
          } else {
            emailContent = templateToUse;
          }
          
          // Convert newlines to <br> for email content
          const formattedEmailContent = emailContent.replace(/\n/g, '<br>');
          
          // Use template title as subject (render placeholders if present), or fallback
          let emailSubject = templateTitle || `Payment Link: ${label}`;
          if (templateTitle && templateTitle.includes('{{label}}')) {
            emailSubject = templateTitle.replace(/\{\{label\}\}/g, label);
          }
          
          // Use new mail compose API for adhoc payments (supports bcc/cc)
          // For customer method, we don't have bcc/cc from form, but use new API for consistency
          if (paymentType === 'INVOICE') {
            // For invoices, use old API (handled by offlineInvoiceService)
          await notifierService.sendEmail({
            recipients: [customer.emailAddress],
            subject: emailSubject,
            content: formattedEmailContent,
            });
          } else {
            // For adhoc payments, use new compose API
            await notifierService.composeEmail({
              recipients: [customer.emailAddress],
              subject: emailSubject,
              content: formattedEmailContent,
              format: 'html',
            });
          }
        }
        
        setSuccess(`Payment link generated and sent to ${customerName} via app!`);
      }
      
      // Reset form
      if (paymentType === 'INVOICE') {
        setInvoiceData({
          countryId: '',
          currencyId: '',
          currencyCode: '',
          tax: '',
          discountPercentage: '',
          amountPaid: '',
          dueDate: '',
          billTo: {
            name: '',
            email: '',
            address: '',
          },
          notes: '',
          lineItems: [{ date: '', service: '', description: '', qty: '1', rate: '' }],
        });
      } else {
      setFormData({
        countryId: '',
        label: '',
        description: '',
        price: '',
        currencyId: '',
        discountProgramIds: [],
      });
      }
      setEmailData({ recipients: [], cc: [], bcc: [FINANCE_EMAIL], message: '' });
      setCustomerData({ customerId: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate payment link');
    } finally {
      setLoading(false);
    }
  };

  const supportedCurrencies = getSupportedCurrencies(formData.countryId);
  const invoiceSupportedCurrencies = getSupportedCurrencies(invoiceData.countryId);

  // Invoice line item management
  const addInvoiceLineItem = () => {
    setInvoiceData({
      ...invoiceData,
      lineItems: [...invoiceData.lineItems, { date: '', service: '', description: '', qty: '1', rate: '' }],
    });
  };

  const removeInvoiceLineItem = (index: number) => {
    if (invoiceData.lineItems.length > 1) {
      setInvoiceData({
        ...invoiceData,
        lineItems: invoiceData.lineItems.filter((_, i) => i !== index),
      });
    }
  };

  const updateInvoiceLineItem = (index: number, field: keyof InvoiceLineItem, value: string) => {
    const updatedLineItems = [...invoiceData.lineItems];
    updatedLineItems[index] = { ...updatedLineItems[index], [field]: value };
    setInvoiceData({ ...invoiceData, lineItems: updatedLineItems });
    
    // Auto-resize description textarea if it's the description field
    if (field === 'description') {
      setTimeout(() => {
        const textarea = document.querySelector(`textarea[data-line-item-index="${index}"]`) as HTMLTextAreaElement;
        if (textarea) {
          // Measure a nearby input to get exact height
          const row = textarea.closest('tr');
          const input = row?.querySelector('input[type="date"], input[type="text"], input[type="number"]') as HTMLInputElement;
          const inputHeight = input ? input.offsetHeight : 28;
          
          textarea.style.height = 'auto';
          textarea.style.height = `${Math.max(inputHeight, textarea.scrollHeight)}px`;
        }
      }, 0);
    }
  };

  // Calculate invoice totals
  // total_item_price = sum of (qty * rate) for all line items
  const calculateInvoiceItemTotal = () => {
    return invoiceData.lineItems.reduce((sum, item) => {
      const qty = parseFloat(item.qty) || 0;
      const rate = parseFloat(item.rate) || 0;
      return sum + (qty * rate);
    }, 0);
  };

  const calculateInvoiceTax = () => {
    return parseFloat(invoiceData.tax) || 0;
  };

  // discount_amount = total_item_price * (discountPercentage / 100)
  // Applied BEFORE tax
  const calculateInvoiceDiscount = () => {
    const totalItemPrice = calculateInvoiceItemTotal();
    const discountPercent = parseFloat(invoiceData.discountPercentage) || 0;
    return totalItemPrice * (discountPercent / 100);
  };

  // subtotal = (total_item_price - discount) + tax
  // Discount is applied before tax
  const calculateInvoiceSubtotal = () => {
    const totalItemPrice = calculateInvoiceItemTotal();
    const discount = calculateInvoiceDiscount();
    const tax = calculateInvoiceTax();
    return (totalItemPrice - discount) + tax;
  };

  const calculateInvoiceAmountPaid = () => {
    return parseFloat(invoiceData.amountPaid) || 0;
  };

  // Calculate terms from due date: "Net X days" where X = days from today to due date
  const calculateTerms = (): string => {
    if (!invoiceData.dueDate) {
      return '';
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(invoiceData.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    
    // Calculate difference in days
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Only calculate if due date is today or in the future
    if (diffDays >= 0) {
      // Special case: same day (0 days) = "Due Upon Receipt"
      if (diffDays === 0) {
        return 'Due Upon Receipt';
      }
      // Handle singular/plural: "day" for 1, "days" for 2+
      const dayText = diffDays === 1 ? 'day' : 'days';
      return `Net ${diffDays} ${dayText}`;
    }
    return '';
  };

  // balance = subtotal - discount - amount_paid
  // balance = subtotal - amount_paid
  // Where subtotal = (total_item_price - discount) + tax
  const calculateInvoiceTotal = () => {
    const subtotal = calculateInvoiceSubtotal();
    const amountPaid = calculateInvoiceAmountPaid();
    return subtotal - amountPaid;
  };

  // Generate email/notification preview
  const generateEmailPreview = () => {
    // Use a mock payment link URL for preview (since we don't have a real one yet)
    const mockPaymentLinkUrl = `${PAYMENT_LINK_BASE_URL}/adhoc-payments/[payment-token-will-be-generated]`;
    // Create a date 2 weeks (14 days) from now and format it like the API would return
    const futureDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const day = String(futureDate.getDate()).padStart(2, '0');
    const month = String(futureDate.getMonth() + 1).padStart(2, '0');
    const year = futureDate.getFullYear();
    const hours = String(futureDate.getHours()).padStart(2, '0');
    const minutes = String(futureDate.getMinutes()).padStart(2, '0');
    const seconds = String(futureDate.getSeconds()).padStart(2, '0');
    const mockValidUntil = `${day}/${month}/${year}, ${hours}:${minutes}:${seconds}`;
    
    // Get data based on payment type
    let label: string;
    let description: string;
    let price: string;
    let currencyCode: string;
    
    if (paymentType === 'INVOICE') {
      label = `Invoice - ${new Date().toLocaleDateString()}`;
      description = `Invoice with ${invoiceData.lineItems.length} line item(s)`;
      price = calculateInvoiceTotal().toFixed(2);
      // Use stored currencyCode, fallback to lookup if not set
      currencyCode = invoiceData.currencyCode || currencies.find(c => c.id === invoiceData.currencyId)?.code || '';
    } else {
      label = formData.label || '[Service Name]';
      description = formData.description || '';
      price = formData.price || '0';
      const selectedCurrency = currencies.find(c => c.id === formData.currencyId);
      currencyCode = selectedCurrency?.code || '';
    }
    
    // Determine which template to use based on method
    let templateToUse: string;
    let recipients: string[] = [];
    let isNotification = false;
    let header: string;
    
    if (activeMethod === 'email') {
      // Use custom message if provided, otherwise use template
      // For invoices, use invoice email template
      // Helper function to strip HTML document structure tags (DOCTYPE, html, head, body) from email templates
      const stripHtmlDocumentTags = (html: string): string => {
        return html
          .replace(/<!DOCTYPE[^>]*>/gi, '')
          .replace(/<html[^>]*>/gi, '')
          .replace(/<\/html>/gi, '')
          .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
          .replace(/<body[^>]*>/gi, '')
          .replace(/<\/body>/gi, '')
          .trim();
      };

      if (paymentType === 'INVOICE') {
        templateToUse = emailData.message || invoiceEmailTemplate || emailTemplate;
        header = invoiceEmailTemplateTitle || emailTemplateTitle || `Payment Link: ${label}`;
        if (invoiceEmailTemplateTitle && invoiceEmailTemplateTitle.includes('{{label}}')) {
          header = invoiceEmailTemplateTitle.replace(/\{\{label\}\}/g, label);
        }
      } else {
        templateToUse = emailData.message || emailTemplate;
        header = emailTemplateTitle || `Payment Link: ${label}`;
        if (emailTemplateTitle && emailTemplateTitle.includes('{{label}}')) {
          header = emailTemplateTitle.replace(/\{\{label\}\}/g, label);
        }
      }
      
      // Strip HTML document tags if present
      templateToUse = stripHtmlDocumentTags(templateToUse);
      recipients = emailData.recipients.filter(Boolean);
    } else if (activeMethod === 'customer') {
      // Use notification template for customer method
      if (!notificationTemplate) {
        return null; // No preview if no notification template
      }
      isNotification = true;
      templateToUse = notificationTemplate.content || '';
      header = notificationTemplate.title || label;
      if (notificationTemplate.title && notificationTemplate.title.includes('{{label}}')) {
        header = notificationTemplate.title.replace(/\{\{label\}\}/g, label);
      }
      const customer = customers.find(c => c.id === customerData.customerId);
      if (customer?.emailAddress) {
        recipients = [customer.emailAddress];
      }
    } else {
      templateToUse = emailTemplate;
      header = emailTemplateTitle || `Payment Link: ${label}`;
    }
    
    // Check if template contains placeholders
    const hasPlaceholders = templateToUse.includes('{{label}}') || 
                            templateToUse.includes('{{url}}') || 
                            templateToUse.includes('{{price}}');
    
    let content: string;
    if (hasPlaceholders) {
      if (isNotification) {
        // For notifications, use the same replacement logic as in handleSubmit
        content = templateToUse;
        content = content.replace(/\{\{label\}\}/g, label);
        content = content.replace(/\{\{url\}\}/g, mockPaymentLinkUrl);
        content = content.replace(/\{\{validUntil\}\}/g, formatDate(mockValidUntil));
        content = content.replace(/\{\{price\}\}/g, formatNumber(price));
        content = content.replace(/\{\{currency\}\}/g, currencyCode);
        if (description) {
          content = content.replace(/\{\{description\}\}/g, description);
        }
        // Convert <br> back to \n for notification content (if any)
        content = content.replace(/<br\s*\/?>/gi, '\n');
      } else {
        // For emails, use renderEmailTemplate
        if (paymentType === 'INVOICE') {
          // For invoices, include invoice-specific placeholders
          const invoiceNumber = `INV-${Date.now()}`;
          const invoiceDate = new Date().toLocaleDateString();
          const subtotal = calculateInvoiceSubtotal();
          const tax = calculateInvoiceTax();
          const total = calculateInvoiceTotal();
          
          // Format line items as HTML table or text
          const lineItemsHtml = invoiceData.lineItems.map((item, idx) => {
            const qty = parseFloat(item.qty) || 0;
            const rate = parseFloat(item.rate) || 0;
            const amount = qty * rate;
            return `
              <tr>
                <td>${item.date || ''}</td>
                <td>${item.service || ''}</td>
                <td>${item.description || ''}</td>
                <td style="text-align: right;">${formatNumber(qty)}</td>
                <td style="text-align: right;">${currencyCode} ${formatNumber(rate)}</td>
                <td style="text-align: right;">${currencyCode} ${formatNumber(amount)}</td>
              </tr>
            `;
          }).join('');
          
          const lineItemsTable = `
            <table style="width: 100%; border-collapse: collapse; margin: 1em 0;">
              <thead>
                <tr style="background-color: #f0f0f0;">
                  <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Date</th>
                  <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Service</th>
                  <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Description</th>
                  <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Qty</th>
                  <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Rate</th>
                  <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${lineItemsHtml}
              </tbody>
            </table>
          `;
          
          content = renderEmailTemplate(templateToUse, {
            label,
            description,
            url: mockPaymentLinkUrl,
            validUntil: mockValidUntil,
            price,
            currency: currencyCode,
            currency_code: currencyCode,
            invoice_number: invoiceNumber,
            date: invoiceDate,
            customer_name: invoiceData.billTo.name || 'Customer Name',
            customer_email_address: invoiceData.billTo.email || 'customer@example.com',
            customer_address: invoiceData.billTo.address || '',
            due_date: invoiceData.dueDate ? new Date(invoiceData.dueDate).toLocaleDateString() : '',
            notes: invoiceData.notes,
            terms: calculateTerms(),
            subtotal: formatNumber(subtotal),
            tax: formatNumber(tax),
            discount_percentage: invoiceData.discountPercentage || '0',
            discount_amount: formatNumber(subtotal * (parseFloat(invoiceData.discountPercentage) || 0) / 100),
            amount_paid: formatNumber(calculateInvoiceAmountPaid()),
            balance_due: formatNumber(total),
            total: formatNumber(total),
            lineItems: lineItemsTable,
          });
        } else {
          content = renderEmailTemplate(templateToUse, {
            label,
            description,
            url: mockPaymentLinkUrl,
            validUntil: mockValidUntil,
            price,
            currency: currencyCode,
          });
        }
      }
    } else {
      content = templateToUse;
    }
    
    return {
      subject: header,
      content,
      recipients,
      isNotification,
    };
  };

  // Tab content for Copy method
  const copyTabContent = (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Generate a payment link and copy it to share manually.
      </p>
      {generatedLink && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 dark:border-blue-800 dark:bg-blue-900/20">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-4">
            Payment Link Generated
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-blue-800 dark:text-blue-300">Payment Token:</span>
              <span className="font-mono font-medium text-blue-900 dark:text-blue-100">{generatedLink.paymentToken}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-800 dark:text-blue-300">URL:</span>
              <span className="font-mono text-blue-900 dark:text-blue-100 break-all">{`${PAYMENT_LINK_BASE_URL}/adhoc-payments/${generatedLink.paymentToken}`}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-800 dark:text-blue-300">Status:</span>
              <span className="text-blue-900 dark:text-blue-100">{generatedLink.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-800 dark:text-blue-300">Valid Until:</span>
              <span className="text-blue-900 dark:text-blue-100">{generatedLink.validUntil}</span>
            </div>
            <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-700">
              <button
                onClick={() => {
                  const paymentLinkUrl = `${PAYMENT_LINK_BASE_URL}/adhoc-payments/${generatedLink.paymentToken}`;
                  navigator.clipboard.writeText(paymentLinkUrl);
                  setSuccess('URL copied to clipboard!');
                }}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                Copy URL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Tab content for Email method
  const emailTabContent = (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Generate a payment link and send it via email to one or more recipients.
      </p>
      <div className="space-y-4">
        <EmailTagInput
          emails={emailData.recipients}
          onChange={(emails) => setEmailData({ ...emailData, recipients: emails })}
          placeholder="Type email and press Enter or comma"
          fixedEmails={
            paymentType === 'INVOICE' && invoiceData.billTo.email && isValidEmail(invoiceData.billTo.email)
              ? [invoiceData.billTo.email.trim()]
              : []
          }
          label="Recipients"
            required
        />
        <div className="grid grid-cols-2 gap-4">
          <EmailTagInput
            emails={emailData.cc}
            onChange={(emails) => setEmailData({ ...emailData, cc: emails })}
            placeholder="Type email and press Enter or comma"
            label="CC"
          />
          <EmailTagInput
            emails={emailData.bcc}
            onChange={(emails) => setEmailData({ ...emailData, bcc: emails })}
            placeholder="Type email and press Enter or comma"
            fixedEmails={[FINANCE_EMAIL]}
            label="BCC"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Email Template
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowEmailPreview(true)}
                disabled={
                  paymentType === 'INVOICE' 
                    ? (!invoiceData.countryId || !invoiceData.currencyId || invoiceData.lineItems.length === 0)
                    : (!formData.label || !formData.price || !formData.currencyId)
                }
                className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                Preview Email
              </button>
            <button
              type="button"
              onClick={() => {
                  setEmailData({ ...emailData, message: '', cc: [], bcc: [FINANCE_EMAIL] });
              }}
              className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Reset to default
            </button>
            </div>
          </div>
          <textarea
            value={emailData.message || (paymentType === 'INVOICE' ? invoiceEmailTemplate : emailTemplate)}
            onChange={(e) => setEmailData({ ...emailData, message: e.target.value })}
            placeholder={paymentType === 'INVOICE' ? invoiceEmailTemplate : emailTemplate}
            rows={10}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-xs text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Edit the template above or leave as-is to use the default. Placeholders: {'{'}label{'}'}, {'{'}description{'}'}, {'{'}url{'}'}, {'{'}validUntil{'}'}, {'{'}price{'}'}, {'{'}currency{'}'}
            {paymentType === 'INVOICE' && ' For invoices: {'}{'{'}invoice_number{'}'}{'}'}, {'{'}date{'}'}, {'{'}customer_name{'}'}{'}'}, {'{'}customer_email_address{'}'}{'}'}, {'{'}customer_address{'}'}{'}'}, {'{'}due_date{'}'}{'}'}, {'{'}subtotal{'}'}{'}'}, {'{'}tax{'}'}{'}'}, {'{'}total{'}'}{'}'}, {'{'}notes{'}'}{'}'}, {'{'}terms{'}'}{'}'}, {'{'}lineItems{'}'}{'}'}
          </p>
        </div>
      </div>
    </div>
  );

  // Filter customers based on search term
  const filteredCustomers = customers.filter((customer) => {
    if (!customerSearchTerm) return true;
    const searchLower = customerSearchTerm.toLowerCase();
    const name = [customer.firstName, customer.otherNames, customer.lastName]
      .filter(Boolean)
      .join(' ') || '';
    const email = customer.emailAddress || '';
    return name.toLowerCase().includes(searchLower) || email.toLowerCase().includes(searchLower);
  });

  // Get selected customer display name
  const getSelectedCustomerName = () => {
    if (!customerData.customerId) return '';
    const customer = customers.find(c => c.id === customerData.customerId);
    if (!customer) return '';
    const name = [customer.firstName, customer.otherNames, customer.lastName]
      .filter(Boolean)
      .join(' ') || customer.emailAddress || 'Unknown';
    return customer.emailAddress ? `${name} (${customer.emailAddress})` : name;
  };

  // Tab content for Customer method
  const customerTabContent = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Generate a payment link and send it directly to a customer via the app.
      </p>
        {notificationTemplate && (
          <button
            type="button"
            onClick={() => setShowEmailPreview(true)}
            className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Preview
          </button>
        )}
      </div>
      <div className="relative" ref={customerDropdownRef}>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Customer *
        </label>
        <div className="relative">
          <input
            type="text"
            value={isCustomerDropdownOpen ? customerSearchTerm : getSelectedCustomerName()}
            onChange={(e) => {
              setCustomerSearchTerm(e.target.value);
              setIsCustomerDropdownOpen(true);
              if (!e.target.value) {
                setCustomerData({ customerId: '' });
              }
            }}
            onFocus={() => {
              setIsCustomerDropdownOpen(true);
              setCustomerSearchTerm('');
            }}
            placeholder="Search customer by name or email..."
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-10 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
          />
          <button
            type="button"
            onClick={() => {
              setIsCustomerDropdownOpen(!isCustomerDropdownOpen);
              if (!isCustomerDropdownOpen) {
                setCustomerSearchTerm('');
              }
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg
              className={`h-5 w-5 transform transition-transform ${isCustomerDropdownOpen ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
        
        {isCustomerDropdownOpen && (
          <div className="absolute z-10 mt-1 w-full max-h-60 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
            {filteredCustomers.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                No customers found
              </div>
            ) : (
              filteredCustomers.map((customer) => {
                const name = [customer.firstName, customer.otherNames, customer.lastName]
                  .filter(Boolean)
                  .join(' ') || customer.emailAddress || 'Unknown';
                const displayName = customer.emailAddress ? `${name} (${customer.emailAddress})` : name;
                const isSelected = customer.id === customerData.customerId;
                
                return (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => {
                      setCustomerData({ customerId: customer.id });
                      setCustomerSearchTerm('');
                      setIsCustomerDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      isSelected ? 'bg-blue-50 text-blue-900 dark:bg-blue-900/20 dark:text-blue-200' : 'text-gray-900 dark:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{displayName}</span>
                      {isSelected && (
                        <svg className="h-4 w-4 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );

  // Filter tabs based on payment type
  // For INVOICE, only show email option
  const allTabs = [
    {
      id: 'copy',
      label: 'Generate & Copy',
      content: copyTabContent,
    },
    {
      id: 'email',
      label: 'Generate & Email',
      content: emailTabContent,
    },
    {
      id: 'customer',
      label: 'Generate & Send to Customer',
      content: customerTabContent,
    },
  ];
  
  const tabs = paymentType === 'INVOICE' 
    ? allTabs.filter(tab => tab.id === 'email')
    : allTabs;
  
  // If payment type is INVOICE and activeMethod is not email, switch to email
  useEffect(() => {
    if (paymentType === 'INVOICE' && activeMethod !== 'email') {
      setActiveMethod('email');
    }
  }, [paymentType, activeMethod]);

  const getSubmitButtonText = () => {
    if (loading) {
      if (activeMethod === 'copy') return 'Generating...';
      if (activeMethod === 'email') return 'Generating & Sending...';
      if (activeMethod === 'customer') return 'Generating & Sending...';
    }
    if (activeMethod === 'copy') return 'Generate & Copy';
    if (activeMethod === 'email') return 'Generate & Send Email';
    if (activeMethod === 'customer') return 'Generate & Send to Customer';
    return 'Generate Payment Link';
  };

  const isSubmitDisabled = () => {
    if (loading) return true;
    if (activeMethod === 'email') return emailData.recipients.length === 0;
    if (activeMethod === 'customer') return !customerData.customerId;
    if (paymentType === 'INVOICE') {
      // Validate invoice form
      if (!invoiceData.countryId || !invoiceData.currencyId) return true;
      if (!invoiceData.billTo.name || !invoiceData.billTo.email || !invoiceData.billTo.address) return true;
      if (invoiceData.lineItems.some(item => !item.date || !item.service || !item.description || !item.qty || !item.rate)) return true;
    return false;
    } else {
      // Validate adhoc payment form
      if (!formData.countryId || !formData.currencyId || !formData.label || !formData.price) return true;
      return false;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Generate Payment Link
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Create adhoc payment request links for customers
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-lg border border-green-300 bg-green-50 p-4 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200">
            {success}
          </div>
        )}

        {/* Payment Type Selector */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Payment Type *
          </label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="ADHOC_PAYMENT"
                checked={paymentType === 'ADHOC_PAYMENT'}
                onChange={(e) => {
                  setPaymentType(e.target.value as PaymentType);
                  setGeneratedLink(null);
                  setError(null);
                  setSuccess(null);
                }}
                className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Adhoc Payment</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="INVOICE"
                checked={paymentType === 'INVOICE'}
                onChange={(e) => {
                  setPaymentType(e.target.value as PaymentType);
                  setGeneratedLink(null);
                  setError(null);
                  setSuccess(null);
                }}
                className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Invoice</span>
            </label>
          </div>
        </div>

        {/* Main Payment Link Form */}
        <form id="payment-link-form" onSubmit={handleSubmit} className="space-y-6 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          {paymentType === 'ADHOC_PAYMENT' ? (
            <>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Country *
              </label>
              <select
                value={formData.countryId}
                onChange={(e) => {
                  setFormData({ ...formData, countryId: e.target.value, currencyId: '' });
                }}
                required
                className="w-full appearance-none rounded-lg border border-gray-300 bg-white bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.5em_1.5em] bg-[right_0.75rem_center] bg-no-repeat px-3 py-2 pr-10 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
              >
                <option value="">Select Country</option>
                {countries.map((country) => (
                  <option key={country.id} value={country.id}>
                    {country.name} ({country.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Currency *
              </label>
              <select
                value={formData.currencyId}
                onChange={(e) => setFormData({ ...formData, currencyId: e.target.value })}
                required
                disabled={!formData.countryId || supportedCurrencies.length === 0}
                className="w-full appearance-none rounded-lg border border-gray-300 bg-white bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.5em_1.5em] bg-[right_0.75rem_center] bg-no-repeat px-3 py-2 pr-10 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400 dark:disabled:bg-gray-900 dark:disabled:text-gray-400"
              >
                <option value="">
                  {!formData.countryId ? 'Select country first' : supportedCurrencies.length === 0 ? 'No currencies available' : 'Select Currency'}
                </option>
                {supportedCurrencies.map((currency) => (
                  <option key={currency.id} value={currency.id}>
                    {currency.label} ({currency.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Price *
              </label>
              <div className="relative">
                {formData.currencyId && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-600 dark:text-gray-400">
                    {currencies.find(c => c.id === formData.currencyId)?.code || ''}
                  </span>
                )}
                <input
                  type="text"
                  required
                  value={formData.price}
                  onChange={(e) => {
                    // Only allow numbers and decimal point
                    const value = e.target.value.replace(/[^0-9.]/g, '');
                    // Prevent multiple decimal points
                    const parts = value.split('.');
                    const sanitized = parts.length > 2 
                      ? parts[0] + '.' + parts.slice(1).join('')
                      : value;
                    setFormData({ ...formData, price: sanitized });
                  }}
                  onKeyPress={(e) => {
                    // Allow: numbers, decimal point, backspace, delete, tab, escape, enter
                    const char = String.fromCharCode(e.which || e.keyCode);
                    if (!/[0-9.]/.test(char) && !['Backspace', 'Delete', 'Tab', 'Escape', 'Enter'].includes(e.key)) {
                      e.preventDefault();
                    }
                  }}
                  placeholder="e.g., 500.19"
                  className={`w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400 ${formData.currencyId ? 'pl-12' : ''}`}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Label *
            </label>
            <input
              type="text"
              required
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              placeholder="e.g., Third Review of land purchase agreement"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="e.g., Legal services required. #urgent"
              rows={3}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
            />
          </div>
            </>
          ) : (
            <>
              {/* Invoice Form */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Country *
                  </label>
                  <select
                    value={invoiceData.countryId}
                    onChange={(e) => {
                      setInvoiceData({ ...invoiceData, countryId: e.target.value, currencyId: '', currencyCode: '' });
                    }}
                    required
                    className="w-full appearance-none rounded-lg border border-gray-300 bg-white bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.5em_1.5em] bg-[right_0.75rem_center] bg-no-repeat px-3 py-2 pr-10 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                  >
                    <option value="">Select Country</option>
                    {countries.map((country) => (
                      <option key={country.id} value={country.id}>
                        {country.name} ({country.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Currency *
                  </label>
                  <select
                    value={invoiceData.currencyId}
                    onChange={(e) => {
                      const selectedCurrencyId = e.target.value;
                      const selectedCurrency = currencies.find(c => c.id === selectedCurrencyId);
                      setInvoiceData({ 
                        ...invoiceData, 
                        currencyId: selectedCurrencyId,
                        currencyCode: selectedCurrency?.code || ''
                      });
                    }}
                    required
                    disabled={!invoiceData.countryId || invoiceSupportedCurrencies.length === 0}
                    className="w-full appearance-none rounded-lg border border-gray-300 bg-white bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.5em_1.5em] bg-[right_0.75rem_center] bg-no-repeat px-3 py-2 pr-10 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400 dark:disabled:bg-gray-900 dark:disabled:text-gray-400"
                  >
                    <option value="">
                      {!invoiceData.countryId ? 'Select country first' : invoiceSupportedCurrencies.length === 0 ? 'No currencies available' : 'Select Currency'}
                    </option>
                    {invoiceSupportedCurrencies.map((currency) => (
                      <option key={currency.id} value={currency.id}>
                        {currency.label} ({currency.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Due Date */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Due Date (Valid Until)
                </label>
                <input
                  type="datetime-local"
                  value={invoiceData.dueDate}
                  onChange={(e) => setInvoiceData({ ...invoiceData, dueDate: e.target.value })}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                />
              </div>

              {/* Bill To Section */}
              <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">Bill To *</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Customer Name *
                    </label>
                    <input
                      type="text"
                      value={invoiceData.billTo.name}
                      onChange={(e) => setInvoiceData({ 
                        ...invoiceData, 
                        billTo: { ...invoiceData.billTo, name: e.target.value }
                      })}
                      required
                      placeholder="Customer name"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      value={invoiceData.billTo.email}
                      onChange={(e) => setInvoiceData({ 
                        ...invoiceData, 
                        billTo: { ...invoiceData.billTo, email: e.target.value }
                      })}
                      required
                      placeholder="customer@example.com"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Address *
                    </label>
                    <textarea
                      value={invoiceData.billTo.address}
                      onChange={(e) => setInvoiceData({ 
                        ...invoiceData, 
                        billTo: { ...invoiceData.billTo, address: e.target.value }
                      })}
                      required
                      placeholder="Street address, City, State, ZIP"
                      rows={3}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                    />
                  </div>
                </div>
              </div>

              {/* Invoice Line Items Table */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Line Items *
                  </label>
                  <button
                    type="button"
                    onClick={addInvoiceLineItem}
                    className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    + Add Line Item
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="w-32 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700 dark:text-gray-300">Date</th>
                        <th className="w-40 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700 dark:text-gray-300">Service</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700 dark:text-gray-300">Description</th>
                        <th className="w-20 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700 dark:text-gray-300">Qty</th>
                        <th className="w-24 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700 dark:text-gray-300">Rate</th>
                        <th className="w-28 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700 dark:text-gray-300">Amount</th>
                        <th className="w-12 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700 dark:text-gray-300"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
                      {invoiceData.lineItems.map((item, index) => {
                        const qty = parseFloat(item.qty) || 0;
                        const rate = parseFloat(item.rate) || 0;
                        const amount = qty * rate;
                        const currencyCode = currencies.find(c => c.id === invoiceData.currencyId)?.code || '';
                        
                        return (
                          <tr key={index} className="bg-blue-50 dark:bg-blue-900/20">
                            <td className="whitespace-nowrap align-top px-4 py-3">
                              <input
                                type="date"
                                value={item.date}
                                onChange={(e) => updateInvoiceLineItem(index, 'date', e.target.value)}
                                required
                                className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-400"
                              />
                            </td>
                            <td className="whitespace-nowrap align-top px-4 py-3">
                              <input
                                type="text"
                                value={item.service}
                                onChange={(e) => updateInvoiceLineItem(index, 'service', e.target.value)}
                                required
                                placeholder="Service name"
                                className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-400"
                              />
                            </td>
                            <td className="align-top px-4 py-3">
                              <textarea
                                data-line-item-index={index}
                                value={item.description}
                                onChange={(e) => updateInvoiceLineItem(index, 'description', e.target.value)}
                                onInput={(e) => {
                                  const textarea = e.target as HTMLTextAreaElement;
                                  // Measure a nearby input to get exact height
                                  const row = textarea.closest('tr');
                                  const input = row?.querySelector('input[type="date"], input[type="text"], input[type="number"]') as HTMLInputElement;
                                  const inputHeight = input ? input.offsetHeight : 28;
                                  
                                  textarea.style.height = 'auto';
                                  textarea.style.height = `${Math.max(inputHeight, textarea.scrollHeight)}px`;
                                }}
                                required
                                placeholder="Description"
                                rows={1}
                                style={{ overflowY: 'hidden' }}
                                className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-400 resize-none"
                              />
                            </td>
                            <td className="whitespace-nowrap align-top px-4 py-3">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.qty}
                                onChange={(e) => updateInvoiceLineItem(index, 'qty', e.target.value)}
                                required
                                className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-400"
                              />
                            </td>
                            <td className="whitespace-nowrap align-top px-4 py-3">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.rate}
                                onChange={(e) => updateInvoiceLineItem(index, 'rate', e.target.value)}
                                required
                                placeholder="0.00"
                                className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-400"
                              />
                            </td>
                            <td className="whitespace-nowrap align-top px-4 py-3 text-xs text-gray-900 dark:text-white">
                              {currencyCode} {amount.toFixed(2)}
                            </td>
                            <td className="whitespace-nowrap align-top px-4 py-3">
                              {invoiceData.lineItems.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeInvoiceLineItem(index)}
                                  className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                >
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tax Field */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tax
                </label>
                <div className="relative">
                  {invoiceData.currencyId && (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-600 dark:text-gray-400">
                      {currencies.find(c => c.id === invoiceData.currencyId)?.code || ''}
                    </span>
                  )}
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={invoiceData.tax}
                    onChange={(e) => setInvoiceData({ ...invoiceData, tax: e.target.value })}
                    placeholder="0.00"
                    className={`w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400 ${invoiceData.currencyId ? 'pl-12' : ''}`}
                  />
                </div>
              </div>

              {/* Discount and Amount Paid Fields */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Discount (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={invoiceData.discountPercentage}
                    onChange={(e) => setInvoiceData({ ...invoiceData, discountPercentage: e.target.value })}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Amount Paid
                  </label>
                  <div className="relative">
                    {invoiceData.currencyId && (
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-600 dark:text-gray-400">
                        {currencies.find(c => c.id === invoiceData.currencyId)?.code || ''}
                      </span>
                    )}
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={invoiceData.amountPaid}
                      onChange={(e) => setInvoiceData({ ...invoiceData, amountPaid: e.target.value })}
                      placeholder="0.00"
                      className={`w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400 ${invoiceData.currencyId ? 'pl-12' : ''}`}
                    />
                  </div>
                </div>
              </div>

              {/* Notes Section */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={invoiceData.notes}
                  onChange={(e) => setInvoiceData({ ...invoiceData, notes: e.target.value })}
                  placeholder="Additional notes or comments"
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                />
              </div>

              {/* Invoice Summary */}
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                <div className="flex justify-end">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Item Total:</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {currencies.find(c => c.id === invoiceData.currencyId)?.code || ''} {calculateInvoiceItemTotal().toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Tax:</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {currencies.find(c => c.id === invoiceData.currencyId)?.code || ''} {calculateInvoiceTax().toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm border-t border-gray-300 pt-2 dark:border-gray-600">
                      <span className="text-gray-600 dark:text-gray-400">Subtotal:</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {currencies.find(c => c.id === invoiceData.currencyId)?.code || ''} {calculateInvoiceSubtotal().toFixed(2)}
                      </span>
                    </div>
                    {calculateInvoiceDiscount() > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Discount ({invoiceData.discountPercentage}%):</span>
                        <span className="font-medium text-red-600 dark:text-red-400">
                          - {currencies.find(c => c.id === invoiceData.currencyId)?.code || ''} {calculateInvoiceDiscount().toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Amount Paid:</span>
                      <span className={`font-medium ${calculateInvoiceAmountPaid() > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
                        {calculateInvoiceAmountPaid() > 0 ? '- ' : ''}{currencies.find(c => c.id === invoiceData.currencyId)?.code || ''} {calculateInvoiceAmountPaid().toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t-2 border-gray-400 pt-2 dark:border-gray-500">
                      <span className="font-semibold text-gray-900 dark:text-white">Balance Due:</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {currencies.find(c => c.id === invoiceData.currencyId)?.code || ''} {calculateInvoiceTotal().toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </form>

        {/* Delivery Method Tabs */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <Tabs
            tabs={tabs}
            activeTab={activeMethod}
            onTabChange={(tabId) => {
              setActiveMethod(tabId as GenerationMethod);
              setGeneratedLink(null);
              setError(null);
              setSuccess(null);
            }}
          />
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            form="payment-link-form"
            disabled={isSubmitDisabled()}
            className="rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            {getSubmitButtonText()}
          </button>
        </div>

        {/* Email/Notification Preview Modal */}
        {showEmailPreview && (() => {
          const preview = generateEmailPreview();
          if (!preview) {
            return null; // No preview available
          }
          const isNotification = preview.isNotification;
          return (
            <div 
              className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
              onClick={() => setShowEmailPreview(false)}
            >
              <div 
                className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-800">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {isNotification ? 'Notification Preview' : 'Email Preview'}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowEmailPreview(false)}
                    className="rounded-lg p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Modal Content */}
                <div className="p-6 space-y-6">
                  {/* Header */}
                  <div className="space-y-2 border-b border-gray-200 pb-4 dark:border-gray-700">
                    {!isNotification && (
                      <div className="flex items-start gap-2">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400 min-w-[80px]">To:</span>
                        <span className="text-sm text-gray-900 dark:text-white">
                          {preview.recipients.length > 0 
                            ? preview.recipients.join(', ') 
                            : <span className="text-gray-400 italic">No recipients entered</span>}
                        </span>
                      </div>
                    )}
                    <div className="flex items-start gap-2">
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400 min-w-[80px]">
                        {isNotification ? 'Header:' : 'Subject:'}
                      </span>
                      <span className="text-sm text-gray-900 dark:text-white font-medium">
                        {preview.subject}
                      </span>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                      {isNotification ? 'Notification Content:' : 'Email Body:'}
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                      <div 
                        className="prose prose-sm max-w-none text-gray-900 dark:text-gray-100 whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{ 
                          __html: preview.content.replace(/\n/g, '<br>') 
                        }}
                      />
                    </div>
                  </div>

                  {/* Info Note */}
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
                    <p className="text-xs text-blue-800 dark:text-blue-200">
                      <strong>Note:</strong> This is a preview. The actual payment link URL and expiration date will be generated when you submit the form.
                    </p>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="sticky bottom-0 flex justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-800">
                  <button
                    type="button"
                    onClick={() => setShowEmailPreview(false)}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      </div>
    </AdminLayout>
  );
}

