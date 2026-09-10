"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type NavItem = { href: string; label: string };
type NavGroup = { label: string; items: NavItem[] };

// Each entry here is a real route (see src/app/**/page.tsx) — picking a draft
// navigates there, it doesn't just swap state on one page. That's deliberate:
// each route is meant to hand off as its own page in the live repo.
const NAV: NavGroup[] = [
  { label: "Hero", items: [{ href: "/", label: "Draft 1" }] },
  {
    label: "The Rhythm",
    items: [
      { href: "/rhythm/draft-1", label: "Draft 1" },
      { href: "/rhythm/draft-2", label: "Draft 2" },
    ],
  },
];

// Static export can settle the browser's URL with or without a trailing
// slash depending on how the page was reached (hard load vs. client-side
// <Link> transition) — compare paths with slashes normalized away so the
// active nav item doesn't silently fall back to the wrong one.
const normalize = (path: string) => path.replace(/\/+$/, "") || "/";

function NavDropdown({ group }: { group: NavGroup }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = normalize(usePathname());
  const activeItem =
    group.items.find((i) => normalize(i.href) === pathname) ?? group.items[0];
  const isActiveGroup = group.items.some((i) => normalize(i.href) === pathname);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
          open || isActiveGroup
            ? "bg-zinc-100 text-zinc-900"
            : "bg-zinc-900 text-zinc-200 hover:text-white"
        }`}
      >
        {group.label}
        {group.items.length > 1 && (
          <span
            className={isActiveGroup ? "text-zinc-500" : "text-[10px] text-zinc-500"}
          >
            {activeItem.label}
          </span>
        )}
        <span
          className="material-symbols-outlined text-sm transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "none" }}
          aria-hidden="true"
        >
          keyboard_arrow_down
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-[calc(100%+6px)] z-20 min-w-[140px] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 py-1 shadow-xl shadow-black/40"
        >
          {group.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs transition-colors ${
                normalize(item.href) === pathname
                  ? "text-white"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              }`}
            >
              {item.label}
              {normalize(item.href) === pathname && (
                <span
                  className="material-symbols-outlined text-sm"
                  aria-hidden="true"
                >
                  check
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// Nav lives in the root layout (shared across every route); the Auto/step-pin
// /viewport controls live inside each page (they're page-local state — a
// different page can have a different step count, or none at all). This
// context bridges the two so they still render as one visual row: the layout
// exposes a slot <div> in the header, and each page portals its own controls
// into it. Nothing is lifted — each page still owns its own control state.
const HeaderSlotContext = createContext<HTMLDivElement | null>(null);

export function useHeaderControlsSlot() {
  return useContext(HeaderSlotContext);
}

export default function AppChrome({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);

  return (
    <HeaderSlotContext.Provider value={slot}>
      <header className="flex flex-none flex-wrap items-center gap-x-6 gap-y-3 border-b border-zinc-900 px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-zinc-100"
        >
          Kairo
        </Link>
        <nav className="flex flex-wrap items-center gap-2">
          {NAV.map((group) => (
            <NavDropdown key={group.label} group={group} />
          ))}
        </nav>
        {/* page-local controls (Auto/step-pin/Desktop-Mobile) portal in here */}
        <div
          ref={setSlot}
          className="flex flex-wrap items-center gap-2 sm:ml-auto"
        />
      </header>
      {children}
    </HeaderSlotContext.Provider>
  );
}
