//validation schemas exports
export * from './schemas.js';

//re-export zod for convenience
export { z } from 'zod';

//validation utilities
import { z } from 'zod';
import type { ApiResponse } from '../db/types.js';

//generic validation function with error formatting
export async function validateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): Promise<{
  success: boolean;
  data?: T;
  errors?: string[];
}> {
  try {
    const validData = await schema.parseAsync(data);
    return { success: true, data: validData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => {
        const path = err.path.length > 0 ? `${err.path.join('.')}: ` : '';
        return `${path}${err.message}`;
      });
      return { success: false, errors };
    }
    return { success: false, errors: ['Validation failed'] };
  }
}

//middleware-style validation
export function createValidationMiddleware<T>(schema: z.ZodSchema<T>) {
  return async (data: unknown): Promise<{
    valid: boolean;
    data?: T;
    error?: string;
    status?: number;
  }> => {
    const result = await validateInput(schema, data);
    
    if (!result.success) {
      return {
        valid: false,
        error: result.errors?.join(', ') || 'Validation failed',
        status: 400,
      };
    }
    
    return {
      valid: true,
      data: result.data,
    };
  };
}

//api response formatter with validation
export function createApiResponse<T>(
  success: boolean,
  data?: T,
  error?: string,
  message?: string
): ApiResponse<T> {
  return {
    success,
    data,
    error,
    message,
    timestamp: new Date().toISOString(),
  };
}

//validation error formatter for api responses
export function formatValidationError(error: z.ZodError): ApiResponse<null> {
  const fieldErrors = error.errors.reduce((acc, err) => {
    const field = err.path.join('.');
    if (!acc[field]) acc[field] = [];
    acc[field].push(err.message);
    return acc;
  }, {} as Record<string, string[]>);

  return {
    success: false,
    error: 'Validation failed',
    data: null,
    message: 'Please check the following errors',
    timestamp: new Date().toISOString(),
    // Add field errors in a details property (extending the base interface)
    ...(Object.keys(fieldErrors).length > 0 && { details: fieldErrors }),
  };
}

//bulk validation for arrays
export async function validateArray<T>(
  schema: z.ZodSchema<T>,
  items: unknown[]
): Promise<{
  success: boolean;
  validItems: T[];
  errors: Array<{ index: number; errors: string[] }>;
}> {
  const validItems: T[] = [];
  const errors: Array<{ index: number; errors: string[] }> = [];

  for (let i = 0; i < items.length; i++) {
    const result = await validateInput(schema, items[i]);
    
    if (result.success && result.data) {
      validItems.push(result.data);
    } else {
      errors.push({
        index: i,
        errors: result.errors || ['Validation failed'],
      });
    }
  }

  return {
    success: errors.length === 0,
    validItems,
    errors,
  };
}

//partial validation (useful for updates)
export async function validatePartial<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): Promise<{
  success: boolean;
  data?: Partial<T>;
  errors?: string[];
}> {
  //create a partial version of the schema
  const partialSchema = schema.partial();
  return await validateInput(partialSchema, data);
}

//conditional validation based on other fields
export function createConditionalSchema<T>(
  baseSchema: z.ZodSchema<T>,
  conditions: Array<{
    when: (data: T) => boolean;
    then: z.ZodSchema<T>;
  }>
) {
  return baseSchema.refine((data) => {
    for (const condition of conditions) {
      if (condition.when(data)) {
        const result = condition.then.safeParse(data);
        if (!result.success) {
          return false;
        }
      }
    }
    return true;
  });
}

//sanitization with validation
export async function sanitizeAndValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  sanitizers?: Array<(data: any) => any>
): Promise<{
  success: boolean;
  data?: T;
  errors?: string[];
}> {
  let processedData = data;
  
  //apply sanitizers
  if (sanitizers) {
    for (const sanitizer of sanitizers) {
      processedData = sanitizer(processedData);
    }
  }
  
  //validate sanitized data
  return await validateInput(schema, processedData);
}

//file validation helpers
export function createFileValidator(options: {
  maxSize?: number;
  allowedTypes?: string[];
  allowedExtensions?: string[];
}) {
  return z.object({
    filename: z.string().min(1, 'Filename is required'),
    mimetype: z.string().min(1, 'MIME type is required'),
    size: z.number().int().positive(),
    buffer: z.instanceof(Buffer),
  }).refine((file) => {
    //check file size
    if (options.maxSize && file.size > options.maxSize) {
      return false;
    }
    
    //check mime type
    if (options.allowedTypes && !options.allowedTypes.includes(file.mimetype)) {
      return false;
    }
    
    //check file extension
    if (options.allowedExtensions) {
      const ext = file.filename.split('.').pop()?.toLowerCase();
      if (!ext || !options.allowedExtensions.includes(ext)) {
        return false;
      }
    }
    
    return true;
  }, {
    message: 'File does not meet validation requirements',
  });
}

//schema composition helpers
export const schemaHelpers = {
  //merge multiple schemas
  merge: <T, U>(schema1: z.ZodSchema<T>, schema2: z.ZodSchema<U>) => {
    return schema1.and(schema2);
  },
  
  //create optional version
  optional: <T>(schema: z.ZodSchema<T>) => {
    return schema.optional();
  },
  
  //create nullable version
  nullable: <T>(schema: z.ZodSchema<T>) => {
    return schema.nullable();
  },
  
  //create array version
  array: <T>(schema: z.ZodSchema<T>, min?: number, max?: number) => {
    let arraySchema = z.array(schema);
    if (min !== undefined) arraySchema = arraySchema.min(min);
    if (max !== undefined) arraySchema = arraySchema.max(max);
    return arraySchema;
  },
};

//common validation chains
export const validationChains = {
  //user creation chain
  createUser: createValidationMiddleware((await import('./schemas.js')).userSchemas.createUser),
  
  //user update chain
  updateUser: createValidationMiddleware((await import('./schemas.js')).userSchemas.updateUser),
  
  //blog post creation chain
  createBlogPost: createValidationMiddleware((await import('./schemas.js')).blogSchemas.create),
  
  //portfolio project creation chain
  createProject: createValidationMiddleware((await import('./schemas.js')).portfolioSchemas.create),
  
  //contact form chain
  contactForm: createValidationMiddleware((await import('./schemas.js')).contactSchema),
  
  //authentication chains
  login: createValidationMiddleware((await import('./schemas.js')).authSchemas.login),
  register: createValidationMiddleware((await import('./schemas.js')).authSchemas.register),
};