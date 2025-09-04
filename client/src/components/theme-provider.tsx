import { createContext, useContext, useEffect, useState } from "react";

// Enforce dark-only theme across the app
type Theme = "dark" | "light" | "system";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: "dark",
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "dark",
  storageKey = "quiz-ui-theme",
  ...props
}: ThemeProviderProps) {
  // We still read storage for backwards compatibility but ignore any value and force 'dark'
  const [theme, _setTheme] = useState<Theme>(() => {
    try {
      const stored = (localStorage.getItem(storageKey) as Theme) || defaultTheme;
      void stored; // ignore
    } catch {}
    return "dark";
  });

  useEffect(() => {
    const root = window.document.documentElement;

    // Ensure only dark class is present
    root.classList.remove("light", "dark");
    root.classList.add("dark");
  }, []);

  const value = {
    theme: "dark" as Theme,
    // no-op to prevent changing theme
    setTheme: (_theme: Theme) => {
      // persist 'dark' in storage if desired
      try {
        localStorage.setItem(storageKey, "dark");
      } catch {}
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};
