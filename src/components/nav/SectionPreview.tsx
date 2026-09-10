"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useHeaderControlsSlot } from "./NavHeader";

type Viewport = "desktop" | "mobile";

type Props = {
  /** number of autoplay/step beats this section has — 0 hides the Auto/step row */
  steps?: number;
  render: (props: { initialStep: number; autoplay: boolean }) => React.ReactNode;
};

const pill = (on: boolean) =>
  `rounded-full px-3 py-1 text-xs transition-colors ${
    on
      ? "bg-zinc-100 text-zinc-900"
      : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
  }`;

// Review-only controls for this page (autoplay/step pin, desktop/mobile
// preview width). Not part of the real site nav — strip this component out
// (and its portal target in NavHeader) when a page graduates from the
// playground into the live repo. Portaled into the header's control slot so
// it renders on the same row as the Hero/Rhythm nav, even though the state
// here stays local to this page.
export default function SectionPreview({ steps = 0, render }: Props) {
  const slot = useHeaderControlsSlot();
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [autoplay, setAutoplay] = useState(true);
  const [pinnedStep, setPinnedStep] = useState(0);
  const initialStep = autoplay ? 0 : pinnedStep;

  const controls = (
    <>
      {steps > 0 && (
        <>
          <button
            type="button"
            onClick={() => setAutoplay((a) => !a)}
            className={pill(autoplay)}
          >
            {autoplay ? "Auto ▶" : "Auto ⏸"}
          </button>
          <div className="flex items-center gap-1 rounded-full bg-zinc-900 p-1">
            {Array.from({ length: steps }, (_, i) => (
              <button
                key={i}
                type="button"
                disabled={autoplay}
                onClick={() => setPinnedStep(i)}
                className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                  !autoplay && pinnedStep === i
                    ? "bg-zinc-100 text-zinc-900"
                    : "text-zinc-400 hover:text-zinc-200 disabled:opacity-40 disabled:hover:text-zinc-400"
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </>
      )}
      <div className="flex items-center gap-1 rounded-full bg-zinc-900 p-1">
        {(["desktop", "mobile"] as Viewport[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setViewport(v)}
            className={`rounded-full px-3 py-1 text-xs capitalize transition-colors ${
              viewport === v
                ? "bg-zinc-100 text-zinc-900"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {v}
          </button>
        ))}
      </div>
    </>
  );

  return (
    <div className="flex h-full w-full min-h-0 flex-col">
      {slot && createPortal(controls, slot)}

      <div className="flex min-h-0 flex-1 flex-col items-center overflow-hidden">
        <div
          className="h-full w-full overflow-hidden transition-[max-width] duration-300"
          style={{
            maxWidth: viewport === "mobile" ? 393 : "100%",
            outline:
              viewport === "mobile" ? "1px solid rgb(24 24 27)" : "none",
          }}
        >
          {render({ initialStep, autoplay })}
        </div>
      </div>
    </div>
  );
}
