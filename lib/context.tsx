'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { Language, AppSettings, User } from '@/types';

interface AppContextType {
  settings: AppSettings;
  setLanguage: (lang: Language) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  user: User | null;
  setUser: (user: User | null) => void;
  isLoggedIn: boolean;
  isInit: boolean;
}

const defaultSettings: AppSettings = { language: 'id', darkMode: false }; // Default to light mode (Staffora)

const AppContext = createContext<AppContextType>({
  settings: defaultSettings,
  setLanguage: () => {},
  setTheme: () => {},
  user: null,
  setUser: () => {},
  isLoggedIn: false,
  isInit: false,
});

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [user, setUser] = useState<User | null>(null);
  const [isInit, setIsInit] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('hris_settings');
    if (stored) {
      try { 
        const parsed = JSON.parse(stored);
        setSettings(parsed); 
        document.documentElement.setAttribute('data-theme', parsed.darkMode ? 'dark' : 'light');
      } catch {}
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
    }
    const storedUser = localStorage.getItem('hris_user');
    if (storedUser) {
      try { setUser(JSON.parse(storedUser)); } catch {}
    }
    setIsInit(true);
  }, []);

  const setLanguage = (lang: Language) => {
    const newSettings = { ...settings, language: lang };
    setSettings(newSettings);
    localStorage.setItem('hris_settings', JSON.stringify(newSettings));
  };

  const setTheme = (theme: 'light' | 'dark') => {
    const isDark = theme === 'dark';
    const newSettings = { ...settings, darkMode: isDark };
    setSettings(newSettings);
    localStorage.setItem('hris_settings', JSON.stringify(newSettings));
    document.documentElement.setAttribute('data-theme', theme);
  };

  const handleSetUser = (u: User | null) => {
    setUser(u);
    if (u) localStorage.setItem('hris_user', JSON.stringify(u));
    else localStorage.removeItem('hris_user');
  };

  return (
    <AppContext.Provider value={{
      settings,
      setLanguage,
      setTheme,
      user,
      setUser: handleSetUser,
      isLoggedIn: !!user,
      isInit,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() { return useContext(AppContext); }
export function useLang() { return useContext(AppContext).settings.language; }
