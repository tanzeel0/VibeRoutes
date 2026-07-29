"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemeId = "light" | "dark" | "system";

export interface SavedTrip {
  id: string;
  slug: string;
  title: string;
  origin: string;
  destination: string;
  days: number;
  vibe: string;
  savedAt: number;
  payload: unknown;
}

interface AppShellContextValue {
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
  trips: SavedTrip[];
  saveTrip: (trip: Omit<SavedTrip, "id" | "savedAt"> & { id?: string }) => void;
  removeTrip: (id: string) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  prefsOpen: boolean;
  setPrefsOpen: (open: boolean) => void;
  loadTripId: string | null;
  setLoadTripId: (id: string | null) => void;
}

const THEME_STORAGE = "vibe-routes-theme";
const TRIPS_STORAGE = "vibe-routes-trips";
const SIDEBAR_STORAGE = "vibe-routes-sidebar";

const AppShellContext = createContext<AppShellContextValue | null>(null);

export function useAppShell() {
  const ctx = useContext(AppShellContext);
  if (!ctx) throw new Error("useAppShell must be used within AppShellProvider");
  return ctx;
}

function normalizeTheme(_raw: string | null): ThemeId {
  // App always follows the OS / browser preference
  return "system";
}

function resolveTheme(_theme: ThemeId): "light" | "dark" {
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

export function AppShellProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>("system");
  const [trips, setTrips] = useState<SavedTrip[]>([]);
  const [sidebarOpen, setSidebarOpenState] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [loadTripId, setLoadTripId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      setThemeState(normalizeTheme(localStorage.getItem(THEME_STORAGE)));
      const raw = localStorage.getItem(TRIPS_STORAGE);
      if (raw) setTrips(JSON.parse(raw) as SavedTrip[]);
      const sb = localStorage.getItem(SIDEBAR_STORAGE);
      if (sb === "1") setSidebarOpenState(true);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const apply = () => {
      document.documentElement.setAttribute("data-theme", resolveTheme("system"));
    };
    apply();
    localStorage.setItem(THEME_STORAGE, "system");

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(TRIPS_STORAGE, JSON.stringify(trips));
    } catch {
      /* ignore quota / private mode errors */
    }
  }, [trips, hydrated]);

  // Theme is locked to system — keep setter for API compat but ignore overrides
  const setTheme = useCallback((_t: ThemeId) => {
    setThemeState("system");
  }, []);

  // On phones/tablets, keep the drawer closed by default (don't write localStorage)
  useEffect(() => {
    if (!hydrated) return;
    const mq = window.matchMedia("(max-width: 900px)");
    const closeOnMobile = () => {
      if (mq.matches) setSidebarOpenState(false);
    };
    closeOnMobile();
    mq.addEventListener("change", closeOnMobile);
    return () => mq.removeEventListener("change", closeOnMobile);
  }, [hydrated]);

  const setSidebarOpen = useCallback((open: boolean) => {
    setSidebarOpenState(open);
    try {
      // Only persist expand/collapse preference on desktop layouts
      if (typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches) {
        return;
      }
      localStorage.setItem(SIDEBAR_STORAGE, open ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const saveTrip = useCallback(
    (trip: Omit<SavedTrip, "id" | "savedAt"> & { id?: string }) => {
      setTrips((prev) => {
        const id = trip.id || trip.slug || `trip-${Date.now()}`;
        const next: SavedTrip = {
          ...trip,
          id,
          savedAt: Date.now(),
        };
        const without = prev.filter((t) => t.id !== id && t.slug !== trip.slug);
        return [next, ...without].slice(0, 30);
      });
    },
    []
  );

  const removeTrip = useCallback((id: string) => {
    setTrips((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      trips,
      saveTrip,
      removeTrip,
      sidebarOpen,
      setSidebarOpen,
      prefsOpen,
      setPrefsOpen,
      loadTripId,
      setLoadTripId,
    }),
    [
      theme,
      setTheme,
      trips,
      saveTrip,
      removeTrip,
      sidebarOpen,
      setSidebarOpen,
      prefsOpen,
      loadTripId,
    ]
  );

  return (
    <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>
  );
}
