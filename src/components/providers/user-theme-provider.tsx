"use client";

import React, { createContext, useContext, useMemo } from "react";
import { getActiveTheme, type ThemeConfig, type ThemeName } from "@/config/themes";

// ============================================
// THEME CONTEXT
// ============================================

interface ThemeContextValue {
  theme: ThemeConfig;
  themeName: ThemeName;

  // Kısayol fonksiyonlar
  card: (variant?: "default" | "hover" | "active") => string;
  button: (variant?: "primary" | "secondary" | "outline" | "ghost") => string;
  badge: (variant?: "primary" | "secondary" | "success" | "warning" | "error") => string;
  tab: (variant?: "list" | "trigger" | "triggerActive") => string;
  progress: (variant?: "track" | "bar") => string;
  input: (variant?: "base" | "focus") => string;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ============================================
// THEME PROVIDER
// ============================================

interface UserThemeProviderProps {
  children: React.ReactNode;
}

export function UserThemeProvider({ children }: UserThemeProviderProps) {
  const theme = getActiveTheme();

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    themeName: theme.name,

    // Kart stili kısayolu
    card: (variant = "default") => {
      switch (variant) {
        case "hover":
          return `${theme.cardStyle.base} ${theme.cardStyle.hover}`;
        case "active":
          return theme.cardStyle.active;
        default:
          return theme.cardStyle.base;
      }
    },

    // Buton stili kısayolu
    button: (variant = "primary") => {
      return theme.buttonStyle[variant];
    },

    // Badge stili kısayolu
    badge: (variant = "primary") => {
      return theme.badgeStyle[variant];
    },

    // Tab stili kısayolu
    tab: (variant = "list") => {
      switch (variant) {
        case "trigger":
          return theme.tabStyle.trigger;
        case "triggerActive":
          return theme.tabStyle.triggerActive;
        default:
          return theme.tabStyle.list;
      }
    },

    // Progress bar stili kısayolu
    progress: (variant = "bar") => {
      return theme.progressStyle[variant === "track" ? "track" : "bar"];
    },

    // Input stili kısayolu
    input: (variant = "base") => {
      if (variant === "focus") {
        return `${theme.inputStyle.base} ${theme.inputStyle.focus}`;
      }
      return theme.inputStyle.base;
    },
  }), [theme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// ============================================
// HOOK: useUserTheme
// ============================================

export function useUserTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useUserTheme must be used within a UserThemeProvider");
  }
  return context;
}

// ============================================
// CSS VAR INJECTION (İsteğe bağlı)
// ============================================

export function ThemeStyleInjector() {
  const { theme } = useUserTheme();

  return (
    <style jsx global>{`
      :root {
        --user-primary: ${theme.colors.primary};
        --user-primary-hover: ${theme.colors.primaryHover};
        --user-primary-foreground: ${theme.colors.primaryForeground};
        --user-background: ${theme.colors.background};
        --user-background-secondary: ${theme.colors.backgroundSecondary};
        --user-card: ${theme.colors.card};
        --user-card-border: ${theme.colors.cardBorder};
        --user-card-hover: ${theme.colors.cardHover};
        --user-gradient-from: ${theme.colors.gradientFrom};
        --user-gradient-to: ${theme.colors.gradientTo};
        --user-gradient-via: ${theme.colors.gradientVia || theme.colors.gradientFrom};
        --user-accent: ${theme.colors.accent};
        --user-accent-hover: ${theme.colors.accentHover};
        --user-accent-foreground: ${theme.colors.accentForeground};
        --user-text: ${theme.colors.text};
        --user-text-secondary: ${theme.colors.textSecondary};
        --user-text-muted: ${theme.colors.textMuted};
        --user-border: ${theme.colors.border};
        --user-border-hover: ${theme.colors.borderHover};
        --user-success: ${theme.colors.success};
        --user-success-bg: ${theme.colors.successBg};
        --user-warning: ${theme.colors.warning};
        --user-warning-bg: ${theme.colors.warningBg};
        --user-error: ${theme.colors.error};
        --user-error-bg: ${theme.colors.errorBg};
      }
    `}</style>
  );
}
