"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useUserTheme } from "@/components/providers/user-theme-provider";
import { hexToRgba } from "@/components/ui/themed";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", type = "text", style, ...props }, ref) => {
    const { theme } = useUserTheme();
    const [isFocused, setIsFocused] = React.useState(false);

    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border px-3 py-2 text-sm  disabled:opacity-50 outline-none transition-all duration-200",
          className
        )}
        style={{
          backgroundColor: theme.colors.backgroundSecondary,
          borderColor: isFocused ? theme.colors.gradientFrom : theme.colors.border,
          color: theme.colors.text,
          boxShadow: isFocused ? `0 0 0 2px ${hexToRgba(theme.colors.gradientFrom, 0.2)}` : 'none',
          ...style,
        }}
        ref={ref}
        onFocus={(e) => {
          setIsFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          props.onBlur?.(e);
        }}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

export { Input };
