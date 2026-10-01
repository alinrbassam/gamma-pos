import { create } from 'zustand';
import { ThemeMode } from '@shared/types';

interface ThemeState {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>((set) => {
  const initialTheme: ThemeMode =
    typeof window !== 'undefined'
      ? (localStorage.getItem('gamma_theme') as ThemeMode) || 'dark'
      : 'dark';

  // Apply immediately on initialization
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    if (
      initialTheme === 'dark' ||
      (initialTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    ) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }

  return {
    theme: initialTheme,
    setTheme: (mode: ThemeMode) => {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('gamma_theme', mode);
      }
      const root = document.documentElement;
      if (
        mode === 'dark' ||
        (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      ) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
      set({ theme: mode });
    },
  };
});
