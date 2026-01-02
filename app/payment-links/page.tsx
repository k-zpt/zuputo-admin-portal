'use client';

import { AdminLayout } from "@/components/AdminLayout";
import { Tabs } from "@/components/Tabs";
import { paymentLinkService, countryService, currencyService, customerService, notifierService, messageTemplateService, notificationService } from "@/lib/api/services";
import { DEFAULT_PAYMENT_LINK_EMAIL_TEMPLATE, renderEmailTemplate, formatNumber, formatDate } from "@/lib/emailTemplates";
import { PAYMENT_LINK_BASE_URL } from "@/lib/api/config";
import { useState, useEffect, useRef } from "react";
import type { AdhocRequest, CreateAdhocRequestPayload, ApiResponse, Country, Currency, Customer, MessageTemplate } from "@/lib/api/types";

type GenerationMethod = 'copy' | 'email' | 'customer';

export default function PaymentLinksPage() {
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
  
  // Additional form data for email and customer methods
  const [emailData, setEmailData] = useState({
    recipients: '',
    message: '',
  });
  
  const [emailTemplate, setEmailTemplate] = useState<string>(DEFAULT_PAYMENT_LINK_EMAIL_TEMPLATE);
  const [emailTemplateTitle, setEmailTemplateTitle] = useState<string>('');
  const [notificationTemplate, setNotificationTemplate] = useState<MessageTemplate | null>(null);
  const [templateLoaded, setTemplateLoaded] = useState(false);
  
  const [customerData, setCustomerData] = useState({
    customerId: '',
  });
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadCountries();
    loadCurrencies();
    loadEmailTemplate();
    if (activeMethod === 'customer') {
      loadCustomers();
    }
  }, [activeMethod]);

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
        t => t.type === 'EMAIL' && t.code === 'PAYMENT_LINK'
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
        t => t.type === 'NOTIFICATION' && t.code === 'PAYMENT_LINK'
      );
      if (notificationTemplate) {
        setNotificationTemplate(notificationTemplate);
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
    const payload: CreateAdhocRequestPayload = {
      countryId: formData.countryId,
      label: formData.label,
      description: formData.description || undefined,
      pricingInfo: {
        price: parseFloat(formData.price),
        currency: formData.currencyId,
      },
      discountProgramIds: formData.discountProgramIds.length > 0 ? formData.discountProgramIds : undefined,
      customerId: activeMethod === 'customer' ? customerData.customerId : undefined,
    };

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
        const recipients = emailData.recipients.split(',').map(r => r.trim()).filter(Boolean);
        
        // Use custom message if provided, otherwise render the template
        let emailContent: string;
        const templateToUse = emailData.message || emailTemplate;
        
        // Check if template contains placeholders (indicating it's a template, not custom text)
        const hasPlaceholders = templateToUse.includes('{{label}}') || 
                                templateToUse.includes('{{url}}') || 
                                templateToUse.includes('{{price}}');
        
        if (hasPlaceholders) {
          // Find currency code for template
          const selectedCurrency = currencies.find(c => c.id === formData.currencyId);
          const currencyCode = selectedCurrency?.code || '';
          
          emailContent = renderEmailTemplate(templateToUse, {
            label: formData.label,
            description: formData.description,
            url: paymentLinkUrl,
            validUntil: link.validUntil,
            price: formData.price,
            currency: currencyCode,
          });
        } else {
          // Use as-is (custom message without placeholders)
          emailContent = templateToUse;
        }
        
        // Convert newlines to <br> for email content
        const formattedContent = emailContent.replace(/\n/g, '<br>');
        
        // Use template title as subject (render placeholders if present), or fallback
        let emailSubject = emailTemplateTitle || `Payment Link: ${formData.label}`;
        if (emailTemplateTitle && emailTemplateTitle.includes('{{label}}')) {
          emailSubject = emailTemplateTitle.replace(/\{\{label\}\}/g, formData.label);
        }
        
        await notifierService.sendEmail({
          recipients,
          subject: emailSubject,
          content: formattedContent,
        });
        
        setSuccess(`Payment link generated and sent via email to ${recipients.length} recipient(s)!`);
      } else if (activeMethod === 'customer') {
        // Customer ID is already included in the initial POST call
        const customer = customers.find(c => c.id === customerData.customerId);
        const customerName = customer 
          ? [customer.firstName, customer.otherNames, customer.lastName].filter(Boolean).join(' ') || customer.emailAddress || 'Customer'
          : 'Customer';
        
        const selectedCurrency = currencies.find(c => c.id === formData.currencyId);
        const currencyCode = selectedCurrency?.code || '';
        
        // 1. Create payment link (already done above)
        // 2. Send notification FIRST using PAYMENT_LINK notification template
        if (notificationTemplate) {
          // Render notification template with placeholders
          let notificationContent = notificationTemplate.content;
          notificationContent = notificationContent.replace(/\{\{label\}\}/g, formData.label);
          notificationContent = notificationContent.replace(/\{\{url\}\}/g, paymentLinkUrl);
          notificationContent = notificationContent.replace(/\{\{validUntil\}\}/g, formatDate(link.validUntil));
          notificationContent = notificationContent.replace(/\{\{price\}\}/g, formatNumber(formData.price));
          notificationContent = notificationContent.replace(/\{\{currency\}\}/g, currencyCode);
          if (formData.description) {
            notificationContent = notificationContent.replace(/\{\{description\}\}/g, formData.description);
          }
          
          // Convert <br> back to \n for notification content (if any)
          notificationContent = notificationContent.replace(/<br\s*\/?>/gi, '\n');
          
          // Get header from template title, or use a default
          let notificationHeader = notificationTemplate.title || formData.label;
          if (notificationHeader.includes('{{label}}')) {
            notificationHeader = notificationHeader.replace(/\{\{label\}\}/g, formData.label);
          }
          
          await notificationService.create({
            header: notificationHeader,
            content: notificationContent,
            recipientId: customerData.customerId,
            type: 'SERVICE_REQUEST',
            source: 'PORTAL',
          });
        }
        
        // 3. Send email to customer using PAYMENT_LINK email template
        if (customer?.emailAddress) {
          // Render email template with placeholders
          const emailContent = renderEmailTemplate(emailTemplate, {
            label: formData.label,
            description: formData.description,
            url: paymentLinkUrl,
            validUntil: link.validUntil,
            price: formData.price,
            currency: currencyCode,
          });
          
          // Convert newlines to <br> for email content
          const formattedEmailContent = emailContent.replace(/\n/g, '<br>');
          
          // Use template title as subject (render placeholders if present), or fallback
          let emailSubject = emailTemplateTitle || `Payment Link: ${formData.label}`;
          if (emailTemplateTitle && emailTemplateTitle.includes('{{label}}')) {
            emailSubject = emailTemplateTitle.replace(/\{\{label\}\}/g, formData.label);
          }
          
          await notifierService.sendEmail({
            recipients: [customer.emailAddress],
            subject: emailSubject,
            content: formattedEmailContent,
          });
        }
        
        setSuccess(`Payment link generated and sent to ${customerName} via app!`);
      }
      
      // Reset form
      setFormData({
        countryId: '',
        label: '',
        description: '',
        price: '',
        currencyId: '',
        discountProgramIds: [],
      });
      setEmailData({ recipients: '', message: '' });
      setCustomerData({ customerId: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate payment link');
    } finally {
      setLoading(false);
    }
  };

  const supportedCurrencies = getSupportedCurrencies(formData.countryId);

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
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Recipients (comma-separated emails) *
          </label>
          <input
            type="text"
            required
            value={emailData.recipients}
            onChange={(e) => setEmailData({ ...emailData, recipients: e.target.value })}
            placeholder="user@example.com, another@example.com"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Email Template
            </label>
            <button
              type="button"
              onClick={() => {
                setEmailData({ ...emailData, message: '' });
              }}
              className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Reset to default
            </button>
          </div>
          <textarea
            value={emailData.message || emailTemplate}
            onChange={(e) => setEmailData({ ...emailData, message: e.target.value })}
            placeholder={emailTemplate}
            rows={10}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-xs text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Edit the template above or leave as-is to use the default. Placeholders: {'{'}label{'}'}, {'{'}description{'}'}, {'{'}url{'}'}, {'{'}validUntil{'}'}, {'{'}price{'}'}, {'{'}currency{'}'}
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
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Generate a payment link and send it directly to a customer via the app.
      </p>
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

  const tabs = [
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
    if (activeMethod === 'email') return !emailData.recipients;
    if (activeMethod === 'customer') return !customerData.customerId;
    return false;
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

        {/* Main Payment Link Form */}
        <form id="payment-link-form" onSubmit={handleSubmit} className="space-y-6 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
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
      </div>
    </AdminLayout>
  );
}

