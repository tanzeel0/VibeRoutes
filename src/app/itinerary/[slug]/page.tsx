"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { ItineraryPayload, DayItinerary } from "@/types/itinerary";
import ItineraryCard from "@/components/ItineraryCard/ItineraryCard";
import BrandLogo from "@/components/shared/BrandLogo";
import dynamic from "next/dynamic";
import Link from "next/link";
import { MapPin, Share2, ArrowLeft, Sparkles, FileDown } from "lucide-react";
import { printItineraryPdf } from "@/lib/exportPdf";

const MapView = dynamic(() => import("@/components/MapView/MapView"), {
  ssr: false,
  loading: () => (
    <div className="map-section" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      Loading map...
    </div>
  ),
});

export default function ItineraryPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [data, setData] = useState<ItineraryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeDay, setActiveDay] = useState<number | null>(null);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/itinerary/${slug}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch(() => {
        setNotFound(true);
        setLoading(false);
      });
  }, [slug]);

  const handleDayClick = (day: number) => {
    setActiveDay(day);
    document.getElementById(`day-${day}`)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  };

  const handleShare = async () => {
    const url = window.location.href;
    await navigator.clipboard.writeText(url);
    alert("Link copied!");
  };

  const handleExportPdf = () => {
    if (data) {
      printItineraryPdf(data, data.itinerary);
    }
  };

  if (loading) {
    return (
      <div className="app-container">
        <div className="empty-state">
          <div className="loading-dots"><span></span><span></span><span></span></div>
          <p style={{ marginTop: 16 }}>Loading itinerary...</p>
        </div>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="app-container">
        <div className="empty-state">
          <div className="empty-icon">?</div>
          <p>Itinerary not found</p>
          <Link href="/" className="btn-ghost" style={{ marginTop: 16 }}>
            <ArrowLeft size={16} /> Go Back
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-brand">
          <BrandLogo />
        </div>
        <div className="header-actions">
          <button className="btn-action" onClick={handleExportPdf} title="Export PDF">
            <FileDown size={14} />
            <span className="btn-label">Export PDF</span>
          </button>
          <button className="btn-action" onClick={handleShare} title="Share">
            <Share2 size={14} />
            <span className="btn-label">Share</span>
          </button>
        </div>
      </header>

      <div className="itinerary-header">
        <h2 className="itinerary-title">{data.title}</h2>
        <div className="itinerary-meta">
          <span>
            <MapPin size={14} /> {data.origin} → {data.destination}
          </span>
          <span>
            <Sparkles size={14} /> {data.vibe.primary.replace(/-/g, " ")}
          </span>
          <span>
            {data.duration.days} days / {data.duration.nights} nights
          </span>
        </div>
        <p className="itinerary-summary">{data.route_summary}</p>

        {data.ai_meta && !data.ai_meta.grounded && (
          <div style={{
            marginTop: 12,
            padding: "8px 14px",
            borderRadius: 12,
            background: "rgba(234, 179, 8, 0.1)",
            border: "1px solid rgba(234, 179, 8, 0.3)",
            fontSize: 13,
            color: "#eab308",
          }}>
            AI-suggested itinerary — please verify venues before traveling
          </div>
        )}
      </div>

      {((data.itinerary?.length ?? 0) > 0) && (
        <MapView
          days={data.itinerary || []}
          routeWaypoints={[]}
          destination={data.destination}
          destinationOnly
          activeDay={activeDay}
          onDayClick={handleDayClick}
        />
      )}

      <div className="itinerary-list">
        {data.itinerary.map((day: DayItinerary) => (
          <ItineraryCard
            key={day.day}
            day={day}
            isActive={activeDay === day.day}
            onClick={() => handleDayClick(day.day)}
          />
        ))}
      </div>

      <div className="action-bar">
        <button className="btn-export" onClick={handleExportPdf}>
          <FileDown size={16} /> Export PDF
        </button>
        <button className="btn-share" onClick={handleShare}>
          <Share2 size={16} /> Copy Share Link
        </button>
      </div>
    </div>
  );
}
