"use client";

import SectionPreview from "@/components/nav/SectionPreview";
import OngoingArcSection from "@/components/sections/OngoingArcSection";

// The Rhythm — Draft 1 ("Ongoing / Arc"), frozen as originally built.
export default function RhythmDraft1Page() {
  return (
    <SectionPreview
      steps={3}
      render={({ initialStep, autoplay }) => (
        <OngoingArcSection
          key={`${initialStep}-${autoplay}`}
          initialStep={initialStep}
          autoplay={autoplay}
        />
      )}
    />
  );
}
