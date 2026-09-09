"use client";

import { useState } from "react";
import OngoingArcSection from "@/components/sections/OngoingArcSection";

type SectionProps = { initialStep: number; autoplay: boolean };

type Option = {
  id: string;
  label: string;
  note: string;
  steps: number;
  render: (props: SectionProps) => React.ReactNode;
};

const OPTIONS: Option[] = [
  {
    id: "ongoing-arc",
    label: "Ongoing · Arc",
    note: "Option 1 — Final draft",
    steps: 3,
    render: (props) => (
      <OngoingArcSection
        key={`${props.initialStep}-${props.autoplay}`}
        {...props}
      />
    ),
  },
];

type Viewport = "desktop" | "mobile";

const pill = (on: boolean) =>
  `rounded-full px-3 py-1 text-xs transition-colors ${
    on
      ? "bg-zinc-100 text-zinc-900"
      : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
  }`;

export default function Home() {
  const [activeId, setActiveId] = useState(OPTIONS[0].id);
  const [viewport, setViewport] = useState<Viewport>("desktop");

  // Review controls — client-only state, so no SSR/hydration surprises.
  const [autoplay, setAutoplay] = useState(true);
  const [pinnedStep, setPinnedStep] = useState(0);

  const current = OPTIONS.find((o) => o.id === activeId) ?? OPTIONS[0];
  const initialStep = autoplay ? 0 : pinnedStep;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#050505] text-zinc-200">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-zinc-900 px-4 py-4 sm:px-6">
        <span className="text-sm font-semibold tracking-tight text-zinc-100">
          Kairo
          <span className="ml-2 font-normal text-zinc-500">
            Section Playground
          </span>
        </span>

        <nav className="flex flex-wrap gap-2">
          {OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setActiveId(o.id)}
              className={pill(o.id === activeId)}
            >
              {o.label}
            </button>
          ))}
        </nav>

        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <button
            type="button"
            onClick={() => setAutoplay((a) => !a)}
            className={pill(autoplay)}
          >
            {autoplay ? "Auto ▶" : "Auto ⏸"}
          </button>

          <div className="flex items-center gap-1 rounded-full bg-zinc-900 p-1">
            {Array.from({ length: current.steps }, (_, i) => (
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
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center overflow-x-auto">
        <div
          className="w-full transition-[max-width] duration-300"
          style={{
            maxWidth: viewport === "mobile" ? 393 : "100%",
            outline:
              viewport === "mobile" ? "1px solid rgb(24 24 27)" : "none",
          }}
        >
          {current.render({ initialStep, autoplay })}
        </div>
        {/* scroll room so the glow-dims-on-scroll behaviour is demoable */}
        <div className="h-[60vh] w-full shrink-0" aria-hidden />
      </main>
    </div>
  );
}
