// Theme Configuration
// To change the theme, update the ACTIVE_THEME variable at the bottom of this file

export interface ThemeColors {
  name: string;
  // Core colors
  background: string;      // Main background
  backgroundDark: string;  // Darker shade for depth
  card: string;            // Card backgrounds
  cardHover: string;       // Card hover state
  
  // Text colors
  foreground: string;      // Primary text
  foregroundMuted: string; // Secondary/muted text
  
  // Accent colors
  primary: string;         // Primary accent (buttons, winner highlights)
  primaryLight: string;    // Lighter variant of primary
  secondary: string;       // Secondary accent
  
  // Semantic colors
  long: string;            // Long position color
  short: string;           // Short position color
  
  // Border colors
  border: string;
  borderHover: string;
}

// ============================================================================
// THEME DEFINITIONS
// ============================================================================

export const themes: Record<string, ThemeColors> = {
  // Current: Warm Earth + Red
  warmEarth: {
    name: "Warm Earth",
    background: "#2A261F",        // Darkened #403A2E
    backgroundDark: "#1F1C17",
    card: "#403A2E",
    cardHover: "#4A4336",
    foreground: "#BFBAB0",
    foregroundMuted: "#8A857B",
    primary: "#BF0413",
    primaryLight: "#D94854",
    secondary: "#D9BD9C",
    long: "#D9BD9C",
    short: "#BF0413",
    border: "#524B3D",
    borderHover: "#6B6355",
  },

  // Crimson + Teal (previous)
  crimsonTeal: {
    name: "Crimson Teal",
    background: "#0D1A24",
    backgroundDark: "#081219",
    card: "#254159",
    cardHover: "#2D4D68",
    foreground: "#A9CBD9",
    foregroundMuted: "#6A8A9A",
    primary: "#BF0436",
    primaryLight: "#E0355F",
    secondary: "#2D83A6",
    long: "#2D83A6",
    short: "#BF0436",
    border: "#344D5E",
    borderHover: "#2D83A6",
  },

  // Midnight Navy + Gold (first alternative)
  midnightGold: {
    name: "Midnight Gold",
    background: "#081226",
    backgroundDark: "#050D1A",
    card: "#0E2440",
    cardHover: "#133052",
    foreground: "#D9CDB8",
    foregroundMuted: "#8A8172",
    primary: "#D9A577",
    primaryLight: "#E8C4A0",
    secondary: "#D9CDB8",
    long: "#D9A577",
    short: "#E85A6B",
    border: "#1A3555",
    borderHover: "#D9A577",
  },

  // Original Emerald
  emerald: {
    name: "Emerald",
    background: "#0A0F14",
    backgroundDark: "#060A0E",
    card: "#111920",
    cardHover: "#1A242E",
    foreground: "#E8ECF0",
    foregroundMuted: "#6B7A8A",
    primary: "#10B981",
    primaryLight: "#34D399",
    secondary: "#14B8A6",
    long: "#10B981",
    short: "#F43F5E",
    border: "#1E2A36",
    borderHover: "#10B981",
  },

  // Neon Lime / Cyberpunk
  neonLime: {
    name: "Neon Lime",
    background: "#0D0D0D",
    backgroundDark: "#050505",
    card: "#161616",
    cardHover: "#1F1F1F",
    foreground: "#E8E8E8",
    foregroundMuted: "#595959",
    primary: "#D8F213",
    primaryLight: "#E5FF4D",
    secondary: "#748C1B",
    long: "#D8F213",
    short: "#FF4757",
    border: "#2A2A2A",
    borderHover: "#3D3D3D",
  },
};

// ============================================================================
// ACTIVE THEME - CHANGE THIS TO SWITCH THEMES
// ============================================================================
export const ACTIVE_THEME: keyof typeof themes = "neonLime";

// Get current theme colors
export const theme = themes[ACTIVE_THEME];

// CSS variable generator for globals.css
export function getThemeCSSVariables(t: ThemeColors): string {
  return `
  /* Theme: ${t.name} */
  --background: ${hexToHSL(t.backgroundDark)};
  --foreground: ${hexToHSL(t.foreground)};
  --card: ${hexToHSL(t.card)};
  --card-foreground: ${hexToHSL(t.foreground)};
  --popover: ${hexToHSL(t.background)};
  --popover-foreground: ${hexToHSL(t.foreground)};
  --primary: ${hexToHSL(t.primary)};
  --primary-foreground: ${hexToHSL(t.backgroundDark)};
  --secondary: ${hexToHSL(t.card)};
  --secondary-foreground: ${hexToHSL(t.foreground)};
  --muted: ${hexToHSL(t.background)};
  --muted-foreground: ${hexToHSL(t.foregroundMuted)};
  --accent: ${hexToHSL(t.secondary)};
  --accent-foreground: ${hexToHSL(t.backgroundDark)};
  --destructive: ${hexToHSL(t.short)};
  --destructive-foreground: ${hexToHSL(t.foreground)};
  --border: ${hexToHSL(t.border)};
  --input: ${hexToHSL(t.card)};
  --ring: ${hexToHSL(t.primary)};
  `;
}

// Helper: Convert hex to HSL string (without hsl() wrapper)
function hexToHSL(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
