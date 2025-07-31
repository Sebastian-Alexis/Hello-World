//form validation utilities for admin interface
export interface ValidationRule {
  rule: string;
  message: string;
}

export interface FieldValidation {
  name: string;
  rules: ValidationRule[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export class FormValidator {
  private fields: Map<string, ValidationRule[]> = new Map();
  
  addField(name: string, rules: ValidationRule[]): FormValidator {
    this.fields.set(name, rules);
    return this;
  }
  
  addRule(fieldName: string, rule: string, message: string): FormValidator {
    const existingRules = this.fields.get(fieldName) || [];
    existingRules.push({ rule, message });
    this.fields.set(fieldName, existingRules);
    return this;
  }
  
  validate(data: Record<string, any>): ValidationResult {
    const errors: Record<string, string> = {};
    let isValid = true;
    
    for (const [fieldName, rules] of this.fields) {
      const value = data[fieldName];
      
      for (const { rule, message } of rules) {
        if (!this.checkRule(rule, value, data)) {
          errors[fieldName] = message;
          isValid = false;
          break; //stop at first error for this field
        }
      }
    }
    
    return { isValid, errors };
  }
  
  validateField(fieldName: string, value: any, allData: Record<string, any> = {}): { isValid: boolean; error: string } {
    const rules = this.fields.get(fieldName) || [];
    
    for (const { rule, message } of rules) {
      if (!this.checkRule(rule, value, allData)) {
        return { isValid: false, error: message };
      }
    }
    
    return { isValid: true, error: '' };
  }
  
  private checkRule(rule: string, value: any, allData: Record<string, any>): boolean {
    const [ruleName, ruleParam] = rule.split(':');
    
    switch (ruleName) {
      case 'required':
        return value !== null && value !== undefined && value !== '';
      
      case 'email':
        if (!value) return true; //optional field
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value);
      
      case 'url':
        if (!value) return true; //optional field
        try {
          new URL(value);
          return true;
        } catch {
          return false;
        }
      
      case 'phone':
        if (!value) return true; //optional field
        const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
        return phoneRegex.test(value.replace(/[\s\-\(\)]/g, ''));
      
      case 'min_length':
        if (!value) return true; //optional field
        const minLen = parseInt(ruleParam);
        return value.length >= minLen;
      
      case 'max_length':
        if (!value) return true; //optional field
        const maxLen = parseInt(ruleParam);
        return value.length <= maxLen;
      
      case 'numeric':
        if (!value) return true; //optional field
        return !isNaN(Number(value));
      
      case 'integer':
        if (!value) return true; //optional field
        return Number.isInteger(Number(value));
      
      case 'min':
        if (!value) return true; //optional field
        const minVal = parseFloat(ruleParam);
        return Number(value) >= minVal;
      
      case 'max':
        if (!value) return true; //optional field
        const maxVal = parseFloat(ruleParam);
        return Number(value) <= maxVal;
      
      case 'alpha':
        if (!value) return true; //optional field
        const alphaRegex = /^[a-zA-Z]+$/;
        return alphaRegex.test(value);
      
      case 'alphanumeric':
        if (!value) return true; //optional field
        const alphaNumRegex = /^[a-zA-Z0-9]+$/;
        return alphaNumRegex.test(value);
      
      case 'slug':
        if (!value) return true; //optional field
        const slugRegex = /^[a-z0-9-]+$/;
        return slugRegex.test(value);
      
      case 'confirmed':
        //check if field matches another field (e.g., password confirmation)
        const confirmFieldName = ruleParam || `${rule}_confirmation`;
        return value === allData[confirmFieldName];
      
      case 'unique':
        //this would typically involve a database check
        //for now, return true - implement based on your needs
        return true;
      
      case 'exists':
        //this would typically involve a database check
        //for now, return true - implement based on your needs
        return true;
      
      case 'date':
        if (!value) return true; //optional field
        const date = new Date(value);
        return !isNaN(date.getTime());
      
      case 'date_after':
        if (!value) return true; //optional field
        const afterDate = new Date(ruleParam);
        const fieldDate = new Date(value);
        return fieldDate > afterDate;
      
      case 'date_before':
        if (!value) return true; //optional field
        const beforeDate = new Date(ruleParam);
        const fieldDateBefore = new Date(value);
        return fieldDateBefore < beforeDate;
      
      case 'in':
        if (!value) return true; //optional field
        const allowedValues = ruleParam.split(',');
        return allowedValues.includes(value);
      
      case 'not_in':
        if (!value) return true; //optional field
        const disallowedValues = ruleParam.split(',');
        return !disallowedValues.includes(value);
      
      case 'regex':
        if (!value) return true; //optional field
        const regex = new RegExp(ruleParam);
        return regex.test(value);
      
      default:
        console.warn(`Unknown validation rule: ${ruleName}`);
        return true;
    }
  }
}

//pre-defined validation rule sets
export const ValidationRules = {
  email: [
    { rule: 'required', message: 'Email is required' },
    { rule: 'email', message: 'Please enter a valid email address' }
  ],
  
  password: [
    { rule: 'required', message: 'Password is required' },
    { rule: 'min_length:8', message: 'Password must be at least 8 characters' }
  ],
  
  strongPassword: [
    { rule: 'required', message: 'Password is required' },
    { rule: 'min_length:8', message: 'Password must be at least 8 characters' },
    { rule: 'regex:(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)', message: 'Password must contain uppercase, lowercase, and number' }
  ],
  
  url: [
    { rule: 'url', message: 'Please enter a valid URL' }
  ],
  
  phone: [
    { rule: 'phone', message: 'Please enter a valid phone number' }
  ],
  
  slug: [
    { rule: 'required', message: 'Slug is required' },
    { rule: 'slug', message: 'Slug can only contain lowercase letters, numbers, and hyphens' }
  ],
  
  title: [
    { rule: 'required', message: 'Title is required' },
    { rule: 'min_length:3', message: 'Title must be at least 3 characters' },
    { rule: 'max_length:255', message: 'Title cannot exceed 255 characters' }
  ],
  
  content: [
    { rule: 'required', message: 'Content is required' },
    { rule: 'min_length:10', message: 'Content must be at least 10 characters' }
  ],
  
  price: [
    { rule: 'numeric', message: 'Price must be a number' },
    { rule: 'min:0', message: 'Price cannot be negative' }
  ],
  
  positiveInteger: [
    { rule: 'integer', message: 'Must be a whole number' },
    { rule: 'min:1', message: 'Must be at least 1' }
  ]
};

//utility functions
export function createValidator(): FormValidator {
  return new FormValidator();
}

export function validateSingleField(rules: ValidationRule[], value: any, allData: Record<string, any> = {}): { isValid: boolean; error: string } {
  const validator = new FormValidator();
  const fieldName = 'field';
  validator.addField(fieldName, rules);
  
  const result = validator.validateField(fieldName, value, allData);
  return result;
}

//async validation support for unique checks, etc.
export interface AsyncValidationRule {
  rule: string;
  message: string;
  validator: (value: any, allData: Record<string, any>) => Promise<boolean>;
}

export class AsyncFormValidator extends FormValidator {
  private asyncRules: Map<string, AsyncValidationRule[]> = new Map();
  
  addAsyncRule(fieldName: string, rule: AsyncValidationRule): AsyncFormValidator {
    const existingRules = this.asyncRules.get(fieldName) || [];
    existingRules.push(rule);
    this.asyncRules.set(fieldName, existingRules);
    return this;
  }
  
  async validateAsync(data: Record<string, any>): Promise<ValidationResult> {
    //first run sync validation
    const syncResult = this.validate(data);
    if (!syncResult.isValid) {
      return syncResult;
    }
    
    //then run async validation
    const asyncErrors: Record<string, string> = {};
    let isValid = true;
    
    for (const [fieldName, rules] of this.asyncRules) {
      const value = data[fieldName];
      
      for (const { rule, message, validator } of rules) {
        try {
          const isRuleValid = await validator(value, data);
          if (!isRuleValid) {
            asyncErrors[fieldName] = message;
            isValid = false;
            break;
          }
        } catch (error) {
          console.error(`Async validation error for ${fieldName}:${rule}`, error);
          asyncErrors[fieldName] = 'Validation failed';
          isValid = false;
          break;
        }
      }
    }
    
    return {
      isValid,
      errors: { ...syncResult.errors, ...asyncErrors }
    };
  }
}