"use client";

import { useEffect, useRef } from "react";

export default function EventCardBackground({ eventId }: { eventId: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const drawCard = () => {
      const card = document.getElementById(`eventCard-${eventId}`);
      const btn = document.getElementById(`peekBtn-${eventId}`);
      const svg = svgRef.current;
      const path = pathRef.current;

      if (!card || !btn || !svg || !path) return;

      const W = card.offsetWidth;
      const H = card.offsetHeight;

      if (W === 0 || H === 0) return; // not laid out yet

      const cardRect = card.getBoundingClientRect();
      const btnRect = btn.getBoundingClientRect();

      const gap = 5; // visible yellow gap between peek button and notch
      const x1 = btnRect.left - cardRect.left - gap;
      const x2 = btnRect.right - cardRect.left + gap;
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

    // Draw on mount and resize
    const raf1 = requestAnimationFrame(() => requestAnimationFrame(drawCard));
    window.addEventListener("resize", drawCard);

    // Also handle resizing of the card itself if content changes
    let resizeObserver: ResizeObserver | null = null;
    const card = document.getElementById(`eventCard-${eventId}`);
    if (card) {
      resizeObserver = new ResizeObserver(() => drawCard());
      resizeObserver.observe(card);
    }

    return () => {
      cancelAnimationFrame(raf1);
      window.removeEventListener("resize", drawCard);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [eventId]);

  return (
    <svg
      ref={svgRef}
      className="pointer-events-none absolute left-0 top-0 block"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path ref={pathRef} fill="#FFEA00" />
    </svg>
  );
}
