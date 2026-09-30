/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('zonafit-theme') as Theme;
    return savedTheme || 'dark';
  });

  const location = useLocation();

  useEffect(() => {
    const root = window.document.documentElement;
    const publicRoutes = [
      '/',
      '/login',
      '/register',
      '/forgot-password',
      '/reset-password',
      '/terms',
      '/privacy',
      '/data-deletion',
    ];
    
    // Check if current path matches any of the exact public routes
    const isPublicRoute = publicRoutes.some(route => {
      // exact match for /reset-password (since it has query params like ?token=...)
      // useLocation().pathname only contains the path part, so exact match works.
      return location.pathname === route;
    });

    if (isPublicRoute) {
      // Force dark mode on public routes
      root.classList.remove('light');
    } else {
      // Apply saved theme on internal routes
      if (theme === 'light') {
        root.classList.add('light');
      } else {
        root.classList.remove('light');
      }
    }
    localStorage.setItem('zonafit-theme', theme);
  }, [theme, location.pathname]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
