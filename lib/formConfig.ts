/**
 * Configuration for form field types
 * Update this array to add or modify valid field types
 */
export const FORM_FIELD_TYPES = [
  'TEXT',
  'LONG_TEXT',
  'EMAIL',
  'PHONE',
  'DATE',
  'NUMBER',
  'SELECT',
  'MULTI_SELECT',
] as const;

export type FormFieldType = typeof FORM_FIELD_TYPES[number];

