'use client';

import { AdminLayout } from "@/components/AdminLayout";
import { messageTemplateService } from "@/lib/api/services";
import { PREDEFINED_VARIABLES } from "@/lib/messageTemplateVariables";
import { useState, useEffect, useRef } from "react";
import type { MessageTemplate, CreateMessageTemplatePayload, UpdateMessageTemplatePayload, ApiResponse } from "@/lib/api/types";

// Variable Picker Component - Simple and intuitive
function VariablePicker({ onInsertTag }: { onInsertTag: (tag: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customVariableName, setCustomVariableName] = useState('');
  const [customVariableDescription, setCustomVariableDescription] = useState('');
  const [customVariableOptional, setCustomVariableOptional] = useState(false);
  const [customVariableContent, setCustomVariableContent] = useState('');
  
  // Available variables with metadata - loaded from config file
  const variables = PREDEFINED_VARIABLES;
  
  const filteredVariables = variables.filter(variable =>
    variable.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    variable.description.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const handleInsert = (variableName: string, asConditional: boolean = false, conditionalContent: string = '') => {
    if (asConditional) {
      const content = conditionalContent.trim() || `${variableName} content here`;
      onInsertTag(`{{#${variableName}}}\n${content}\n{{/${variableName}}}`);
    } else {
      onInsertTag(`{{${variableName}}}`);
    }
    setIsOpen(false);
    setSearchTerm('');
    setShowCustomInput(false);
    setCustomVariableName('');
    setCustomVariableDescription('');
    setCustomVariableOptional(false);
    setCustomVariableContent('');
  };
  
  const handleCreateCustom = () => {
    if (!customVariableName.trim()) return;
    
    // Validate variable name (alphanumeric and underscores only)
    const sanitizedName = customVariableName.trim().replace(/[^a-zA-Z0-9_]/g, '_');
    if (sanitizedName !== customVariableName.trim()) {
      setCustomVariableName(sanitizedName);
    }
    
    // If optional is checked, insert as conditional block with custom content; otherwise as simple tag
    handleInsert(sanitizedName, customVariableOptional, customVariableContent);
  };
  
  const isValidVariableName = (name: string) => {
    return /^[a-zA-Z0-9_]+$/.test(name);
  };
  
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-600 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/30"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Variable
      </button>
      
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-10 z-20 w-80 rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
            <div className="border-b border-gray-200 p-3 dark:border-gray-700">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  Add Variable
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowCustomInput(!showCustomInput);
                    setSearchTerm('');
                    if (!showCustomInput) {
                      setCustomVariableName('');
                      setCustomVariableDescription('');
                      setCustomVariableOptional(false);
                      setCustomVariableContent('');
                    }
                  }}
                  className="flex items-center gap-1 rounded border border-blue-300 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-600 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/30"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {showCustomInput ? 'Cancel' : 'Custom'}
                </button>
              </div>
              {!showCustomInput ? (
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search variables..."
                  className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  autoFocus
                />
              ) : (
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Variable Name *
                    </label>
                    <input
                      type="text"
                      value={customVariableName}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^a-zA-Z0-9_]/g, '_');
                        setCustomVariableName(value);
                      }}
                      placeholder="e.g., customerName"
                      className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm font-mono dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      autoFocus
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Only letters, numbers, and underscores allowed
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Description (optional)
                    </label>
                    <input
                      type="text"
                      value={customVariableDescription}
                      onChange={(e) => setCustomVariableDescription(e.target.value)}
                      placeholder="What this variable represents"
                      className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="custom-optional"
                      checked={customVariableOptional}
                      onChange={(e) => setCustomVariableOptional(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                    />
                    <label htmlFor="custom-optional" className="text-xs text-gray-700 dark:text-gray-300">
                      This variable is optional (use conditional block)
                    </label>
                  </div>
                  {customVariableOptional && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Conditional Block Content
                      </label>
                      <textarea
                        value={customVariableContent}
                        onChange={(e) => setCustomVariableContent(e.target.value)}
                        placeholder="Content that appears when this variable has a value. You can use {{variableName}} inside to display the value."
                        rows={3}
                        className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        This content will be wrapped in {`{{#${customVariableName || 'variable'}}...{{/${customVariableName || 'variable'}}}`}
                      </p>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleCreateCustom}
                    disabled={!customVariableName.trim() || !isValidVariableName(customVariableName)}
                    className="w-full rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-500 dark:hover:bg-blue-600"
                  >
                    Add Variable
                  </button>
                </div>
              )}
            </div>
            <div className="max-h-64 overflow-y-auto">
              {filteredVariables.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  No variables found
                </div>
              ) : (
                filteredVariables.map((variable) => (
                  <div
                    key={variable.name}
                    className="border-b border-gray-100 p-3 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-medium text-gray-900 dark:text-white">
                            {`{{${variable.name}}}`}
                          </span>
                          {variable.required && (
                            <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
                              Required
                            </span>
                          )}
                          {!variable.required && (
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                              Optional
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {variable.description}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => handleInsert(variable.name, false, '')}
                          className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                          title="Insert as simple variable"
                        >
                          Insert
                        </button>
                        {!variable.required && (
                          <button
                            type="button"
                            onClick={() => handleInsert(variable.name, true, '')}
                            className="rounded border border-green-300 bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100 dark:border-green-600 dark:bg-green-900/20 dark:text-green-300 dark:hover:bg-green-900/30"
                            title="Insert as conditional block (only shows if value exists)"
                          >
                            If exists
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="border-t border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/50">
              <div className="text-xs text-gray-600 dark:text-gray-400">
                <div className="mb-1 font-medium">Tip:</div>
                <div>• Click "Insert" to add a variable that always appears</div>
                <div>• Click "If exists" for optional variables (only shows when value is provided)</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function MessageTemplatesPage() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    type: 'EMAIL',
    name: '',
    code: '',
    title: '',
    content: '',
  });
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Format code: remove non-alphanumeric (except underscores), uppercase, spaces to underscores
  const formatCode = (input: string): string => {
    return input
      .replace(/[^a-zA-Z0-9_\s]/g, '') // Remove non-alphanumeric (except underscores and spaces)
      .replace(/\s+/g, '_') // Convert spaces to underscores
      .toUpperCase(); // Convert to uppercase
  };

  // Generate code from name
  const generateCodeFromName = (name: string): string => {
    return formatCode(name);
  };

  const handleNameChange = (name: string) => {
    setFormData(prev => {
      // Auto-generate code if code is empty or matches the previous generated code
      const shouldAutoGenerate = !prev.code || prev.code === generateCodeFromName(prev.name);
      return {
        ...prev,
        name,
        code: shouldAutoGenerate ? generateCodeFromName(name) : prev.code,
      };
    });
  };

  const handleCodeChange = (code: string) => {
    // Format the code as user types
    const formatted = formatCode(code);
    setFormData(prev => ({ ...prev, code: formatted }));
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      const response: ApiResponse<MessageTemplate[]> = await messageTemplateService.list();
      setTemplates(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load message templates');
    } finally {
      setLoading(false);
    }
  };

  // Convert newlines based on type: EMAIL -> <br>, NOTIFICATION -> <br>, SMS -> \n
  const formatContentForSave = (content: string, type: string): string => {
    if (type === 'EMAIL' || type === 'NOTIFICATION') {
      return content.replace(/\n/g, '<br>');
    } else if (type === 'SMS') {
      return content; // Keep \n as is for SMS
    }
    return content;
  };

  // Convert content back for editing: <br> -> \n
  const formatContentForEdit = (content: string, type: string): string => {
    if (type === 'EMAIL' || type === 'NOTIFICATION') {
      return content.replace(/<br\s*\/?>/gi, '\n');
    }
    return content; // SMS already has \n
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      const payload: CreateMessageTemplatePayload = {
        type: formData.type,
        name: formData.name,
        code: formData.code || undefined,
        title: formData.title || undefined,
        content: formatContentForSave(formData.content, formData.type),
      };
      await messageTemplateService.create(payload);
      await loadTemplates();
      setShowCreateForm(false);
      setFormData({ type: 'EMAIL', name: '', code: '', title: '', content: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create message template');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string, data: UpdateMessageTemplatePayload) => {
    try {
      setSaving(true);
      setError(null);
      // Format content based on type before saving
      const formattedData = {
        ...data,
        content: data.content ? formatContentForSave(data.content, formData.type) : undefined,
      };
      await messageTemplateService.update(id, formattedData);
      await loadTemplates();
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update message template');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    // Note: Delete endpoint not shown in API spec, but we can add it if needed
    // For now, just show an error
    setError('Delete functionality not yet implemented');
  };

  const startEdit = (template: MessageTemplate) => {
    setEditingId(template.id);
    setFormData({
      type: template.type,
      name: template.name,
      code: template.code || '',
      title: template.title || '',
      content: formatContentForEdit(template.content, template.type),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({ type: 'EMAIL', name: '', code: '', title: '', content: '' });
  };

  const groupedTemplates = templates.reduce((acc, template) => {
    if (!acc[template.type]) {
      acc[template.type] = [];
    }
    acc[template.type].push(template);
    return acc;
  }, {} as Record<string, MessageTemplate[]>);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Message Templates
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Manage email, SMS, and other message templates
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            + New Template
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
            {error}
          </div>
        )}

        {showCreateForm && (
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Create New Template
            </h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Type *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  required
                  className="w-full appearance-none rounded-lg border border-gray-300 bg-white bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.5em_1.5em] bg-[right_0.75rem_center] bg-no-repeat px-3 py-2 pr-10 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                >
                  <option value="EMAIL">EMAIL</option>
                  <option value="SMS">SMS</option>
                  <option value="NOTIFICATION">NOTIFICATION</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g., Payment Link Email"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Code
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  placeholder="Auto-generated from name (e.g., PAYMENT_LINK_EMAIL)"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Optional. Auto-generated from name. Only alphanumeric characters and underscores allowed.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Payment Link: {{label}}"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Optional. Used as email subject for EMAIL templates. Supports placeholders like {'{'}{'{'}label{'}'}{'}'}.
                </p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Content *
                  </label>
                  <VariablePicker
                    onInsertTag={(tag) => {
                      const textarea = contentTextareaRef.current;
                      const cursorPos = textarea?.selectionStart || formData.content.length;
                      const newContent = 
                        formData.content.slice(0, cursorPos) + 
                        tag + 
                        formData.content.slice(cursorPos);
                      setFormData({ ...formData, content: newContent });
                      // Focus back on textarea and set cursor position
                      setTimeout(() => {
                        if (textarea) {
                          textarea.focus();
                          textarea.setSelectionRange(cursorPos + tag.length, cursorPos + tag.length);
                        }
                      }, 0);
                    }}
                  />
                </div>
                <textarea
                  ref={contentTextareaRef}
                  required
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Template content with placeholders like {{label}}, {{url}}, etc."
                  rows={10}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-xs text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Use {'{{tag}}'} for simple placeholders, {'{{#tag}}'}...{'{{/tag}}'} for conditional blocks.
                </p>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setFormData({ type: 'EMAIL', name: '', code: '', title: '', content: '' });
                  }}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                  {saving ? 'Creating...' : 'Create Template'}
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="text-center text-gray-600 dark:text-gray-400">Loading...</div>
        ) : (
          <div className="space-y-6">
            {Object.keys(groupedTemplates).length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-white p-6 text-center dark:border-gray-800 dark:bg-gray-900">
                <p className="text-gray-600 dark:text-gray-400">No message templates found. Create one to get started.</p>
              </div>
            ) : (
              Object.entries(groupedTemplates).map(([type, typeTemplates]) => (
                <div key={type} className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                  <div className="border-b border-gray-200 px-6 py-3 dark:border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{type} Templates</h2>
                  </div>
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {typeTemplates.map((template) => (
                      <div key={template.id} className="p-6">
                        {editingId === template.id ? (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              handleUpdate(template.id, {
                                type: formData.type,
                                name: formData.name,
                                code: formData.code || undefined,
                                title: formData.title || undefined,
                                content: formData.content,
                              });
                            }}
                            className="space-y-4"
                          >
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Type *
                              </label>
                              <select
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                required
                                className="w-full appearance-none rounded-lg border border-gray-300 bg-white bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.5em_1.5em] bg-[right_0.75rem_center] bg-no-repeat px-3 py-2 pr-10 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                              >
                                <option value="EMAIL">EMAIL</option>
                                <option value="SMS">SMS</option>
                                <option value="NOTIFICATION">NOTIFICATION</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Name *
                              </label>
                              <input
                                type="text"
                                required
                                value={formData.name}
                                onChange={(e) => handleNameChange(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Code
                              </label>
                              <input
                                type="text"
                                value={formData.code}
                                onChange={(e) => handleCodeChange(e.target.value)}
                                placeholder="Auto-generated from name"
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                              />
                              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                Optional. Only alphanumeric characters and underscores allowed.
                              </p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Title
                              </label>
                              <input
                                type="text"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                placeholder="e.g., Payment Link: {{label}}"
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                              />
                              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                Optional. Used as email subject for EMAIL templates. Supports placeholders like {'{'}{'{'}label{'}'}{'}'}.
                              </p>
                            </div>
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Content *
                                </label>
                                <VariablePicker
                                  onInsertTag={(tag) => {
                                    const textarea = contentTextareaRef.current;
                                    const cursorPos = textarea?.selectionStart || formData.content.length;
                                    const newContent = 
                                      formData.content.slice(0, cursorPos) + 
                                      tag + 
                                      formData.content.slice(cursorPos);
                                    setFormData({ ...formData, content: newContent });
                                    // Focus back on textarea and set cursor position
                                    setTimeout(() => {
                                      if (textarea) {
                                        textarea.focus();
                                        textarea.setSelectionRange(cursorPos + tag.length, cursorPos + tag.length);
                                      }
                                    }, 0);
                                  }}
                                />
                              </div>
                              <textarea
                                ref={contentTextareaRef}
                                required
                                value={formData.content}
                                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                rows={10}
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-xs text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400"
                              />
                              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                Use {'{{tag}}'} for simple placeholders, {'{{#tag}}'}...{'{{/tag}}'} for conditional blocks.
                              </p>
                            </div>
                            <div className="flex gap-2 justify-end">
                              <button
                                type="button"
                                onClick={cancelEdit}
                                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                disabled={saving}
                                className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-500 dark:hover:bg-blue-600"
                              >
                                {saving ? 'Saving...' : 'Save Changes'}
                              </button>
                            </div>
                          </form>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                                  {template.name}
                                </h3>
                                <div className="mt-1 space-y-1">
                                  <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Type: {template.type}
                                  </p>
                                  {template.code && (
                                    <p className="text-xs font-mono text-gray-400 dark:text-gray-500">
                                      Code: {template.code}
                                    </p>
                                  )}
                                </div>
                                {template.created && (
                                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                                    Created: {new Date(template.created).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => startEdit(template)}
                                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDelete(template.id)}
                                  className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:border-red-600 dark:bg-gray-800 dark:text-red-300 dark:hover:bg-red-900/20"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                              {template.type === 'EMAIL' || template.type === 'NOTIFICATION' ? (
                                <div 
                                  className="font-mono text-xs text-gray-900 dark:text-gray-100 whitespace-pre-wrap"
                                  dangerouslySetInnerHTML={{ __html: template.content }}
                                />
                              ) : (
                                <pre className="whitespace-pre-wrap font-mono text-xs text-gray-900 dark:text-gray-100">
                                  {template.content}
                                </pre>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

