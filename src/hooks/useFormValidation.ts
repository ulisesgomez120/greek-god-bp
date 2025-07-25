// ============================================================================
// USE FORM VALIDATION HOOK
// ============================================================================
// Custom hook for real-time form validation with debouncing, error management,
// and accessibility support for TrainSmart authentication forms

import { useState, useCallback, useEffect, useMemo } from "react";
import { z } from "zod";
import { validateFormData } from "@/utils/validation";

// ============================================================================
// TYPES
// ============================================================================

export interface FormField {
  value: any;
  error?: string;
  touched: boolean;
  dirty: boolean;
}

export interface FormState<T extends Record<string, any>> {
  fields: Record<keyof T, FormField>;
  isValid: boolean;
  isSubmitting: boolean;
  hasErrors: boolean;
  isDirty: boolean;
  touchedFields: Set<keyof T>;
}

export interface UseFormValidationOptions {
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  debounceMs?: number;
  resetOnSubmit?: boolean;
}

export interface UseFormValidationReturn<T extends Record<string, any>> {
  // State
  formState: FormState<T>;
  values: T;
  errors: Record<keyof T, string | undefined>;

  // Actions
  setValue: (field: keyof T, value: any) => void;
  setError: (field: keyof T, error: string) => void;
  clearError: (field: keyof T) => void;
  clearAllErrors: () => void;
  setFieldTouched: (field: keyof T, touched?: boolean) => void;
  setSubmitting: (submitting: boolean) => void;
  resetForm: (newValues?: Partial<T>) => void;
  validateField: (field: keyof T) => Promise<boolean>;
  validateForm: () => Promise<boolean>;

  // Handlers
  handleChange: (field: keyof T) => (value: any) => void;
  handleBlur: (field: keyof T) => () => void;
  handleSubmit: (onSubmit: (values: T) => Promise<void> | void) => (event?: any) => Promise<void>;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useFormValidation<T extends Record<string, any>>(
  schema: z.ZodSchema<T>,
  initialValues: T,
  options: UseFormValidationOptions = {}
): UseFormValidationReturn<T> {
  const { validateOnChange = true, validateOnBlur = true, debounceMs = 300, resetOnSubmit = false } = options;

  // Initialize form state
  const [formState, setFormState] = useState<FormState<T>>(() => {
    const fields = {} as Record<keyof T, FormField>;

    Object.keys(initialValues).forEach((key) => {
      fields[key as keyof T] = {
        value: initialValues[key as keyof T],
        touched: false,
        dirty: false,
      };
    });

    return {
      fields,
      isValid: false,
      isSubmitting: false,
      hasErrors: false,
      isDirty: false,
      touchedFields: new Set(),
    };
  });

  // Debounce timer for validation
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  // Computed values
  const values = useMemo(() => {
    const vals = {} as T;
    Object.keys(formState.fields).forEach((key) => {
      vals[key as keyof T] = formState.fields[key as keyof T].value;
    });
    return vals;
  }, [formState.fields]);

  const errors = useMemo(() => {
    const errs = {} as Record<keyof T, string | undefined>;
    Object.keys(formState.fields).forEach((key) => {
      errs[key as keyof T] = formState.fields[key as keyof T].error;
    });
    return errs;
  }, [formState.fields]);

  // ============================================================================
  // VALIDATION FUNCTIONS
  // ============================================================================

  const validateField = useCallback(
    async (field: keyof T): Promise<boolean> => {
      const fieldValue = formState.fields[field].value;

      try {
        // Create a partial schema for single field validation
        const fieldSchema = schema.pick({ [field]: true } as any);
        const result = validateFormData(fieldSchema, { [field]: fieldValue });

        setFormState((prev) => ({
          ...prev,
          fields: {
            ...prev.fields,
            [field]: {
              ...prev.fields[field],
              error: result.errors[field as string],
            },
          },
          hasErrors: Object.values({
            ...prev.fields,
            [field]: { error: result.errors[field as string] },
          }).some((f) => f.error),
        }));

        return !result.errors[field as string];
      } catch (error) {
        // If single field validation fails, validate entire form to get field-specific error
        const fullResult = validateFormData(schema, values);

        setFormState((prev) => ({
          ...prev,
          fields: {
            ...prev.fields,
            [field]: {
              ...prev.fields[field],
              error: fullResult.errors[field as string],
            },
          },
          hasErrors: Object.values({
            ...prev.fields,
            [field]: { error: fullResult.errors[field as string] },
          }).some((f) => f.error),
        }));

        return !fullResult.errors[field as string];
      }
    },
    [schema, formState.fields, values]
  );

  const validateForm = useCallback(async (): Promise<boolean> => {
    const result = validateFormData(schema, values);

    setFormState((prev) => {
      const newFields = { ...prev.fields };

      // Clear all errors first
      Object.keys(newFields).forEach((key) => {
        newFields[key as keyof T] = {
          ...newFields[key as keyof T],
          error: undefined,
        };
      });

      // Set new errors
      Object.keys(result.errors).forEach((key) => {
        if (newFields[key as keyof T]) {
          newFields[key as keyof T] = {
            ...newFields[key as keyof T],
            error: result.errors[key],
          };
        }
      });

      return {
        ...prev,
        fields: newFields,
        isValid: result.isValid,
        hasErrors: !result.isValid,
      };
    });

    return result.isValid;
  }, [schema, values]);

  // ============================================================================
  // FORM ACTIONS
  // ============================================================================

  const setValue = useCallback(
    (field: keyof T, value: any) => {
      setFormState((prev) => ({
        ...prev,
        fields: {
          ...prev.fields,
          [field]: {
            ...prev.fields[field],
            value,
            dirty: value !== initialValues[field],
          },
        },
        isDirty: Object.values({
          ...prev.fields,
          [field]: { ...prev.fields[field], value, dirty: value !== initialValues[field] },
        }).some((f) => f.dirty),
      }));

      // Debounced validation on change
      if (validateOnChange) {
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }

        const timer = setTimeout(() => {
          validateField(field);
        }, debounceMs);

        setDebounceTimer(timer);
      }
    },
    [initialValues, validateOnChange, debounceMs, debounceTimer, validateField]
  );

  const setError = useCallback((field: keyof T, error: string) => {
    setFormState((prev) => ({
      ...prev,
      fields: {
        ...prev.fields,
        [field]: {
          ...prev.fields[field],
          error,
        },
      },
      hasErrors: true,
    }));
  }, []);

  const clearError = useCallback((field: keyof T) => {
    setFormState((prev) => ({
      ...prev,
      fields: {
        ...prev.fields,
        [field]: {
          ...prev.fields[field],
          error: undefined,
        },
      },
      hasErrors: Object.values({
        ...prev.fields,
        [field]: { ...prev.fields[field], error: undefined },
      }).some((f) => f.error),
    }));
  }, []);

  const clearAllErrors = useCallback(() => {
    setFormState((prev) => {
      const newFields = { ...prev.fields };
      Object.keys(newFields).forEach((key) => {
        newFields[key as keyof T] = {
          ...newFields[key as keyof T],
          error: undefined,
        };
      });

      return {
        ...prev,
        fields: newFields,
        hasErrors: false,
      };
    });
  }, []);

  const setFieldTouched = useCallback((field: keyof T, touched: boolean = true) => {
    setFormState((prev) => ({
      ...prev,
      fields: {
        ...prev.fields,
        [field]: {
          ...prev.fields[field],
          touched,
        },
      },
      touchedFields: touched
        ? new Set([...prev.touchedFields, field])
        : new Set([...prev.touchedFields].filter((f) => f !== field)),
    }));
  }, []);

  const setSubmitting = useCallback((submitting: boolean) => {
    setFormState((prev) => ({
      ...prev,
      isSubmitting: submitting,
    }));
  }, []);

  const resetForm = useCallback(
    (newValues?: Partial<T>) => {
      const resetValues = { ...initialValues, ...newValues };

      setFormState(() => {
        const fields = {} as Record<keyof T, FormField>;

        Object.keys(resetValues).forEach((key) => {
          fields[key as keyof T] = {
            value: resetValues[key as keyof T],
            touched: false,
            dirty: false,
          };
        });

        return {
          fields,
          isValid: false,
          isSubmitting: false,
          hasErrors: false,
          isDirty: false,
          touchedFields: new Set(),
        };
      });
    },
    [initialValues]
  );

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleChange = useCallback(
    (field: keyof T) => (value: any) => {
      setValue(field, value);
    },
    [setValue]
  );

  const handleBlur = useCallback(
    (field: keyof T) => () => {
      setFieldTouched(field, true);

      if (validateOnBlur) {
        validateField(field);
      }
    },
    [setFieldTouched, validateOnBlur, validateField]
  );

  const handleSubmit = useCallback(
    (onSubmit: (values: T) => Promise<void> | void) => async (event?: any) => {
      if (event?.preventDefault) {
        event.preventDefault();
      }

      setSubmitting(true);

      // Mark all fields as touched
      Object.keys(formState.fields).forEach((key) => {
        setFieldTouched(key as keyof T, true);
      });

      try {
        const isValid = await validateForm();

        if (isValid) {
          await onSubmit(values);

          if (resetOnSubmit) {
            resetForm();
          }
        }
      } catch (error) {
        console.error("Form submission error:", error);
      } finally {
        setSubmitting(false);
      }
    },
    [formState.fields, setSubmitting, setFieldTouched, validateForm, values, resetOnSubmit, resetForm]
  );

  // ============================================================================
  // CLEANUP
  // ============================================================================

  useEffect(() => {
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [debounceTimer]);

  // ============================================================================
  // RETURN HOOK INTERFACE
  // ============================================================================

  return {
    // State
    formState,
    values,
    errors,

    // Actions
    setValue,
    setError,
    clearError,
    clearAllErrors,
    setFieldTouched,
    setSubmitting,
    resetForm,
    validateField,
    validateForm,

    // Handlers
    handleChange,
    handleBlur,
    handleSubmit,
  };
}

// ============================================================================
// EXPORT
// ============================================================================

export default useFormValidation;
