import { useEffect, useRef, useState } from "react";
import {
  type LucideIcon,
  Home, Package, FlaskConical, Layers, Rocket, GitCompare,
  PackageCheck, Tag, Palette, FileText, SlidersHorizontal,
  CheckSquare, Settings, BookOpen, BarChart3,
  Lightbulb, AlertTriangle, Info, Play, Search,
  HelpCircle, ChevronDown
} from "lucide-react";
import { useAppTour } from "@/features/tour/use-app-tour";
import { MODULE_GUIDES, type ModuleGuide } from "./guides";

/* ──────────────────────────────────────────────────────────────
   Icon lookup map (Lucide name → component)
────────────────────────────────────────────────────────────── */
const LUCIDE_MAP: Record<string, LucideIcon> = {
  Home, Package, FlaskConical, Layers, Rocket, GitCompare,
  PackageCheck, Tag, Palette, FileText, SlidersHorizontal,
  CheckSquare, Settings, BookOpen, BarChart3,
};

function GuideIcon({ name, size = 16, className }: { name: string; size?: number; className?: string }) {
  const Icon = LUCIDE_MAP[name] ?? HelpCircle;
  return <Icon size={size} strokeWidth={1.7} className={className} />;
}

/* ──────────────────────────────────────────────────────────────
   Image loader
────────────────────────────────────────────────────────────── */
const imageModules = import.meta.glob("../../assets/help/*.png", { eager: true, import: "default" }) as Record<string, string>;
const helpImageMap = Object.entries(imageModules).reduce<Record<string, string>>((acc, [path, url]) => {
  const filename = path.split("/").pop();
  if (filename) acc[filename] = url;
  return acc;
}, {});

/* ──────────────────────────────────────────────────────────────
   Callout component
────────────────────────────────────────────────────────────── */
function Callout({ type, text }: { type: "tip" | "warning" | "note"; text: string }) {
  const config = {
    tip:     { bg: "bg-emerald-50",  border: "border-emerald-200", Icon: Lightbulb,     label: "Tip",     textCls: "text-emerald-800", iconCls: "text-emerald-600" },
    warning: { bg: "bg-amber-50",    border: "border-amber-200",   Icon: AlertTriangle, label: "Warning", textCls: "text-amber-800",   iconCls: "text-amber-600"   },
    note:    { bg: "bg-blue-50",     border: "border-blue-200",    Icon: Info,          label: "Note",    textCls: "text-blue-800",    iconCls: "text-blue-500"    },
  }[type];
  return (
    <div className={`flex gap-3 rounded-lg border ${config.border} ${config.bg} px-4 py-3`}>
      <config.Icon size={15} strokeWidth={2} className={`mt-0.5 shrink-0 ${config.iconCls}`} />
      <p className={`text-sm leading-relaxed ${config.textCls}`}>
        <span className="font-semibold">{config.label}: </span>{text}
      </p>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Flow step diagram
────────────────────────────────────────────────────────────── */
function FlowDiagram({ steps }: { steps: { label: string; desc: string }[] }) {
  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-max items-start gap-0">
        {steps.map((step, idx) => (
          <div key={step.label} className="flex items-start">
            <div className="flex flex-col items-center">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white shadow">
                {idx + 1}
              </div>
              <div className="mt-2 w-32 text-center">
                <p className="text-xs font-semibold text-slate-800">{step.label}</p>
                <p className="mt-1 text-[11px] leading-snug text-slate-500">{step.desc}</p>
              </div>
            </div>
            {idx < steps.length - 1 && (
              <div className="mx-1 mt-3.5 shrink-0 text-slate-300">
                <svg width="20" height="12" viewBox="0 0 20 12" aria-hidden="true">
                  <path d="M0 6h16M12 1l6 5-6 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Module guide content
────────────────────────────────────────────────────────────── */
function GuideContent({ guide, onZoom }: { guide: ModuleGuide; onZoom: (p: { title: string; imageUrl: string }) => void }) {
  const imageUrl = guide.image ? helpImageMap[guide.image] : undefined;

  return (
    <article className="space-y-8">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <GuideIcon name={guide.icon} size={22} className="text-primary" />
              </div>
              <div>
                <h1 className="font-heading text-2xl font-bold text-slate-900">{guide.label}</h1>
                <p className="mt-0.5 text-sm text-slate-500">{guide.tagline}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Overview + screenshot */}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-heading text-base font-semibold text-slate-900">Overview</h2>
          <div className="mt-3 space-y-3">
            {guide.overview.map((para, i) => (
              <p key={i} className="text-sm leading-relaxed text-slate-600">{para}</p>
            ))}
          </div>
        </section>

        {imageUrl ? (
          <button
            type="button"
            onClick={() => onZoom({ title: guide.label, imageUrl })}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm transition hover:shadow-md"
            title="Click to enlarge"
          >
            <img src={imageUrl} alt={`${guide.label} screenshot`} className="h-full w-full object-cover object-top transition hover:scale-[1.01]" />
          </button>
        ) : (
          <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center">
            <p className="text-xs text-slate-400">Screenshot coming soon</p>
          </div>
        )}
      </div>

      {/* Key Concepts */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-heading text-base font-semibold text-slate-900">Key Concepts</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {guide.concepts.map((c) => (
            <div key={c.term} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-primary">{c.term}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{c.definition}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Workflow / Data Flow */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-heading text-base font-semibold text-slate-900">Workflow &amp; Data Flow</h2>
        <div className="mt-4">
          <FlowDiagram steps={guide.flow} />
        </div>
      </section>

      {/* Step-by-step guides */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-heading text-base font-semibold text-slate-900">How-To Guides</h2>
        <div className="mt-4 space-y-6">
          {guide.howTo.map((section) => (
            <div key={section.title}>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Play size={12} strokeWidth={2} className="text-primary" />
                {section.title}
              </h3>
              <ol className="mt-2 space-y-2 pl-7">
                {section.steps.map((step, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-600">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-[10px] font-bold text-slate-500">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>

      {/* Tips, warnings, notes */}
      {guide.callouts.length > 0 && (
        <section className="space-y-3">
          {guide.callouts.map((c, i) => (
            <Callout key={i} type={c.type} text={c.text} />
          ))}
        </section>
      )}

      {/* FAQ */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-heading text-base font-semibold text-slate-900">Frequently Asked Questions</h2>
        <div className="mt-4 divide-y divide-slate-100">
          {guide.faq.map((item) => (
            <FaqRow key={item.q} q={item.q} a={item.a} />
          ))}
        </div>
      </section>
    </article>
  );
}

function FaqRow({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="py-3">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-4 text-left"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="text-sm font-medium text-slate-800">{q}</span>
        <ChevronDown size={15} strokeWidth={2} className={`mt-0.5 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <p className="mt-2 text-sm leading-relaxed text-slate-600">{a}</p>}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Getting started section
────────────────────────────────────────────────────────────── */
function GettingStartedContent() {
  return (
    <article className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <BookOpen size={22} strokeWidth={1.7} className="text-primary" />
            </div>
          <div>
            <h1 className="font-heading text-2xl font-bold text-slate-900">Getting Started with Tatva</h1>
            <p className="mt-0.5 text-sm text-slate-500">Your end-to-end Product Lifecycle Management platform</p>
          </div>
        </div>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-600">
          <p>Tatva manages the entire lifecycle of a product — from raw material specifications and formula development, through regulatory labeling and artwork proofing, to change control and commercial release. Everything is connected, versioned, and fully auditable.</p>
          <p>The platform is organised around <strong>Containers</strong> — isolated workspaces for a brand, plant, or product line. Select your container in the header before creating any records. All data you create is scoped to that container.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { step: "1", title: "Select a Container", desc: "Choose your brand or plant workspace from the header dropdown. All KPIs, lists, and records will be scoped to this container." },
          { step: "2", title: "Create Your Foundation", desc: "Start with Items (raw materials and finished goods), then build Formulas, FG Structures, and link Documents." },
          { step: "3", title: "Govern & Release", desc: "Submit Release Requests to formally approve and release items and formulas. Use Changes for any modifications post-release." },
        ].map((s) => (
          <div key={s.step} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">{s.step}</div>
            <h3 className="mt-3 font-semibold text-slate-900">{s.title}</h3>
            <p className="mt-1 text-sm text-slate-600">{s.desc}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-heading text-base font-semibold text-slate-900">Core Data Model</h2>
        <p className="mt-2 text-sm text-slate-600">Understanding these relationships is the key to using Tatva effectively:</p>
        <div className="mt-4 space-y-3">
          {[
            { rule: "RM → Formula", desc: "Raw Materials (RM) are the building blocks of Formula recipes. Formulas output a Formulation item (FML)." },
            { rule: "FML → FG Structure", desc: "A Finished Good Structure (BOM) links the formula output (FML) and packaging components (PKG) to the Finished Good (FG) item." },
            { rule: "Formula → Label", desc: "The Labeling module recursively expands the formula tree to generate ingredient declarations and allergen statements." },
            { rule: "Draft → Released", desc: "All objects start as Draft and must go through a Release workflow before they can be used in production or labeling." },
            { rule: "Released → Change → New Revision", desc: "Released objects are immutable. Any change requires a Change Request and creates a new revision — preserving the full audit history." },
          ].map((r) => (
            <div key={r.rule} className="flex gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
              <span className="mt-0.5 shrink-0 text-[11px] font-bold text-primary bg-primary/10 rounded px-2 py-0.5 h-fit whitespace-nowrap">{r.rule}</span>
              <p className="text-sm text-slate-600">{r.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
        <div className="flex items-center gap-2">
          <Lightbulb size={15} strokeWidth={2} className="text-amber-600" />
          <p className="text-sm font-semibold text-amber-800">Pro tip — follow this order for a new product</p>
        </div>
        <ol className="mt-2 space-y-1 pl-4 text-sm text-amber-700 list-decimal">
          <li>Create all RM items and set their allergen flags in Specifications.</li>
          <li>Build the Formula recipe with ingredient percentages.</li>
          <li>Create the FG item and link it to the formula via an FG Structure.</li>
          <li>Upload supporting Documents (SDS, COA) and link them to items.</li>
          <li>Submit a Release Request — Tatva bundles everything automatically.</li>
          <li>Generate the regulatory Label from the released formula.</li>
          <li>Create the Artwork record and manage proofing rounds.</li>
        </ol>
      </div>
    </article>
  );
}

/* ──────────────────────────────────────────────────────────────
   Main page
────────────────────────────────────────────────────────────── */
const NAV_GROUPS = [
  {
    label: "Start Here",
    items: [{ id: "getting-started", label: "Getting Started", icon: "BookOpen" }],
  },
  {
    label: "Core Modules",
    items: MODULE_GUIDES.filter((g) => ["home", "items", "formulas", "fg"].includes(g.id)),
  },
  {
    label: "Execution",
    items: MODULE_GUIDES.filter((g) => ["npd", "changes", "releases", "tasks"].includes(g.id)),
  },
  {
    label: "Reference",
    items: MODULE_GUIDES.filter((g) => ["labeling", "artworks", "documents", "specifications"].includes(g.id)),
  },
  {
    label: "Administration",
    items: MODULE_GUIDES.filter((g) => ["configuration"].includes(g.id)),
  },
];

export function HelpCenterPage(): JSX.Element {
  const [selectedId, setSelectedId] = useState("getting-started");
  const [zoomedImage, setZoomedImage] = useState<{ title: string; imageUrl: string } | null>(null);
  const [search, setSearch] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);
  const { startTour } = useAppTour(false);

  const selectedGuide = MODULE_GUIDES.find((g) => g.id === selectedId);

  // Escape key closes zoom
  useEffect(() => {
    if (!zoomedImage) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setZoomedImage(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [zoomedImage]);

  // Scroll content to top on module change
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [selectedId]);

  const filteredGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) =>
      search === "" ||
      item.label.toLowerCase().includes(search.toLowerCase()) ||
      ("tagline" in item && (item as ModuleGuide).tagline.toLowerCase().includes(search.toLowerCase()))
    ),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="-m-6 flex h-[calc(100vh-4.5rem)] overflow-hidden">
      {/* ── Left sidebar ── */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
        {/* Header */}
        <div className="border-b border-slate-100 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">Help Center</p>
          <h1 className="mt-1 font-heading text-lg font-bold text-slate-900">Tatva Guide</h1>
          <button
            type="button"
            onClick={startTour}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-primary/90 transition"
          >
            <HelpCircle size={14} strokeWidth={2} />
            Take a Guided Tour
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-slate-100">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
            <Search size={13} strokeWidth={2} className="shrink-0 text-slate-400" />
            <input
              type="search"
              placeholder="Search guides…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3">
          {filteredGroups.map((group) => (
            <div key={group.label} className="mb-4 px-3">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = selectedId === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition ${
                        active
                          ? "bg-primary/10 font-semibold text-primary"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <GuideIcon name={item.icon} size={15} className={active ? "text-primary" : "text-slate-400"} />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* ── Main content ── */}
      <div ref={contentRef} className="flex-1 overflow-y-auto bg-mainbg p-6">
        {selectedId === "getting-started" ? (
          <GettingStartedContent />
        ) : selectedGuide ? (
          <GuideContent guide={selectedGuide} onZoom={setZoomedImage} />
        ) : (
          <p className="text-sm text-slate-500">Select a module from the left to read its guide.</p>
        )}
      </div>

      {/* ── Zoomed screenshot modal ── */}
      {zoomedImage ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <button type="button" className="absolute inset-0 h-full w-full" aria-label="Close" onClick={() => setZoomedImage(null)} />
          <div className="relative z-10 max-h-[95vh] w-full max-w-7xl overflow-hidden rounded-xl border border-slate-300 bg-slate-900 p-2 shadow-2xl">
            <div className="mb-2 flex items-center justify-between px-2">
              <p className="text-sm font-medium text-white">{zoomedImage.title}</p>
              <button type="button" onClick={() => setZoomedImage(null)} className="rounded border border-slate-400 px-2 py-1 text-xs text-white hover:bg-slate-800">
                Close ✕
              </button>
            </div>
            <div className="max-h-[86vh] overflow-auto rounded bg-black">
              <img src={zoomedImage.imageUrl} alt={`${zoomedImage.title} zoomed`} className="mx-auto h-auto max-h-[86vh] w-auto max-w-full" />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
