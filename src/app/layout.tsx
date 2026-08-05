import type { Metadata } from "next";
import SiteHeader from "@/shared/layout/SiteHeader";
import BottomNav from "@/shared/layout/BottomNav";
import "./globals.css";
export const PAGE_CONTAINER_CLASSES = "mx-auto w-full max-w-[1400px] px-3 lg:px-6";

export const metadata: Metadata = {
  title: "Livon",
  description: "Livon — event discovery platform",
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