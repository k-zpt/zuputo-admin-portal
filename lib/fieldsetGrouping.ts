/**
 * Configuration for fieldset and field type inference
 * This module handles intelligent grouping of variables into fieldsets
 * and inferring field types based on variable names
 */

export interface FieldsetGroupingConfig {
  // Suffix to append to fieldset names (default: '_DETAILS')
  fieldsetSuffix: string;
  
  // Name for the general/ungrouped fieldset (default: 'GENERAL')
  generalFieldsetName: string;
  
  // Minimum number of parts required to create a grouped fieldset (default: 2)
  // Variables with fewer parts will go to GENERAL
  minPartsForGrouping: number;
}

export const DEFAULT_GROUPING_CONFIG: FieldsetGroupingConfig = {
  fieldsetSuffix: '_DETAILS',
  generalFieldsetName: 'GENERAL',
  minPartsForGrouping: 2,
};

/**
 * Infers the field type based on the variable name
 * Rules:
 * - If contains "date", use DATE
 * - If contains "email", use EMAIL
 * - If contains "address", use LONG_TEXT
 * - If contains "phone" or "phone number", use PHONE
 * - Default to TEXT
 */
export function inferFieldType(variableName: string): string {
  const lowerName = variableName.toLowerCase();
  
  if (lowerName.includes('date')) {
    return 'DATE';
  }
  if (lowerName.includes('email')) {
    return 'EMAIL';
  }
  if (lowerName.includes('address')) {
    return 'LONG_TEXT';
  }
  if (lowerName.includes('phone') || lowerName.includes('phone_number')) {
    return 'PHONE';
  }
  
  // Default to TEXT
  return 'TEXT';
}

/**
 * Groups variables into fieldsets based on their naming pattern
 * Improved logic:
 * - PARTY_A_NAME, PARTY_A_ADDRESS, PARTY_A_PHONE_NUMBER all go to PARTY_A_DETAILS
 * - Avoids creating base groups (e.g., PARTY_DETAILS) if specific groups exist (e.g., PARTY_A_DETAILS)
 * 
 * @param variables - Array of variable names to group
 * @param config - Optional configuration for grouping behavior
 * @returns Array of fieldset configurations with grouped variables
 */
export function groupVariablesIntoFieldsets(
  variables: string[],
  config: FieldsetGroupingConfig = DEFAULT_GROUPING_CONFIG
): Array<{ name: string; fields: string[] }> {
  const grouped: Record<string, string[]> = {};

  // First pass: group variables by their prefix
  variables.forEach(variable => {
    const parts = variable.split('_');
    
    // If variable has fewer parts than minimum, or is a single word, put in GENERAL
    if (parts.length < config.minPartsForGrouping) {
      if (!grouped[config.generalFieldsetName]) {
        grouped[config.generalFieldsetName] = [];
      }
      grouped[config.generalFieldsetName].push(variable);
      return;
    }

    // Find the best prefix by checking how many other variables share each prefix length
    let bestPrefix: string | null = null;
    let bestSharedCount = 0;
    
    // Try prefixes of different lengths (from longest to shortest)
    for (let i = parts.length - 1; i >= 1; i--) {
      const candidatePrefix = parts.slice(0, i).join('_');
      
      // Count how many variables share this prefix (excluding the last part)
      const sharedCount = variables.filter(v => {
        const vParts = v.split('_');
        return vParts.length > i && vParts.slice(0, i).join('_') === candidatePrefix;
      }).length;
      
      // If multiple variables share this prefix, it's a good grouping
      // Prefer longer prefixes with more shared variables
      if (sharedCount > 1 && (bestPrefix === null || sharedCount > bestSharedCount || 
          (sharedCount === bestSharedCount && candidatePrefix.length > bestPrefix.length))) {
        bestPrefix = candidatePrefix;
        bestSharedCount = sharedCount;
      }
    }

    // If no good prefix found, use all but the last part
    if (!bestPrefix) {
      bestPrefix = parts.slice(0, -1).join('_');
    }

    // Check if prefix already ends with the suffix to avoid duplication
    let groupName: string;
    if (bestPrefix.toUpperCase().endsWith(config.fieldsetSuffix.toUpperCase())) {
      groupName = bestPrefix;
    } else {
      groupName = bestPrefix + config.fieldsetSuffix;
    }

    if (!grouped[groupName]) {
      grouped[groupName] = [];
    }
    grouped[groupName].push(variable);
  });

  // Second pass: Clean up - remove base groups if specific groups exist
  // e.g., if PARTY_DETAILS exists, remove PARTY_DETAILS
  const groupNames = Object.keys(grouped);
  const groupsToRemove = new Set<string>();
  
  groupNames.forEach(groupName => {
    // Check if this is a base group that has more specific versions
    const baseName = groupName.replace(config.fieldsetSuffix, '');
    const baseParts = baseName.split('_');
    
    // Look for more specific groups (e.g., if we have PARTY_DETAILS, check for PARTY_A_DETAILS, PARTY_B_DETAILS, etc.)
    if (baseParts.length >= 1) {
      const hasMoreSpecific = groupNames.some(otherName => {
        if (otherName === groupName) return false;
        const otherBase = otherName.replace(config.fieldsetSuffix, '');
        const otherParts = otherBase.split('_');
        // Check if other group starts with this base but has more parts
        return otherParts.length > baseParts.length && 
               otherParts.slice(0, baseParts.length).join('_') === baseParts.join('_');
      });
      
      if (hasMoreSpecific) {
        groupsToRemove.add(groupName);
      }
    }
  });

  // Move variables from removed groups to more specific groups or GENERAL
  groupsToRemove.forEach(groupToRemove => {
    const variablesToMove = grouped[groupToRemove];
    const baseName = groupToRemove.replace(config.fieldsetSuffix, '');
    const baseParts = baseName.split('_');
    
    variablesToMove.forEach(variable => {
      const varParts = variable.split('_');
      
      // Try to find a more specific group for this variable
      let foundGroup = false;
      for (let i = baseParts.length + 1; i < varParts.length; i++) {
        const candidatePrefix = varParts.slice(0, i).join('_');
        const candidateGroupName = candidatePrefix + config.fieldsetSuffix;
        
        if (grouped[candidateGroupName] && !groupsToRemove.has(candidateGroupName)) {
          grouped[candidateGroupName].push(variable);
          foundGroup = true;
          break;
        }
      }
      
      // If no specific group found, put in GENERAL
      if (!foundGroup) {
        if (!grouped[config.generalFieldsetName]) {
          grouped[config.generalFieldsetName] = [];
        }
        grouped[config.generalFieldsetName].push(variable);
      }
    });
    
    delete grouped[groupToRemove];
  });

  // Convert to array format
  return Object.entries(grouped).map(([name, fields]) => ({
    name,
    fields,
  }));
}

/**
 * Converts variable name to a human-readable label
 * e.g., "PARTY_A" -> "Party A"
 */
export function variableToLabel(variable: string): string {
  return variable
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

