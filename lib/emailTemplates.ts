/**
 * Default email template for payment links
 * Supports placeholders: {{label}}, {{description}}, {{url}}, {{validUntil}}, {{price}}, {{currency}}
 */
export const DEFAULT_PAYMENT_LINK_EMAIL_TEMPLATE = `Hello,

You have been sent a payment link for the following service:

Service: {{label}}
{{#description}}
Description: {{description}}
{{/description}}
Amount: {{currency}} {{price}}

Payment Link: {{url}}

This link is valid until: {{validUntil}}

Please complete your payment using the link above.

Thank you.`;

/**
 * Formats a number with thousand separators (e.g., 45000 -> 45,000)
 */
export function formatNumber(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return value.toString();
  
  // Check if it's a decimal number
  const parts = num.toString().split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1];
  
  // Format integer part with commas
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  
  return decimalPart ? `${formattedInteger}.${decimalPart}` : formattedInteger;
}

/**
 * Formats a date string to human-readable format (e.g., "22/12/2025, 00:00:00" -> "22nd December, 2025")
 */
export function formatDate(dateString: string): string {
  try {
    // Try to parse various date formats
    let date: Date;
    
    // Handle format like "22/12/2025, 00:00:00"
    if (dateString.includes('/')) {
      const parts = dateString.split(',')[0].split('/');
      if (parts.length === 3) {
        date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      } else {
        date = new Date(dateString);
      }
    } else {
      date = new Date(dateString);
    }
    
    if (isNaN(date.getTime())) {
      return dateString; // Return original if parsing fails
    }
    
    const day = date.getDate();
    const month = date.toLocaleString('en-US', { month: 'long' });
    const year = date.getFullYear();
    
    // Add ordinal suffix
    const getOrdinalSuffix = (n: number): string => {
      const j = n % 10;
      const k = n % 100;
      if (j === 1 && k !== 11) return 'st';
      if (j === 2 && k !== 12) return 'nd';
      if (j === 3 && k !== 13) return 'rd';
      return 'th';
    };
    
    return `${day}${getOrdinalSuffix(day)} ${month}, ${year}`;
  } catch (error) {
    return dateString; // Return original if formatting fails
  }
}

/**
 * Replaces template placeholders with actual values dynamically
 * Supports any tag name, not just hardcoded ones
 */
export function renderEmailTemplate(
  template: string,
  values: Record<string, any>
): string {
  let rendered = template;
  
  // Special formatting for known fields
  const specialFormatters: Record<string, (value: any) => string> = {
    price: (val) => formatNumber(val),
    validUntil: (val) => formatDate(val),
  };
  
  // First, handle all conditional blocks {{#tag}}...{{/tag}}
  // Find all conditional blocks
  const conditionalRegex = /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
  let match;
  const processedBlocks = new Set<string>();
  
  while ((match = conditionalRegex.exec(rendered)) !== null) {
    const tagName = match[1];
    const blockContent = match[2];
    const fullBlock = match[0];
    
    // Avoid processing the same block multiple times
    if (processedBlocks.has(fullBlock)) continue;
    processedBlocks.add(fullBlock);
    
    const value = values[tagName];
    
    if (value !== undefined && value !== null && value !== '') {
      // Keep the block and replace inner {{tag}} with value
      const innerContent = blockContent.replace(
        new RegExp(`\\{\\{${tagName}\\}\\}`, 'g'),
        String(value)
      );
      rendered = rendered.replace(fullBlock, innerContent);
    } else {
      // Remove the entire block
      rendered = rendered.replace(fullBlock, '');
    }
  }
  
  // Then, replace all simple placeholders {{tag}}
  // Find all unique tag names in the template
  const tagRegex = /\{\{(\w+)\}\}/g;
  const foundTags = new Set<string>();
  
  while ((match = tagRegex.exec(rendered)) !== null) {
    const tagName = match[1];
    // Skip conditional block markers (# and /)
    if (tagName.startsWith('#') || tagName.startsWith('/')) continue;
    foundTags.add(tagName);
  }
  
  // Replace each tag with its value
  foundTags.forEach(tagName => {
    const value = values[tagName];
    if (value !== undefined && value !== null) {
      // Apply special formatting if available
      const formatter = specialFormatters[tagName];
      const formattedValue = formatter ? formatter(value) : String(value);
      rendered = rendered.replace(
        new RegExp(`\\{\\{${tagName}\\}\\}`, 'g'),
        formattedValue
      );
    } else {
      // Replace with empty string if value not provided
      rendered = rendered.replace(
        new RegExp(`\\{\\{${tagName}\\}\\}`, 'g'),
        ''
      );
    }
  });
  
  return rendered.trim();
}

