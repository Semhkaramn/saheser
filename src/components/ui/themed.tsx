"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useUserTheme } from "@/components/providers/user-theme-provider";

// ============================================
// HELPER: Hex to RGBA
// ============================================
function hexToRgba(hex: string, alpha: number): string {
  // Remove # if present
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ============================================
// THEMED CARD
// ============================================

interface ThemedCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "hover" | "active" | "primary-dark";
}

const ThemedCard = React.forwardRef<HTMLDivElement, ThemedCardProps>(
  ({ className, variant = "hover", style, ...props }, ref) => {
    const { theme } = useUserTheme();

    const getCardStyle = (): React.CSSProperties => {
      switch (variant) {
        case "active":
          return {
            background: `linear-gradient(135deg, ${hexToRgba(theme.colors.gradientFrom, 0.15)}, ${hexToRgba(theme.colors.gradientTo, 0.1)})`,
            borderColor: hexToRgba(theme.colors.gradientFrom, 0.4),
          };
        case "primary-dark":
          // Koyu primary renk arka plan - görev kartları için
          return {
            background: `linear-gradient(135deg, ${hexToRgba(theme.colors.primary, 0.15)}, ${hexToRgba(theme.colors.gradientTo, 0.08)})`,
            borderColor: hexToRgba(theme.colors.primary, 0.35),
          };
        case "hover":
        case "default":
        default:
          return {
            backgroundColor: hexToRgba(theme.colors.card, 0.8),
            borderColor: hexToRgba(theme.colors.border, 0.5),
          };
      }
    };

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl border p-4 transition-all duration-200 backdrop-blur-sm",
          className
        )}
        style={{ ...getCardStyle(), ...style }}
        {...props}
      />
    );
  }
);
ThemedCard.displayName = "ThemedCard";

// ============================================
// THEMED CARD HEADER
// ============================================

const ThemedCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 pb-4", className)}
    {...props}
  />
));
ThemedCardHeader.displayName = "ThemedCardHeader";

// ============================================
// THEMED CARD TITLE
// ============================================

const ThemedCardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => {
  const { theme } = useUserTheme();

  return (
    <h3
      ref={ref}
      className={cn(
        "text-lg font-semibold leading-none tracking-tight",
        className
      )}
      style={{ color: theme.colors.text }}
      {...props}
    />
  );
});
ThemedCardTitle.displayName = "ThemedCardTitle";

// ============================================
// THEMED CARD DESCRIPTION
// ============================================

const ThemedCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  const { theme } = useUserTheme();

  return (
    <p
      ref={ref}
      className={cn("text-sm", className)}
      style={{ color: theme.colors.textSecondary }}
      {...props}
    />
  );
});
ThemedCardDescription.displayName = "ThemedCardDescription";

// ============================================
// THEMED CARD CONTENT
// ============================================

const ThemedCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("", className)} {...props} />
));
ThemedCardContent.displayName = "ThemedCardContent";

// ============================================
// THEMED CARD FOOTER
// ============================================

const ThemedCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center pt-4", className)}
    {...props}
  />
));
ThemedCardFooter.displayName = "ThemedCardFooter";

// ============================================
// THEMED BUTTON - INLINE STYLES APPROACH
// ============================================

interface ThemedButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
}

const ThemedButton = React.forwardRef<HTMLButtonElement, ThemedButtonProps>(
  ({ className, variant = "primary", size = "md", disabled, style, ...props }, ref) => {
    const { theme } = useUserTheme();
    const [isHovered, setIsHovered] = React.useState(false);

    const sizeClasses = {
      sm: "px-3 py-1.5 text-sm",
      md: "px-4 py-2 text-sm",
      lg: "px-6 py-3 text-base",
    };

    // Rengi koyulaştırma fonksiyonu
    const darkenColor = (hex: string, percent: number): string => {
      const cleanHex = hex.replace('#', '');
      const r = Math.max(0, Math.floor(parseInt(cleanHex.substring(0, 2), 16) * (1 - percent / 100)));
      const g = Math.max(0, Math.floor(parseInt(cleanHex.substring(2, 4), 16) * (1 - percent / 100)));
      const b = Math.max(0, Math.floor(parseInt(cleanHex.substring(4, 6), 16) * (1 - percent / 100)));
      return `rgb(${r}, ${g}, ${b})`;
    };

    const getButtonStyle = (): React.CSSProperties => {
      const baseStyle: React.CSSProperties = {
        cursor: disabled ? 'default' : 'pointer',
      };

      switch (variant) {
        case "primary":
          return {
            ...baseStyle,
            background: isHovered && !disabled
              ? `linear-gradient(to right, ${darkenColor(theme.colors.gradientFrom, 15)}, ${darkenColor(theme.colors.gradientTo, 15)})`
              : `linear-gradient(to right, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})`,
            color: theme.colors.primaryForeground,
            boxShadow: isHovered && !disabled
              ? `0 12px 20px -3px ${hexToRgba(theme.colors.gradientFrom, 0.35)}`
              : `0 10px 15px -3px ${hexToRgba(theme.colors.gradientFrom, 0.25)}`,
            transform: isHovered && !disabled ? 'translateY(-1px)' : 'translateY(0)',
          };
        case "secondary":
          return {
            ...baseStyle,
            backgroundColor: isHovered && !disabled
              ? theme.colors.borderHover
              : theme.colors.backgroundSecondary,
            color: theme.colors.text,
            border: `1px solid ${theme.colors.border}`,
          };
        case "outline":
          return {
            ...baseStyle,
            backgroundColor: isHovered && !disabled
              ? hexToRgba(theme.colors.gradientFrom, 0.25)
              : hexToRgba(theme.colors.gradientFrom, 0.15),
            borderColor: isHovered && !disabled
              ? hexToRgba(theme.colors.gradientFrom, 0.6)
              : hexToRgba(theme.colors.gradientFrom, 0.4),
            color: isHovered && !disabled ? theme.colors.text : theme.colors.textSecondary,
            border: `1px solid`,
            boxShadow: `0 2px 4px ${hexToRgba(theme.colors.gradientFrom, isHovered ? 0.2 : 0.1)}`,
          };
        case "ghost":
          return {
            ...baseStyle,
            backgroundColor: isHovered && !disabled
              ? hexToRgba(theme.colors.backgroundSecondary, 0.8)
              : 'transparent',
            color: isHovered && !disabled
              ? theme.colors.text
              : theme.colors.textMuted,
          };
        default:
          return baseStyle;
      }
    };

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center rounded-full font-medium transition-all duration-200",
          disabled && "opacity-50",
          sizeClasses[size],
          className
        )}
        style={{ ...getButtonStyle(), ...style }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        {...props}
      />
    );
  }
);
ThemedButton.displayName = "ThemedButton";

// ============================================
// THEMED BADGE - INLINE STYLES APPROACH
// ============================================

interface ThemedBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "primary" | "secondary" | "success" | "warning" | "error";
}

const ThemedBadge = React.forwardRef<HTMLSpanElement, ThemedBadgeProps>(
  ({ className, variant = "primary", style, ...props }, ref) => {
    const { theme } = useUserTheme();

    const getBadgeStyle = (): React.CSSProperties => {
      switch (variant) {
        case "primary":
          return {
            backgroundColor: hexToRgba(theme.colors.gradientFrom, 0.2),
            color: theme.colors.textSecondary,
            borderColor: hexToRgba(theme.colors.gradientFrom, 0.3),
          };
        case "secondary":
          return {
            backgroundColor: hexToRgba(theme.colors.border, 0.2),
            color: theme.colors.textSecondary,
            borderColor: hexToRgba(theme.colors.border, 0.3),
          };
        case "success":
          return {
            backgroundColor: hexToRgba(theme.colors.success, 0.2),
            color: theme.colors.success,
            borderColor: hexToRgba(theme.colors.success, 0.3),
          };
        case "warning":
          return {
            backgroundColor: hexToRgba(theme.colors.warning, 0.2),
            color: theme.colors.warning,
            borderColor: hexToRgba(theme.colors.warning, 0.3),
          };
        case "error":
          return {
            backgroundColor: hexToRgba(theme.colors.error, 0.2),
            color: theme.colors.error,
            borderColor: hexToRgba(theme.colors.error, 0.3),
          };
        default:
          return {};
      }
    };

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
          className
        )}
        style={{ ...getBadgeStyle(), ...style }}
        {...props}
      />
    );
  }
);
ThemedBadge.displayName = "ThemedBadge";

// ============================================
// THEMED PROGRESS BAR - INLINE STYLES
// ============================================

interface ThemedProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
}

const ThemedProgress = React.forwardRef<HTMLDivElement, ThemedProgressProps>(
  ({ className, value, max = 100, style, ...props }, ref) => {
    const { theme } = useUserTheme();
    const percentage = Math.min((value / max) * 100, 100);

    return (
      <div
        ref={ref}
        className={cn(
          "w-full h-2.5 rounded-full overflow-hidden",
          className
        )}
        style={{
          backgroundColor: hexToRgba(theme.colors.border, 0.5),
          ...style
        }}
        {...props}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${percentage}%`,
            background: `linear-gradient(to right, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})`
          }}
        />
      </div>
    );
  }
);
ThemedProgress.displayName = "ThemedProgress";

// ============================================
// THEMED INPUT - INLINE STYLES
// ============================================

interface ThemedInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const ThemedInput = React.forwardRef<HTMLInputElement, ThemedInputProps>(
  ({ className, style, ...props }, ref) => {
    const { theme } = useUserTheme();
    const [isFocused, setIsFocused] = React.useState(false);

    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded-lg border px-3 py-2 text-sm transition-all duration-200 outline-none",
          className
        )}
        style={{
          backgroundColor: theme.colors.backgroundSecondary,
          borderColor: isFocused ? theme.colors.gradientFrom : theme.colors.border,
          color: theme.colors.text,
          boxShadow: isFocused ? `0 0 0 2px ${hexToRgba(theme.colors.gradientFrom, 0.2)}` : 'none',
          ...style
        }}
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
ThemedInput.displayName = "ThemedInput";

// ============================================
// THEMED TEXTAREA - INLINE STYLES
// ============================================

interface ThemedTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const ThemedTextarea = React.forwardRef<HTMLTextAreaElement, ThemedTextareaProps>(
  ({ className, style, ...props }, ref) => {
    const { theme } = useUserTheme();
    const [isFocused, setIsFocused] = React.useState(false);

    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full rounded-lg border px-3 py-2 text-sm transition-all duration-200 outline-none min-h-[100px]",
          className
        )}
        style={{
          backgroundColor: theme.colors.backgroundSecondary,
          borderColor: isFocused ? theme.colors.gradientFrom : theme.colors.border,
          color: theme.colors.text,
          boxShadow: isFocused ? `0 0 0 2px ${hexToRgba(theme.colors.gradientFrom, 0.2)}` : 'none',
          ...style
        }}
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
ThemedTextarea.displayName = "ThemedTextarea";

// ============================================
// THEMED SECTION TITLE
// ============================================

interface ThemedSectionTitleProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  badge?: React.ReactNode;
}

const ThemedSectionTitle = React.forwardRef<HTMLDivElement, ThemedSectionTitleProps>(
  ({ className, icon, title, badge, ...props }, ref) => {
    const { theme } = useUserTheme();

    return (
      <div
        ref={ref}
        className={cn("flex items-center gap-2 mb-4", className)}
        {...props}
      >
        {icon && (
          <div
            className="p-2 rounded-lg"
            style={{
              background: `linear-gradient(135deg, ${hexToRgba(theme.colors.gradientFrom, 0.2)}, ${hexToRgba(theme.colors.gradientTo, 0.2)})`
            }}
          >
            {icon}
          </div>
        )}
        <h2
          className="text-lg font-bold bg-clip-text text-transparent"
          style={{
            backgroundImage: `linear-gradient(to right, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})`
          }}
        >
          {title}
        </h2>
        {badge && <div className="ml-auto">{badge}</div>}
      </div>
    );
  }
);
ThemedSectionTitle.displayName = "ThemedSectionTitle";

// ============================================
// THEMED EMPTY STATE
// ============================================

interface ThemedEmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

const ThemedEmptyState = React.forwardRef<HTMLDivElement, ThemedEmptyStateProps>(
  ({ className, icon, title, description, action, style, ...props }, ref) => {
    const { theme } = useUserTheme();

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl border p-12 text-center backdrop-blur-sm",
          className
        )}
        style={{
          backgroundColor: hexToRgba(theme.colors.card, 0.8),
          borderColor: hexToRgba(theme.colors.border, 0.5),
          ...style
        }}
        {...props}
      >
        {icon && (
          <div
            className="w-fit mx-auto mb-4"
            style={{ color: theme.colors.textMuted }}
          >
            {icon}
          </div>
        )}
        <h3
          className="text-xl font-semibold mb-2"
          style={{ color: theme.colors.text }}
        >
          {title}
        </h3>
        {description && (
          <p
            className="mb-4"
            style={{ color: theme.colors.textMuted }}
          >
            {description}
          </p>
        )}
        {action}
      </div>
    );
  }
);
ThemedEmptyState.displayName = "ThemedEmptyState";

// ============================================
// THEMED INFO CARD
// ============================================

interface ThemedInfoCardProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  items: { icon?: React.ReactNode; text: string }[];
}

const ThemedInfoCard = React.forwardRef<HTMLDivElement, ThemedInfoCardProps>(
  ({ className, icon, title, items, style, ...props }, ref) => {
    const { theme } = useUserTheme();

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl border p-6 shadow-lg",
          className
        )}
        style={{
          background: `linear-gradient(135deg, ${hexToRgba(theme.colors.gradientFrom, 0.15)}, ${hexToRgba(theme.colors.gradientTo, 0.1)})`,
          borderColor: hexToRgba(theme.colors.gradientFrom, 0.4),
          ...style
        }}
        {...props}
      >
        <div className="flex items-start gap-4">
          {icon && (
            <div
              className="p-3 rounded-xl"
              style={{
                background: hexToRgba(theme.colors.gradientFrom, 0.2)
              }}
            >
              {icon}
            </div>
          )}
          <div style={{ color: theme.colors.textSecondary }}>
            <p
              className="font-bold text-lg mb-3"
              style={{ color: theme.colors.text }}
            >
              {title}
            </p>
            <ul className="space-y-2 text-sm">
              {items.map((item, index) => (
                <li key={index} className="flex items-start gap-2">
                  {item.icon && (
                    <span className="mt-0.5 flex-shrink-0">{item.icon}</span>
                  )}
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }
);
ThemedInfoCard.displayName = "ThemedInfoCard";

// ============================================
// EXPORTS
// ============================================

export {
  ThemedCard,
  ThemedCardHeader,
  ThemedCardTitle,
  ThemedCardDescription,
  ThemedCardContent,
  ThemedCardFooter,
  ThemedButton,
  ThemedBadge,
  ThemedProgress,
  ThemedInput,
  ThemedTextarea,
  ThemedSectionTitle,
  ThemedEmptyState,
  ThemedInfoCard,
  hexToRgba,
};
