"use client";

import SectionPreview from "@/components/nav/SectionPreview";
import HeroSection from "@/components/sections/HeroSection";

// Hero — Draft 1. This is a real route (`/`), not a tab: it's meant to be
// handed off as its own page in the live repo.
export default function HeroPage() {
  return <SectionPreview render={() => <HeroSection />} />;
}
