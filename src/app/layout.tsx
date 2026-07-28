import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import "@/styles/main.scss";
import StoreProvider from "@/components/shared/StoreProvider";
import { AppShellProvider } from "@/components/shared/AppShellContext";
import { TripsSidebar, PreferencesModal } from "@/components/shared/TripsSidebar";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Vibe Routes",
  description:
    "Tell Vibe Routes the city, how many days, and the vibe — get a specific itinerary with real places and a live map.",
  icons: {
    icon: [{ url: "/logo-icon.png", type: "image/png" }],
    apple: [{ url: "/logo-icon.png" }],
    shortcut: ["/logo-icon.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${fraunces.variable}`} data-theme="light">
      <body className={dmSans.className}>
        <StoreProvider>
          <AppShellProvider>
            <div className="app-shell">
              <TripsSidebar />
              <div className="app-shell-main">{children}</div>
            </div>
            <PreferencesModal />
          </AppShellProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
