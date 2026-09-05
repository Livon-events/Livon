"use client";

import { useEffect, useRef } from "react";

export default function EventCardBackground({ eventId }: { eventId: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  // Last-drawn measurements — lets drawCard() no-op (and skip the DOM
  // writes below) when a resize/observer tick fires but nothing about
  // this card's own layout actually changed, per bug: repeated redraws
  // with identical values were still causing a visible flicker.
  const lastRef = useRef<{ w: number; h: number; x1: number; x2: number } | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const card = svg.parentElement;
    if (!card) return;

    const drawCard = () => {
      const btn = card.querySelector<HTMLElement>(`#peekBtn-${CSS.escape(eventId)}`);
      const path = pathRef.current;

      if (!btn || !path) return;

      const W = card.offsetWidth;
      const H = card.offsetHeight;

      if (W === 0 || H === 0) return; // not laid out yet

      const cardRect = card.getBoundingClientRect();
      const btnRect = btn.getBoundingClientRect();

      const gap = 5; // visible yellow gap between peek button and notch
      const x1 = Math.round(btnRect.left - cardRect.left - gap);
      const x2 = Math.round(btnRect.right - cardRect.left + gap);

      const last = lastRef.current;
      if (last && last.w === W && last.h === H && last.x1 === x1 && last.x2 === x2) {
        return; // nothing actually changed — skip the redraw entirely
      }
      lastRef.current = { w: W, h: H, x1, x2 };

      const d = 46;   // notch depth = head height
      const r = 12;   // card outer corner radius
      const nr = 10;   // notch corner radius

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

    let pendingFrame: number | null = null;
    const scheduleDraw = () => {
      if (pendingFrame !== null) return; // already coalesced into a pending frame
      pendingFrame = requestAnimationFrame(() => {
        pendingFrame = null;
        drawCard();
      });
    };

    scheduleDraw();

    const resizeObserver = new ResizeObserver(() => scheduleDraw());
    resizeObserver.observe(card);

    return () => {
      if (pendingFrame !== null) cancelAnimationFrame(pendingFrame);
      resizeObserver.disconnect();
    };
  }, [eventId]);

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