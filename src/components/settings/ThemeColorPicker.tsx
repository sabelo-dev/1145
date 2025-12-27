import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Palette, RotateCcw, Check } from "lucide-react";
import { useThemeCustomization, hslToHex, hexToHsl } from "@/contexts/ThemeCustomizationContext";
import { useToast } from "@/hooks/use-toast";

const ThemeColorPicker: React.FC = () => {
  const { colors, setColors, resetColors, presets, applyPreset } = useThemeCustomization();
  const { toast } = useToast();

  const handleColorChange = (colorKey: keyof typeof colors, hexValue: string) => {
    const hslValue = hexToHsl(hexValue);
    setColors({ [colorKey]: hslValue });
  };

  const handleSave = () => {
    toast({
      title: "Theme Saved",
      description: "Your custom theme colors have been saved.",
    });
  };

  const handleReset = () => {
    resetColors();
    toast({
      title: "Theme Reset",
      description: "Theme colors have been reset to defaults.",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Theme Customization
        </CardTitle>
        <CardDescription>
          Personalize your experience with custom accent colors
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Color Presets */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Quick Presets</Label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {presets.map((preset) => {
              const isActive = 
                colors.primary === preset.colors.primary && 
                colors.secondary === preset.colors.secondary;
              
              return (
                <button
                  key={preset.name}
                  onClick={() => applyPreset(preset.name)}
                  className={`relative flex flex-col items-center gap-1.5 p-2 rounded-lg border-2 transition-all hover:scale-105 ${
                    isActive 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex gap-0.5">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: hslToHex(preset.colors.primary) }}
                    />
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: hslToHex(preset.colors.secondary) }}
                    />
                  </div>
                  <span className="text-xs font-medium">{preset.name}</span>
                  {isActive && (
                    <Check className="absolute top-1 right-1 h-3 w-3 text-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Color Pickers */}
        <div className="space-y-4">
          <Label className="text-sm font-medium">Custom Colors</Label>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="primary-color" className="text-xs text-muted-foreground">
                Primary Color
              </Label>
              <div className="flex gap-2 items-center">
                <div className="relative">
                  <Input
                    id="primary-color"
                    type="color"
                    value={hslToHex(colors.primary)}
                    onChange={(e) => handleColorChange("primary", e.target.value)}
                    className="w-12 h-10 p-1 cursor-pointer rounded-md"
                  />
                </div>
                <div
                  className="flex-1 h-10 rounded-md border"
                  style={{ backgroundColor: `hsl(${colors.primary})` }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="secondary-color" className="text-xs text-muted-foreground">
                Secondary Color
              </Label>
              <div className="flex gap-2 items-center">
                <div className="relative">
                  <Input
                    id="secondary-color"
                    type="color"
                    value={hslToHex(colors.secondary)}
                    onChange={(e) => handleColorChange("secondary", e.target.value)}
                    className="w-12 h-10 p-1 cursor-pointer rounded-md"
                  />
                </div>
                <div
                  className="flex-1 h-10 rounded-md border"
                  style={{ backgroundColor: `hsl(${colors.secondary})` }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accent-color" className="text-xs text-muted-foreground">
                Accent Color
              </Label>
              <div className="flex gap-2 items-center">
                <div className="relative">
                  <Input
                    id="accent-color"
                    type="color"
                    value={hslToHex(colors.accent)}
                    onChange={(e) => handleColorChange("accent", e.target.value)}
                    className="w-12 h-10 p-1 cursor-pointer rounded-md"
                  />
                </div>
                <div
                  className="flex-1 h-10 rounded-md border"
                  style={{ backgroundColor: `hsl(${colors.accent})` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Preview</Label>
          <div className="p-4 rounded-lg border bg-card space-y-3">
            <div className="flex gap-2 flex-wrap">
              <Button size="sm">Primary Button</Button>
              <Button size="sm" variant="secondary">Secondary</Button>
              <Button size="sm" variant="outline">Outline</Button>
            </div>
            <div className="flex gap-2">
              <div 
                className="px-3 py-1 rounded-full text-xs font-medium text-white"
                style={{ backgroundColor: `hsl(${colors.primary})` }}
              >
                Primary Tag
              </div>
              <div 
                className="px-3 py-1 rounded-full text-xs font-medium"
                style={{ backgroundColor: `hsl(${colors.secondary})`, color: 'hsl(222.2 47.4% 11.2%)' }}
              >
                Secondary Tag
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button onClick={handleSave}>
            Save Theme
          </Button>
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Default
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ThemeColorPicker;
