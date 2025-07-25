// ============================================================================
// LOADING BUTTON COMPONENT
// ============================================================================
// Button component with loading states and smooth animations for authentication
// forms and user actions

import React from "react";
import { ActivityIndicator } from "react-native";
import Button, { ButtonProps } from "./Button";

// ============================================================================
// TYPES
// ============================================================================

export interface LoadingButtonProps extends ButtonProps {
  loading?: boolean;
  loadingText?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const LoadingButton: React.FC<LoadingButtonProps> = ({
  loading = false,
  loadingText,
  children,
  disabled,
  ...props
}) => {
  const isDisabled = disabled || loading;

  return (
    <Button {...props} loading={loading} disabled={isDisabled}>
      {loading && loadingText ? loadingText : children}
    </Button>
  );
};

// ============================================================================
// EXPORT
// ============================================================================

export default LoadingButton;
