"use client";

import SectionPreview from "@/components/nav/SectionPreview";
import RhythmSectionDraft2 from "@/components/sections/RhythmSectionDraft2";

// The Rhythm — Draft 2, built from Sonali's feedback (reshape motion,
// cross-visit progress, loop cue, hover tooltips).
export default function RhythmDraft2Page() {
  return (
    <SectionPreview
      steps={3}
      render={({ initialStep, autoplay }) => (
        <RhythmSectionDraft2
          key={`${initialStep}-${autoplay}`}
          initialStep={initialStep}
          autoplay={autoplay}
        />
      )}
    />
  );
}
