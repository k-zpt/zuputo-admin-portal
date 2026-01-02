'use client';

import { AdminLayout } from "@/components/AdminLayout";
import { formService, countryService, currencyService } from "@/lib/api/services";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ApiResponse, Country, Currency, CreateFormPayload, CreateFieldsetPayload, CreateFieldPayload, FieldOption, Conditional, ConfigureFieldsetPayload } from "@/lib/api/types";
import { FORM_FIELD_TYPES } from "@/lib/formConfig";
import { FORM_TYPES, formatFormType } from "@/lib/formUtils";
import { groupVariablesIntoFieldsets, DEFAULT_GROUPING_CONFIG } from "@/lib/fieldsetGrouping";

export default function CreateFormPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templateMethod, setTemplateMethod] = useState<'text' | 'file'>('text');
  const [showFieldsetConfig, setShowFieldsetConfig] = useState(false);
  const [templateUploadResult, setTemplateUploadResult] = useState<{
    valid_variables: string[];
    invalid_variables: string[];
    total_variables_found: number;
    status?: 'success' | 'has_errors';
  } | null>(null);
  const [createdFormId, setCreatedFormId] = useState<string | null>(null);
  const [configuringFieldsets, setConfiguringFieldsets] = useState(false);
  
  const [formData, setFormData] = useState<CreateFormPayload>({
    name: '',
    label: '',
    description: '',
    type: FORM_TYPES.CONTRACT, // Default form type
    fieldsets: [],
    template: '',
    countryCode: '',
    pricingInfo: {
      price: 0,
      currency: '',
    },
  });

  useEffect(() => {
    loadCountries();
    loadCurrencies();
  }, []);

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

  // Format name: remove non-alphanumeric (except underscores), uppercase, spaces to underscores
  const formatName = (input: string): string => {
    return input
      .replace(/[^a-zA-Z0-9_\s]/g, '') // Remove non-alphanumeric (except underscores and spaces)
      .replace(/\s+/g, '_') // Convert spaces to underscores
      .toUpperCase(); // Convert to uppercase
  };

  // Generate name from label
  const generateNameFromLabel = (label: string): string => {
    return formatName(label);
  };

  // Convert variable name to label (e.g., "PARTY_A" -> "Party A")
  const variableToLabel = (variable: string): string => {
    return variable
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const handleLabelChange = (label: string) => {
    setFormData(prev => {
      // Auto-generate name if name is empty or matches the previous generated name
      const shouldAutoGenerate = !prev.name || prev.name === generateNameFromLabel(prev.label);
      return {
        ...prev,
        label,
        name: shouldAutoGenerate ? generateNameFromLabel(label) : prev.name,
      };
    });
  };

  const handleNameChange = (name: string) => {
    // Format the name as user types
    const formatted = formatName(name);
    setFormData(prev => ({ ...prev, name: formatted }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      
      // Validate required fields
      if (!formData.label || !formData.countryCode) {
        setError('Please fill in all required fields');
        return;
      }

      // Validate template input
      if (templateMethod === 'text' && !formData.template) {
        setError('Please provide a template filename or upload a template file');
        return;
      }

      if (templateMethod === 'file' && !templateFile) {
        setError('Please select a template file to upload');
        return;
      }

      // Ensure name is generated from label if not provided
      const finalFormData = {
        ...formData,
        name: formData.name || generateNameFromLabel(formData.label),
        // If uploading file, template will be set after upload
        template: templateMethod === 'text' ? formData.template : '',
      };

      // Create the form first
      const response = await formService.create(finalFormData);
      const formId = response.data.id;

      // If a file was uploaded, upload it to the form
      if (templateMethod === 'file' && templateFile) {
        try {
          setUploading(true);
          const uploadResponse = await formService.uploadTemplate(formId, templateFile);
          
          // If upload was successful and has valid variables, show fieldset configuration dialog
          if (uploadResponse.data.status === 'success' && 
              uploadResponse.data.extraction_results?.valid_variables && 
              uploadResponse.data.extraction_results.valid_variables.length > 0) {
            setTemplateUploadResult(uploadResponse.data.extraction_results);
            setCreatedFormId(formId);
            setShowFieldsetConfig(true);
            setUploading(false);
            return; // Don't navigate yet, wait for user to configure fieldsets or skip
          }
        } catch (uploadErr) {
          setError(uploadErr instanceof Error ? uploadErr.message : 'Form created but template upload failed');
          // Still navigate to the form page even if upload fails
        } finally {
          setUploading(false);
        }
      }

      router.push(`/forms/${formId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create form');
    } finally {
      setLoading(false);
    }
  };

  const addFieldset = () => {
    setFormData({
      ...formData,
      fieldsets: [
        ...formData.fieldsets,
        {
          name: '',
          label: '',
          description: '',
          fields: [],
        },
      ],
    });
  };

  const removeFieldset = (index: number) => {
    setFormData({
      ...formData,
      fieldsets: formData.fieldsets.filter((_, i) => i !== index),
    });
  };

  const updateFieldset = (index: number, updates: Partial<CreateFieldsetPayload>) => {
    const updated = [...formData.fieldsets];
    updated[index] = { ...updated[index], ...updates };
    setFormData({ ...formData, fieldsets: updated });
  };

  const addField = (fieldsetIndex: number) => {
    const updated = [...formData.fieldsets];
    updated[fieldsetIndex] = {
      ...updated[fieldsetIndex],
      fields: [
        ...updated[fieldsetIndex].fields,
        {
          name: '',
          label: '',
          description: '',
          type: 'TEXT',
          isRequired: false,
        },
      ],
    };
    setFormData({ ...formData, fieldsets: updated });
  };

  const removeField = (fieldsetIndex: number, fieldIndex: number) => {
    const updated = [...formData.fieldsets];
    updated[fieldsetIndex] = {
      ...updated[fieldsetIndex],
      fields: updated[fieldsetIndex].fields.filter((_, i) => i !== fieldIndex),
    };
    setFormData({ ...formData, fieldsets: updated });
  };

  const updateField = (fieldsetIndex: number, fieldIndex: number, updates: Partial<CreateFieldPayload>) => {
    const updated = [...formData.fieldsets];
    const updatedFields = [...updated[fieldsetIndex].fields];
    updatedFields[fieldIndex] = { ...updatedFields[fieldIndex], ...updates };
    updated[fieldsetIndex] = { ...updated[fieldsetIndex], fields: updatedFields };
    setFormData({ ...formData, fieldsets: updated });
  };

  const addFieldOption = (fieldsetIndex: number, fieldIndex: number) => {
    const updated = [...formData.fieldsets];
    const updatedFields = [...updated[fieldsetIndex].fields];
    const field = updatedFields[fieldIndex];
    updatedFields[fieldIndex] = {
      ...field,
      options: [...(field.options || []), { label: '', value: '' }],
    };
    updated[fieldsetIndex] = { ...updated[fieldsetIndex], fields: updatedFields };
    setFormData({ ...formData, fieldsets: updated });
  };

  const removeFieldOption = (fieldsetIndex: number, fieldIndex: number, optionIndex: number) => {
    const updated = [...formData.fieldsets];
    const updatedFields = [...updated[fieldsetIndex].fields];
    const field = updatedFields[fieldIndex];
    updatedFields[fieldIndex] = {
      ...field,
      options: field.options?.filter((_, i) => i !== optionIndex) || [],
    };
    updated[fieldsetIndex] = { ...updated[fieldsetIndex], fields: updatedFields };
    setFormData({ ...formData, fieldsets: updated });
  };

  const updateFieldOption = (fieldsetIndex: number, fieldIndex: number, optionIndex: number, updates: Partial<FieldOption>) => {
    const updated = [...formData.fieldsets];
    const updatedFields = [...updated[fieldsetIndex].fields];
    const field = updatedFields[fieldIndex];
    const updatedOptions = [...(field.options || [])];
    updatedOptions[optionIndex] = { ...updatedOptions[optionIndex], ...updates };
    updatedFields[fieldIndex] = { ...field, options: updatedOptions };
    updated[fieldsetIndex] = { ...updated[fieldsetIndex], fields: updatedFields };
    setFormData({ ...formData, fieldsets: updated });
  };

  const updateConditional = (fieldsetIndex: number, fieldIndex: number, conditional: Conditional | undefined) => {
    const updated = [...formData.fieldsets];
    const updatedFields = [...updated[fieldsetIndex].fields];
    updatedFields[fieldIndex] = { ...updatedFields[fieldIndex], conditional };
    updated[fieldsetIndex] = { ...updated[fieldsetIndex], fields: updatedFields };
    setFormData({ ...formData, fieldsets: updated });
  };

  const getSupportedCurrencies = (countryCode: string): Currency[] => {
    if (!countryCode) return currencies;
    const country = countries.find(c => c.code === countryCode);
    if (!country) return currencies;

    const supportedCurrencyCodes = country.currencies.map(c =>
      typeof c === 'string' ? c : c.code
    );

    return currencies.filter(c => supportedCurrencyCodes.includes(c.code));
  };

  // Fieldset configuration state
  const [fieldsetConfig, setFieldsetConfig] = useState<Array<{
    name: string;
    fields: Array<{
      name: string;
      label?: string;
      description?: string;
      type?: string;
    }>;
  }>>([]);

  // Initialize fieldset config when template upload result is available
  useEffect(() => {
    if (templateUploadResult?.valid_variables && templateUploadResult.valid_variables.length > 0) {
      // Use the grouping utility function (easily configurable via fieldsetGrouping.ts)
      const grouped = groupVariablesIntoFieldsets(
        templateUploadResult.valid_variables,
        DEFAULT_GROUPING_CONFIG // Can be customized here if needed
      );

      // Convert to fieldset config format
      const initialConfig = grouped.map(({ name, fields }) => ({
        name,
        fields: fields.map(fieldName => ({
          name: fieldName,
          label: variableToLabel(fieldName),
          description: '',
          type: '',
        })),
      }));

      setFieldsetConfig(initialConfig);
    }
  }, [templateUploadResult]);

  const handleSkipFieldsetConfig = () => {
    if (createdFormId) {
      router.push(`/forms/${createdFormId}`);
    }
  };

  const handleSaveFieldsetConfig = async () => {
    if (!createdFormId) return;

    try {
      setConfiguringFieldsets(true);
      setError(null);

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

      await formService.configureFieldsets(createdFormId, payload);
      router.push(`/forms/${createdFormId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to configure fieldsets');
    } finally {
      setConfiguringFieldsets(false);
    }
  };

  const addFieldsetToConfig = () => {
    const newFieldset = { name: '', fields: [] };
    setFieldsetConfig([...fieldsetConfig, newFieldset]);
    // Auto-expand the new fieldset
    const newIndex = fieldsetConfig.length;
    setExpandedFieldsets(prev => new Set([...prev, newIndex]));
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
          type: '',
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
    if (!templateUploadResult?.valid_variables) return [];
    const assigned = new Set(fieldsetConfig.flatMap(fs => fs.fields.map(f => f.name)));
    return templateUploadResult.valid_variables.filter(v => !assigned.has(v));
  };

  // Expanded fieldsets in overview
  const [expandedFieldsets, setExpandedFieldsets] = useState<Set<number>>(new Set());
  // Expanded fields for "see more" functionality
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());

  const toggleFieldsetExpansion = (index: number) => {
    setExpandedFieldsets(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
        // Also collapse all fields in this fieldset when collapsing the fieldset
        fieldsetConfig[index]?.fields.forEach((_, fieldIdx) => {
          setExpandedFields(prevFields => {
            const nextFields = new Set(prevFields);
            nextFields.delete(`${index}-${fieldIdx}`);
            return nextFields;
          });
        });
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const toggleFieldExpansion = (fieldsetIndex: number, fieldIndex: number) => {
    const key = `${fieldsetIndex}-${fieldIndex}`;
    setExpandedFields(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
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
          type: '',
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
              Create New Form
            </h1>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Basic Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Label *
                </label>
                <input
                  type="text"
                  required
                  value={formData.label}
                  onChange={(e) => handleLabelChange(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Auto-generated from label (e.g., CONTRACT_FORM)"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Optional. Auto-generated from label. Only alphanumeric characters and underscores allowed.
                </p>
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
                  Type *
                </label>
                <select
                  required
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full appearance-none rounded-lg border border-gray-300 bg-white bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.5em_1.5em] bg-[right_0.75rem_center] bg-no-repeat px-3 py-2 pr-10 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                >
                  {Object.values(FORM_TYPES).map((type) => (
                    <option key={type} value={type}>
                      {formatFormType(type)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Template *
                </label>
                <div className="mb-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTemplateMethod('text');
                      setTemplateFile(null);
                    }}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      templateMethod === 'text'
                        ? 'bg-blue-600 text-white dark:bg-blue-500'
                        : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                    }`}
                  >
                    Enter Template Name
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTemplateMethod('file');
                      setFormData({ ...formData, template: '' });
                    }}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      templateMethod === 'file'
                        ? 'bg-blue-600 text-white dark:bg-blue-500'
                        : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                    }`}
                  >
                    Upload Template File
                  </button>
                </div>
                {templateMethod === 'text' ? (
                  <div>
                    <input
                      type="text"
                      required={templateMethod === 'text'}
                      value={formData.template}
                      onChange={(e) => setFormData({ ...formData, template: e.target.value })}
                      placeholder="e.g., Generic_Agreement.docx"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Template filename (must exist in the system)
                    </p>
                  </div>
                ) : (
                  <div>
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      {templateFile ? templateFile.name : 'Choose File (.doc or .docx)'}
                      <input
                        type="file"
                        accept=".doc,.docx"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            // Validate file type
                            const validExtensions = ['.doc', '.docx'];
                            const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
                            if (!validExtensions.includes(fileExtension)) {
                              setError('Please upload a Word document (.doc or .docx)');
                              return;
                            }
                            setTemplateFile(file);
                            setError(null);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                    {templateFile && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Selected: {templateFile.name} ({(templateFile.size / 1024).toFixed(2)} KB)
                      </p>
                    )}
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Upload a Word document template. The file will be uploaded after the form is created.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Country and Pricing */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Country & Pricing</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Country Code *
                </label>
                <select
                  required
                  value={formData.countryCode}
                  onChange={(e) => {
                    setFormData({ 
                      ...formData, 
                      countryCode: e.target.value,
                      // Clear currency if country changes
                      pricingInfo: { ...formData.pricingInfo, currency: '' }
                    });
                  }}
                  className="w-full appearance-none rounded-lg border border-gray-300 bg-white bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.5em_1.5em] bg-[right_0.75rem_center] bg-no-repeat px-3 py-2 pr-10 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                >
                  <option value="">Select Country</option>
                  {countries.map((country) => (
                    <option key={country.id} value={country.code}>
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
                  required
                  value={formData.pricingInfo.currency}
                  onChange={(e) => setFormData({
                    ...formData,
                    pricingInfo: { ...formData.pricingInfo, currency: e.target.value }
                  })}
                  disabled={!formData.countryCode}
                  className="w-full appearance-none rounded-lg border border-gray-300 bg-white bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.5em_1.5em] bg-[right_0.75rem_center] bg-no-repeat px-3 py-2 pr-10 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400 dark:disabled:bg-gray-900 dark:disabled:text-gray-400"
                >
                  <option value="">{formData.countryCode ? 'Select Currency' : 'Select Country First'}</option>
                  {getSupportedCurrencies(formData.countryCode).map((currency) => (
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
                <div className="flex items-center gap-2">
                  {formData.pricingInfo.currency && (() => {
                    const selectedCurrency = currencies.find(c => c.id === formData.pricingInfo.currency);
                    return selectedCurrency ? (
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {selectedCurrency.code}
                      </span>
                    ) : null;
                  })()}
                  <input
                    type="text"
                    required
                    value={formData.pricingInfo.price?.toString() || ''}
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
                              price: value === '' || value === '.' ? 0 : numValue 
                            }
                          });
                        }
                      }
                    }}
                    className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Fieldsets */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Fieldsets</h2>
              <button
                type="button"
                onClick={addFieldset}
                className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-600 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/30"
              >
                + Add Fieldset
              </button>
            </div>

            {formData.fieldsets.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No fieldsets added. Click "Add Fieldset" to get started.</p>
            ) : (
              <div className="space-y-4">
                {formData.fieldsets.map((fieldset, fieldsetIndex) => (
                  <div key={fieldsetIndex} className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="font-medium text-gray-900 dark:text-white">Fieldset {fieldsetIndex + 1}</h3>
                      <button
                        type="button"
                        onClick={() => removeFieldset(fieldsetIndex)}
                        className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={fieldset.name}
                          onChange={(e) => updateFieldset(fieldsetIndex, { name: e.target.value })}
                          className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Label *
                        </label>
                        <input
                          type="text"
                          required
                          value={fieldset.label}
                          onChange={(e) => updateFieldset(fieldsetIndex, { label: e.target.value })}
                          className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Description
                        </label>
                        <textarea
                          value={fieldset.description || ''}
                          onChange={(e) => updateFieldset(fieldsetIndex, { description: e.target.value })}
                          rows={2}
                          className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        />
                      </div>

                      {/* Fields */}
                      <div className="mt-4 space-y-3 border-t border-gray-200 pt-3 dark:border-gray-700">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Fields</label>
                          <button
                            type="button"
                            onClick={() => addField(fieldsetIndex)}
                            className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            + Add Field
                          </button>
                        </div>
                        {fieldset.fields.length === 0 ? (
                          <p className="text-xs text-gray-500 dark:text-gray-400">No fields added</p>
                        ) : (
                          fieldset.fields.map((field, fieldIndex) => (
                            <div key={fieldIndex} className="rounded border border-gray-200 bg-white p-3 dark:border-gray-600 dark:bg-gray-700">
                              <div className="mb-2 flex items-center justify-between">
                                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                  Field {fieldIndex + 1}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeField(fieldsetIndex, fieldIndex)}
                                  className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                >
                                  Remove
                                </button>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Name *</label>
                                  <input
                                    type="text"
                                    required
                                    value={field.name}
                                    onChange={(e) => updateField(fieldsetIndex, fieldIndex, { name: e.target.value })}
                                    className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Label *</label>
                                  <input
                                    type="text"
                                    required
                                    value={field.label}
                                    onChange={(e) => updateField(fieldsetIndex, fieldIndex, { label: e.target.value })}
                                    className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                                  />
                                </div>
                                <div className="col-span-2">
                                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Description</label>
                                  <input
                                    type="text"
                                    value={field.description || ''}
                                    onChange={(e) => updateField(fieldsetIndex, fieldIndex, { description: e.target.value })}
                                    className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Type *</label>
                                  <select
                                    required
                                    value={field.type}
                                    onChange={(e) => updateField(fieldsetIndex, fieldIndex, { type: e.target.value })}
                                    className="w-full appearance-none rounded border border-gray-300 bg-white bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1em_1em] bg-[right_0.5rem_center] bg-no-repeat px-2 py-1 pr-8 text-xs text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                                  >
                                    {FORM_FIELD_TYPES.map((type) => (
                                      <option key={type} value={type}>
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
                                    onChange={(e) => updateField(fieldsetIndex, fieldIndex, { widget: e.target.value })}
                                    className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Validator</label>
                                  <input
                                    type="text"
                                    value={field.validator || ''}
                                    onChange={(e) => updateField(fieldsetIndex, fieldIndex, { validator: e.target.value })}
                                    className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={field.isRequired || false}
                                    onChange={(e) => updateField(fieldsetIndex, fieldIndex, { isRequired: e.target.checked })}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                                  />
                                  <label className="text-xs text-gray-600 dark:text-gray-400">Required</label>
                                </div>

                                {/* Options for SELECT/MULTI_SELECT */}
                                {(field.type === 'SELECT' || field.type === 'MULTI_SELECT') && (
                                  <div className="col-span-2 space-y-2 rounded border border-gray-200 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-800">
                                    <div className="flex items-center justify-between">
                                      <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Options</label>
                                      <button
                                        type="button"
                                        onClick={() => addFieldOption(fieldsetIndex, fieldIndex)}
                                        className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                                      >
                                        + Add Option
                                      </button>
                                    </div>
                                    {field.options && field.options.length > 0 ? (
                                      field.options.map((option, optionIndex) => (
                                        <div key={optionIndex} className="flex gap-2">
                                          <input
                                            type="text"
                                            placeholder="Label"
                                            value={option.label}
                                            onChange={(e) => updateFieldOption(fieldsetIndex, fieldIndex, optionIndex, { label: e.target.value })}
                                            className="flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                          />
                                          <input
                                            type="text"
                                            placeholder="Value"
                                            value={option.value}
                                            onChange={(e) => updateFieldOption(fieldsetIndex, fieldIndex, optionIndex, { value: e.target.value })}
                                            className="flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => removeFieldOption(fieldsetIndex, fieldIndex, optionIndex)}
                                            className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                          >
                                            Remove
                                          </button>
                                        </div>
                                      ))
                                    ) : (
                                      <p className="text-xs text-gray-500 dark:text-gray-400">No options added</p>
                                    )}
                                  </div>
                                )}

                                {/* Conditional */}
                                <div className="col-span-2 space-y-2 rounded border border-gray-200 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-800">
                                  <div className="flex items-center justify-between">
                                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Conditional</label>
                                    <button
                                      type="button"
                                      onClick={() => updateConditional(fieldsetIndex, fieldIndex, field.conditional ? undefined : { field: '', value: '', operator: 'equals' })}
                                      className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                                    >
                                      {field.conditional ? 'Remove' : 'Add Conditional'}
                                    </button>
                                  </div>
                                  {field.conditional && (
                                    <div className="grid grid-cols-3 gap-2">
                                      <input
                                        type="text"
                                        placeholder="Field"
                                        value={field.conditional.field}
                                        onChange={(e) => updateConditional(fieldsetIndex, fieldIndex, { ...field.conditional!, field: e.target.value })}
                                        className="rounded border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                      />
                                      <select
                                        value={field.conditional.operator}
                                        onChange={(e) => updateConditional(fieldsetIndex, fieldIndex, { ...field.conditional!, operator: e.target.value })}
                                        className="rounded border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                      >
                                        <option value="equals">equals</option>
                                        <option value="not_equals">not equals</option>
                                        <option value="contains">contains</option>
                                        <option value="greater_than">greater than</option>
                                        <option value="less_than">less than</option>
                                      </select>
                                      <input
                                        type="text"
                                        placeholder="Value"
                                        value={field.conditional.value}
                                        onChange={(e) => updateConditional(fieldsetIndex, fieldIndex, { ...field.conditional!, value: e.target.value })}
                                        className="rounded border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || uploading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              {uploading ? 'Uploading Template...' : loading ? 'Creating...' : 'Create Form'}
            </button>
          </div>
        </form>

        {/* Fieldset Configuration Modal */}
        {showFieldsetConfig && templateUploadResult && createdFormId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-4 flex items-start justify-between">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Configure Fieldsets
                  </h2>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    Template uploaded successfully! {templateUploadResult.valid_variables.length} variables were extracted.
                    Group them into fieldsets below, or skip to create the form with empty fieldsets.
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
                      const isExpanded = expandedFieldsets.has(idx);
                      return (
                        <div key={idx} className="rounded border border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-700">
                          <div className="w-full flex items-center justify-between p-3">
                            <div className="flex items-center gap-3 flex-1">
                              <button
                                type="button"
                                onClick={() => toggleFieldsetExpansion(idx)}
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
                                onChange={(e) => updateFieldsetInConfig(idx, { name: e.target.value })}
                                placeholder={`Fieldset ${idx + 1}`}
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
                                    setExpandedFields(prev => new Set([...prev, fieldKey]));
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
                                    const isFieldExpanded = expandedFields.has(fieldKey);
                                    return (
                                      <div key={fieldIdx} className="rounded border border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-700">
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
                                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                              {field.name}
                                            </span>
                                          </button>
                                          <div className="flex items-center gap-2">
                                            {/* Reorder field buttons */}
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
                                              <div>
                                                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Label</label>
                                                <input
                                                  type="text"
                                                  value={field.label || ''}
                                                  onChange={(e) => updateFieldInConfig(idx, fieldIdx, { label: e.target.value })}
                                                  placeholder={variableToLabel(field.name)}
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
      </div>
    </AdminLayout>
  );
}

