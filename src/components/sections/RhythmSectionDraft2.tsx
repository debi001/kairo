"use client";

import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import styles from "./RhythmSectionDraft2.module.css";

type Step = {
  glyph: string;
  iconLabel: string;
  heading: string;
  body: string;
  /** where the travelling node sits on the arc for this beat, 0–1 */
  progress: number;
  /** milestones follow their reshaped positions from this beat on */
  reshaped: boolean;
};

const CTA_LABEL = "Start Your Goal";

// Copy + geometry mirror the Figma FINAL frames (ArcH D · 9 / 10 / 11).
const STEPS: Step[] = [
  {
    glyph: "hourglass_bottom", // TODO: confirm new check-in icon (Figma annotation "New icon")
    iconLabel: "≈ 10 min",
    heading: "Ten meaningful minutes",
    body:
      "Tell Kairo what's changed since your last visit — priorities, progress, anything in the way. A short check-in is all it takes to keep moving.",
    progress: 0.3,
    reshaped: false,
  },
  {
    glyph: "alt_route",
    iconLabel: "Your new path",
    heading: "Kairo reshapes your path",
    body:
      "You told it what changed — so your milestones and next steps re-space around where you are now. The goal doesn't move, and neither does your momentum.",
    progress: 0.3, // marker HELD — the plan changes, not your position
    reshaped: true,
  },
  {
    glyph: "directions_walk",
    iconLabel: "Your next step",
    heading: "You keep moving",
    body:
      "You leave with a clear next step and a little closer to your goal. Then you come back in a week or two — for the next ten minutes.",
    progress: 0.78,
    reshaped: true,
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

// Milestones re-space around where you are now (not the day-one plan): they
// slide from `planned` to `reshaped` when Kairo re-plans. The goal never moves.
const MILESTONES = [
  { planned: 0.34, reshaped: 0.5 },
  { planned: 0.63, reshaped: 0.84 },
];

const arcPoint = (f: number) => {
  const th = Math.PI * (1 - Math.max(0, Math.min(1, f)));
  return { x: ARC_CX + ARC_R * Math.cos(th), y: ARC_CY - ARC_R * Math.sin(th) };
};

// per-beat dwell so the loop moment (beat 3 → 1) is legible
const DWELL_MS = [3600, 3600, 4600];
// how quickly autoplay resumes after the pointer leaves the arc
const RESUME_MS = 450;
const RESHAPE_MS = 1050;
// Keep in sync with the stroke-dashoffset transition in the CSS module.
const DRAW_MS = 950;

const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const clampStep = (n: number) =>
  Math.min(STEPS.length - 1, Math.max(0, Math.floor(n) || 0));

// Which beat a dragged fraction belongs to.
const stepForFraction = (f: number) => (f < 0.42 ? 0 : f < 0.68 ? 1 : 2);

type Props = {
  /** step to show first (0-based) */
  initialStep?: number;
  /** auto-advance through the steps */
  autoplay?: boolean;
};

export default function RhythmSectionDraft2({
  initialStep = 0,
  autoplay = true,
}: Props) {
  const [active, setActive] = useState(() => clampStep(initialStep));
  const [revealed, setRevealed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const [loopHint, setLoopHint] = useState(false);

  // Curve growth: a plain 0–1 number the CSS transition eases via dashoffset.
  const [len, setLen] = useState(ARC_LEN_FALLBACK);
  const [p, setP] = useState(0);
  const [skipAnim, setSkipAnim] = useState(false);
  // faint arc kept from the previous cycle's furthest point
  const [traceFrac, setTraceFrac] = useState(0);

  const rootRef = useRef<HTMLElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const trackRef = useRef<SVGPathElement>(null);
  const progressRef = useRef<SVGPathElement>(null);
  const glowRef = useRef<SVGPathElement>(null);
  const markerRef = useRef<SVGGElement>(null);
  const milestoneRefs = useRef<Array<SVGGElement | null>>([]);

  const markerFrac = useRef(0);
  const committedP = useRef(0);
  const activeRef = useRef(active);
  const skipAnimRef = useRef(false);
  const draggingRef = useRef(false);
  const reduceMotion = useRef(false);
  const mProg = useRef(0); // 0 = milestones planned, 1 = reshaped
  const prevMaxFrac = useRef(0);
  const loopTimer = useRef<number | undefined>(undefined);
  const resumeFast = useRef(false); // resume autoplay quickly after hover-out

  const reshaped = STEPS[active].reshaped;
  // monotonic latch: only play the reshape flourishes after the first re-plan
  const everReshapedRef = useRef(false);
  if (reshaped) everReshapedRef.current = true;
  const everReshaped = everReshapedRef.current;

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  // ---- marker ----------------------------------------------------------------
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

  // ---- milestones (reshape) ------------------------------------------------
  const placeMilestones = useCallback((t: number) => {
    mProg.current = t;
    MILESTONES.forEach((m, i) => {
      const g = milestoneRefs.current[i];
      if (!g) return;
      const pt = arcPoint(m.planned + (m.reshaped - m.planned) * t);
      g.setAttribute("transform", `translate(${pt.x} ${pt.y})`);
    });
  }, []);

  // ---- go to a beat -------------------------------------------------------
  const goStep = useCallback(
    (idx: number) => {
      const next = clampStep(idx);
      const prev = activeRef.current;

      // leaving the last beat — remember how far the marker got, so a reset
      // still shows a faint trace ("not back to zero")
      if (prev === STEPS.length - 1 && next !== prev) {
        prevMaxFrac.current = Math.max(
          prevMaxFrac.current,
          STEPS[STEPS.length - 1].progress,
        );
        setTraceFrac(prevMaxFrac.current);
      }

      // the loop wrap: beat 3 -> beat 1
      const wrapping = prev === STEPS.length - 1 && next === 0;
      if (wrapping) {
        setLoopHint(true);
        window.clearTimeout(loopTimer.current);
        loopTimer.current = window.setTimeout(() => setLoopHint(false), 1400);
      }

      if (revealed) applyProgress(STEPS[next].progress, next < prev);
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
    placeMilestones(reshaped ? 1 : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeMarker, placeMilestones]);

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

  // First reveal: grow forward from 0 to the current beat.
  useEffect(() => {
    if (revealed) applyProgress(STEPS[activeRef.current].progress, false);
  }, [revealed, applyProgress]);

  // Slide milestones whenever the plan is reshaped / restored.
  useEffect(() => {
    const target = reshaped ? 1 : 0;
    // during a loop reset the curve snaps back too — snap the milestones with
    // it so the user never sees a dot crawling backwards
    if (reduceMotion.current || skipAnimRef.current) {
      placeMilestones(target);
      return;
    }
    const from = mProg.current;
    if (from === target) return;
    const start = performance.now();
    let raf = requestAnimationFrame(function tick(now) {
      const t = Math.min(1, Math.max(0, (now - start) / RESHAPE_MS));
      placeMilestones(from + (target - from) * easeInOut(t));
      if (t < 1) raf = requestAnimationFrame(tick);
      else placeMilestones(target);
    });
    const done = window.setTimeout(() => placeMilestones(target), RESHAPE_MS + 120);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(done);
    };
  }, [reshaped, placeMilestones]);

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

  // Auto-advance (per-beat dwell; quick resume right after a hover-out).
  useEffect(() => {
    if (!autoplay || !revealed || paused || dragging || reduceMotion.current)
      return;
    const delay = resumeFast.current ? RESUME_MS : DWELL_MS[active] ?? 3600;
    resumeFast.current = false;
    const id = window.setTimeout(() => {
      if (!document.hidden) goStep((activeRef.current + 1) % STEPS.length);
    }, delay);
    return () => window.clearTimeout(id);
  }, [autoplay, revealed, paused, dragging, active, goStep]);

  useEffect(
    () => () => window.clearTimeout(loopTimer.current),
    [],
  );

  // ---- grab / drag / tap anywhere on the arc to change beat ---------------
  const pointerToFraction = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return 0;
    const r = svg.getBoundingClientRect();
    const scale = Math.min(r.width / VB.w, r.height / VB.h);
    const offX = (r.width - VB.w * scale) / 2;
    const offY = (r.height - VB.h * scale) / 2;
    const ux = VB.x + (clientX - r.left - offX) / scale;
    const uy = VB.y + (clientY - r.top - offY) / scale;
    let ang = Math.atan2(ARC_CY - uy, ux - ARC_CX);
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
    setP(STEPS[idx].progress);
    committedP.current = STEPS[idx].progress;
  };
  // --------------------------------------------------------------------------

  const step = STEPS[active];
  const atGoal = active === STEPS.length - 1;
  const dashOffset = len * (1 - p);
  const curveStyle = { strokeDasharray: len, strokeDashoffset: dashOffset };
  const traceStyle = { strokeDasharray: len, strokeDashoffset: len * (1 - traceFrac) };
  const curveClass = (base: string) =>
    skipAnim ? `${base} ${styles.noAnim}` : base;

  return (
    <div className={styles.host}>
      <section
        ref={rootRef}
        className={styles.section}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => {
          setPaused(false);
          resumeFast.current = true;
        }}
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
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => {
                setPaused(false);
                resumeFast.current = true;
              }}
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
                <path d={ARC_D} className={styles.trace} style={traceStyle} />
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

                {/* Today — the start node the curve grows out of */}
                <circle
                  cx="0"
                  cy="224"
                  r="4"
                  className={styles.todayDot}
                  aria-hidden="true"
                />

                <g
                  className={
                    dragging
                      ? `${styles.arcLayer} ${styles.dragging}`
                      : styles.arcLayer
                  }
                  onPointerDown={onArcDown}
                  onPointerMove={onArcMove}
                  onPointerUp={onArcUp}
                  onPointerCancel={onArcUp}
                >
                  <path d={ARC_D} className={styles.arcHit} />

                  {/* the two milestones — slide between planned & reshaped */}
                  {MILESTONES.map((m, i) => {
                    const frac = reshaped ? m.reshaped : m.planned;
                    const done = p >= frac - 0.02;
                    return (
                      <g
                        key={i}
                        ref={(el) => {
                          milestoneRefs.current[i] = el;
                        }}
                        className={
                          done
                            ? `${styles.waypoint} ${styles.wpOn}`
                            : styles.waypoint
                        }
                      >
                        <circle r="9" className={styles.wpRing} />
                        <circle r="3.5" className={styles.wpDot} />
                      </g>
                    );
                  })}

                  {/* goal node — fixed anchor, pulses when the plan reshapes */}
                  <g
                    key={`goal-${everReshaped ? reshaped : "init"}`}
                    className={`${atGoal ? styles.goalOn : ""} ${
                      everReshaped ? styles.goalPulse : ""
                    }`}
                  >
                    <circle
                      cx="448"
                      cy="224"
                      r="10"
                      className={styles.goalRing}
                    />
                    <circle
                      cx="448"
                      cy="224"
                      r="7"
                      className={styles.goalDot}
                    />
                  </g>

                  {/* travelling node */}
                  <g
                    ref={markerRef}
                    className={`${styles.marker} ${
                      dragging ? styles.markerDragging : ""
                    }`}
                  >
                    <circle r="11" className={styles.markerHalo} />
                    <circle r="4.5" className={styles.markerCore} />
                  </g>
                </g>
              </svg>

              <div
                className={`${styles.loopHint} ${
                  loopHint ? styles.loopHintOn : ""
                }`}
                aria-hidden="true"
              >
                Next visit
              </div>

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
                {active === 0 ? (
                  <span key={`l-${active}`} className={styles.timeChipWrap}>
                    <span className={styles.timeChip}>{step.iconLabel}</span>
                  </span>
                ) : (
                  <span key={`l-${active}`} className={styles.iconLabel}>
                    {step.iconLabel}
                  </span>
                )}
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
              Your life changes. Your path adapts. A few meaningful minutes with
              Kairo keeps you moving towards your goal.
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
