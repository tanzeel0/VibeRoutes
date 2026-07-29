"use client";

import { useEffect, useRef, useState } from "react";
import type { DayItinerary, GeoPoint } from "@/types/itinerary";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface MapViewProps {
  days: DayItinerary[];
  routeWaypoints: GeoPoint[];
  activeDay: number | null;
  onDayClick: (day: number) => void;
  /** City name for captions — destination-focused map on home */
  destination?: string;
  /** When true, only plot stop pins (no origin→destination route line) */
  destinationOnly?: boolean;
}

function pinSvg(fill: string): string {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 22s7-7.2 7-12.2A7 7 0 1 0 5 9.8C5 14.8 12 22 12 22z" fill="${fill}"/>
    <circle cx="12" cy="9.5" r="2.6" fill="#fff"/>
  </svg>`;
}

function dayMarkerIcon(day: number, active: boolean, label: string): L.DivIcon {
  const bg = active ? "var(--vr-primary, #ff385c)" : "#111827";
  const ring = active ? "0 0 0 3px rgba(255,56,92,.25)" : "0 2px 8px rgba(0,0,0,.28)";
  return L.divIcon({
    className: "vr-marker",
    html: `<div class="vr-pin ${active ? "is-active" : ""}" style="
      display:flex;flex-direction:column;align-items:center;gap:2px;
      transform:translateY(-6px);cursor:pointer;
    " title="${label.replace(/"/g, "&quot;")}">
      <div style="
        width:36px;height:36px;border-radius:50%;
        background:${bg};color:#fff;font-weight:700;font-size:12px;
        display:flex;align-items:center;justify-content:center;gap:0;
        border:2px solid #fff;box-shadow:${ring};
        font-family:system-ui,sans-serif;position:relative;
      ">
        <span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:.22">${pinSvg("#fff")}</span>
        <span style="position:relative;z-index:1">${day}</span>
      </div>
      <div style="
        width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;
        border-top:8px solid ${bg};filter:drop-shadow(0 1px 1px rgba(0,0,0,.2));
      "></div>
    </div>`,
    iconSize: [36, 48],
    iconAnchor: [18, 48],
    popupAnchor: [0, -44],
  });
}

export default function MapView({
  days,
  routeWaypoints,
  activeDay,
  onDayClick,
  destination,
  destinationOnly = true,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const callbackRef = useRef(onDayClick);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const city =
    destination ||
    days.find((d) => d.location)?.location ||
    "your destination";

  useEffect(() => {
    callbackRef.current = onDayClick;
  });

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    try {
      const map = L.map(containerRef.current, {
        center: [22.5, 78.9],
        zoom: 5,
        scrollWheelZoom: false,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map);

      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setReady(true);
      requestAnimationFrame(() => map.invalidateSize());
    } catch (err) {
      console.error("Map init error:", err);
      setError("Could not load map");
    }

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layers = layerRef.current;
    if (!map || !layers || !ready) return;

    layers.clearLayers();
    const bounds = L.latLngBounds([]);

    // Destination-only: skip long-haul origin→destination polyline on home
    if (!destinationOnly && routeWaypoints.length >= 2) {
      const latlngs = routeWaypoints.map(
        (wp) => [wp.lat, wp.lng] as L.LatLngExpression
      );
      L.polyline(latlngs, {
        color: "#ff385c",
        weight: 3,
        opacity: 0.65,
      }).addTo(layers);
    }

    days.forEach((day) => {
      const isActive = activeDay === day.day;
      const places = (day.places_visited || []).filter(
        (place) =>
          typeof place.lat === "number" &&
          typeof place.lng === "number" &&
          !(place.lat === 0 && place.lng === 0)
      );

      places.forEach((place) => {
        L.marker([place.lat, place.lng], {
          icon: dayMarkerIcon(
            day.day,
            isActive,
            `Day ${day.day}: ${place.name}`
          ),
        })
          .bindPopup(
            `<div class="vr-map-popup"><strong>Day ${day.day}: ${day.title}</strong><br/><span>${place.name}</span></div>`
          )
          .on("click", () => callbackRef.current(day.day))
          .addTo(layers);
        bounds.extend([place.lat, place.lng]);
      });
    });

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 14 });
    }

    requestAnimationFrame(() => map.invalidateSize());
  }, [days, routeWaypoints, activeDay, ready, destinationOnly]);

  const dayNumbers = days.map((d) => d.day);

  return (
    <div className="map-block">
      <p className="map-lead">
        Real streets inside {city} — location pins show which stops sit near
        each other. Tap a pin or day to jump through the itinerary.
      </p>

      <div className="map-section">
        {error ? (
          <div className="map-fallback">{error}</div>
        ) : (
          <div ref={containerRef} className="map-canvas" />
        )}
      </div>

      {dayNumbers.length > 0 && (
        <div className="map-day-jumps" aria-label="Jump to day">
          {dayNumbers.map((day) => (
            <button
              key={day}
              type="button"
              className={`map-day-jump ${activeDay === day ? "is-active" : ""}`}
              onClick={() => onDayClick(day)}
            >
              <span className="map-day-jump-icon" aria-hidden />
              Day {day}
            </button>
          ))}
        </div>
      )}

      <p className="map-legend">
        Street map of {city} only — numbered location pins show what’s near
        what.
      </p>
    </div>
  );
}
