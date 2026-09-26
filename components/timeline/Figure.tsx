"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { figureAt, figureGeometry } from "@/lib/figure-proportions";
import { sectionRange } from "@/lib/timeline-scroll";
import { AGE_FROM, AGE_TO } from "@/content/years";

gsap.registerPlugin(ScrollTrigger);

/**
 * The figure that grows up.
 *
 * A single stroked line, because proportion is the whole point: head-to-height
 * runs from about a quarter at birth to about a seventh at nineteen, and the
 * neck appearing around five is what stops a child reading as a shrunken adult.
 *
 * Geometry is written straight onto SVG attributes from the scrub's onUpdate
 * rather than through React state. This runs on every frame of the scroll, and
 * a re-render per frame is the difference between smooth and unusable.
 */
export default function Figure({ className }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<SVGEllipseElement>(null);
  const neckRef = useRef<SVGLineElement>(null);
  const torsoRef = useRef<SVGLineElement>(null);
  const armLeftRef = useRef<SVGPolylineElement>(null);
  const armRightRef = useRef<SVGPolylineElement>(null);
  const legLeftRef = useRef<SVGPolylineElement>(null);
  const legRightRef = useRef<SVGPolylineElement>(null);

  /** Push interpolated geometry for a scroll progress onto the DOM. */
  const paint = (progress: number) => {
    const age = AGE_FROM + (AGE_TO - AGE_FROM) * progress;
    const g = figureGeometry(figureAt(age));

    headRef.current?.setAttribute("cx", String(g.headCx));
    headRef.current?.setAttribute("cy", String(g.headCy));
    headRef.current?.setAttribute("rx", String(g.headRx));
    headRef.current?.setAttribute("ry", String(g.headRy));

    // When shape.neck is 0 the neck line spans nothing and simply is not
    // drawn, rather than needing to be hidden.
    neckRef.current?.setAttribute("y1", String(g.neckTop));
    neckRef.current?.setAttribute("y2", String(g.neckBottom));

    torsoRef.current?.setAttribute("y1", String(g.shoulderY));
    torsoRef.current?.setAttribute("y2", String(g.hipY));

    const elbowY = g.shoulderY + g.armLen * 0.52;
    armLeftRef.current?.setAttribute(
      "points",
      `${-g.armX},${g.shoulderY + 3} ${-g.armX - 1},${elbowY} ${-g.armX + g.handFlare},${g.handY}`,
    );
    armRightRef.current?.setAttribute(
      "points",
      `${g.armX},${g.shoulderY + 3} ${g.armX + 1},${elbowY} ${g.armX - g.handFlare},${g.handY}`,
    );
    legLeftRef.current?.setAttribute(
      "points",
      `${-g.legX},${g.hipY} ${-g.legX - 1},${g.feetY - 12} ${-g.legX - g.footFlare},${g.feetY}`,
    );
    legRightRef.current?.setAttribute(
      "points",
      `${g.legX},${g.hipY} ${g.legX + 1},${g.feetY - 12} ${g.legX + g.footFlare},${g.feetY}`,
    );
  };

  useGSAP(
    () => {
      const section = wrapRef.current?.closest(".track-timeline");
      if (!section) return;

      const tween = { p: 0 };
      const trigger = ScrollTrigger.create({
        // Absolute positions, resolved fresh: `pin` moves the element's document
        // position as its spacer grows.
        start: () => sectionRange(section).start,
        end: () => sectionRange(section).end,
        scrub: true,
        onUpdate: (self) => {
          tween.p = self.progress;
          paint(self.progress);
        },
        onRefresh: (self) => paint(self.progress),
      });

      paint(trigger.progress);

      return () => {
        trigger.kill();
        void tween;
      };
    },
    { scope: wrapRef },
  );

  return (
    <div ref={wrapRef} className={className} aria-hidden="true">
      <svg
        viewBox="-52 -2 104 104"
        className="h-full w-full"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        focusable="false"
      >
        <ellipse ref={headRef} cx="0" cy="0" rx="0" ry="0" />
        <line ref={neckRef} x1="0" y1="0" x2="0" y2="0" />
        <line ref={torsoRef} x1="0" y1="0" x2="0" y2="0" />
        <polyline ref={armLeftRef} points="" />
        <polyline ref={armRightRef} points="" />
        <polyline ref={legLeftRef} points="" />
        <polyline ref={legRightRef} points="" />
      </svg>
    </div>
  );
}
