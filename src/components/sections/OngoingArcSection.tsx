"use client";

import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import styles from "./OngoingArc.module.css";

type Step = {
  glyph: string;
  iconLabel: string;
  heading: string;
  body: string;
  /** how far the curve has grown along the arc, 0–1 */
  progress: number;
};

const CTA_LABEL = "Start Your Goal";

const STEPS: Step[] = [
  {
    glyph: "edit_note",
    iconLabel: "Your update",
    heading: "You check in",
    body:
      "A 10-minute check-in: tell Kairo what's changed since your last visit — priorities, progress, and anything getting in the way.",
    progress: 0.33,
  },
  {
    glyph: "alt_route",
    iconLabel: "Your new path",
    heading: "Kairo reshapes your path",
    body:
      "Your milestones and next steps adjust around where you are now, not the day you started.",
    progress: 0.67,
  },
  {
    glyph: "directions_walk",
    iconLabel: "Your next step",
    heading: "You keep moving",
    body:
      "Leave with a clear next step, and a little closer to your goal — visit after visit.",
    progress: 1,
  },
];

// Semicircle: centre (224, 224), radius 224 — exact bezier path from Figma.
const ARC_D =
  "M 0 224 C 0 164.59 23.6 107.62 65.61 65.61 C 107.62 23.6 164.59 0 224 0 C 283.41 0 340.38 23.6 382.39 65.61 C 424.4 107.62 448 164.59 448 224";
const ARC_CX = 224;
const ARC_CY = 224;
const ARC_R = 224;
const ARC_LEN_FALLBACK = 703.7;

// viewBox — keep in sync with `.arc` aspect-ratio in the CSS module.
const VB = { x: -20, y: -16, w: 490, h: 300 };

// The two intermediate milestones sit on the arc at their step's fraction.
const WAYPOINTS = [0, 1].map((i) => {
  const theta = Math.PI * (1 - STEPS[i].progress);
  return {
    step: i,
    x: ARC_CX + ARC_R * Math.cos(theta),
    y: ARC_CY - ARC_R * Math.sin(theta),
  };
});

const CYCLE_MS = 3600;
// Keep in sync with the stroke-dashoffset transition in the CSS module.
const DRAW_MS = 950;

const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const clampStep = (n: number) =>
  Math.min(STEPS.length - 1, Math.max(0, Math.floor(n) || 0));

// Which step a curve fraction belongs to (thresholds midway between steps).
const stepForFraction = (f: number) => (f < 0.5 ? 0 : f < 0.835 ? 1 : 2);

type Props = {
  /** step to show first (0-based) */
  initialStep?: number;
  /** auto-advance through the steps */
  autoplay?: boolean;
};

export default function OngoingArcSection({
  initialStep = 0,
  autoplay = true,
}: Props) {
  const [active, setActive] = useState(() => clampStep(initialStep));
  const [revealed, setRevealed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [scrolling, setScrolling] = useState(false);

  // Curve growth: a plain 0–1 number the CSS transition eases via dashoffset.
  const [len, setLen] = useState(ARC_LEN_FALLBACK);
  const [p, setP] = useState(0);
  const [skipAnim, setSkipAnim] = useState(false);

  const rootRef = useRef<HTMLElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const trackRef = useRef<SVGPathElement>(null);
  const progressRef = useRef<SVGPathElement>(null);
  const glowRef = useRef<SVGPathElement>(null);
  const markerRef = useRef<SVGGElement>(null);

  const markerFrac = useRef(0);
  const committedP = useRef(0);
  const activeRef = useRef(active);
  const skipAnimRef = useRef(false);
  const draggingRef = useRef(false);
  const reduceMotion = useRef(false);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  // Position the travelling marker at a fraction along the path.
  const placeMarker = useCallback((frac: number) => {
    const track = trackRef.current;
    const marker = markerRef.current;
    if (!track || !marker) return;
    const L = track.getTotalLength();
    const f = Math.max(0.0001, Math.min(1, frac));
    const pt = track.getPointAtLength(f * L);
    marker.setAttribute("transform", `translate(${pt.x} ${pt.y})`);
    marker.style.opacity = frac > 0.015 ? "1" : "0";
    markerFrac.current = frac;
    rootRef.current?.setAttribute("data-p", frac.toFixed(3));
  }, []);

  // Paint the curve fraction straight onto the DOM (used while dragging).
  const paintCurve = useCallback(
    (frac: number) => {
      const off = len * (1 - frac);
      if (progressRef.current)
        progressRef.current.style.strokeDashoffset = `${off}`;
      if (glowRef.current) glowRef.current.style.strokeDashoffset = `${off}`;
      placeMarker(frac);
    },
    [len, placeMarker],
  );

  // Move the curve to a target fraction. `reset` snaps back to the start first
  // so the arc always *grows forward* from Today, never crawls backward.
  const applyProgress = useCallback((target: number, reset: boolean) => {
    if (reset && !reduceMotion.current) {
      skipAnimRef.current = true;
      setSkipAnim(true);
      setP(0);
      committedP.current = 0;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          skipAnimRef.current = false;
          setSkipAnim(false);
          setP(target);
          committedP.current = target;
        }),
      );
    } else {
      setP(target);
      committedP.current = target;
    }
  }, []);

  // Go to a step (from autoplay / dots / keys). Growing forward = smooth ease;
  // wrapping/going back = reset to the start, then grow.
  const goStep = useCallback(
    (idx: number) => {
      const next = clampStep(idx);
      if (revealed) applyProgress(STEPS[next].progress, next < activeRef.current);
      activeRef.current = next;
      setActive(next);
    },
    [applyProgress, revealed],
  );

  // Measure the real path length + read the reduced-motion preference once.
  useEffect(() => {
    reduceMotion.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (trackRef.current) setLen(trackRef.current.getTotalLength());
    placeMarker(0);
  }, [placeMarker]);

  // Draw in once the section scrolls into view.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setRevealed(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // First reveal: grow forward from 0 to the current step.
  useEffect(() => {
    if (revealed) applyProgress(STEPS[activeRef.current].progress, false);
  }, [revealed, applyProgress]);

  // Dim the ambient glow while the page is actively scrolling.
  useEffect(() => {
    let t: number | undefined;
    const onScroll = () => {
      setScrolling(true);
      window.clearTimeout(t);
      t = window.setTimeout(() => setScrolling(false), 240);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(t);
    };
  }, []);

  // Glide the marker along the path in step with the CSS curve transition.
  useEffect(() => {
    if (draggingRef.current) return;
    if (reduceMotion.current || skipAnimRef.current) {
      placeMarker(p);
      return;
    }
    const from = markerFrac.current;
    const to = p;
    if (from === to) return;

    const start = performance.now();
    let raf = requestAnimationFrame(function tick(now) {
      const t = Math.min(1, Math.max(0, (now - start) / DRAW_MS));
      placeMarker(from + (to - from) * easeInOut(t));
      if (t < 1) raf = requestAnimationFrame(tick);
      else placeMarker(to);
    });
    const done = window.setTimeout(() => placeMarker(to), DRAW_MS + 120);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(done);
    };
  }, [p, placeMarker]);

  // Auto-advance.
  useEffect(() => {
    if (!autoplay || !revealed || paused || dragging || reduceMotion.current)
      return;
    const id = window.setInterval(() => {
      if (!document.hidden) goStep((activeRef.current + 1) % STEPS.length);
    }, CYCLE_MS);
    return () => window.clearInterval(id);
  }, [autoplay, revealed, paused, dragging, goStep]);

  // ---- grab / drag / tap anywhere on the arc to change step -----------------
  const pointerToFraction = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return 0;
    const r = svg.getBoundingClientRect();
    const scale = Math.min(r.width / VB.w, r.height / VB.h);
    const offX = (r.width - VB.w * scale) / 2;
    const offY = (r.height - VB.h * scale) / 2;
    const ux = VB.x + (clientX - r.left - offX) / scale;
    const uy = VB.y + (clientY - r.top - offY) / scale;
    let ang = Math.atan2(ARC_CY - uy, ux - ARC_CX); // π at Today → 0 at Goal
    if (ang < 0) ang = ux < ARC_CX ? Math.PI : 0;
    ang = Math.max(0, Math.min(Math.PI, ang));
    return 1 - ang / Math.PI;
  }, []);

  const onArcDown = (e: ReactPointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
    draggingRef.current = true;
    skipAnimRef.current = true;
    setDragging(true);
    setSkipAnim(true);
    setPaused(true);
    const f = pointerToFraction(e.clientX, e.clientY);
    committedP.current = f;
    paintCurve(f);
    const idx = stepForFraction(f);
    if (idx !== activeRef.current) {
      activeRef.current = idx;
      setActive(idx);
    }
  };

  const onArcMove = (e: ReactPointerEvent) => {
    if (!draggingRef.current) return;
    const f = pointerToFraction(e.clientX, e.clientY);
    committedP.current = f;
    paintCurve(f);
    const idx = stepForFraction(f);
    if (idx !== activeRef.current) {
      activeRef.current = idx;
      setActive(idx);
    }
  };

  const onArcUp = (e: ReactPointerEvent) => {
    if (!draggingRef.current) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
    draggingRef.current = false;
    skipAnimRef.current = false;
    setDragging(false);
    setSkipAnim(false);
    setPaused(false);

    const idx = stepForFraction(markerFrac.current);
    activeRef.current = idx;
    setActive(idx);
    setP(STEPS[idx].progress); // ease from where it was dropped to the exact step
    committedP.current = STEPS[idx].progress;
  };
  // --------------------------------------------------------------------------

  const step = STEPS[active];
  const atGoal = active === STEPS.length - 1;
  const dashOffset = len * (1 - p);
  const curveStyle = { strokeDasharray: len, strokeDashoffset: dashOffset };
  const curveClass = (base: string) =>
    skipAnim ? `${base} ${styles.noAnim}` : base;

  return (
    <div className={styles.host}>
    <section
      ref={rootRef}
      className={styles.section}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="A rhythm you return to"
      data-active={active}
      data-revealed={String(revealed)}
      data-scrolling={String(scrolling)}
    >
      <div className={styles.card}>
        <div className={styles.panel}>
        <div
          className={styles.arc}
          tabIndex={0}
          role="group"
          aria-label={`Step ${active + 1} of ${STEPS.length}: ${step.heading}`}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") {
              e.preventDefault();
              goStep((active + 1) % STEPS.length);
            }
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              goStep((active - 1 + STEPS.length) % STEPS.length);
            }
          }}
        >
          <span className={styles.aura} aria-hidden="true" />

          <svg
            ref={svgRef}
            className={styles.svg}
            viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
            preserveAspectRatio="xMidYMid meet"
            fill="none"
            aria-hidden="true"
          >
            <path ref={trackRef} d={ARC_D} className={styles.track} />
            <path
              ref={glowRef}
              d={ARC_D}
              className={curveClass(styles.glow)}
              style={curveStyle}
            />
            <path
              ref={progressRef}
              d={ARC_D}
              className={curveClass(styles.progress)}
              style={curveStyle}
            />

            {/* one interactive layer: grab / drag / tap anywhere on the arc */}
            <g
              className={dragging ? `${styles.arcLayer} ${styles.dragging}` : styles.arcLayer}
              onPointerDown={onArcDown}
              onPointerMove={onArcMove}
              onPointerUp={onArcUp}
              onPointerCancel={onArcUp}
            >
              <path d={ARC_D} className={styles.arcHit} />

              {/* the two milestone nodes (step 1 & step 2) */}
              {WAYPOINTS.map((w) => (
                <g
                  key={w.step}
                  className={
                    active >= w.step
                      ? `${styles.waypoint} ${styles.wpOn}`
                      : styles.waypoint
                  }
                >
                  <circle cx={w.x} cy={w.y} r="9" className={styles.wpRing} />
                  <circle cx={w.x} cy={w.y} r="3.5" className={styles.wpDot} />
                </g>
              ))}

              {/* goal node (step 3) */}
              <g className={atGoal ? styles.goalOn : undefined}>
                <circle cx="448" cy="224" r="10" className={styles.goalRing} />
                <circle cx="448" cy="224" r="4" className={styles.goalDot} />
              </g>

              {/* travelling node */}
              <g
                ref={markerRef}
                className={`${styles.marker} ${dragging ? styles.markerDragging : ""}`}
              >
                <circle r="11" className={styles.markerHalo} />
                <circle r="4.5" className={styles.markerCore} />
              </g>
            </g>
          </svg>

          <div className={styles.iconWrap}>
            <span className={styles.iconBox}>
              <span
                key={`g-${active}`}
                className={`material-symbols-outlined ${styles.glyph}`}
                aria-hidden="true"
              >
                {step.glyph}
              </span>
            </span>
            <span key={`l-${active}`} className={styles.iconLabel}>
              {step.iconLabel}
            </span>
          </div>

          <span className={`${styles.overline} ${styles.overlineStart}`}>
            Today
          </span>
          <span className={`${styles.overline} ${styles.overlineEnd}`}>
            Your goal
          </span>
        </div>

        <div className={styles.step}>
          <h3 key={`h-${active}`}>{step.heading}</h3>
          <p key={`b-${active}`}>{step.body}</p>
        </div>

        <div className={styles.dots} role="tablist" aria-label="Steps">
          {STEPS.map((s, i) => (
            <button
              key={s.heading}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={s.heading}
              className={i === active ? styles.dotOn : styles.dot}
              onClick={() => goStep(i)}
            />
          ))}
        </div>
        </div>

        <div className={styles.pitch}>
          <h2>A rhythm you return to.</h2>
          <p>
            Kairo isn&rsquo;t a plan you make once. Every week or two, a short
            check-in keeps your path matched to your life.
          </p>
          <button type="button" className={styles.cta}>
            {CTA_LABEL}
          </button>
        </div>
      </div>
    </section>
    </div>
  );
}
