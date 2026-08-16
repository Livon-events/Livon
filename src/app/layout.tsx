import type { Metadata } from "next";
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        {children}
        <div className="md:hidden"><BottomNav /></div>
      </body>
    </html>
  );
}
