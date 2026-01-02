'use client';

import { AdminLayout } from "@/components/AdminLayout";
import { formService, countryService, currencyService } from "@/lib/api/services";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Form, ApiResponse, UpdateFormPayload, FieldsetInfo, FieldInfo, Country, Currency } from "@/lib/api/types";
import { FORM_FIELD_TYPES } from "@/lib/formConfig";
import { API_BASE_URL, API_ENDPOINTS } from "@/lib/api/config";
import { formatFormType } from "@/lib/formUtils";
import { groupVariablesIntoFieldsets, DEFAULT_GROUPING_CONFIG, inferFieldType, variableToLabel } from "@/lib/fieldsetGrouping";
import mammoth from 'mammoth';

export default function FormDetailPage() {
  const params = useParams();
  const router = useRouter();
  const formId = params.id as string;
  
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [countries, setCountries] = useState<Country[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [templateUploadResult, setTemplateUploadResult] = useState<{
    template_uploaded: boolean;
    file_location?: string;
    filename?: string;
    file_size?: number;
    extraction_results?: {
      valid_variables: string[];
      invalid_variables: string[];
      total_variables_found: number;
    };
    status?: 'success' | 'has_errors';
    upload_timestamp?: string;
    backup_created?: string;
  } | null>(null);
  
  const [templateInfo, setTemplateInfo] = useState<{
    file_location?: string;
    filename?: string;
    file_size?: number;
    upload_timestamp?: string;
  } | null>(null);
  
  // Template preview modal state
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  
  // Expanded fieldsets for accordion
  const [expandedFieldsets, setExpandedFieldsets] = useState<Set<string>>(new Set());
  
  // Drag and drop state
  const [draggedFieldsetId, setDraggedFieldsetId] = useState<string | null>(null);
  const [draggedFieldId, setDraggedFieldId] = useState<{ fieldsetId: string; fieldId: string } | null>(null);
  
  // Fieldset configuration modal state (for template upload)
  const [showFieldsetConfig, setShowFieldsetConfig] = useState(false);
  const [fieldsetConfig, setFieldsetConfig] = useState<Array<{ name: string; fields: Array<{ name: string; label: string; description: string; type: string }> }>>([]);
  const [configuringFieldsets, setConfiguringFieldsets] = useState(false);
  const [expandedConfigFieldsets, setExpandedConfigFieldsets] = useState<Set<number>>(new Set());
  const [expandedConfigFields, setExpandedConfigFields] = useState<Set<string>>(new Set());
  
  // Form data for editing
  const [formData, setFormData] = useState<UpdateFormPayload>({
    name: '',
    label: '',
    description: '',
    country: '',
    isFeatured: false,
    pricingInfo: undefined,
    fieldsets: [],
  });

  useEffect(() => {
    if (formId) {
      loadCountries();
      loadCurrencies();
      loadTemplateInfo();
      loadForm();
    }
  }, [formId]);

  // Update formData when currencies are loaded (to convert currency codes to IDs)
  useEffect(() => {
    if (form && currencies.length > 0 && formData.pricingInfo?.currency) {
      // Check if currency needs to be converted from code to ID
      const currentCurrency = formData.pricingInfo.currency;
      // Try to find by code (if it's a code, we need to convert to ID)
      const currencyByCode = currencies.find(c => c.code === currentCurrency);
      // Only update if we found it by code (meaning it's a code, not an ID)
      if (currencyByCode && currencyByCode.code === currentCurrency && currencyByCode.id !== currentCurrency) {
        setFormData(prev => ({
          ...prev,
          pricingInfo: prev.pricingInfo ? {
            ...prev.pricingInfo,
            currency: currencyByCode.id,
          } : undefined,
        }));
      }
    }
  }, [currencies.length]); // Only depend on currencies.length to avoid infinite loops

  const loadForm = async () => {
    try {
      setLoading(true);
      setError(null);
      const response: ApiResponse<Form> = await formService.getById(formId);
      setForm(response.data);
      // Initialize form data for editing
      // Handle country - could be string ID or Country object
      const countryId = typeof response.data.country === 'string' 
        ? response.data.country 
        : (response.data.country as any)?.id || '';
      
      // Handle pricingInfo.currency - could be string code/ID or Currency object
      let pricingInfo = response.data.pricingInfo;
      if (pricingInfo) {
        if (typeof pricingInfo.currency !== 'string') {
          // Extract currency ID from Currency object
          pricingInfo = {
            ...pricingInfo,
            currency: (pricingInfo.currency as any)?.id || '',
          };
        } else {
          // If it's a string, try to find currency by ID or code
          // If currencies are loaded, convert code to ID; otherwise store as-is
          const currency = currencies.length > 0 && pricingInfo
            ? (currencies.find(c => c.id === pricingInfo.currency) || 
               currencies.find(c => c.code === pricingInfo.currency))
            : null;
          if (currency) {
            // Convert to ID
            pricingInfo = {
              ...pricingInfo,
              currency: currency.id,
            };
          }
          // If currency not found and currencies not loaded yet, store as-is
          // It will be converted in the useEffect when currencies load
        }
      }
      
      setFormData({
        name: response.data.name || '',
        label: response.data.label || '',
        description: response.data.description || '',
        country: countryId,
        isFeatured: response.data.isFeatured ?? response.data.featured ?? false,
        pricingInfo: pricingInfo,
        fieldsets: response.data.fieldsets || [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load form details');
    } finally {
      setLoading(false);
    }
  };

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

  const loadTemplateInfo = async () => {
    try {
      const response = await formService.getTemplateInfo(formId);
      if (response.data.exists && response.data.file_location) {
        setTemplateInfo({
          file_location: response.data.file_location,
          filename: response.data.filename,
          file_size: response.data.file_size,
          upload_timestamp: response.data.upload_timestamp,
        });
      } else {
        setTemplateInfo(null);
      }
    } catch (err) {
      // Template might not exist, which is fine
      setTemplateInfo(null);
    }
  };

  const [previewContentType, setPreviewContentType] = useState<string | null>(null);
  const [convertedHtml, setConvertedHtml] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  
  const handlePreviewTemplate = async () => {
    if (formId) {
      setPreviewError(null);
      setPreviewLoading(true);
      setPreviewContentType(null);
      setConvertedHtml(null);
      setShowPreviewModal(true);
      
      // Check the content type of the preview
      try {
        const testResponse = await fetch(`/api/forms/${formId}/preview`, { method: 'HEAD' });
        if (!testResponse.ok) {
          // For HEAD requests, check status code
          if (testResponse.status === 404) {
            setPreviewError('Preview not available: File not found');
          } else {
            // For other errors, try to get the error message from a GET request
            try {
              const errorResponse = await fetch(`/api/forms/${formId}/preview`);
              const errorData = await errorResponse.json().catch(() => null);
              if (errorData?.msg) {
                if (errorData.msg.toLowerCase().includes('not found') || errorData.msg.toLowerCase().includes('file not found')) {
                  setPreviewError('Preview not available: File not found');
                } else {
                  setPreviewError(`Preview not available: ${errorData.msg}`);
                }
              } else {
                setPreviewError(`Preview not available: ${testResponse.statusText}`);
              }
            } catch {
              setPreviewError(`Preview not available: ${testResponse.statusText}`);
            }
          }
          setPreviewLoading(false);
          return;
        }
        
        const contentType = testResponse.headers.get('Content-Type') || '';
        setPreviewContentType(contentType);
        
        // If it's a Word document, browsers can't display it directly
        if (contentType.includes('application/msword') || 
            contentType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document') ||
            contentType.includes('application/vnd.ms-word')) {
          // Don't set error - we'll show the conversion option instead
        }
      } catch (err) {
        setPreviewError('Failed to load preview. The document may not be available.');
      } finally {
        setPreviewLoading(false);
      }
    }
  };
  
  const handleConvertToHtml = async () => {
    if (!formId) return;
    
    setIsConverting(true);
    setPreviewError(null);
    
    try {
      // Fetch the Word document
      const response = await fetch(`/api/forms/${formId}/preview`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('File not found');
        }
        throw new Error(`Failed to fetch document: ${response.statusText}`);
      }
      
      // Try to get filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          let extractedFilename = filenameMatch[1].replace(/['"]/g, '');
          // Decode if it's URL encoded
          try {
            extractedFilename = decodeURIComponent(extractedFilename);
          } catch (e) {
            // If decoding fails, use as-is
          }
          // Update templateInfo with the extracted filename if we don't have one
          if (!templateInfo?.filename && extractedFilename) {
            setTemplateInfo(prev => ({
              ...prev,
              filename: extractedFilename,
              file_location: prev?.file_location,
              file_size: prev?.file_size,
              upload_timestamp: prev?.upload_timestamp,
            }));
          }
        }
      }
      
      // Get the document as an array buffer
      const arrayBuffer = await response.arrayBuffer();
      
      // Configure mammoth with better formatting preservation
      const options = {
        styleMap: [
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh",
          "p[style-name='Heading 4'] => h4:fresh",
          "p[style-name='Heading 5'] => h5:fresh",
          "p[style-name='Heading 6'] => h6:fresh",
          "p[style-name='Title'] => h1.title:fresh",
          "p[style-name='Subtitle'] => h2.subtitle:fresh",
          "r[style-name='Strong'] => strong",
          "r[style-name='Emphasis'] => em",
          "p[style-name='Quote'] => blockquote:fresh",
          "p[style-name='Intense Quote'] => blockquote.intense:fresh",
          "p[style-name='List Paragraph'] => p.list-paragraph",
          "r[style-name='Code'] => code",
          "p[style-name='Code'] => pre:fresh",
        ],
        includeDefaultStyleMap: true,
        convertImage: mammoth.images.imgElement((image) => {
          return image.read("base64").then((imageBuffer) => {
            return {
              src: "data:" + image.contentType + ";base64," + imageBuffer
            };
          });
        }),
        // Preserve list formatting
        transformDocument: (document) => {
          return document;
        },
      };
      
      // Convert Word document to HTML using mammoth with better options
      const result = await mammoth.convertToHtml({ arrayBuffer }, options);
      
      // Wrap the HTML with better styling to preserve formatting
      const styledHtml = `
        <style>
          body {
            font-family: 'Times New Roman', serif;
            font-size: 12pt;
            line-height: 1.6;
            color: #000;
            max-width: 8.5in;
            margin: 0 auto;
            padding: 1in;
            background: white;
          }
          p {
            margin: 0.5em 0;
            text-align: left;
          }
          h1, h2, h3, h4, h5, h6 {
            margin-top: 1em;
            margin-bottom: 0.5em;
            font-weight: bold;
          }
          h1 { font-size: 18pt; }
          h2 { font-size: 16pt; }
          h3 { font-size: 14pt; }
          h4 { font-size: 12pt; }
          h5 { font-size: 11pt; }
          h6 { font-size: 10pt; }
          strong, b {
            font-weight: bold;
          }
          em, i {
            font-style: italic;
          }
          u {
            text-decoration: underline;
          }
          blockquote {
            margin: 1em 2em;
            padding-left: 1em;
            border-left: 3px solid #ccc;
            font-style: italic;
          }
          ul, ol {
            margin: 0.5em 0;
            padding-left: 2em;
            list-style-position: outside;
          }
          ul {
            list-style-type: disc;
          }
          ul ul {
            list-style-type: circle;
          }
          ul ul ul {
            list-style-type: square;
          }
          ol {
            list-style-type: decimal;
          }
          ol ol {
            list-style-type: lower-alpha;
          }
          ol ol ol {
            list-style-type: lower-roman;
          }
          li {
            margin: 0.25em 0;
            display: list-item;
            padding-left: 0.5em;
          }
          li p {
            margin: 0;
            display: inline;
          }
          table {
            border-collapse: collapse;
            width: 100%;
            margin: 1em 0;
          }
          table td, table th {
            border: 1px solid #000;
            padding: 0.5em;
            text-align: left;
          }
          table th {
            background-color: #f0f0f0;
            font-weight: bold;
          }
          code {
            background-color: #f4f4f4;
            padding: 0.2em 0.4em;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
          }
          pre {
            background-color: #f4f4f4;
            padding: 1em;
            border-radius: 3px;
            overflow-x: auto;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
          }
          img {
            max-width: 100%;
            height: auto;
            margin: 1em 0;
          }
          .list-paragraph {
            margin-left: 0;
          }
        </style>
        <div class="document-content">
          ${result.value}
        </div>
      `;
      
      // Set the converted HTML with styling
      setConvertedHtml(styledHtml);
      
      // Log any warnings
      if (result.messages.length > 0) {
        console.warn('Conversion warnings:', result.messages);
      }
    } catch (err) {
      console.error('Conversion error:', err);
      setPreviewError(err instanceof Error ? err.message : 'Failed to convert document. The file might be corrupted or in an unsupported format.');
    } finally {
      setIsConverting(false);
    }
  };
  
  const handleExportToPdf = async () => {
    if (!convertedHtml) return;
    
    try {
      // Create a temporary element with the HTML content
      const element = document.createElement('div');
      element.innerHTML = convertedHtml;
      element.style.width = '8.5in';
      element.style.margin = '0 auto';
      element.style.backgroundColor = 'white';
      
      // Get the filename and sanitize it
      const getSafeFilename = () => {
        // Try templateInfo first, then form.template as fallback
        let filename = templateInfo?.filename || form?.template || null;
        
        // If filename contains a path (has slashes), extract just the filename part
        if (filename && filename.includes('/')) {
          filename = filename.split('/').pop() || filename;
        }
        
        console.log('PDF Export - Available filename sources:', {
          templateInfoFilename: templateInfo?.filename,
          formTemplate: form?.template,
          extractedFilename: filename
        });
        
        if (!filename) {
          console.warn('No filename available, using default "document.pdf"');
          return 'document.pdf';
        }
        
        // Remove the file extension
        const nameWithoutExt = filename.replace(/\.(docx?|doc)$/i, '');
        
        // Sanitize the filename: remove unsafe characters, keep alphanumeric, spaces, hyphens, underscores, and dots
        const sanitized = nameWithoutExt
          .replace(/[^a-zA-Z0-9\s\-_.]/g, '') // Remove unsafe characters
          .replace(/\s+/g, '_') // Replace spaces with underscores
          .replace(/_{2,}/g, '_') // Replace multiple underscores with single
          .trim();
        
        const finalFilename = sanitized.length > 0 ? `${sanitized}.pdf` : 'document.pdf';
        console.log('PDF Export - Final filename:', finalFilename);
        
        // Ensure it's not empty and add .pdf extension
        return finalFilename;
      };
      
      // Configure PDF options with better quality
      const opt = {
        margin: [0.5, 0.5, 0.5, 0.5],
        filename: getSafeFilename(),
        image: { type: 'jpeg', quality: 1.0 },
        html2canvas: { 
          scale: 2,
          useCORS: true,
          letterRendering: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: 816, // 8.5 inches at 96 DPI
          windowHeight: element.scrollHeight,
        },
        jsPDF: { 
          unit: 'in', 
          format: 'letter', 
          orientation: 'portrait',
          precision: 16,
        },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
      };
      
      // Dynamically import html2pdf.js only on client side
      const html2pdf = (await import('html2pdf.js')).default;
      await html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.error('PDF export error:', err);
      setPreviewError('Failed to export PDF. Please try again.');
    }
  };
  
  // Get preview URL
  const getPreviewUrl = () => {
    if (!formId) return '';
    return `/api/forms/${formId}/preview`;
  };
  
  // Get download URL (fallback)
  const getDownloadUrl = () => {
    if (!formId || !templateInfo?.file_location) return '';
    return `${API_BASE_URL}${templateInfo.file_location}`;
  };
  
  // Check if the document can be previewed in browser
  const canPreviewInBrowser = () => {
    if (!previewContentType) return true; // Assume yes if we don't know
    // PDFs can be previewed
    if (previewContentType.includes('application/pdf')) return true;
    // Images can be previewed
    if (previewContentType.startsWith('image/')) return true;
    // Word documents cannot be previewed
    if (previewContentType.includes('application/msword') || 
        previewContentType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document') ||
        previewContentType.includes('application/vnd.ms-word')) return false;
    // Default to trying
    return true;
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      
      if (!form) {
        setError('Form data not loaded');
        return;
      }
      
      // Helper to get country ID from either string or object
      const getCountryId = (country: string | Country | undefined): string => {
        if (!country) return '';
        return typeof country === 'string' ? country : country.id || '';
      };
      
      // Helper to compare pricing info
      const pricingInfoChanged = (): boolean => {
        if (!formData.pricingInfo && !form.pricingInfo) return false;
        if (!formData.pricingInfo || !form.pricingInfo) return true;
        
        // Compare currency IDs
        const getCurrencyId = (currency: string | Currency | undefined): string => {
          if (!currency) return '';
          if (typeof currency === 'string') {
            // If it's a string, check if it's an ID or code
            const foundCurrency = currencies.find(c => c.id === currency || c.code === currency);
            return foundCurrency?.id || currency;
          }
          return currency.id || '';
        };
        
        const formCurrencyId = getCurrencyId(form.pricingInfo.currency);
        const formDataCurrencyId = formData.pricingInfo.currency || '';
        
        return formData.pricingInfo.price !== form.pricingInfo.price || 
               formDataCurrencyId !== formCurrencyId;
      };
      
      // Helper to compare fieldsets (deep comparison)
      const fieldsetsChanged = (): boolean => {
        return JSON.stringify(formData.fieldsets) !== JSON.stringify(form.fieldsets);
      };
      
      // Build update payload - only include fields that have actually changed
      const payload: UpdateFormPayload = {};
      
      if (formData.name !== undefined && formData.name !== form.name) {
        payload.name = formData.name;
      }
      
      if (formData.label !== undefined && formData.label !== form.label) {
        payload.label = formData.label;
      }
      
      if (formData.description !== undefined && formData.description !== form.description) {
        payload.description = formData.description;
      }
      
      const originalCountryId = getCountryId(form.country);
      if (formData.country !== undefined && formData.country !== originalCountryId) {
        payload.country = formData.country;
      }
      
      const originalIsFeatured = form.isFeatured ?? form.featured ?? false;
      if (formData.isFeatured !== undefined && formData.isFeatured !== originalIsFeatured) {
        payload.isFeatured = formData.isFeatured;
      }
      
      if (pricingInfoChanged()) {
        // Ensure currency is sent as ID (it's already stored as ID in formData)
        payload.pricingInfo = {
          price: formData.pricingInfo!.price,
          currency: formData.pricingInfo!.currency, // This is already the currency ID
        };
      }
      
      if (fieldsetsChanged()) {
        payload.fieldsets = formData.fieldsets;
      }
      
      // Only send request if there are actual changes
      if (Object.keys(payload).length === 0) {
        setSuccess('No changes to save');
        setIsEditing(false);
        return;
      }
      
      await formService.update(formId, payload);
      setSuccess('Form updated successfully!');
      setIsEditing(false);
      await loadForm(); // Reload to get updated data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update form');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setError(null);
    setSuccess(null);
    // Reset form data to original
    if (form) {
      // Handle country - could be string ID or Country object
      const countryId = typeof form.country === 'string' 
        ? form.country 
        : (form.country as any)?.id || '';
      
      // Handle pricingInfo.currency - could be string code/ID or Currency object
      let pricingInfo = form.pricingInfo;
      if (pricingInfo) {
        if (typeof pricingInfo.currency !== 'string') {
          // Extract currency ID from Currency object
          pricingInfo = {
            ...pricingInfo,
            currency: (pricingInfo.currency as any)?.id || '',
          };
        } else {
          // If it's a string, check if it's a code or ID
          // Try to find by ID first, then by code
          const currency = currencies.find(c => c.id === pricingInfo.currency) || 
                          currencies.find(c => c.code === pricingInfo.currency);
          if (currency) {
            // Convert to ID (whether it was code or ID, use the found currency's ID)
            pricingInfo = {
              ...pricingInfo,
              currency: currency.id,
            };
          }
          // If currency not found in list, assume it's already an ID
        }
      }
      
      setFormData({
        name: form.name || '',
        label: form.label || '',
        description: form.description || '',
        country: countryId,
        isFeatured: form.isFeatured ?? form.featured ?? false,
        pricingInfo: pricingInfo,
        fieldsets: form.fieldsets || [],
      });
    }
  };

  const updateFieldset = (fieldsetId: string, updates: Partial<FieldsetInfo>) => {
    setFormData(prev => ({
      ...prev,
      fieldsets: prev.fieldsets?.map(fs => 
        fs.id === fieldsetId ? { ...fs, ...updates } : fs
      ) || []
    }));
  };

  const updateField = (fieldsetId: string, fieldId: string, updates: Partial<FieldInfo>) => {
    setFormData(prev => ({
      ...prev,
      fieldsets: prev.fieldsets?.map(fs => 
        fs.id === fieldsetId 
          ? {
              ...fs,
              fields: fs.fields?.map(f => f.id === fieldId ? { ...f, ...updates } : f) || []
            }
          : fs
      ) || []
    }));
  };

  const addFieldset = () => {
    const newFieldset: FieldsetInfo = {
      id: `fieldset-${Date.now()}`,
      name: '',
      label: '',
      description: '',
      fields: [],
    };
    setFormData(prev => ({
      ...prev,
      fieldsets: [...(prev.fieldsets || []), newFieldset]
    }));
  };

  const addField = (fieldsetId: string) => {
    const newField: FieldInfo = {
      id: `field-${Date.now()}`,
      name: '',
      label: '',
      description: '',
      isRequired: false,
      type: '',
      widget: '',
      validator: '',
    };
    updateFieldset(fieldsetId, {
      fields: [...(formData.fieldsets?.find(fs => fs.id === fieldsetId)?.fields || []), newField]
    });
  };

  const removeFieldset = (fieldsetId: string) => {
    setFormData(prev => ({
      ...prev,
      fieldsets: prev.fieldsets?.filter(fs => fs.id !== fieldsetId) || []
    }));
  };

  const reorderFormFieldset = (fieldsetId: string, direction: 'up' | 'down') => {
    setFormData(prev => {
      const fieldsets = [...(prev.fieldsets || [])];
      const currentIndex = fieldsets.findIndex(fs => fs.id === fieldsetId);
      if (currentIndex === -1) return prev;
      
      const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (newIndex < 0 || newIndex >= fieldsets.length) return prev;
      
      [fieldsets[currentIndex], fieldsets[newIndex]] = [fieldsets[newIndex], fieldsets[currentIndex]];
      return { ...prev, fieldsets };
    });
  };

  const reorderFormField = (fieldsetId: string, fieldId: string, direction: 'up' | 'down') => {
    setFormData(prev => {
      const fieldsets = [...(prev.fieldsets || [])];
      const fieldsetIndex = fieldsets.findIndex(fs => fs.id === fieldsetId);
      if (fieldsetIndex === -1) return prev;
      
      const fields = [...(fieldsets[fieldsetIndex].fields || [])];
      const currentIndex = fields.findIndex(f => f.id === fieldId);
      if (currentIndex === -1) return prev;
      
      const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (newIndex < 0 || newIndex >= fields.length) return prev;
      
      [fields[currentIndex], fields[newIndex]] = [fields[newIndex], fields[currentIndex]];
      fieldsets[fieldsetIndex] = { ...fieldsets[fieldsetIndex], fields };
      return { ...prev, fieldsets };
    });
  };

  const removeField = (fieldsetId: string, fieldId: string) => {
    updateFieldset(fieldsetId, {
      fields: formData.fieldsets?.find(fs => fs.id === fieldsetId)?.fields?.filter(f => f.id !== fieldId) || []
    });
  };

  // Format field name: remove non-alphanumeric (except underscores), uppercase, spaces to underscores
  const formatFieldName = (input: string): string => {
    return input
      .replace(/[^a-zA-Z0-9_\s]/g, '') // Remove non-alphanumeric (except underscores and spaces)
      .replace(/\s+/g, '_') // Convert spaces to underscores
      .toUpperCase(); // Convert to uppercase
  };

  // Generate field name from label
  const generateFieldNameFromLabel = (label: string): string => {
    if (!label || label.trim() === '') return '';
    return formatFieldName(label);
  };

  // Fieldset configuration handlers (for template upload)
  const handleSkipFieldsetConfig = () => {
    setShowFieldsetConfig(false);
    setFieldsetConfig([]);
    // Reload form to get updated data
    loadForm();
  };

  const handleSaveFieldsetConfig = async () => {
    if (!formId) return;

    try {
      setConfiguringFieldsets(true);
      setError(null);

      // Validate before sending
      const validationErrors: string[] = [];
      fieldsetConfig.forEach((fieldset, fsIdx) => {
        if (!fieldset.name || fieldset.name.trim() === '') {
          validationErrors.push(`Fieldset ${fsIdx + 1}: Name is required`);
        }
        if (fieldset.fields.length === 0) {
          validationErrors.push(`Fieldset "${fieldset.name || `Fieldset ${fsIdx + 1}`}": At least one field is required`);
        }
        fieldset.fields.forEach((field, fIdx) => {
          if (!field.name || field.name.trim() === '') {
            validationErrors.push(`Fieldset "${fieldset.name || `Fieldset ${fsIdx + 1}`}", Field ${fIdx + 1}: Name is required`);
          }
        });
      });

      if (validationErrors.length > 0) {
        setError(`Validation errors:\n${validationErrors.join('\n')}`);
        return;
      }

      // Prepare payload - only include name and fields with name, description, label, type
      const payload = fieldsetConfig.map(fieldset => ({
        name: fieldset.name,
        fields: fieldset.fields.map(field => ({
          name: field.name,
          ...(field.label && { label: field.label }),
          ...(field.description && { description: field.description }),
          ...(field.type && { type: field.type }),
        })),
      }));

      await formService.configureFieldsets(formId, payload);
      setShowFieldsetConfig(false);
      setFieldsetConfig([]);
      setSuccess('Fieldsets configured successfully!');
      // Reload form to get updated data
      loadForm();
    } catch (err: any) {
      // Try to extract detailed error message
      let errorMessage = 'Failed to configure fieldsets';
      
      if (err instanceof Error) {
        errorMessage = err.message;
        
        // Check if we have errorData attached to the error (from API client)
        if ((err as any).errorData) {
          const errorData = (err as any).errorData;
          
          // If there's a data field with validation errors
          if (errorData.data) {
            if (Array.isArray(errorData.data)) {
              // Array of validation errors
              const validationErrors = errorData.data.map((e: any) => {
                if (typeof e === 'string') return e;
                return `${e.field || e.path || e.loc?.join('.') || ''}: ${e.msg || e.message || e}`;
              }).filter(Boolean);
              
              if (validationErrors.length > 0) {
                errorMessage = `Validation errors:\n${validationErrors.join('\n')}`;
              }
            } else if (typeof errorData.data === 'object') {
              // Object with validation errors (e.g., { fieldset: "error", field: "error" })
              const validationErrors = Object.entries(errorData.data)
                .map(([key, value]) => {
                  if (Array.isArray(value)) {
                    return `${key}: ${value.join(', ')}`;
                  }
                  return `${key}: ${value}`;
                })
                .filter(Boolean);
              
              if (validationErrors.length > 0) {
                errorMessage = `Validation errors:\n${validationErrors.join('\n')}`;
              }
            } else if (typeof errorData.data === 'string') {
              errorMessage = errorData.data;
            }
          }
          
          // If errorData.msg exists and we haven't found validation errors, use it
          if (errorData.msg && errorMessage === err.message) {
            errorMessage = errorData.msg;
          }
        }
      }
      
      setError(errorMessage);
    } finally {
      setConfiguringFieldsets(false);
    }
  };

  const addFieldsetToConfig = () => {
    const newFieldset = { name: '', fields: [] };
    setFieldsetConfig([...fieldsetConfig, newFieldset]);
    // Auto-expand the new fieldset
    const newIndex = fieldsetConfig.length;
    setExpandedConfigFieldsets(prev => new Set([...prev, newIndex]));
  };

  const removeFieldsetFromConfig = (index: number) => {
    setFieldsetConfig(fieldsetConfig.filter((_, i) => i !== index));
  };

  const updateFieldsetInConfig = (index: number, updates: Partial<{ name: string; fields: any[] }>) => {
    const updated = [...fieldsetConfig];
    updated[index] = { ...updated[index], ...updates };
    setFieldsetConfig(updated);
  };

  const addFieldToFieldset = (fieldsetIndex: number, variableName: string) => {
    const updated = [...fieldsetConfig];
    updated[fieldsetIndex] = {
      ...updated[fieldsetIndex],
      fields: [
        ...updated[fieldsetIndex].fields,
        {
          name: variableName,
          label: variableToLabel(variableName),
          description: '',
          type: inferFieldType(variableName),
        },
      ],
    };
    setFieldsetConfig(updated);
  };

  const removeFieldFromFieldset = (fieldsetIndex: number, fieldIndex: number) => {
    const updated = [...fieldsetConfig];
    updated[fieldsetIndex] = {
      ...updated[fieldsetIndex],
      fields: updated[fieldsetIndex].fields.filter((_, i) => i !== fieldIndex),
    };
    setFieldsetConfig(updated);
  };

  const updateFieldInConfig = (fieldsetIndex: number, fieldIndex: number, updates: Partial<{ name: string; label?: string; description?: string; type?: string }>) => {
    const updated = [...fieldsetConfig];
    const updatedFields = [...updated[fieldsetIndex].fields];
    updatedFields[fieldIndex] = { ...updatedFields[fieldIndex], ...updates };
    updated[fieldsetIndex] = { ...updated[fieldsetIndex], fields: updatedFields };
    setFieldsetConfig(updated);
  };

  // Get unassigned variables (variables not yet added to any fieldset)
  const getUnassignedVariables = (): string[] => {
    if (!templateUploadResult?.extraction_results?.valid_variables) return [];
    const assigned = new Set(fieldsetConfig.flatMap(fs => fs.fields.map(f => f.name)));
    return templateUploadResult.extraction_results.valid_variables.filter(v => !assigned.has(v));
  };

  const toggleConfigFieldsetExpansion = (index: number) => {
    setExpandedConfigFieldsets(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const toggleConfigFieldExpansion = (fieldKey: string) => {
    setExpandedConfigFields(prev => {
      const next = new Set(prev);
      if (next.has(fieldKey)) {
        next.delete(fieldKey);
      } else {
        next.add(fieldKey);
      }
      return next;
    });
  };

  const toggleFieldExpansion = (fieldsetIndex: number, fieldIndex: number) => {
    const key = `${fieldsetIndex}-${fieldIndex}`;
    toggleConfigFieldExpansion(key);
  };

  const addVariableToFieldsetFromOverview = (fieldsetIndex: number, variableName: string) => {
    const updated = [...fieldsetConfig];
    updated[fieldsetIndex] = {
      ...updated[fieldsetIndex],
      fields: [
        ...updated[fieldsetIndex].fields,
        {
          name: variableName,
          label: variableToLabel(variableName),
          description: '',
          type: inferFieldType(variableName),
        },
      ],
    };
    setFieldsetConfig(updated);
  };

  const removeFieldFromFieldsetInOverview = (fieldsetIndex: number, fieldIndex: number) => {
    const updated = [...fieldsetConfig];
    updated[fieldsetIndex] = {
      ...updated[fieldsetIndex],
      fields: updated[fieldsetIndex].fields.filter((_, i) => i !== fieldIndex),
    };
    setFieldsetConfig(updated);
  };

  const reorderFieldInFieldset = (fieldsetIndex: number, fieldIndex: number, direction: 'up' | 'down') => {
    const updated = [...fieldsetConfig];
    const fields = [...updated[fieldsetIndex].fields];
    const newIndex = direction === 'up' ? fieldIndex - 1 : fieldIndex + 1;
    
    // Bounds check
    if (newIndex < 0 || newIndex >= fields.length) return;
    
    // Swap fields
    [fields[fieldIndex], fields[newIndex]] = [fields[newIndex], fields[fieldIndex]];
    
    updated[fieldsetIndex] = {
      ...updated[fieldsetIndex],
      fields,
    };
    setFieldsetConfig(updated);
  };

  const reorderFieldset = (fieldsetIndex: number, direction: 'up' | 'down') => {
    const updated = [...fieldsetConfig];
    const newIndex = direction === 'up' ? fieldsetIndex - 1 : fieldsetIndex + 1;
    
    // Bounds check
    if (newIndex < 0 || newIndex >= updated.length) return;
    
    // Swap fieldsets
    [updated[fieldsetIndex], updated[newIndex]] = [updated[newIndex], updated[fieldsetIndex]];
    
    setFieldsetConfig(updated);
  };

  const moveFieldFromOverview = (sourceFieldsetIndex: number, sourceFieldIndex: number, targetFieldsetIndex: number) => {
    const updated = [...fieldsetConfig];
    const fieldToMove = updated[sourceFieldsetIndex].fields[sourceFieldIndex];
    
    // Remove from source
    updated[sourceFieldsetIndex] = {
      ...updated[sourceFieldsetIndex],
      fields: updated[sourceFieldsetIndex].fields.filter((_, i) => i !== sourceFieldIndex),
    };
    
    // Add to target
    updated[targetFieldsetIndex] = {
      ...updated[targetFieldsetIndex],
      fields: [...updated[targetFieldsetIndex].fields, fieldToMove],
    };
    
    setFieldsetConfig(updated);
  };

  const handleTemplateUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validExtensions = ['.doc', '.docx'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (!validExtensions.includes(fileExtension)) {
      setError('Please upload a Word document (.doc or .docx)');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setSuccess(null);
      setTemplateUploadResult(null);

      const response = await formService.uploadTemplate(formId, file);
      
      setTemplateUploadResult(response.data);
      
      // Store template info for preview
      if (response.data.template_uploaded && response.data.file_location) {
        setTemplateInfo({
          file_location: response.data.file_location,
          filename: response.data.filename,
          file_size: response.data.file_size,
          upload_timestamp: response.data.upload_timestamp,
        });
      }
      
      // If upload was successful and has valid variables, show fieldset configuration dialog
      if (response.data.status === 'success' && 
          response.data.extraction_results?.valid_variables && 
          response.data.extraction_results.valid_variables.length > 0) {
        // Initialize fieldset config with auto-grouped variables
        const validVariables = response.data.extraction_results.valid_variables;
        
        const grouped = groupVariablesIntoFieldsets(
          validVariables,
          DEFAULT_GROUPING_CONFIG
        );
        
        const initialConfig = grouped.map(({ name, fields }) => ({
          name,
          fields: fields.map(fieldName => ({
            name: fieldName,
            label: variableToLabel(fieldName),
            description: '',
            type: inferFieldType(fieldName),
          })),
        }));
        
        setFieldsetConfig(initialConfig);
        // Auto-expand all fieldsets when modal opens so user can see the grouped fields
        setExpandedConfigFieldsets(new Set(initialConfig.map((_, idx) => idx)));
        setShowFieldsetConfig(true);
        setSuccess('Template uploaded successfully! Configure fieldsets below or skip to continue.');
      } else if (response.data.status === 'success') {
        setSuccess('Template uploaded successfully!');
      } else if (response.data.status === 'has_errors') {
        setSuccess('Template uploaded, but some variables have errors. See details below.');
      } else {
        setSuccess('Template uploaded successfully!');
      }
      
      // Clear the file input
      event.target.value = '';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload template');
    } finally {
      setUploading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => router.back()}
              className="mb-4 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Forms
            </button>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {isEditing ? 'Edit Form' : 'Form Details'}
            </h1>
          </div>
          {!isEditing && form && (
            <button
              onClick={() => setIsEditing(true)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              Edit Form
            </button>
          )}
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

        {loading ? (
          <div className="text-center text-gray-600 dark:text-gray-400">Loading form details...</div>
        ) : form ? (
          isEditing ? (
            <div className="space-y-6">
              {/* Template Upload Section - At the top */}
              <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Word Document Template</h2>
                  {templateInfo && (
                    <button
                      type="button"
                      onClick={handlePreviewTemplate}
                      className="flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-600 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/30"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      Preview Template
                    </button>
                  )}
                </div>
                {templateInfo && (
                  <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-medium">Current template:</span> {templateInfo.filename}
                      {templateInfo.file_size && (
                        <span className="ml-2">({(templateInfo.file_size / 1024).toFixed(2)} KB)</span>
                      )}
                      {templateInfo.upload_timestamp && (
                        <span className="ml-2 text-xs">
                          - Uploaded: {new Date(templateInfo.upload_timestamp).toLocaleString()}
                        </span>
                      )}
                    </p>
                  </div>
                )}
                <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                  Upload a Word document (.doc or .docx) template. The system will extract {'{{variable}}'} placeholders from the document.
                </p>
                <div className="flex items-center gap-3">
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    {uploading ? 'Uploading...' : 'Choose File'}
                    <input
                      type="file"
                      accept=".doc,.docx"
                      onChange={handleTemplateUpload}
                      disabled={uploading}
                      className="hidden"
                    />
                  </label>
                  {uploading && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Uploading...
                    </div>
                  )}
                </div>

                {/* Upload Results */}
                {templateUploadResult && (
                  <div className="mt-4 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-700">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                        Upload Results
                      </h4>
                      {templateUploadResult.status === 'success' && (
                        <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-200">
                          Success
                        </span>
                      )}
                      {templateUploadResult.status === 'has_errors' && (
                        <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
                          Has Errors
                        </span>
                      )}
                    </div>

                    {templateUploadResult.filename && (
                      <div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          <span className="font-medium">File:</span> {templateUploadResult.filename}
                        </p>
                      </div>
                    )}

                    {templateUploadResult.file_size !== undefined && (
                      <div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          <span className="font-medium">Size:</span> {templateUploadResult.file_size.toLocaleString()} bytes
                        </p>
                      </div>
                    )}

                    {templateUploadResult.upload_timestamp && (
                      <div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          <span className="font-medium">Uploaded:</span> {new Date(templateUploadResult.upload_timestamp).toLocaleString()}
                        </p>
                      </div>
                    )}

                    {templateUploadResult.backup_created && (
                      <div>
                        <p className="text-xs text-green-600 dark:text-green-400">
                          <span className="font-medium">Backup created:</span> {templateUploadResult.backup_created}
                        </p>
                      </div>
                    )}

                    {templateUploadResult.extraction_results && (
                      <div className="space-y-2">
                        <div>
                          <h5 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Variable Extraction ({templateUploadResult.extraction_results.total_variables_found} total)
                          </h5>
                          {templateUploadResult.extraction_results.valid_variables.length > 0 && (
                            <div className="mb-2">
                              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                                Valid Variables ({templateUploadResult.extraction_results.valid_variables.length}):
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {templateUploadResult.extraction_results.valid_variables.map((variable, index) => (
                                  <span
                                    key={index}
                                    className="rounded bg-green-100 px-2 py-1 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                  >
                                    {variable}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {templateUploadResult.extraction_results.invalid_variables.length > 0 && (
                            <div>
                              <p className="text-xs text-red-600 dark:text-red-400 mb-1">
                                Invalid Variables ({templateUploadResult.extraction_results.invalid_variables.length}):
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {templateUploadResult.extraction_results.invalid_variables.map((variable, index) => (
                                  <span
                                    key={index}
                                    className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300"
                                  >
                                    {variable}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Basic Form Fields */}
              <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
                <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Basic Information</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Label
                    </label>
                    <input
                      type="text"
                      value={formData.label}
                      onChange={(e) => setFormData({ ...formData, label: e.target.value })}
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
                      rows={3}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Country
                    </label>
                    <select
                      value={formData.country || ''}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value || undefined })}
                      className="w-full appearance-none rounded-lg border border-gray-300 bg-white bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.5em_1.5em] bg-[right_0.75rem_center] bg-no-repeat px-3 py-2 pr-10 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                    >
                      <option value="">Select Country (Optional)</option>
                      {countries.map((country) => (
                        <option key={country.id} value={country.id}>
                          {country.name} ({country.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isFeatured"
                      checked={formData.isFeatured || false}
                      onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                    />
                    <label htmlFor="isFeatured" className="text-sm text-gray-700 dark:text-gray-300">
                      Featured
                    </label>
                  </div>
                </div>
              </div>

              {/* Pricing Information */}
              <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
                <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Pricing Information</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Price
                    </label>
                    <input
                      type="text"
                      value={formData.pricingInfo?.price?.toString() || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Allow only numbers and a single decimal point
                        if (value === '' || /^\d*\.?\d*$/.test(value)) {
                          // Prevent leading zeros unless it's "0" or "0."
                          const numValue = value === '' ? 0 : (value === '.' ? 0 : parseFloat(value));
                          if (!isNaN(numValue) || value === '' || value === '.') {
                            setFormData({
                              ...formData,
                              pricingInfo: {
                                ...formData.pricingInfo,
                                price: value === '' || value === '.' ? 0 : numValue,
                                currency: formData.pricingInfo?.currency || '',
                              }
                            });
                          }
                        }
                      }}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Currency
                    </label>
                    <select
                      value={formData.pricingInfo?.currency || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        pricingInfo: {
                          ...formData.pricingInfo,
                          price: formData.pricingInfo?.price || 0,
                          currency: e.target.value, // Store currency ID
                        }
                      })}
                      className="w-full appearance-none rounded-lg border border-gray-300 bg-white bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.5em_1.5em] bg-[right_0.75rem_center] bg-no-repeat px-3 py-2 pr-10 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                    >
                      <option value="">Select Currency (Optional)</option>
                      {currencies.map((currency) => (
                        <option key={currency.id} value={currency.id}>
                          {currency.label} ({currency.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Fieldsets - Accordion Style */}
              <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Fieldsets</h2>
                  {isEditing && (
                    <button
                      type="button"
                      onClick={addFieldset}
                      className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-600 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/30"
                    >
                      + Add Fieldset
                    </button>
                  )}
                </div>
                {formData.fieldsets && formData.fieldsets.length > 0 ? (
                  <div className="space-y-2">
                    {formData.fieldsets.map((fieldset, fieldsetIndex) => {
                      const isExpanded = expandedFieldsets.has(fieldset.id);
                      return (
                        <div key={fieldset.id} className="rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
                          {/* Accordion Header */}
                          <div className="flex items-center justify-between p-4">
                            <button
                              type="button"
                              onClick={() => {
                                setExpandedFieldsets(prev => {
                                  const next = new Set(prev);
                                  if (next.has(fieldset.id)) {
                                    next.delete(fieldset.id);
                                  } else {
                                    next.add(fieldset.id);
                                  }
                                  return next;
                                });
                              }}
                              className="flex items-center gap-3 flex-1 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded-lg p-2 -ml-2"
                            >
                              <svg
                                className={`h-5 w-5 text-gray-500 dark:text-gray-400 transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                              <div>
                                <h3 className="font-medium text-gray-900 dark:text-white">
                                  {fieldset.label || fieldset.name || `Fieldset ${fieldsetIndex + 1}`}
                                </h3>
                                {fieldset.description && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                                    {fieldset.description}
                                  </p>
                                )}
                              </div>
                            </button>
                            <div className="flex items-center gap-4">
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {fieldset.fields?.length || 0} field{(fieldset.fields?.length || 0) !== 1 ? 's' : ''}
                              </span>
                              {isEditing && (
                                <>
                                  {/* Reorder fieldset buttons */}
                                  <div className="flex items-center gap-0.5 border-l border-gray-200 dark:border-gray-600 pl-2">
                                    <button
                                      type="button"
                                      onClick={() => reorderFormFieldset(fieldset.id, 'up')}
                                      disabled={fieldsetIndex === 0}
                                      className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                                      title="Move fieldset up"
                                    >
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                      </svg>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => reorderFormFieldset(fieldset.id, 'down')}
                                      disabled={fieldsetIndex === (formData.fieldsets?.length || 0) - 1}
                                      className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                                      title="Move fieldset down"
                                    >
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </button>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => removeFieldset(fieldset.id)}
                                    className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                                  >
                                    Remove
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                          
                          {/* Accordion Content */}
                          {isExpanded && (
                            <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-4">
                              {isEditing ? (
                                <div className="space-y-3">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                      Fieldset Name
                                    </label>
                                    <input
                                      type="text"
                                      value={fieldset.name || ''}
                                      onChange={(e) => {
                                        // Convert to uppercase as user types
                                        const uppercased = e.target.value.toUpperCase();
                                        updateFieldset(fieldset.id, { name: uppercased });
                                      }}
                                      className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                      Fieldset Label
                                    </label>
                                    <input
                                      type="text"
                                      value={fieldset.label || ''}
                                      onChange={(e) => updateFieldset(fieldset.id, { label: e.target.value })}
                                      className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                      Fieldset Description
                                    </label>
                                    <textarea
                                      value={fieldset.description || ''}
                                      onChange={(e) => updateFieldset(fieldset.id, { description: e.target.value })}
                                      rows={2}
                                      className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                    />
                                  </div>
                                  <div>
                                    <div className="mb-2 flex items-center justify-between">
                                      <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Fields</label>
                                      <button
                                        type="button"
                                        onClick={() => addField(fieldset.id)}
                                        className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                                      >
                                        + Add Field
                                      </button>
                                    </div>
                                    {fieldset.fields && fieldset.fields.length > 0 ? (
                                      <div className="space-y-3">
                                        {fieldset.fields.map((field, fieldIndex) => (
                                          <div key={field.id} className="rounded border border-gray-300 bg-white p-3 dark:border-gray-600 dark:bg-gray-700">
                                            <div className="mb-2 flex items-center justify-between">
                                              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                                Field: {field.label || field.name || field.id}
                                              </span>
                                              <div className="flex items-center gap-2">
                                                {/* Reorder field buttons */}
                                                <div className="flex items-center gap-0.5">
                                                  <button
                                                    type="button"
                                                    onClick={() => reorderFormField(fieldset.id, field.id, 'up')}
                                                    disabled={fieldIndex === 0}
                                                    className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                                                    title="Move up"
                                                  >
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                                    </svg>
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => reorderFormField(fieldset.id, field.id, 'down')}
                                                    disabled={fieldIndex === (fieldset.fields?.length || 0) - 1}
                                                    className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                                                    title="Move down"
                                                  >
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                  </button>
                                                </div>
                                                <button
                                                  type="button"
                                                  onClick={() => removeField(fieldset.id, field.id)}
                                                  className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                                >
                                                  Remove
                                                </button>
                                              </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                              <div>
                                                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Name</label>
                                                <input
                                                  type="text"
                                                  value={field.name || ''}
                                                  onChange={(e) => updateField(fieldset.id, field.id, { name: e.target.value })}
                                                  className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                                                />
                                              </div>
                                              <div>
                                                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Label</label>
                                                <input
                                                  type="text"
                                                  value={field.label || ''}
                                                  onChange={(e) => updateField(fieldset.id, field.id, { label: e.target.value })}
                                                  className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                                                />
                                              </div>
                                              <div className="col-span-2">
                                                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Description</label>
                                                <input
                                                  type="text"
                                                  value={field.description || ''}
                                                  onChange={(e) => updateField(fieldset.id, field.id, { description: e.target.value })}
                                                  className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                                                />
                                              </div>
                                              <div>
                                                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Type</label>
                                                <select
                                                  value={field.type || ''}
                                                  onChange={(e) => updateField(fieldset.id, field.id, { type: e.target.value })}
                                                  className="w-full appearance-none rounded border border-gray-300 bg-white bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1em_1em] bg-[right_0.5rem_center] bg-no-repeat px-2 py-1 pr-8 text-xs text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                                                >
                                                  <option value="">Select Type</option>
                                                  {FORM_FIELD_TYPES.map((type) => (
                                                    <option key={type} value={type} className="bg-white dark:bg-gray-800">
                                                      {type}
                                                    </option>
                                                  ))}
                                                </select>
                                              </div>
                                              <div>
                                                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Widget</label>
                                                <input
                                                  type="text"
                                                  value={field.widget || ''}
                                                  onChange={(e) => updateField(fieldset.id, field.id, { widget: e.target.value })}
                                                  className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                                                />
                                              </div>
                                              <div>
                                                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Validator</label>
                                                <input
                                                  type="text"
                                                  value={field.validator || ''}
                                                  onChange={(e) => updateField(fieldset.id, field.id, { validator: e.target.value })}
                                                  className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                                                />
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <input
                                                  type="checkbox"
                                                  checked={field.isRequired || false}
                                                  onChange={(e) => updateField(fieldset.id, field.id, { isRequired: e.target.checked })}
                                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                                                />
                                                <label className="text-xs text-gray-600 dark:text-gray-400">Required</label>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-gray-500 dark:text-gray-400">No fields in this fieldset</p>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                // View mode - read-only
                                <div className="space-y-2">
                                  {fieldset.description && (
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                      {fieldset.description}
                                    </p>
                                  )}
                                  {fieldset.fields && fieldset.fields.length > 0 && (
                                    <div>
                                      <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Fields ({fieldset.fields.length}):
                                      </h4>
                                      <div className="space-y-2">
                                        {fieldset.fields.map((field) => (
                                          <div key={field.id} className="rounded border border-gray-200 bg-white p-2 dark:border-gray-600 dark:bg-gray-700">
                                            <div className="flex items-center justify-between">
                                              <span className="text-xs font-medium text-gray-900 dark:text-white">
                                                {field.label || field.name || field.id}
                                              </span>
                                              <div className="flex items-center gap-2">
                                                {field.type && (
                                                  <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                                    {field.type}
                                                  </span>
                                                )}
                                                {field.isRequired && (
                                                  <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
                                                    Required
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                            {field.description && (
                                              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                                                {field.description}
                                              </p>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No fieldsets added</p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={saving}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
            ) : (
            <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
              <div className="space-y-6">
                {/* Template Preview Section - At the top for view mode */}
                {(templateInfo || form.template) && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                          Word Document Template
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {templateInfo ? (
                            <>
                              <span className="font-medium">File:</span> {templateInfo.filename}
                              {templateInfo.file_size && (
                                <span className="ml-2">({(templateInfo.file_size / 1024).toFixed(2)} KB)</span>
                              )}
                              {templateInfo.upload_timestamp && (
                                <span className="ml-2 text-xs">
                                  - Uploaded: {new Date(templateInfo.upload_timestamp).toLocaleString()}
                                </span>
                              )}
                            </>
                          ) : (
                            <>
                              <span className="font-medium">Template:</span> {form.template}
                            </>
                          )}
                        </p>
                      </div>
                      {(templateInfo || form.template) && (
                        <button
                          type="button"
                          onClick={handlePreviewTemplate}
                          className="flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-600 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/30"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Preview Template
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                      {form.label || form.name}
                    </h2>
                    {form.name && form.name !== form.label && (
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Name: {form.name}
                      </p>
                    )}
                  </div>
                  {(form.featured || form.isFeatured) && (
                    <span className="rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
                      Featured
                    </span>
                  )}
                </div>

                {form.description && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Description
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      {form.description}
                    </p>
                  </div>
                )}

                {form.country && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Country
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      {typeof form.country === 'string' 
                        ? (countries.find(c => c.id === form.country)?.name || form.country)
                        : ((form.country as any)?.name || (form.country as any)?.id || 'N/A')}
                    </p>
                  </div>
                )}

                {form.pricingInfo && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Pricing
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      {typeof form.pricingInfo.currency === 'string'
                        ? form.pricingInfo.currency
                        : (form.pricingInfo.currency as any)?.code || (form.pricingInfo.currency as any)?.label || 'N/A'
                      } {form.pricingInfo.price}
                    </p>
                  </div>
                )}

                {form.fieldsets && form.fieldsets.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Fieldsets ({form.fieldsets.length})
                    </h3>
                    <div className="space-y-2">
                      {form.fieldsets.map((fieldset, fieldsetIndex) => {
                        const isExpanded = expandedFieldsets.has(fieldset.id);
                        return (
                          <div key={fieldset.id} className="rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
                            {/* Accordion Header */}
                            <div className="flex items-center justify-between p-4">
                              <button
                                type="button"
                                onClick={() => {
                                  setExpandedFieldsets(prev => {
                                    const next = new Set(prev);
                                    if (next.has(fieldset.id)) {
                                      next.delete(fieldset.id);
                                    } else {
                                      next.add(fieldset.id);
                                    }
                                    return next;
                                  });
                                }}
                                className="flex items-center gap-3 flex-1 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded-lg p-2 -ml-2"
                              >
                                <svg
                                  className={`h-5 w-5 text-gray-500 dark:text-gray-400 transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                <div>
                                  <h4 className="font-medium text-gray-900 dark:text-white">
                                    {fieldset.label || fieldset.name || `Fieldset ${fieldsetIndex + 1}`}
                                  </h4>
                                  {fieldset.description && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                                      {fieldset.description}
                                    </p>
                                  )}
                                </div>
                              </button>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {fieldset.fields?.length || 0} field{(fieldset.fields?.length || 0) !== 1 ? 's' : ''}
                              </span>
                            </div>
                            
                            {/* Accordion Content */}
                            {isExpanded && (
                              <div className="border-t border-gray-200 dark:border-gray-700 p-4">
                                {fieldset.description && (
                                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                    {fieldset.description}
                                  </p>
                                )}
                                {fieldset.fields && fieldset.fields.length > 0 && (
                                  <div className="space-y-2">
                                    {fieldset.fields.map((field) => (
                                      <div key={field.id} className="rounded border border-gray-200 bg-white p-2 dark:border-gray-600 dark:bg-gray-700">
                                        <div className="flex items-center justify-between">
                                          <span className="text-xs font-medium text-gray-900 dark:text-white">
                                            {field.label || field.name || field.id}
                                          </span>
                                          <div className="flex items-center gap-2">
                                            {field.type && (
                                              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                                {field.type}
                                              </span>
                                            )}
                                            {field.isRequired && (
                                              <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
                                                Required
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        {field.description && (
                                          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                                            {field.description}
                                          </p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {form.type && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Type
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      {formatFormType(form.type)}
                    </p>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Form ID
                  </h3>
                  <p className="font-mono text-sm text-gray-600 dark:text-gray-400">
                    {form.id}
                  </p>
                </div>
              </div>
            </div>
          )
        ) : (
          <div className="text-center text-gray-500 dark:text-gray-400">
            Form not found
          </div>
        )}
      </div>
      
      {/* Template Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4" onClick={() => setShowPreviewModal(false)}>
          <div className="relative h-full w-full max-w-6xl rounded-lg bg-white shadow-xl dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex h-full flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Template Preview
                </h2>
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(false)}
                  className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                  aria-label="Close preview"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Preview Content */}
              <div className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-800 p-4">
                {previewLoading ? (
                  <div className="flex h-full items-center justify-center">
                    <div className="text-center">
                      <svg className="mx-auto h-8 w-8 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">Loading preview...</p>
                    </div>
                  </div>
                ) : convertedHtml ? (
                  // Display converted HTML
                  <div className="flex h-full flex-col">
                    {/* Toolbar */}
                    <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-2 dark:border-gray-700 dark:bg-gray-800">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Document converted to HTML
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleExportToPdf}
                          className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          Export as PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setConvertedHtml(null);
                          }}
                          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                        >
                          Back
                        </button>
                      </div>
                    </div>
                    {/* Content */}
                    <div className="flex-1 overflow-auto bg-gray-100 p-4 dark:bg-gray-900">
                      <div 
                        className="mx-auto bg-white shadow-lg"
                        style={{ maxWidth: '8.5in', minHeight: '11in', padding: '1in' }}
                        dangerouslySetInnerHTML={{ __html: convertedHtml }}
                      />
                    </div>
                  </div>
                ) : previewError || !canPreviewInBrowser() ? (
                  <div className="flex h-full flex-col items-center justify-center">
                    <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-6 text-center dark:border-yellow-800 dark:bg-yellow-900/20 max-w-md">
                      <svg className="mx-auto h-12 w-12 text-yellow-600 dark:text-yellow-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <h3 className="mb-2 text-lg font-semibold text-yellow-900 dark:text-yellow-200">
                        Document Preview Not Available
                      </h3>
                      <p className="mb-4 text-sm text-yellow-800 dark:text-yellow-300">
                        {previewError || 'Word documents cannot be previewed directly in the browser. You can convert it to HTML for preview or download the file.'}
                      </p>
                      <div className="flex flex-col gap-2">
                        {!previewError && (
                          <button
                            type="button"
                            onClick={handleConvertToHtml}
                            disabled={isConverting}
                            className="inline-block rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-green-500 dark:hover:bg-green-600"
                          >
                            {isConverting ? (
                              <span className="flex items-center justify-center gap-2">
                                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Converting...
                              </span>
                            ) : (
                              'View as HTML'
                            )}
                          </button>
                        )}
                        {getDownloadUrl() && (
                          <a
                            href={getDownloadUrl()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                          >
                            Download Document
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setShowPreviewModal(false);
                            setConvertedHtml(null);
                          }}
                          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full w-full">
                    <object
                      data={getPreviewUrl()}
                      type={previewContentType || 'application/pdf'}
                      className="h-full w-full min-h-[600px] rounded border border-gray-300 dark:border-gray-600"
                      title="Template Preview"
                    >
                      <div className="flex h-full min-h-[600px] flex-col items-center justify-center rounded-lg border border-gray-300 bg-white p-8 dark:border-gray-600 dark:bg-gray-800">
                        <p className="mb-4 text-gray-600 dark:text-gray-400">
                          Unable to display preview. Your browser might not support direct rendering of this document type.
                        </p>
                        <div className="flex gap-3">
                          <a
                            href={getPreviewUrl()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                          >
                            Open in New Tab
                          </a>
                          {getDownloadUrl() && (
                            <a
                              href={getDownloadUrl()}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                            >
                              Download
                            </a>
                          )}
                        </div>
                      </div>
                    </object>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fieldset Configuration Modal */}
      {showFieldsetConfig && templateUploadResult?.extraction_results && formId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-4 flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Configure Fieldsets
                </h2>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Template uploaded successfully! {templateUploadResult.extraction_results.valid_variables.length} variables were extracted.
                  Group them into fieldsets below, or skip to continue editing the form.
                </p>
              </div>
              {/* Top action buttons */}
              <div className="flex gap-2 ml-4">
                <button
                  type="button"
                  onClick={handleSkipFieldsetConfig}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Skip
                </button>
                <button
                  type="button"
                  onClick={handleSaveFieldsetConfig}
                  disabled={configuringFieldsets}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                  {configuringFieldsets ? 'Saving...' : 'Save & Continue'}
                </button>
              </div>
            </div>

            {error && (
              <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
                {error}
              </div>
            )}

            {/* Overview Section */}
            {fieldsetConfig.length > 0 && (
              <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  Overview ({fieldsetConfig.length} fieldset{fieldsetConfig.length !== 1 ? 's' : ''}, {fieldsetConfig.reduce((sum, fs) => sum + fs.fields.length, 0)} field{fieldsetConfig.reduce((sum, fs) => sum + fs.fields.length, 0) !== 1 ? 's' : ''})
                </h3>
                <div className="space-y-2">
                  {fieldsetConfig.map((fieldset, idx) => {
                    const isExpanded = expandedConfigFieldsets.has(idx);
                    return (
                      <div key={idx} className="rounded border border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-700">
                        <div className="w-full flex items-center justify-between p-3">
                          <div className="flex items-center gap-3 flex-1">
                            <button
                              type="button"
                              onClick={() => toggleConfigFieldsetExpansion(idx)}
                              className="flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors rounded px-2 py-1 -ml-2"
                            >
                              <svg
                                className={`h-4 w-4 text-gray-500 dark:text-gray-400 transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                            <input
                              type="text"
                              value={fieldset.name}
                              onChange={(e) => {
                                // Convert to uppercase as user types
                                const uppercased = e.target.value.toUpperCase();
                                updateFieldsetInConfig(idx, { name: uppercased });
                              }}
                              placeholder={`FIELDSET_${idx + 1}`}
                              className="flex-1 text-sm font-medium text-gray-900 dark:text-white bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-2 py-1"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {fieldset.fields.length} field{fieldset.fields.length !== 1 ? 's' : ''}
                            </span>
                            {/* Reorder fieldset buttons */}
                            <div className="flex items-center gap-0.5 border-l border-gray-200 dark:border-gray-600 pl-2 ml-1">
                              <button
                                type="button"
                                onClick={() => reorderFieldset(idx, 'up')}
                                disabled={idx === 0}
                                className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Move fieldset up"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => reorderFieldset(idx, 'down')}
                                disabled={idx === fieldsetConfig.length - 1}
                                className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Move fieldset down"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeFieldsetFromConfig(idx)}
                              className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="border-t border-gray-200 dark:border-gray-600 p-3 space-y-3">
                            {/* Fields in this fieldset */}
                            <div className="mb-3 flex items-center justify-between">
                              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Fields</label>
                              <button
                                type="button"
                                onClick={() => {
                                  const newField = {
                                    name: '',
                                    label: '',
                                    description: '',
                                    type: 'TEXT',
                                  };
                                  const updated = [...fieldsetConfig];
                                  updated[idx] = {
                                    ...updated[idx],
                                    fields: [...updated[idx].fields, newField],
                                  };
                                  setFieldsetConfig(updated);
                                  // Auto-expand the new field
                                  const fieldKey = `${idx}-${updated[idx].fields.length - 1}`;
                                  setExpandedConfigFields(prev => new Set([...prev, fieldKey]));
                                }}
                                className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                              >
                                + Add Field
                              </button>
                            </div>
                            <div className="space-y-2">
                              {fieldset.fields.length > 0 ? (
                                fieldset.fields.map((field, fieldIdx) => {
                                  const fieldKey = `${idx}-${fieldIdx}`;
                                  const isFieldExpanded = expandedConfigFields.has(fieldKey);
                                  return (
                                    <div key={fieldIdx} className={`rounded border bg-white dark:bg-gray-700 ${
                                      !field.name || field.name.trim() === ''
                                        ? 'border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20'
                                        : 'border-gray-200 dark:border-gray-600'
                                    }`}>
                                      <div className="flex items-center justify-between p-2">
                                        <button
                                          type="button"
                                          onClick={() => toggleFieldExpansion(idx, fieldIdx)}
                                          className="flex items-center gap-2 flex-1 text-left hover:bg-gray-50 dark:hover:bg-gray-600 rounded px-2 py-1 -ml-2"
                                        >
                                          <svg
                                            className={`h-3 w-3 text-gray-500 dark:text-gray-400 transform transition-transform ${isFieldExpanded ? 'rotate-90' : ''}`}
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                          >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                          </svg>
                                          <span className={`text-xs font-medium ${
                                            !field.name || field.name.trim() === ''
                                              ? 'text-red-700 dark:text-red-300'
                                              : 'text-gray-700 dark:text-gray-300'
                                          }`}>
                                            {field.name || <span className="italic text-red-600 dark:text-red-400">⚠️ Name required (click to edit)</span>}
                                          </span>
                                        </button>
                                        <div className="flex items-center gap-2">
                                          {/* Reorder buttons */}
                                          <div className="flex items-center gap-0.5">
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                reorderFieldInFieldset(idx, fieldIdx, 'up');
                                              }}
                                              disabled={fieldIdx === 0}
                                              className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                                              title="Move up"
                                            >
                                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                              </svg>
                                            </button>
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                reorderFieldInFieldset(idx, fieldIdx, 'down');
                                              }}
                                              disabled={fieldIdx === fieldset.fields.length - 1}
                                              className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                                              title="Move down"
                                            >
                                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                              </svg>
                                            </button>
                                          </div>
                                          {/* Move field to another fieldset */}
                                          {fieldsetConfig.length > 1 && (
                                            <select
                                              value=""
                                              onChange={(e) => {
                                                if (e.target.value && e.target.value !== String(idx)) {
                                                  moveFieldFromOverview(idx, fieldIdx, parseInt(e.target.value));
                                                  e.target.value = '';
                                                }
                                              }}
                                              onClick={(e) => e.stopPropagation()}
                                              className="text-xs appearance-none rounded-lg border border-gray-300 bg-white bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1em_1em] bg-[right_0.5rem_center] bg-no-repeat px-2 py-1 pr-8 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                                            >
                                              <option value="">Move to...</option>
                                              {fieldsetConfig.map((fs, fsIdx) => (
                                                fsIdx !== idx && (
                                                  <option key={fsIdx} value={fsIdx} className="bg-white dark:bg-gray-800">
                                                    {fs.name || `Fieldset ${fsIdx + 1}`}
                                                  </option>
                                                )
                                              ))}
                                            </select>
                                          )}
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              removeFieldFromFieldsetInOverview(idx, fieldIdx);
                                            }}
                                            className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                          >
                                            Remove
                                          </button>
                                        </div>
                                      </div>
                                      {/* Expanded field details */}
                                      {isFieldExpanded && (
                                        <div className="border-t border-gray-200 dark:border-gray-600 p-3 space-y-2">
                                          <div className="grid grid-cols-2 gap-2">
                                            <div className="col-span-2">
                                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Name <span className="text-red-500">*</span>
                                              </label>
                                              <input
                                                type="text"
                                                value={field.name || ''}
                                                onChange={(e) => {
                                                  // Format the name as user types (uppercase, spaces to underscores, remove non-alphanumeric except underscores)
                                                  const formatted = formatFieldName(e.target.value);
                                                  updateFieldInConfig(idx, fieldIdx, { name: formatted });
                                                }}
                                                placeholder={field.label ? generateFieldNameFromLabel(field.label) || 'e.g., PARTY_A_NAME' : 'e.g., PARTY_A_NAME'}
                                                className={`w-full rounded border px-2 py-1 text-xs dark:bg-gray-800 dark:text-white ${
                                                  !field.name || field.name.trim() === ''
                                                    ? 'border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20'
                                                    : 'border-gray-300 dark:border-gray-600 bg-white'
                                                }`}
                                              />
                                              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                Field name (required). Auto-generated from label, or enter manually. Use UPPER_SNAKE_CASE format.
                                              </p>
                                            </div>
                                            <div>
                                              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Label</label>
                                              <input
                                                type="text"
                                                value={field.label || ''}
                                                onChange={(e) => {
                                                  const newLabel = e.target.value;
                                                  // Auto-generate name from label if name is empty or matches the previous auto-generated value
                                                  const currentField = fieldsetConfig[idx].fields[fieldIdx];
                                                  const previousAutoGeneratedName = generateFieldNameFromLabel(currentField.label || '');
                                                  const shouldAutoGenerate = !currentField.name || currentField.name === previousAutoGeneratedName;
                                                  
                                                  updateFieldInConfig(idx, fieldIdx, {
                                                    label: newLabel,
                                                    name: shouldAutoGenerate ? generateFieldNameFromLabel(newLabel) : currentField.name,
                                                  });
                                                }}
                                                placeholder={field.name ? variableToLabel(field.name) : 'Field label'}
                                                className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                                              />
                                            </div>
                                            <div>
                                              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Type</label>
                                              <select
                                                value={field.type || ''}
                                                onChange={(e) => updateFieldInConfig(idx, fieldIdx, { type: e.target.value })}
                                                className="w-full appearance-none rounded border border-gray-300 bg-white bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1em_1em] bg-[right_0.5rem_center] bg-no-repeat px-2 py-1 pr-8 text-xs text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                                              >
                                                <option value="">Select Type</option>
                                                {FORM_FIELD_TYPES.map((type) => (
                                                  <option key={type} value={type} className="bg-white dark:bg-gray-800">
                                                    {type}
                                                  </option>
                                                ))}
                                              </select>
                                            </div>
                                            <div className="col-span-2">
                                              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Description</label>
                                              <input
                                                type="text"
                                                value={field.description || ''}
                                                onChange={(e) => updateFieldInConfig(idx, fieldIdx, { description: e.target.value })}
                                                placeholder="Field description"
                                                className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })
                              ) : (
                                <p className="text-xs text-gray-500 dark:text-gray-400">No fields in this fieldset</p>
                              )}
                            </div>
                            
                            {/* Add variable to this fieldset */}
                            {getUnassignedVariables().length > 0 && (
                              <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Add Variable to This Fieldset
                                </label>
                                <select
                                  value=""
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      addVariableToFieldsetFromOverview(idx, e.target.value);
                                      e.target.value = '';
                                    }
                                  }}
                                  className="w-full appearance-none rounded-lg border border-gray-300 bg-white bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1em_1em] bg-[right_0.5rem_center] bg-no-repeat px-2 py-1 pr-8 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                                >
                                  <option value="">Select a variable...</option>
                                  {getUnassignedVariables().map((variable) => (
                                    <option key={variable} value={variable} className="bg-white dark:bg-gray-800">
                                      {variable}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Unassigned Variables Section */}
            {getUnassignedVariables().length > 0 && (
              <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                <h3 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
                  Unassigned Variables ({getUnassignedVariables().length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {getUnassignedVariables().map((variable) => (
                    <span
                      key={variable}
                      className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    >
                      {variable}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Add Fieldset Button */}
            <div className="mb-6">
              <button
                type="button"
                onClick={addFieldsetToConfig}
                className="w-full rounded-lg border border-dashed border-gray-300 bg-white px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                + Add Fieldset
              </button>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
              <button
                type="button"
                onClick={handleSkipFieldsetConfig}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={handleSaveFieldsetConfig}
                disabled={configuringFieldsets}
                className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                {configuringFieldsets ? 'Saving...' : 'Save & Continue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

