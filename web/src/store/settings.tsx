import { createContext, useCallback, useContext, useMemo } from "react";
import type { AppSettings } from "@/lib/api/types";
import { useLocalStorage } from "@/lib/hooks";
import { useTheme } from "@/store/theme";

export const DEFAULT_SETTINGS: AppSettings = {
  language: "zh",
  textLang: "zh",
  promptLang: "zh",
  device: "auto",
  isHalf: true,
  backendPort: 9880,
  theme: "dark",
  autoSwitchWeights: false,
};

interface SettingsContextValue {
  settings: AppSettings;
  update: (patch: Partial<AppSettings>) => void;
  reset: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings, reset] = useLocalStorage<AppSettings>("gsv.settings", DEFAULT_SETTINGS);
  const { resolved, setTheme } = useTheme();

  // 让主题与设置保持一致（设置页修改 theme 时）。
  const update = useCallback(
    (patch: Partial<AppSettings>) => {
      setSettings((prev) => ({ ...prev, ...patch }));
      if (patch.theme && patch.theme !== resolved) setTheme(patch.theme);
    },
    [setSettings, resolved, setTheme],
  );

  const value = useMemo(() => ({ settings, update, reset }), [settings, update, reset]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings 必须在 SettingsProvider 内使用");
  return ctx;
}
