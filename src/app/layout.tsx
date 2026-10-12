import type { Metadata } from "next";
import Script from "next/script";
import { SpeedInsights } from "@vercel/speed-insights/next";
import SiteHeader from "@/shared/layout/SiteHeader";
import BottomNav from "@/shared/layout/BottomNav";
import { getSiteUrl } from "@/shared/siteUrl";
import "./globals.css";

export const PAGE_CONTAINER_CLASSES = "mx-auto w-full max-w-[1400px] px-3 lg:px-6";

const siteUrl = getSiteUrl();
const clarityProjectId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID?.trim();
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
        <SpeedInsights />
        {clarityProjectId && (
          <Script id="microsoft-clarity" strategy="afterInteractive">
            {`(function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", ${JSON.stringify(clarityProjectId)});`}
          </Script>
        )}
      </body>
    </html>
  );
}
