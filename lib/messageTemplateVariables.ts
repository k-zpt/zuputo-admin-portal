/**
 * Predefined variables for message templates
 * These are common variables used in payment link templates
 * You can extend this list or create custom variables in the UI
 */
export interface TemplateVariable {
  name: string;
  description: string;
  required: boolean;
}

export const PREDEFINED_VARIABLES: TemplateVariable[] = [
  { name: 'label', description: 'Service label/name', required: true },
  { name: 'url', description: 'Payment link URL', required: true },
  { name: 'price', description: 'Payment amount (formatted)', required: true },
  { name: 'currency', description: 'Currency code', required: true },
  { name: 'validUntil', description: 'Link expiration date (formatted)', required: true },
  { name: 'description', description: 'Service description', required: false },
];

