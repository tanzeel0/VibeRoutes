"use client";

import type { TripBudget } from "@/types/itinerary";
import { formatInrRange } from "@/lib/costs/estimateTrip";
import { IndianRupee } from "lucide-react";

export default function TripBudgetCard({ budget }: { budget: TripBudget }) {
  return (
    <div className="trip-budget-card">
      <div className="trip-budget-header">
        <IndianRupee size={18} />
        <div>
          <h3>Estimated trip cost</h3>
          <p className="trip-budget-range">
            {formatInrRange(budget.per_person_low, budget.per_person_high)}
            <span> / person</span>
          </p>
        </div>
      </div>

      {budget.breakdown && (
        <ul className="trip-budget-breakdown">
          <li>
            <span>Stay</span>
            <span>
              {formatInrRange(budget.breakdown.stay[0], budget.breakdown.stay[1])}
            </span>
          </li>
          <li>
            <span>Food</span>
            <span>
              {formatInrRange(budget.breakdown.food[0], budget.breakdown.food[1])}
            </span>
          </li>
          <li>
            <span>Local transport</span>
            <span>
              {formatInrRange(
                budget.breakdown.local_transport[0],
                budget.breakdown.local_transport[1]
              )}
            </span>
          </li>
          <li>
            <span>Activities</span>
            <span>
              {formatInrRange(
                budget.breakdown.activities[0],
                budget.breakdown.activities[1]
              )}
            </span>
          </li>
        </ul>
      )}

      <p className="trip-budget-note">{budget.note}</p>
      <p className="trip-budget-source">{budget.source}</p>
    </div>
  );
}
