"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAppSelector, useAppDispatch } from "@/redux/store";
import {
  reset,
  setActiveDay,
  setUserPrompt,
  generateItinerary,
  modifyItinerary,
  loadSavedTrip,
} from "@/redux/itinerarySlice";
import InputFlow from "@/components/InputFlow/InputFlow";
import ChatWizard from "@/components/ChatWizard/ChatWizard";
import ItineraryCard from "@/components/ItineraryCard/ItineraryCard";
import BrandLogo from "@/components/shared/BrandLogo";
import { useAppShell } from "@/components/shared/AppShellContext";
import dynamic from "next/dynamic";
import type { GenerateRequest, ItineraryPayload, DayItinerary } from "@/types/itinerary";
import { printItineraryPdf } from "@/lib/exportPdf";
import { resolveTripBudget } from "@/lib/costs/estimateTrip";
import {
  MapPin,
  Share2,
  FileDown,
  RotateCcw,
  Sparkles,
  IndianRupee,
} from "lucide-react";

const MapView = dynamic(() => import("@/components/MapView/MapView"), {
  ssr: false,
  loading: () => (
    <div className="map-section loading">
      <div className="loading-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  ),
});

const QUICK_PROMPTS = [
  "4-day street food trip to Mumbai",
  "3-day heritage walk in Jaipur",
  "5-day nature escape to Manali",
  "Weekend nightlife in Goa",
];

const ACTIVE_TRIP_KEY = "vibe-routes-active";

function clearActiveTripStorage() {
  try {
    sessionStorage.removeItem(ACTIVE_TRIP_KEY);
  } catch {
    /* ignore */
  }
}

function writeActiveTripStorage(data: {
  meta: ItineraryPayload;
  days: DayItinerary[];
  userPrompt: string;
}) {
  try {
    sessionStorage.setItem(ACTIVE_TRIP_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota errors */
  }
}

export default function HomePage() {
  const dispatch = useAppDispatch();
  const { status, days, meta, error, activeDay, userPrompt } = useAppSelector(
    (s) => s.itinerary
  );
  const { saveTrip, loadTripId, setLoadTripId, trips } = useAppShell();

  const [wizardActive, setWizardActive] = useState(false);
  const [initialPrompt, setInitialPrompt] = useState("");
  const [restored, setRestored] = useState(false);
  const savedSlugRef = useRef<string | null>(null);

  const isActive =
    status === "streaming" || status === "done" || status === "error";

  const tripBudget = meta
    ? resolveTripBudget(meta, days.length ? days : meta.itinerary || [])
    : null;

  const handleDayClick = useCallback(
    (day: number) => {
      dispatch(setActiveDay(day));
      document
        .getElementById(`day-${day}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    },
    [dispatch]
  );

  const handleShare = async () => {
    if (meta?.slug) {
      const url = `${window.location.origin}/itinerary/${meta.slug}`;
      await navigator.clipboard.writeText(url);
      alert("Link copied to clipboard!");
    }
  };

  const handleExportPdf = () => {
    if (!meta) return;
    printItineraryPdf(meta, days);
  };

  const handlePromptSubmit = (text: string) => {
    setInitialPrompt(text);
    setWizardActive(true);
  };

  const handleWizardComplete = (
    request: GenerateRequest,
    displayPrompt: string
  ) => {
    setWizardActive(false);
    dispatch(setUserPrompt(displayPrompt));
    dispatch(generateItinerary(request));
  };

  const handleQuickPrompt = (text: string) => {
    setInitialPrompt(text);
    setWizardActive(true);
  };

  const handleNewTrip = useCallback(() => {
    setWizardActive(false);
    setInitialPrompt("");
    savedSlugRef.current = null;
    clearActiveTripStorage();
    dispatch(reset());
  }, [dispatch]);

  const handleRevise = (text: string) => {
    if (meta && (status === "done" || status === "error")) {
      const nextPrompt = userPrompt
        ? `${userPrompt}\n→ ${text}`
        : text;
      dispatch(setUserPrompt(nextPrompt));
      // Allow sidebar to re-save the updated version
      savedSlugRef.current = null;
      dispatch(
        modifyItinerary({
          instruction: text,
          current: meta,
          days,
        })
      );
      return;
    }

    setInitialPrompt(text);
    setWizardActive(true);
    savedSlugRef.current = null;
    clearActiveTripStorage();
    dispatch(reset());
  };

  // Restore the last open trip after a refresh / HMR reload
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(ACTIVE_TRIP_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          meta?: ItineraryPayload;
          days?: DayItinerary[];
          userPrompt?: string;
        };
        if (parsed?.meta) {
          const tripDays =
            parsed.days?.length
              ? parsed.days
              : parsed.meta.itinerary?.length
                ? parsed.meta.itinerary
                : [];
          savedSlugRef.current = parsed.meta.slug ?? null;
          dispatch(
            loadSavedTrip({
              payload: parsed.meta,
              days: tripDays,
              userPrompt: parsed.userPrompt,
            })
          );
        }
      }
    } catch {
      /* ignore */
    }
    setRestored(true);
  }, [dispatch]);

  // Persist finished trips into the sidebar + keep active view recoverable
  useEffect(() => {
    if (!restored) return;
    if (status !== "done" || !meta?.slug) return;

    const tripDays = days.length ? days : meta.itinerary || [];
    const budget = resolveTripBudget(meta, tripDays);
    const metaWithBudget = {
      ...meta,
      itinerary: tripDays,
      trip_budget: budget,
    };
    writeActiveTripStorage({
      meta: metaWithBudget,
      days: tripDays,
      userPrompt,
    });

    if (savedSlugRef.current === meta.slug) return;
    savedSlugRef.current = meta.slug;
    saveTrip({
      id: meta.slug,
      slug: meta.slug,
      title: meta.title,
      origin: meta.origin,
      destination: meta.destination,
      days: meta.duration.days,
      vibe: meta.vibe.primary,
      payload: metaWithBudget,
    });
  }, [status, meta, days, userPrompt, saveTrip, restored]);

  // Load a trip from the sidebar
  useEffect(() => {
    if (!loadTripId) return;
    const trip = trips.find((t) => t.id === loadTripId);
    setLoadTripId(null);
    if (!trip?.payload) return;

    const payload = trip.payload as ItineraryPayload;
    const tripDays: DayItinerary[] =
      payload.itinerary?.length > 0 ? payload.itinerary : [];
    const prompt = `${trip.days}-day ${trip.vibe.replace(/-/g, " ")} trip from ${trip.origin} to ${trip.destination}`;

    setWizardActive(false);
    savedSlugRef.current = trip.slug;
    writeActiveTripStorage({
      meta: { ...payload, itinerary: tripDays },
      days: tripDays,
      userPrompt: prompt,
    });
    dispatch(
      loadSavedTrip({
        payload,
        days: tripDays,
        userPrompt: prompt,
      })
    );
  }, [loadTripId, trips, setLoadTripId, dispatch]);

  // Preferences → Reset trip
  useEffect(() => {
    const onReset = () => handleNewTrip();
    window.addEventListener("vibe-routes-reset", onReset);
    return () => window.removeEventListener("vibe-routes-reset", onReset);
  }, [handleNewTrip]);

  return (
    <div className="app-container">
      <header className="app-header">
        <BrandLogo />
        {isActive && (
          <div className="header-actions">
            {status === "done" && (
              <>
                <button className="btn-action" onClick={handleShare}>
                  <Share2 size={14} /> Share
                </button>
                <button className="btn-action" onClick={handleExportPdf}>
                  <FileDown size={14} /> Export PDF
                </button>
              </>
            )}
            <button className="btn-action" onClick={handleNewTrip}>
              <RotateCcw size={14} /> New Trip
            </button>
          </div>
        )}
      </header>

      {/* ===== IDLE: Initial prompt input ===== */}
      {restored && status === "idle" && !wizardActive && (
        <main className="search-page">
          <div className="search-shell animate-slide-up-fade">
            <div className="search-hero">
              <p className="hero-kicker">Plan trips that feel like you</p>
              <h1 className="hero-title">Vibe Routes</h1>
              <p className="hero-subtitle">
                Tell me the city, how many days, and the vibe - get a specific
                itinerary with real places and a live map.
              </p>
            </div>

            <div className="prompt-bar centered">
              <InputFlow onSubmit={handlePromptSubmit} autoFocus />
            </div>

            <div className="quick-prompts">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  className="quick-prompt"
                  onClick={() => handleQuickPrompt(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </main>
      )}

      {/* ===== WIZARD: Step-by-step questions ===== */}
      {restored && status === "idle" && wizardActive && (
        <main className="wizard-page">
          <ChatWizard
            initialPrompt={initialPrompt}
            onComplete={handleWizardComplete}
          />
        </main>
      )}

      {/* ===== ACTIVE: Streaming / Done ===== */}
      {isActive && (
        <main className="chat-page">
          <div className="chat-content">
            {userPrompt && (
              <div className="message-user">
                <div className="avatar-circle user-avatar">You</div>
                <div className="message-body">{userPrompt}</div>
              </div>
            )}

            {status === "error" && error && (
              <div className="error-message">
                {error}
                <button className="btn-action" onClick={handleNewTrip}>
                  <RotateCcw size={14} /> Try Again
                </button>
              </div>
            )}

            {status === "streaming" && days.length === 0 && (
              <div className="ai-thinking">
                <div className="avatar-circle ai-avatar">
                  <Sparkles size={16} />
                </div>
                <div className="thinking-text">
                  {meta ? "Updating your itinerary" : "Building your itinerary"}
                  <span className="loading-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </span>
                </div>
              </div>
            )}

            {meta && (
              <div className="ai-response animate-slide-up-fade">
                <div className="response-header">
                  <div className="avatar-circle ai-avatar">
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <h2 className="response-title">{meta.title}</h2>
                    <div className="response-tags">
                      <span>
                        <MapPin size={14} /> {meta.origin} →{" "}
                        {meta.destination}
                      </span>
                      <span>
                        <Sparkles size={14} />{" "}
                        {meta.vibe.primary.replace(/-/g, " ")}
                      </span>
                      <span>
                        {meta.duration.days} days / {meta.duration.nights}{" "}
                        nights
                      </span>
                      {tripBudget && (
                        <span className="response-tag-budget">
                          <IndianRupee size={14} />
                          {tripBudget.per_person_low.toLocaleString("en-IN")}–
                          {tripBudget.per_person_high.toLocaleString("en-IN")} / person
                        </span>
                      )}
                    </div>
                    <p className="response-summary">{meta.route_summary}</p>
                  </div>
                </div>

                {((meta.route_geo?.waypoints?.length ?? 0) > 0 ||
                  days.length > 0) && (
                  <MapView
                    days={days}
                    routeWaypoints={meta.route_geo?.waypoints ?? []}
                    activeDay={activeDay}
                    onDayClick={handleDayClick}
                  />
                )}

                <div className="itinerary-list">
                  {days.map((day) => (
                    <ItineraryCard
                      key={day.day}
                      day={day}
                      isActive={activeDay === day.day}
                      onClick={() => handleDayClick(day.day)}
                    />
                  ))}
                </div>

                {status === "done" && (
                  <div className="action-bar">
                    <button className="btn-export" onClick={handleExportPdf}>
                      <FileDown size={16} /> Export PDF
                    </button>
                    <button className="btn-share" onClick={handleShare}>
                      <Share2 size={16} /> Copy Share Link
                    </button>
                    <button className="btn-share" onClick={handleNewTrip}>
                      <RotateCcw size={16} /> New Trip
                    </button>
                  </div>
                )}
              </div>
            )}

            {status === "streaming" && days.length > 0 && (
              <div className="streaming-indicator">
                <span className="pulse-dot"></span>
                Updating your itinerary...
              </div>
            )}
          </div>

          {/* Always-visible bottom bar for changes */}
          <div className="prompt-bar bottom">
            <InputFlow
              onSubmit={handleRevise}
              placeholder="Change this trip — e.g. make it 5 days, more food, slower pace..."
              autoFocus={false}
              disabled={status === "streaming"}
            />
          </div>
        </main>
      )}
    </div>
  );
}
