import { createContext, useContext, type ReactNode } from 'react';
import { cardShell, categoryColors, colors, gradients, radii, shadow } from './colors';

// Always resolves to the light palette regardless of device color scheme -
// dark mode is a deliberately separate future project (needs its own
// palette design and contrast pass, not just inverted values). This
// provider exists now so that project only has to change what
// lightTheme/darkTheme resolve to, not rewire every screen that consumes
// colors - every consumer already goes through useTheme().
const lightTheme = { colors, categoryColors, gradients, radii, shadow, cardShell };

export type Theme = typeof lightTheme;

const ThemeContext = createContext<Theme>(lightTheme);

export function ThemeProvider({ children }: { children: ReactNode }) {
  return <ThemeContext.Provider value={lightTheme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
