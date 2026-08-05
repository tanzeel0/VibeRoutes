"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

interface BrandLogoProps {
  href?: string;
  /** "mark" = icon + wordmark. "icon" = icon only. */
  variant?: "mark" | "icon";
}

export default function BrandLogo({
  href = "/",
  variant = "mark",
}: BrandLogoProps) {
  const pathname = usePathname();
  const isMark = variant === "mark";

  return (
    <Link
      href={href}
      className={`brand${isMark ? " brand--mark" : " brand--icon"}`}
      aria-label="Vibe Routes AI home"
      onClick={(e) => {
        // Same-route Link clicks can remount the page and drop client state.
        if (pathname === href) e.preventDefault();
      }}
    >
      <Image
        src="/logo-icon.png"
        alt=""
        width={40}
        height={40}
        className="brand-logo-img"
        priority
        unoptimized
      />
      {isMark && (
        <span className="brand-text">
          Vibe routes <span className="brand-ai">AI</span>
        </span>
      )}
    </Link>
  );
}
