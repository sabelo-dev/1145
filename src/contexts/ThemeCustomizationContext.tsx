import React, { createContext, useContext, useState, useEffect } from "react";

interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
}

interface ThemeCustomizationContextType {
  colors: ThemeColors;
  setColors: (colors: Partial<ThemeColors>) => void;
  resetColors: () => void;
  presets: { name: string; colors: ThemeColors }[];
  applyPreset: (presetName: string) => void;
}

const defaultColors: ThemeColors = {
  primary: "215 35% 20%",
  secondary: "43 93% 64%",
  accent: "210 40% 96.1%",
};

const colorPresets = [
  { name: "Default", colors: { primary: "215 35% 20%", secondary: "43 93% 64%", accent: "210 40% 96.1%" } },
  { name: "Ocean", colors: { primary: "199 89% 48%", secondary: "187 100% 42%", accent: "185 96% 90%" } },
  { name: "Forest", colors: { primary: "142 76% 36%", secondary: "84 81% 44%", accent: "138 76% 90%" } },
  { name: "Sunset", colors: { primary: "25 95% 53%", secondary: "38 92% 50%", accent: "30 100% 90%" } },
  { name: "Royal", colors: { primary: "262 83% 58%", secondary: "280 87% 65%", accent: "270 100% 95%" } },
  { name: "Rose", colors: { primary: "346 77% 50%", secondary: "330 81% 60%", accent: "340 100% 95%" } },
];

const ThemeCustomizationContext = createContext<ThemeCustomizationContextType | undefined>(undefined);

const hslToHex = (hsl: string): string => {
  const [h, s, l] = hsl.split(" ").map((v) => parseFloat(v.replace("%", "")));
  const sDecimal = s / 100;
  const lDecimal = l / 100;

  const c = (1 - Math.abs(2 * lDecimal - 1)) * sDecimal;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lDecimal - c / 2;

  let r = 0, g = 0, b = 0;

  if (0 <= h && h < 60) { r = c; g = x; b = 0; }
  else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
  else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
  else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
  else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
  else if (300 <= h && h < 360) { r = c; g = 0; b = x; }

  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
};

const hexToHsl = (hex: string): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "0 0% 0%";

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
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
};

export const ThemeCustomizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [colors, setColorsState] = useState<ThemeColors>(() => {
    const saved = localStorage.getItem("theme-colors");
    return saved ? JSON.parse(saved) : defaultColors;
  });

  useEffect(() => {
    localStorage.setItem("theme-colors", JSON.stringify(colors));
    
    // Apply colors to CSS variables
    const root = document.documentElement;
    root.style.setProperty("--primary", colors.primary);
    root.style.setProperty("--secondary", colors.secondary);
    root.style.setProperty("--accent", colors.accent);
  }, [colors]);

  const setColors = (newColors: Partial<ThemeColors>) => {
    setColorsState((prev) => ({ ...prev, ...newColors }));
  };

  const resetColors = () => {
    setColorsState(defaultColors);
  };

  const applyPreset = (presetName: string) => {
    const preset = colorPresets.find((p) => p.name === presetName);
    if (preset) {
      setColorsState(preset.colors);
    }
  };

  return (
    <ThemeCustomizationContext.Provider
      value={{ colors, setColors, resetColors, presets: colorPresets, applyPreset }}
    >
      {children}
    </ThemeCustomizationContext.Provider>
  );
};

export const useThemeCustomization = () => {
  const context = useContext(ThemeCustomizationContext);
  if (!context) {
    throw new Error("useThemeCustomization must be used within a ThemeCustomizationProvider");
  }
  return context;
};

export { hslToHex, hexToHsl };
