"use client";

import type { DayItinerary } from "@/types/itinerary";
import { ACTIVITY_CATEGORY_LABELS } from "@/types/itinerary";
import { formatInr } from "@/lib/costs/estimateTrip";
import Image from "next/image";
import { MapPin } from "lucide-react";

interface ItineraryCardProps {
  day: DayItinerary;
  isActive: boolean;
  onClick: () => void;
}

export default function ItineraryCard({ day, isActive, onClick }: ItineraryCardProps) {
  const daySpend = day.estimated_cost_inr
    ?? (day.activities || []).reduce((s, a) => s + (a.estimated_cost_inr || 0), 0);

  const places = (day.places_visited || []).filter((p) => p?.name);

  return (
    <div
      className={`day-card ${isActive ? "highlight" : ""}`}
      id={`day-${day.day}`}
      onClick={onClick}
    >
      <div className="day-card-header">
        <div className="day-number">{day.day}</div>
        <div className="day-info">
          <h3>{day.title}</h3>
          <span className="day-location">
            <MapPin size={13} aria-hidden />
            {day.location}
          </span>
        </div>
        {daySpend > 0 && (
          <div className="day-cost" title="Typical activity spend for this day (per person)">
            ~{formatInr(daySpend)}
          </div>
        )}
      </div>

      {day.image && (
        <Image
          src={day.image.url}
          alt={day.image.alt}
          width={800}
          height={200}
          className="day-image"
          unoptimized
          style={{ width: "100%", height: "auto" }}
        />
      )}

      <p className="day-description">{day.description}</p>

      {places.length > 0 && (
        <ul className="day-places">
          {places.map((place, i) => (
            <li key={`${place.name}-${i}`} className="day-place">
              <MapPin size={14} className="day-place-icon" aria-hidden />
              <span className="day-place-name">{place.name}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="day-activities">
        {(day.activities || []).map((activity, i) => (
          <span key={i} className={`activity-chip ${activity.category}`}>
            <span className="activity-chip-cat">
              {ACTIVITY_CATEGORY_LABELS[activity.category] || activity.category}
            </span>
            <span className="activity-chip-name">{activity.name}</span>
            {typeof activity.estimated_cost_inr === "number" &&
              activity.estimated_cost_inr > 0 && (
                <span className="activity-chip-cost">
                  ~{formatInr(activity.estimated_cost_inr)}
                </span>
              )}
          </span>
        ))}
      </div>
    </div>
  );
}
