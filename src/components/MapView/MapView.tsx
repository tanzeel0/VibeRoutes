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
}

function dayMarkerIcon(day: number, active: boolean): L.DivIcon {
  const size = active ? 32 : 26;
  const bg = active ? "#f97316" : "#22c55e";
  return L.divIcon({
    className: "vr-marker",
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${bg};color:#fff;font-weight:700;font-size:${active ? 12 : 11}px;
      display:flex;align-items:center;justify-content:center;
      border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.25);
      font-family:system-ui,sans-serif;
    ">${day}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function routeMarkerIcon(label: string): L.DivIcon {
  return L.divIcon({
    className: "vr-marker",
    html: `<div style="
      width:14px;height:14px;border-radius:50%;
      background:#ff385c;border:2px solid #fff;
      box-shadow:0 2px 6px rgba(0,0,0,.25);
    " title="${label}"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

export default function MapView({
  days,
  routeWaypoints,
  activeDay,
  onDayClick,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const callbackRef = useRef(onDayClick);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    callbackRef.current = onDayClick;
  });

  // Init map once
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

      // Leaflet needs a resize after mount in flex layouts
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

  // Draw overlays when data / map ready
  useEffect(() => {
    const map = mapRef.current;
    const layers = layerRef.current;
    if (!map || !layers || !ready) return;

    layers.clearLayers();
    const bounds = L.latLngBounds([]);

    if (routeWaypoints.length >= 2) {
      const latlngs = routeWaypoints.map(
        (wp) => [wp.lat, wp.lng] as L.LatLngExpression
      );
      L.polyline(latlngs, {
        color: "#ff385c",
        weight: 3,
        opacity: 0.65,
      }).addTo(layers);

      routeWaypoints.forEach((wp) => {
        L.marker([wp.lat, wp.lng], { icon: routeMarkerIcon(wp.name) })
          .bindPopup(`<strong>${wp.name}</strong>`)
          .addTo(layers);
        bounds.extend([wp.lat, wp.lng]);
      });
    } else {
      routeWaypoints.forEach((wp) => {
        L.marker([wp.lat, wp.lng], { icon: routeMarkerIcon(wp.name) })
          .bindPopup(`<strong>${wp.name}</strong>`)
          .addTo(layers);
        bounds.extend([wp.lat, wp.lng]);
      });
    }

    days.forEach((day) => {
      const isActive = activeDay === day.day;
      (day.places_visited || []).forEach((place) => {
        if (
          typeof place.lat !== "number" ||
          typeof place.lng !== "number" ||
          (place.lat === 0 && place.lng === 0)
        ) {
          return;
        }
        L.marker([place.lat, place.lng], {
          icon: dayMarkerIcon(day.day, isActive),
        })
          .bindPopup(
            `<strong>Day ${day.day}: ${day.title}</strong><br/>${place.name}`
          )
          .on("click", () => callbackRef.current(day.day))
          .addTo(layers);
        bounds.extend([place.lat, place.lng]);
      });
    });

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
    }

    requestAnimationFrame(() => map.invalidateSize());
  }, [days, routeWaypoints, activeDay, ready]);

  return (
    <div className="map-section">
      {error ? (
        <div className="map-fallback">{error}</div>
      ) : (
        <div ref={containerRef} className="map-canvas" />
      )}
    </div>
  );
}
