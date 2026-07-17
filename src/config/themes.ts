// ============================================
// MERKEZI TEMA YAPILANDIRMASI (Harley)
// ============================================

export type ThemeName = "harley";

export interface ThemeColors {
  // Ana renkler
  primary: string;
  primaryHover: string;
  primaryForeground: string;

  // Arka plan renkleri
  background: string;
  backgroundSecondary: string;

  // Kart renkleri
  card: string;
  cardBorder: string;
  cardHover: string;

  // Gradient'ler
  gradientFrom: string;
  gradientTo: string;
  gradientVia?: string;

  // Accent renkler
  accent: string;
  accentHover: string;
  accentForeground: string;

  // Text renkleri
  text: string;
  textSecondary: string;
  textMuted: string;

  // Border renkleri
  border: string;
  borderHover: string;

  // Success, warning, error
  success: string;
  successBg: string;
  warning: string;
  warningBg: string;
  error: string;
  errorBg: string;

  // Badge renkleri
  badgePrimary: string;
  badgePrimaryBg: string;
  badgeSecondary: string;
  badgeSecondaryBg: string;
}

export interface ThemeConfig {
  name: ThemeName;
  displayName: string;
  colors: ThemeColors;

  // Kart stilleri
  cardStyle: {
    base: string;
    hover: string;
    active: string;
  };

  // Buton stilleri
  buttonStyle: {
    primary: string;
    secondary: string;
    outline: string;
    ghost: string;
  };

  // Badge stilleri
  badgeStyle: {
    primary: string;
    secondary: string;
    success: string;
    warning: string;
    error: string;
  };

  // Tab stilleri
  tabStyle: {
    list: string;
    trigger: string;
    triggerActive: string;
  };

  // Progress bar stilleri
  progressStyle: {
    track: string;
    bar: string;
  };

  // Input stilleri
  inputStyle: {
    base: string;
    focus: string;
  };
}


// ============================================
// HARLEY TEMASI
// ============================================
const harleyTheme: ThemeConfig = {
  name: "harley",
  displayName: "Harley",
  colors: {
    // Canlı mavi - referans sitedeki gibi imza vurgu rengi
    primary: "#3B82F6",
    primaryHover: "#2563EB",
    primaryForeground: "#ffffff",

    // Koyu lacivert zemin - referans sitedeki gibi
    background: "#0B1120",
    backgroundSecondary: "#111A2E",

    card: "#141D33",
    cardBorder: "#232E4A",
    cardHover: "#1A2540",

    gradientFrom: "#3B82F6",
    gradientTo: "#8B5CF6",
    gradientVia: "#6366F1",

    // Mor - ikincil vurgu
    accent: "#8B5CF6",
    accentHover: "#7C3AED",
    accentForeground: "#ffffff",

    text: "#F1F5F9",
    textSecondary: "#94A3B8",
    textMuted: "#64748B",

    border: "#232E4A",
    borderHover: "#2E3B5C",

    success: "#22C55E",
    successBg: "rgba(34, 197, 94, 0.12)",
    warning: "#F59E0B",
    warningBg: "rgba(245, 158, 11, 0.12)",
    error: "#EF4444",
    errorBg: "rgba(239, 68, 68, 0.12)",

    badgePrimary: "#60A5FA",
    badgePrimaryBg: "rgba(59, 130, 246, 0.14)",
    badgeSecondary: "#A78BFA",
    badgeSecondaryBg: "rgba(139, 92, 246, 0.14)",
  },
  cardStyle: {
    base: "bg-[#141D33] border-[#232E4A] shadow-sm",
    hover: "hover:border-[#2E3B5C] hover:shadow-md transition-all duration-200",
    active: "bg-[#1A2540] border-[#3B82F6]/40",
  },
  buttonStyle: {
    primary: "bg-[#3B82F6] hover:bg-[#2563EB] text-white font-medium shadow-sm",
    secondary: "bg-[#1A2540] hover:bg-[#232E4A] text-[#F1F5F9] border border-[#232E4A]",
    outline: "bg-transparent border border-[#232E4A] text-[#F1F5F9] hover:border-[#2E3B5C] hover:bg-[#141D33]",
    ghost: "text-[#64748B] hover:text-[#F1F5F9] hover:bg-[#141D33]",
  },
  badgeStyle: {
    primary: "bg-[#3B82F6]/15 text-[#60A5FA] border-[#3B82F6]/25",
    secondary: "bg-[#8B5CF6]/15 text-[#A78BFA] border-[#8B5CF6]/25",
    success: "bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/25",
    warning: "bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/25",
    error: "bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/25",
  },
  tabStyle: {
    list: "bg-[#111A2E] border border-[#232E4A]",
    trigger: "text-[#64748B] hover:text-[#F1F5F9] hover:bg-[#1A2540]",
    triggerActive: "bg-[#3B82F6] text-white font-medium shadow-sm",
  },
  progressStyle: {
    track: "bg-[#1A2540]",
    bar: "bg-[#3B82F6]",
  },
  inputStyle: {
    base: "bg-[#111A2E] border-[#232E4A] text-[#F1F5F9] placeholder:text-[#64748B]",
    focus: "focus:border-[#3B82F6] focus:ring-[#3B82F6]/15",
  },
};



// ============================================
// TEMA HARİTASI VE YARDIMCI FONKSİYONLAR
// ============================================

export const themes: Record<ThemeName, ThemeConfig> = {
  harley: harleyTheme,
};

export function getThemeName(): ThemeName {
  return "harley";
}

// Aktif temayı al
export function getActiveTheme(): ThemeConfig {
  return harleyTheme;
}

// Tema listesini al (admin panel için)
