"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
// Static import (not a /public path) so Next emits it under _next/static/media
// and applies basePath/assetPrefix — a raw "/Kairo-symbol.png" is left
// unprefixed and 404s under the GitHub Pages base path.
import kairoSymbol from "./kairo-symbol.png";
import styles from "./Hero.module.css";

const EYEBROW = "Your always-on AI mentor";
const HEADLINE = "Turn the goal you keep thinking about into visible progress.";
// One line. The goal rotator and value strip below carry the
// "tell it a goal / it adapts / you keep moving" detail the old paragraph did.
const SUBHEAD =
  "Kairo turns that goal into a living path that adapts as your life changes.";
const PRIMARY_CTA = "Start with your goal";
// A generic invitation, not a specific story — the card sells the idea of
// momentum with Kairo. Title wraps to two lines (clamped); meta is a short,
// deliberately vague hook that stays on one line.
const VIDEO_LABEL = "See what moving forward with Kairo looks like.";
const VIDEO_META = "A 2-minute watch";
const VIDEO_DURATION = "2:11";

// Concrete goal examples for the rotator. Each is tinted with its own
// goal-category colour — the six hues from Figma "Color Semantic Goal"
// (goal/get-promo, new-biz, grow-biz, prof-dev, personal-dev, hobby), the
// same palette the Kairo symbol mark is built from.
const GOALS = [
  { text: "get promoted", color: "#ff7c33" }, // DS: goal/get-promo
  { text: "start a business", color: "#6eff4a" }, // DS: goal/new-biz
  { text: "grow my business", color: "#4a84ff" }, // DS: goal/grow-biz
  { text: "switch careers", color: "#714aff" }, // DS: goal/prof-dev
  { text: "get fit", color: "#ff5af7" }, // DS: goal/personal-dev
  { text: "learn the guitar", color: "#ffd646" }, // DS: goal/hobby
];

// Each point carries a Material Symbols glyph, shown in a small square token.
const VALUE_POINTS = [
  { text: "Re-plans as things change", icon: "autorenew" },
  { text: "10-minute check-ins", icon: "schedule" },
  { text: "A clear next step every time", icon: "arrow_forward" },
];

const GOAL_ROTATE_MS = 2400;

// The story video, on Vimeo.
const VIMEO_ID = "1225446755";
// Silent, chrome-less, looping preview that plays inside the card thumbnail
// (`background=1` implies autoplay + loop + muted + no UI). Not rendered under
// reduced motion — a static poster shows instead.
const VIDEO_PREVIEW_SRC = `https://player.vimeo.com/video/${VIMEO_ID}?background=1`;
// Full player for the modal: sound, controls, autoplay on open, no Vimeo chrome.
const VIDEO_MODAL_SRC = `https://player.vimeo.com/video/${VIMEO_ID}?autoplay=1&title=0&byline=0&portrait=0`;

export default function HeroSection() {
  const [open, setOpen] = useState(false);
  const [goalIndex, setGoalIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Track the reduced-motion preference — gates both the goal rotator and the
  // autoplaying video preview (WCAG 2.2.2: no >5s auto-moving content).
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Rotate the example goal on a timer — a single example stays under reduced motion.
  useEffect(() => {
    if (reduceMotion) return;
    const id = window.setInterval(() => {
      setGoalIndex((i) => (i + 1) % GOALS.length);
    }, GOAL_ROTATE_MS);
    return () => window.clearInterval(id);
  }, [reduceMotion]);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    dialogRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <div className={styles.host}>
      <section className={styles.section} aria-label="Kairo, your always-on AI mentor">
        <div className={styles.content}>
          {/* Group 1 — identity: the mark + who this is for, read as a unit. */}
          <div className={styles.identity}>
            <div className={styles.symbolWrap}>
              <span className={styles.glow} aria-hidden="true" />
              <span className={styles.ring} aria-hidden="true" />
              <span className={styles.ring} data-second aria-hidden="true" />
              <Image
                src={kairoSymbol}
                alt=""
                width={144}
                height={144}
                className={styles.symbol}
                priority
              />
            </div>
            <span className={styles.eyebrow}>{EYEBROW}</span>
          </div>

          {/* Group 2 — the headline claim. */}
          <h1 className={styles.headline}>{HEADLINE}</h1>

          {/* Group 3 — the pitch: the concrete goal Kairo stands in for, what it
              does with it, and how. One container, one uniform gap. */}
          <div className={styles.pitch}>
            <div
              className={styles.goalRotator}
              aria-label={`For example: ${GOALS.map((g) => g.text).join(", ")}`}
            >
              <span className={styles.goalPrefix}>I want to</span>
              <span
                key={goalIndex}
                className={styles.goalPhrase}
                style={{ color: GOALS[goalIndex].color }}
              >
                {GOALS[goalIndex].text}
              </span>
              <span className={styles.goalCaret} aria-hidden="true" />
            </div>

            <p className={styles.subhead}>{SUBHEAD}</p>

            <ul className={styles.valueStrip}>
              {VALUE_POINTS.map(({ text, icon }) => (
                <li key={text} className={styles.valueItem}>
                  <span
                    className={`material-symbols-outlined ${styles.valueIcon}`}
                    aria-hidden="true"
                  >
                    {icon}
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>

          {/* Group 4 — action. */}
          <div className={styles.ctaRow}>
            <button type="button" className={styles.primaryCta}>
              {PRIMARY_CTA}
            </button>

            {/* Secondary: a media card for the story video — [thumb] [title /
                meta] [play]. A single transparent button stretched over the
                whole card is the trigger, so the thumbnail and text stay
                non-interactive and the Vimeo <iframe> never eats the click. */}
            <div className={styles.videoCard}>
              <span className={styles.videoThumb}>
                <span className={styles.videoPoster} aria-hidden="true" />
                {!reduceMotion && (
                  <iframe
                    className={styles.videoPreview}
                    src={VIDEO_PREVIEW_SRC}
                    title="Video preview"
                    aria-hidden="true"
                    tabIndex={-1}
                    loading="lazy"
                    allow="autoplay; picture-in-picture"
                  />
                )}
              </span>
              <span className={styles.videoText}>
                <span className={styles.videoTitle}>{VIDEO_LABEL}</span>
                <span className={styles.videoMeta}>{VIDEO_META}</span>
              </span>
              <span className={styles.playBadge} aria-hidden="true">
                <span className={styles.playGlyph} />
              </span>
              <button
                ref={triggerRef}
                type="button"
                className={styles.videoCardBtn}
                onClick={() => setOpen(true)}
                aria-label={`Play video: ${VIDEO_LABEL} (${VIDEO_DURATION})`}
              />
            </div>
          </div>
        </div>
      </section>

      {open && (
        <div
          className={styles.overlay}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            ref={dialogRef}
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-label={`${VIDEO_LABEL} (${VIDEO_DURATION})`}
            tabIndex={-1}
          >
            <button
              type="button"
              className={styles.closeBtn}
              onClick={close}
              aria-label="Close video"
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                close
              </span>
            </button>
            <iframe
              className={styles.video}
              src={VIDEO_MODAL_SRC}
              title={VIDEO_LABEL}
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}
    </div>
  );
}
