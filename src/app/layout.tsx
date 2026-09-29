import type { Metadata } from "next";
import { Suspense } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import SiteHeader from "@/shared/layout/SiteHeader";
import BottomNav from "@/shared/layout/BottomNav";
import { getSiteUrl } from "@/shared/siteUrl";
import "./globals.css";

export const PAGE_CONTAINER_CLASSES = "mx-auto w-full max-w-[1400px] px-3 lg:px-6";

const siteUrl = getSiteUrl();
const siteDescription = "Discover and share events on Livon.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Livon",
    template: "%s · Livon",
  },
  description: siteDescription,
  applicationName: "Livon",
  openGraph: {
    type: "website",
    siteName: "Livon",
    title: "Livon",
    description: siteDescription,
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "Livon",
    description: siteDescription,
  },
};

// Heights must match SiteHeader's spacers so the swap causes no layout shift.
function SiteHeaderSkeleton() {
  return (
    <div
      className="h-[72px] border-b-[3.5px] border-[#FFF335] bg-[#0C0C0C] md:h-20"
      aria-hidden="true"
    />
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Suspense fallback={<SiteHeaderSkeleton />}>
          <SiteHeader />
        </Suspense>
        {children}
        <div className="md:hidden"><BottomNav /></div>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
