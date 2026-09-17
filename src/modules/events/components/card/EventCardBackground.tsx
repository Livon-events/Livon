"use client";

import { useEffect, useState, useRef } from "react";

/**
 * Yellow Peek-notch card chrome. Happy path keeps the measured SVG notch
 * (Livon differentiator). Falls back to a static yellow rounded frame when
 * measure fails or the user prefers reduced motion — see
 * docs/FR/home-feed-performance.md.
 */
export default function EventCardBackground({ eventId }: { eventId: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  // Last-drawn measurements — lets drawCard() no-op (and skip the DOM
  // writes below) when a resize/observer tick fires but nothing about
  // this card's own layout actually changed, per bug: repeated redraws
  // with identical values were still causing a visible flicker.
  const lastRef = useRef<{ w: number; h: number; x1: number; x2: number } | null>(null);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    if (useFallback) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      setUseFallback(true);
      return;
    }

    const svg = svgRef.current;
    if (!svg) return;

    const card = svg.parentElement;
    if (!card) return;

    let pendingFrame: number | null = null;
    let disposed = false;

    const resizeObserver = new ResizeObserver(() => {
      if (!disposed) scheduleDraw();
    });

    const enterFallback = () => {
      if (disposed) return;
      disposed = true;
      if (pendingFrame !== null) {
        cancelAnimationFrame(pendingFrame);
        pendingFrame = null;
      }
      resizeObserver.disconnect();
      setUseFallback(true);
    };

    const drawCard = () => {
      if (disposed) return;

      const btn = card.querySelector<HTMLElement>(`#peekBtn-${CSS.escape(eventId)}`);
      const path = pathRef.current;

      if (!btn || !path) {
        enterFallback();
        return;
      }

      const W = card.offsetWidth;
      const H = card.offsetHeight;

      if (W === 0 || H === 0) return; // not laid out yet — wait for next tick

      const cardRect = card.getBoundingClientRect();
      const btnRect = btn.getBoundingClientRect();

      if (btnRect.width <= 0 || btnRect.height <= 0) {
        enterFallback();
        return;
      }

      const gap = 5; // visible yellow gap between peek button and notch
      const x1 = Math.round(btnRect.left - cardRect.left - gap);
      const x2 = Math.round(btnRect.right - cardRect.left + gap);

      // Transitional layout can produce out-of-range notch coords — skip this
      // frame instead of permanently degrading chrome.
      if (x2 <= x1 || x1 < 0 || x2 > W) return;

      const last = lastRef.current;
      if (last && last.w === W && last.h === H && last.x1 === x1 && last.x2 === x2) {
        return; // nothing actually changed — skip the redraw entirely
      }
      lastRef.current = { w: W, h: H, x1, x2 };

      const d = 46; // notch depth = head height
      const r = 12; // card outer corner radius
      const nr = 10; // notch corner radius

      svg.setAttribute("width", W.toString());
      svg.setAttribute("height", H.toString());

      path.setAttribute(
        "d",
        `
          M ${r},0
          L ${x1 - nr},0
          A ${nr},${nr} 0 0 1 ${x1},${nr}
          L ${x1},${d - nr}
          A ${nr},${nr} 0 0 0 ${x1 + nr},${d}
          L ${x2 - nr},${d}
          A ${nr},${nr} 0 0 0 ${x2},${d - nr}
          L ${x2},${nr}
          A ${nr},${nr} 0 0 1 ${x2 + nr},0
          L ${W - r},0
          A ${r},${r} 0 0 1 ${W},${r}
          L ${W},${H - r}
          A ${r},${r} 0 0 1 ${W - r},${H}
          L ${r},${H}
          A ${r},${r} 0 0 1 0,${H - r}
          L 0,${r}
          A ${r},${r} 0 0 1 ${r},0
          Z
      `
      );
    };

    function scheduleDraw() {
      if (disposed || pendingFrame !== null) return;
      pendingFrame = requestAnimationFrame(() => {
        pendingFrame = null;
        drawCard();
      });
    }

    scheduleDraw();
    resizeObserver.observe(card);

    return () => {
      disposed = true;
      if (pendingFrame !== null) cancelAnimationFrame(pendingFrame);
      resizeObserver.disconnect();
    };
  }, [eventId, useFallback]);

  if (useFallback) {
    return (
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[12px] bg-[#FFF335]"
      />
    );
  }

  return (
    <svg
      ref={svgRef}
      className="pointer-events-none absolute left-0 top-0 block"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path ref={pathRef} fill="#FFF335" />
    </svg>
  );
}
