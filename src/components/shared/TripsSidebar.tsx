"use client";

import { useAppShell, type ThemeId } from "./AppShellContext";
import {
  MapPin,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";

const THEMES: { id: ThemeId; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor },
];

export function TripsSidebar() {
  const {
    trips,
    removeTrip,
    sidebarOpen,
    setSidebarOpen,
    setLoadTripId,
    setPrefsOpen,
  } = useAppShell();

  return (
    <aside className={`trips-sidebar ${sidebarOpen ? "is-open" : "is-collapsed"}`}>
      <div className="trips-sidebar-header">
        {sidebarOpen ? <h2>Your trips</h2> : <span className="sr-only">Your trips</span>}
        <button
          className="icon-btn"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          title={sidebarOpen ? "Collapse" : "Expand"}
        >
          {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
        </button>
      </div>

      <div className="trips-list">
        {trips.length === 0 ? (
          sidebarOpen ? (
            <p className="trips-empty">
              Finished trips show up here so you can jump back anytime.
            </p>
          ) : null
        ) : (
          trips.map((trip) => (
            <div key={trip.id} className="trip-item">
              <button
                className="trip-item-main"
                onClick={() => setLoadTripId(trip.id)}
                title={`${trip.origin} → ${trip.destination}`}
              >
                {sidebarOpen ? (
                  <>
                    <span className="trip-item-title">{trip.title}</span>
                    <span className="trip-item-meta">
                      <MapPin size={12} /> {trip.origin} → {trip.destination}
                    </span>
                    <span className="trip-item-meta">
                      {trip.days} days · {trip.vibe.replace(/-/g, " ")}
                    </span>
                  </>
                ) : (
                  <span className="trip-rail-mark">
                    {(trip.destination || "?").slice(0, 1).toUpperCase()}
                  </span>
                )}
              </button>
              {sidebarOpen && (
                <button
                  className="icon-btn"
                  aria-label="Delete trip"
                  onClick={() => removeTrip(trip.id)}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <div className="trips-sidebar-footer">
        <button
          className={sidebarOpen ? "btn-action" : "icon-btn"}
          onClick={() => setPrefsOpen(true)}
          aria-label="Preferences"
          title="Preferences"
        >
          {sidebarOpen ? (
            "Preferences"
          ) : (
            <Settings size={18} />
          )}
        </button>
      </div>
    </aside>
  );
}

export function PreferencesModal() {
  const { prefsOpen, setPrefsOpen, theme, setTheme } = useAppShell();

  if (!prefsOpen) return null;

  return (
    <div className="prefs-overlay" onClick={() => setPrefsOpen(false)}>
      <div
        className="prefs-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="prefs-title"
      >
        <div className="prefs-header">
          <h2 id="prefs-title">Preferences</h2>
          <button
            className="icon-btn"
            onClick={() => setPrefsOpen(false)}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="prefs-section">
          <h3>Theme</h3>
          <p className="prefs-hint">Applies to the whole site.</p>
          <div className="theme-grid theme-grid-3">
            {THEMES.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  className={`theme-swatch ${theme === t.id ? "selected" : ""}`}
                  onClick={() => setTheme(t.id)}
                >
                  <Icon size={16} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="prefs-section">
          <h3>Restart</h3>
          <p className="prefs-hint">Reload the app page.</p>
          <button className="btn-action" onClick={() => window.location.reload()}>
            Restart
          </button>
        </div>

        <div className="prefs-section">
          <h3>Reset</h3>
          <p className="prefs-hint">
            Clear the current trip view and return to planning.
          </p>
          <button
            className="btn-action"
            onClick={() => {
              setPrefsOpen(false);
              window.dispatchEvent(new CustomEvent("vibe-routes-reset"));
            }}
          >
            Reset trip
          </button>
        </div>
      </div>
    </div>
  );
}
