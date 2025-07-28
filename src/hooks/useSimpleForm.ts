// ============================================================================
// USE SIMPLE FORM HOOK
// ============================================================================
// Simplified form hook that eliminates keyboard interference by using basic
// useState for form values and only validating on submit

import { useState, useCallback } from "react";
import { z } from "zod";
import { validateFormData } from "@/utils/validation";

// ============================================================================
// TYPES
// ============================================================================

export interface UseSimpleFormOptions {
  onSubmit?: (values: any) => Promise<void> | void;
}

export interface UseSimpleFormReturn<T extends Record<string, any>> {
  // State
  values: T;
  errors: Record<keyof T, string | undefined>;
  isSubmitting: boolean;

  // Actions
  setValue: (field: keyof T, value: any) => void;
  setError: (field: keyof T, error: string) => void;
  clearError: (field: keyof T) => void;
  clearAllErrors: () => void;
  setSubmitting: (submitting: boolean) => void;
  resetForm: (newValues?: Partial<T>) => void;

  // Handlers
  handleChange: (field: keyof T) => (value: any) => void;
  handleSubmit: (onSubmit: (values: T) => Promise<void> | void) => () => Promise<void>;
  validateAndSubmit: (schema: z.ZodSchema<T>, onSubmit: (values: T) => Promise<void> | void) => () => Promise<void>;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useSimpleForm<T extends Record<string, any>>(
  initialValues: T,
  options: UseSimpleFormOptions = {}
): UseSimpleFormReturn<T> {
  // Simple state - no complex tracking
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Record<keyof T, string | undefined>>({} as Record<keyof T, string | undefined>);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const setValue = useCallback(
    (field: keyof T, value: any) => {
      setValues((prev) => ({ ...prev, [field]: value }));

      // Clear error when user starts typing
      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    },
    [errors]
  );

  const setError = useCallback((field: keyof T, error: string) => {
    setErrors((prev) => ({ ...prev, [field]: error }));
  }, []);

  const clearError = useCallback((field: keyof T) => {
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }, []);

  const clearAllErrors = useCallback(() => {
    setErrors({} as Record<keyof T, string | undefined>);
  }, []);

  const setSubmitting = useCallback((submitting: boolean) => {
    setIsSubmitting(submitting);
  }, []);

  const resetForm = useCallback(
    (newValues?: Partial<T>) => {
      const resetValues = { ...initialValues, ...newValues };
      setValues(resetValues);
      setErrors({} as Record<keyof T, string | undefined>);
      setIsSubmitting(false);
    },
    [initialValues]
  );

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleChange = useCallback(
    (field: keyof T) => (value: any) => {
      setValue(field, value);
    },
    [setValue]
  );

  const handleSubmit = useCallback(
    (onSubmit: (values: T) => Promise<void> | void) => async () => {
      setIsSubmitting(true);
      try {
        await onSubmit(values);
      } catch (error) {
        console.error("Form submission error:", error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [values]
  );

  const validateAndSubmit = useCallback(
    (schema: z.ZodSchema<T>, onSubmit: (values: T) => Promise<void> | void) => async () => {
      setIsSubmitting(true);
      clearAllErrors();

      try {
        // Validate form
        const result = validateFormData(schema, values);

        if (!result.isValid) {
          // Set validation errors
          Object.keys(result.errors).forEach((key) => {
            if (result.errors[key]) {
              setError(key as keyof T, result.errors[key]);
            }
          });
          return;
        }

        // Submit if valid
        await onSubmit(values);
      } catch (error) {
        console.error("Form validation/submission error:", error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [values, clearAllErrors, setError]
  );

  // ============================================================================
  // RETURN HOOK INTERFACE
  // ============================================================================

  return {
    // State
    values,
    errors,
    isSubmitting,

    // Actions
    setValue,
    setError,
    clearError,
    clearAllErrors,
    setSubmitting,
    resetForm,

    // Handlers
    handleChange,
    handleSubmit,
    validateAndSubmit,
  };
}

// ============================================================================
// EXPORT
// ============================================================================

export default useSimpleForm;
