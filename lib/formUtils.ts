/**
 * Form type utilities
 */

export const FORM_TYPES = {
  CONTRACT: 'CONTRACT',
  COMPANY_INCORPORATION: 'COMPANY_INCORPORATION',
  SOLE_PROPRIETORSHIP_INCORPORATION: 'SOLE_PROPRIETORSHIP_INCORPORATION',
} as const;

export type FormType = typeof FORM_TYPES[keyof typeof FORM_TYPES];

/**
 * Converts form type enum value to human-readable display name
 */
export function formatFormType(type: string): string {
  const typeMap: Record<string, string> = {
    CONTRACT: 'Contract',
    COMPANY_INCORPORATION: 'Company Incorporation',
    SOLE_PROPRIETORSHIP_INCORPORATION: 'Sole Proprietorship Incorporation',
  };
  
  return typeMap[type] || type;
}

