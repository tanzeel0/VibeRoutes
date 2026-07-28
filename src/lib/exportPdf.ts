import type {
  Activity,
  DayItinerary,
  GeoPoint,
  ItineraryPayload,
} from "@/types/itinerary";
import { ACTIVITY_CATEGORY_LABELS } from "@/types/itinerary";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function prettyVibe(vibe: string): string {
  return vibe.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Warm, printable document name — also used as the Save-as-PDF filename. */
export function buildPdfDocumentName(meta: ItineraryPayload): string {
  const days = meta.duration?.days ?? meta.itinerary?.length ?? 0;
  const city = meta.destination?.trim() || "Trip";
  const vibe = prettyVibe(meta.vibe?.primary || "escape");
  return `${city} · ${days}-Day ${vibe} — Vibe Routes`;
}

function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function collectMapPlaces(
  days: DayItinerary[],
  destination: string
): Array<GeoPoint & { day: number; label: string }> {
  const destKey = destination.toLowerCase().trim();
  const points: Array<GeoPoint & { day: number; label: string }> = [];
  const seen = new Set<string>();

  for (const day of days) {
    for (const place of day.places_visited || []) {
      if (
        typeof place.lat !== "number" ||
        typeof place.lng !== "number" ||
        (place.lat === 0 && place.lng === 0)
      ) {
        continue;
      }
      // Skip obvious origin-only points far from the trip story
      const nameKey = (place.name || "").toLowerCase();
      if (nameKey && nameKey !== destKey && !nameKey.includes(destKey)) {
        // still keep — destination pocket map wants all day stops
      }
      const key = `${place.lat.toFixed(4)},${place.lng.toFixed(4)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      points.push({
        ...place,
        day: day.day,
        label: place.name || `Day ${day.day}`,
      });
    }
  }

  return points;
}

/** Destination street map with day pins (print-friendly). */
function buildDestinationStreetMap(
  places: Array<GeoPoint & { day: number; label: string }>,
  destination: string
): string {
  if (places.length === 0) {
    return `
      <div class="map-empty">
        <p>Your ${escapeHtml(destination)} stops will appear here once places are pinned.</p>
      </div>`;
  }

  const placesJson = JSON.stringify(
    places.map((p) => ({
      lat: p.lat,
      lng: p.lng,
      day: p.day,
      label: p.label,
    }))
  );

  return `
    <div id="street-map" class="street-map" role="img" aria-label="${escapeHtml(destination)} street map"></div>
    <p class="map-legend">Street map of ${escapeHtml(destination)} only — numbered pins show what’s near what.</p>
    <script>
      window.__VR_MAP_PLACES__ = ${placesJson};
    </script>`;
}

function activityChips(activities: Activity[] = []): string {
  return activities
    .map((a) => {
      const cat = ACTIVITY_CATEGORY_LABELS[a.category] || a.category;
      const cost =
        typeof a.estimated_cost_inr === "number" && a.estimated_cost_inr > 0
          ? ` · ~${formatInr(a.estimated_cost_inr)}`
          : "";
      return `<span class="activity"><em>${escapeHtml(cat)}</em>${escapeHtml(a.name)}${escapeHtml(cost)}</span>`;
    })
    .join("");
}

export function buildItineraryPdfHtml(
  meta: ItineraryPayload,
  daysInput: DayItinerary[]
): string {
  const days = daysInput.length ? daysInput : meta.itinerary || [];
  const docName = buildPdfDocumentName(meta);
  const coverTitle = escapeHtml(docName);
  const city = escapeHtml(meta.destination);
  const vibe = escapeHtml(prettyVibe(meta.vibe.primary));
  const mapPlaces = collectMapPlaces(days, meta.destination);
  const hero = meta.hero_image?.url
    ? `<img class="hero" src="${escapeHtml(meta.hero_image.url)}" alt="${escapeHtml(meta.hero_image.alt || meta.destination)}" />`
    : `<div class="hero-fallback"><span>${city}</span></div>`;

  const daysHtml = days
    .map((day, idx) => {
      const img = day.image?.url
        ? `<img class="day-photo" src="${escapeHtml(day.image.url)}" alt="${escapeHtml(day.image.alt || day.title)}" />`
        : "";
      const pageBreak = idx > 0 && idx % 2 === 0 ? " page-break" : "";
      return `
      <article class="day${pageBreak}">
        <header class="day-head">
          <div class="day-badge">Day ${day.day}</div>
          <div>
            <h3>${escapeHtml(day.title)}</h3>
            <p class="loc">${escapeHtml(day.location)}</p>
          </div>
        </header>
        ${img}
        <p class="desc">${escapeHtml(day.description)}</p>
        <div class="activities">${activityChips(day.activities)}</div>
      </article>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${coverTitle}</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  :root {
    --canvas: #ffffff;
    --surface: #f7f7f7;
    --ink: #000000;
    --line: #dddddd;
    --chip: #f2f2f2;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    background: var(--canvas);
    color: var(--ink);
  }
  body {
    padding: 36px 28px 48px;
    font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    line-height: 1.55;
    background:
      radial-gradient(ellipse 80% 50% at 50% -10%, rgba(255, 56, 92, 0.1), transparent 55%),
      var(--canvas);
  }
  .sheet {
    max-width: 820px;
    margin: 0 auto;
    background: transparent;
    border: none;
    border-radius: 0;
    padding: 8px 0 32px;
    box-shadow: none;
  }
  .print-bar {
    position: sticky;
    top: 0;
    z-index: 5;
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    background: rgba(255, 255, 255, 0.96);
    padding: 12px 0 16px;
    margin-bottom: 8px;
    border-bottom: 1px solid var(--line);
    color: var(--ink);
  }
  .print-bar button {
    background: #222222;
    color: #ffffff;
    border: none;
    border-radius: 999px;
    padding: 10px 18px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }
  .print-bar span,
  .print-bar .hint {
    font-size: 12px;
    color: var(--ink);
  }

  .brand {
    font-size: 12px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ink);
    font-weight: 700;
    margin-bottom: 10px;
  }
  h1 {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 34px;
    line-height: 1.2;
    font-weight: 600;
    color: var(--ink);
    margin: 0 0 12px;
    border: none;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0 0 18px;
  }
  .pill {
    background: var(--surface);
    color: var(--ink);
    border-radius: 999px;
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 600;
    border: 1px solid var(--line);
  }
  .summary {
    color: var(--ink);
    font-size: 15px;
    margin: 0 0 22px;
  }
  .hero, .hero-fallback {
    width: 100%;
    height: 280px;
    object-fit: cover;
    border-radius: 16px;
    margin-bottom: 28px;
    display: block;
  }
  .hero-fallback {
    background: var(--surface);
    display: flex;
    align-items: flex-end;
    padding: 24px;
  }
  .hero-fallback span {
    font-family: Georgia, serif;
    font-size: 28px;
    color: var(--ink);
  }

  .budget {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 14px;
    padding: 18px 20px;
    margin-bottom: 28px;
  }
  .budget h2 {
    margin: 0 0 6px;
    font-size: 13px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink);
  }
  .budget-range {
    font-size: 22px;
    font-weight: 700;
    margin: 0 0 8px;
    color: var(--ink);
  }
  .budget-range span { font-size: 13px; font-weight: 500; color: var(--ink); }
  .muted, .source { margin: 0; font-size: 12px; color: var(--ink); }
  .source { margin-top: 4px; }

  .day {
    background: var(--canvas);
    border: 1px solid var(--line);
    border-radius: 16px;
    padding: 20px;
    margin: 0 0 18px;
    border-left: 4px solid #dddddd;
  }
  .day-head {
    display: flex;
    gap: 14px;
    align-items: flex-start;
    margin-bottom: 12px;
  }
  .day-badge {
    min-width: 58px;
    height: 58px;
    border-radius: 14px;
    background: var(--surface);
    color: var(--ink);
    border: 1px solid var(--line);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 13px;
  }
  .day h3 {
    margin: 0 0 4px;
    font-size: 18px;
    color: var(--ink);
    font-family: Georgia, serif;
  }
  .loc { margin: 0; color: var(--ink); font-size: 13px; }
  .day-photo {
    width: 100%;
    max-height: 240px;
    object-fit: cover;
    border-radius: 12px;
    margin: 0 0 14px;
    display: block;
  }
  .desc { margin: 0 0 12px; font-size: 14px; color: var(--ink); }
  .activities { display: flex; flex-wrap: wrap; gap: 8px; }
  .activity {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    background: var(--chip);
    border: 1px solid var(--line);
    color: var(--ink);
    padding: 5px 10px;
    border-radius: 999px;
    font-size: 12px;
  }
  .activity em {
    font-style: normal;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--ink);
  }

  .map-page {
    page-break-before: always;
    margin-top: 8px;
  }
  .map-page h2 {
    font-family: Georgia, serif;
    font-size: 26px;
    margin: 0 0 6px;
    color: var(--ink);
  }
  .map-lead {
    color: var(--ink);
    margin: 0 0 18px;
    font-size: 14px;
  }
  .street-map {
    width: 100%;
    height: 420px;
    border-radius: 18px;
    overflow: hidden;
    border: 1px solid var(--line);
    background: var(--surface);
  }
  .map-empty {
    background: var(--surface);
    border-radius: 18px;
    padding: 48px 24px;
    text-align: center;
    color: var(--ink);
  }
  .map-legend {
    margin-top: 14px;
    font-size: 12px;
    color: var(--ink);
  }
  .vr-pin {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #222222;
    color: #ffffff;
    font-weight: 700;
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid #ffffff;
    box-shadow: 0 2px 6px rgba(0,0,0,.2);
  }

  .tiny-foot {
    margin-top: 28px;
    padding-top: 14px;
    border-top: 1px solid var(--line);
    font-size: 11px;
    color: var(--ink);
    text-align: center;
  }

  @page {
    margin: 12mm;
  }

  @media print {
    html, body {
      background: #ffffff !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      padding: 0;
      background: #ffffff !important;
    }
    .sheet {
      box-shadow: none;
      border: none;
      max-width: none;
      padding: 0 0 20px;
      background: transparent;
    }
    .print-bar { display: none !important; }
    .page-break { page-break-before: always; }
    .day { break-inside: avoid; }
    .day-photo, .hero { break-inside: avoid; }
    .street-map { break-inside: avoid; }
    a[href]::after { content: ""; }
    body, h1, h2, h3, p, span, strong, em, li, .brand, .summary, .loc, .desc,
    .map-lead, .map-legend, .tiny-foot, .pill, .activity, .budget,
    .budget-range, .muted, .source, figcaption {
      color: #000000 !important;
    }
    .vr-pin { color: #ffffff !important; background: #222222 !important; }
  }
</style>
</head>
<body>
  <div class="print-bar">
    <button type="button" onclick="window.print()">Save as PDF / Print</button>
    <span>Keep background graphics on.</span>
    <span class="hint">Turn off “Headers and footers” in the print dialog so the page URL doesn’t show.</span>
  </div>
  <div class="sheet">
    <div class="brand">Vibe Routes</div>
    <h1>${coverTitle}</h1>
    <div class="meta">
      <span class="pill">${escapeHtml(meta.origin)} → ${city}</span>
      <span class="pill">${meta.duration.days} days · ${meta.duration.nights} nights</span>
      <span class="pill">${vibe}</span>
    </div>
    <p class="summary">${escapeHtml(meta.route_summary)}</p>
    ${hero}
    ${daysHtml}

    <section class="map-page">
      <h2>${city} street map</h2>
      <p class="map-lead">Real streets inside ${city} — numbered pins show which stops sit near each other.</p>
      ${buildDestinationStreetMap(mapPlaces, meta.destination)}
    </section>

    <div class="tiny-foot">
      Verify venues &amp; live prices before you go · Crafted with Vibe Routes
    </div>
  </div>
  <script>
    (function () {
      document.title = ${JSON.stringify(docName)};

      function initStreetMap() {
        var el = document.getElementById('street-map');
        var places = window.__VR_MAP_PLACES__ || [];
        if (!el || !window.L || !places.length) return Promise.resolve();

        return new Promise(function (resolve) {
          var map = L.map(el, {
            zoomControl: true,
            scrollWheelZoom: false,
            attributionControl: true
          });

          var tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 18,
            attribution: '&copy; OpenStreetMap'
          }).addTo(map);

          var bounds = L.latLngBounds([]);
          places.forEach(function (p) {
            var icon = L.divIcon({
              className: '',
              html: '<div class="vr-pin">' + p.day + '</div>',
              iconSize: [28, 28],
              iconAnchor: [14, 14]
            });
            L.marker([p.lat, p.lng], { icon: icon })
              .bindPopup('<strong>Day ' + p.day + '</strong><br/>' + p.label)
              .addTo(map);
            bounds.extend([p.lat, p.lng]);
          });

          if (bounds.isValid()) {
            map.fitBounds(bounds.pad(0.25), { maxZoom: 15 });
          }

          var settled = false;
          function done() {
            if (settled) return;
            settled = true;
            map.invalidateSize();
            resolve();
          }
          tiles.on('load', done);
          setTimeout(done, 2500);
        });
      }

      function whenImagesReady() {
        return new Promise(function (resolve) {
          var imgs = Array.prototype.slice.call(document.images || []);
          if (!imgs.length) { resolve(); return; }
          var left = imgs.length;
          var finished = false;
          function tick() {
            if (finished) return;
            left -= 1;
            if (left <= 0) { finished = true; resolve(); }
          }
          imgs.forEach(function (img) {
            if (img.complete) tick();
            else {
              img.addEventListener('load', tick);
              img.addEventListener('error', tick);
            }
          });
          setTimeout(function () { if (!finished) { finished = true; resolve(); } }, 5000);
        });
      }

      function startPrintFlow() {
        Promise.all([whenImagesReady(), initStreetMap()]).then(function () {
          setTimeout(function () { window.print(); }, 700);
        });
      }

      if (document.readyState === "complete") {
        startPrintFlow();
      } else {
        window.addEventListener("load", startPrintFlow);
      }
    })();
  </script>
</body>
</html>`;
}

/** Opens a printable itinerary window from in-memory data (no DB required). */
export function printItineraryPdf(
  meta: ItineraryPayload,
  days: DayItinerary[]
): void {
  const html = buildItineraryPdfHtml(meta, days);
  try {
    // Same-origin /print avoids about:blank in the browser print footer
    sessionStorage.setItem("vibe-routes-pdf-html", html);
    const win = window.open("/print", "_blank");
    if (!win) {
      alert("Please allow pop-ups to export PDF.");
      sessionStorage.removeItem("vibe-routes-pdf-html");
    }
  } catch {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (!win) {
      alert("Please allow pop-ups to export PDF.");
      URL.revokeObjectURL(url);
    }
  }
}
