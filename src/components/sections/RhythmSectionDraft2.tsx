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
  /** milestones follow their reshaped positions from this beat on */
  reshaped: boolean;
};

const CTA_LABEL = "Start Your Goal";

// Copy + geometry mirror the Figma FINAL frames (ArcH D · 9 / 10 / 11).
// Progress values aren't fixed here any more — see `stepProgress` below: each
// beat's position depends on which *visit* (cycle) you're on.
const STEPS: Step[] = [
  {
    glyph: "hourglass_bottom",
    iconLabel: "≈ 10 min",
    heading: "Ten meaningful minutes",
    body:
      "Tell Kairo what's changed since your last visit — priorities, progress, anything in the way. A short check-in is all it takes to keep moving.",
    reshaped: false,
  },
  {
    glyph: "alt_route",
    iconLabel: "Your new path",
    heading: "Kairo reshapes your path",
    body:
      "You told it what changed — so your milestones and next steps re-space around where you are now. The goal doesn't move, and neither does your momentum.",
    reshaped: true, // marker HELD — the plan changes, not your position
  },
  {
    glyph: "directions_walk",
    iconLabel: "Your next step",
    heading: "You keep moving",
    body:
      "You leave with a clear next step and a little closer to your goal. Then you come back in a week or two — for the next ten minutes.",
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

// ---- cross-visit progress ---------------------------------------------------
// Each lap (beat 1 → 2 → 3) covers a band of the arc. Beat 1 & 2 sit at the
// band's start (2 is the reshape — you hold in place while the plan moves),
// beat 3 grows to the band's end. The *next* lap's band picks up exactly where
// the last one stopped — so "next visit" never resets you to the start, it
// keeps you moving. Exactly 3 visits complete the goal (the 3rd band ends at
// 1.0 — the arc literally reaches the goal node); the 4th visit wraps back to
// band 0, i.e. a new goal, so the whole cycle repeats in threes.
const CYCLE_BANDS = [
  { start: 0.12, end: 0.42 },
  { start: 0.42, end: 0.7 },
  { start: 0.7, end: 1.0 },
];
const bandForCycle = (cycle: number) =>
  CYCLE_BANDS[cycle % CYCLE_BANDS.length];

const stepProgress = (beatIndex: number, cycle: number) => {
  const band = bandForCycle(cycle);
  return beatIndex === 2 ? band.end : band.start;
};

// Milestones re-space around where you are now (not the day-one plan): they
// slide from `planned` to `reshaped` when Kairo re-plans. The goal never
// moves. Positions are relative to the current visit's band, so "your next
// step" is always freshly ahead of wherever that visit starts. Both reshaped
// positions stay inside the band (< end) so beat 3's growth to `end` reaches
// *both* of them every visit — one milestone reached per visit would leave
// the trail lopsided and the next visit's reset would look inconsistent.
const milestonesForCycle = (cycle: number) => {
  const { start, end } = bandForCycle(cycle);
  const span = end - start;
  return [
    { planned: start + span * 0.25, reshaped: start + span * 0.6 },
    { planned: start + span * 0.5, reshaped: start + span * 0.85 },
  ];
};

const arcPoint = (f: number) => {
  const th = Math.PI * (1 - Math.max(0, Math.min(1, f)));
  return { x: ARC_CX + ARC_R * Math.cos(th), y: ARC_CY - ARC_R * Math.sin(th) };
};

// svg user-space point → percentage within `.arc`, for positioning HTML
// overlays (tooltip, loop hint) that must track a point on the responsive svg.
const svgToPct = (x: number, y: number) => ({
  xPct: ((x - VB.x) / VB.w) * 100,
  yPct: ((y - VB.y) / VB.h) * 100,
});

// per-beat dwell so the loop moment (beat 3 → 1) is legible
const DWELL_MS = [3600, 3600, 4600];
// how quickly autoplay resumes after the pointer leaves the arc
const RESUME_MS = 450;
// milestone reshape: how long each dot takes, and the gap before the 2nd starts
const RESHAPE_MS = 900;
const STAGGER_MS = 180;
// Keep in sync with the stroke-dashoffset transition in the CSS module.
const DRAW_MS = 950;

const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// easeOutBack — overshoots slightly past the target then settles, so a
// milestone reads as "snapping into place" rather than gliding.
const easeOvershoot = (t: number) => {
  const c1 = 1.25;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

const clampStep = (n: number) =>
  Math.min(STEPS.length - 1, Math.max(0, Math.floor(n) || 0));

// Which beat a dragged fraction belongs to, within the current visit's band.
const stepForFraction = (f: number, cycle: number) => {
  const { start, end } = bandForCycle(cycle);
  const span = end - start;
  if (f < start + span * 0.4) return 0;
  if (f < start + span * 0.75) return 1;
  return 2;
};

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
  const [cycle, setCycle] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const [loopHint, setLoopHint] = useState(false);
  // bumping either entry replays that milestone's "landed" pulse
  const [landKey, setLandKey] = useState<[number, number]>([0, 0]);

  // Curve growth: a plain 0–1 number the CSS transition eases via dashoffset.
  const [len, setLen] = useState(ARC_LEN_FALLBACK);
  const [p, setP] = useState(0);
  const [skipAnim, setSkipAnim] = useState(false);
  // faint arc kept from the previous visit's furthest point
  const [traceFrac, setTraceFrac] = useState(0);
  // history of reached milestones — persists across all 3 visits of a lap,
  // clears once the 3rd visit's goal is reached and a new lap begins
  const [completedMarks, setCompletedMarks] = useState<number[]>([]);
  // hover tooltip — explains what a node on the arc is (goal / milestone /
  // completed milestone) without a permanent on-screen legend
  const [tooltip, setTooltip] = useState<{
    xPct: number;
    yPct: number;
    label: string;
  } | null>(null);

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
  const cycleRef = useRef(cycle);
  const skipAnimRef = useRef(false);
  const draggingRef = useRef(false);
  const reduceMotion = useRef(false);
  const mLocalT = useRef<[number, number]>([0, 0]); // per-milestone local t (0=planned,1=reshaped)
  const milestonePrevCycle = useRef(0);
  const prevMaxFrac = useRef(0);
  const loopTimer = useRef<number | undefined>(undefined);
  const resumeFast = useRef(false); // resume autoplay quickly after hover-out
  const recordedMarksRef = useRef<Set<string>>(new Set()); // dedup key: `${cycle}-${i}`

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
  // so the arc always *grows forward*, never crawls backward.
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
  const placeMilestoneAt = useCallback(
    (i: number, cycleForCalc: number, t: number) => {
      const m = milestonesForCycle(cycleForCalc)[i];
      const g = milestoneRefs.current[i];
      if (!g || !m) return;
      const pt = arcPoint(m.planned + (m.reshaped - m.planned) * t);
      g.setAttribute("transform", `translate(${pt.x} ${pt.y})`);
    },
    [],
  );

  // ---- go to a beat -------------------------------------------------------
  const goStep = useCallback(
    (idx: number) => {
      const next = clampStep(idx);
      const prev = activeRef.current;
      const prevCycle = cycleRef.current;

      // leaving beat 3 — remember how far we got, so a reset still shows a
      // faint trace ("not back to zero")
      if (prev === STEPS.length - 1 && next !== prev) {
        const prevEnd = stepProgress(2, prevCycle);
        prevMaxFrac.current = Math.max(prevMaxFrac.current, prevEnd);
        setTraceFrac(prevMaxFrac.current);
      }

      // completing a full lap — bump the visit so beat 1 resumes further on
      const wrapping = prev === STEPS.length - 1 && next === 0;
      if (wrapping) {
        cycleRef.current = prevCycle + 1;
        setCycle(cycleRef.current);
        setLoopHint(true);
        window.clearTimeout(loopTimer.current);
        loopTimer.current = window.setTimeout(() => setLoopHint(false), 1400);

        // a fresh goal every 3 visits — clear the completed-milestone trail
        if (cycleRef.current % CYCLE_BANDS.length === 0) {
          recordedMarksRef.current.clear();
          setCompletedMarks([]);
        }
      }

      const target = stepProgress(next, cycleRef.current);
      const isBackward = target < committedP.current - 0.001;
      if (revealed) applyProgress(target, isBackward);
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
    const t0 = reshaped ? 1 : 0;
    mLocalT.current = [t0, t0];
    milestonePrevCycle.current = cycleRef.current;
    placeMilestoneAt(0, cycleRef.current, t0);
    placeMilestoneAt(1, cycleRef.current, t0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeMarker, placeMilestoneAt]);

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
    if (revealed)
      applyProgress(stepProgress(activeRef.current, cycleRef.current), false);
  }, [revealed, applyProgress]);

  // Slide milestones whenever the plan is reshaped / restored — staggered,
  // with a little overshoot, so each move reads as one clear "it just moved
  // here" gesture instead of two things happening at once.
  useEffect(() => {
    const target = reshaped ? 1 : 0;
    const cycleChanged = milestonePrevCycle.current !== cycle;
    milestonePrevCycle.current = cycle;

    // a new visit's milestones are a fresh plan, not an undo of the last one —
    // snap instead of sliding backwards. Same during a curve reset.
    if (reduceMotion.current || skipAnimRef.current || cycleChanged) {
      mLocalT.current = [target, target];
      placeMilestoneAt(0, cycle, target);
      placeMilestoneAt(1, cycle, target);
      return;
    }

    const rafs: Array<number | undefined> = [undefined, undefined];
    const delays: Array<number | undefined> = [undefined, undefined];

    ([0, 1] as const).forEach((i) => {
      const from = mLocalT.current[i];
      if (from === target) return;
      const run = () => {
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, Math.max(0, (now - start) / RESHAPE_MS));
          const val = from + (target - from) * easeOvershoot(t);
          mLocalT.current[i] = val;
          placeMilestoneAt(i, cycle, val);
          if (t < 1) {
            rafs[i] = requestAnimationFrame(tick);
          } else {
            mLocalT.current[i] = target;
            placeMilestoneAt(i, cycle, target);
            setLandKey((k) => {
              const next: [number, number] = [...k];
              next[i] += 1;
              return next;
            });
          }
        };
        rafs[i] = requestAnimationFrame(tick);
      };
      if (i === 0) run();
      else delays[i] = window.setTimeout(run, STAGGER_MS);
    });

    return () => {
      rafs.forEach((r) => r !== undefined && cancelAnimationFrame(r));
      delays.forEach((d) => d !== undefined && window.clearTimeout(d));
    };
  }, [reshaped, cycle, placeMilestoneAt]);

  // Record each milestone's position the first time it's reached, so the
  // trail persists across visits as a hint of what's already been done.
  useEffect(() => {
    const list = milestonesForCycle(cycle);
    list.forEach((m, i) => {
      const frac = reshaped ? m.reshaped : m.planned;
      if (p < frac - 0.02) return;
      const key = `${cycle}-${i}`;
      if (recordedMarksRef.current.has(key)) return;
      recordedMarksRef.current.add(key);
      setCompletedMarks((marks) => [...marks, frac]);
    });
  }, [p, cycle, reshaped]);

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
    setTooltip(null);
    const f = pointerToFraction(e.clientX, e.clientY);
    committedP.current = f;
    paintCurve(f);
    const idx = stepForFraction(f, cycleRef.current);
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
    const idx = stepForFraction(f, cycleRef.current);
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

    const idx = stepForFraction(markerFrac.current, cycleRef.current);
    activeRef.current = idx;
    setActive(idx);
    const target = stepProgress(idx, cycleRef.current);
    setP(target);
    committedP.current = target;
  };
  // --------------------------------------------------------------------------

  const step = STEPS[active];
  const atGoal = active === STEPS.length - 1;
  const dashOffset = len * (1 - p);
  const curveStyle = { strokeDasharray: len, strokeDashoffset: dashOffset };
  const traceStyle = {
    strokeDasharray: len,
    strokeDashoffset: len * (1 - traceFrac),
  };
  const curveClass = (base: string) =>
    skipAnim ? `${base} ${styles.noAnim}` : base;
  const milestones = milestonesForCycle(cycle);

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
        data-cycle={cycle}
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
              {cycle > 0 && (
                <span
                  key={cycle}
                  className={styles.auraPulse}
                  aria-hidden="true"
                />
              )}

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

                  {/* completed-milestone trail — persists across all 3 visits */}
                  {completedMarks.map((frac, i) => {
                    const pt = arcPoint(frac);
                    return (
                      <circle
                        key={`mark-${i}`}
                        cx={pt.x}
                        cy={pt.y}
                        r="3"
                        className={styles.historyDot}
                        onPointerEnter={() =>
                          setTooltip({
                            ...svgToPct(pt.x, pt.y),
                            label: "Completed milestone",
                          })
                        }
                        onPointerLeave={() => setTooltip(null)}
                      />
                    );
                  })}

                  {/* the two milestones — slide between planned & reshaped */}
                  {milestones.map((m, i) => {
                    const frac = reshaped ? m.reshaped : m.planned;
                    const done = p >= frac - 0.02;
                    const pt = arcPoint(frac);
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
                        onPointerEnter={() =>
                          setTooltip({
                            ...svgToPct(pt.x, pt.y),
                            label: done ? "Completed milestone" : "Milestone",
                          })
                        }
                        onPointerLeave={() => setTooltip(null)}
                      >
                        <g
                          key={`land-${i}-${landKey[i]}`}
                          className={styles.wpLandGroup}
                        >
                          <circle r="9" className={styles.wpRing} />
                          <circle r="3.5" className={styles.wpDot} />
                        </g>
                      </g>
                    );
                  })}

                  {/* goal node — fixed anchor, pulses when the plan reshapes */}
                  <g
                    key={`goal-${everReshaped ? reshaped : "init"}`}
                    className={`${atGoal ? styles.goalOn : ""} ${
                      everReshaped ? styles.goalPulse : ""
                    }`}
                    onPointerEnter={() =>
                      setTooltip({ ...svgToPct(448, 224), label: "Goal" })
                    }
                    onPointerLeave={() => setTooltip(null)}
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

              {tooltip && (
                <div
                  className={styles.tooltip}
                  style={{ left: `${tooltip.xPct}%`, top: `${tooltip.yPct}%` }}
                >
                  {tooltip.label}
                </div>
              )}

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
