import { useEffect, useState } from "react";

const helpScreens = [
  {
    id: "dashboard",
    image: "help-dashboard.png",
    title: "Dashboard",
    summary: "KPIs, recent objects, change request trends, and quick navigation.",
    steps: [
      "Select a container from the header to scope KPIs and lists.",
      "Use the recent object tables to open records.",
      "Review change request charts to spot bottlenecks."
    ],
    howTo: [
      "Open the Dashboard from the left navigation.",
      "Pick the active container in the header selector.",
      "Click a recent object row to open its detail page.",
      "Use the change charts to drill into Changes if needed."
    ]
  },
  {
    id: "materials",
    image: "help-materials-list.png",
    title: "Materials List",
    summary: "Create and manage RM, FML, FG, and Packaging materials.",
    steps: [
      "Switch tabs to filter by RM, FML, FG, or Packaging.",
      "Use search to find items by code or name.",
      "Only latest versions appear; use History for older revisions."
    ],
    howTo: [
      "Select a material type tab (RM/FML/FG/PKG).",
      "Click Create Material to open the create form.",
      "Fill core attributes, select UOM, and save.",
      "Use the row action menu for checkout/revise/copy/delete."
    ]
  },
  {
    id: "material-detail",
    image: "help-material-detail.png",
    title: "Material Detail",
    summary: "Edit attributes, manage specs, documents, and workflow in one place.",
    steps: [
      "Checkout in Draft to enable editing.",
      "Update attributes in the Details tab.",
      "Add specs and documents before check-in."
    ],
    howTo: [
      "Open a material from the list.",
      "Click Checkout (Draft only) to unlock fields.",
      "Edit attributes and save changes.",
      "Open the Specifications tab to add spec rows.",
      "Use Link Document to attach documents.",
      "Check in to lock the revision."
    ]
  },
  {
    id: "formulation-list",
    image: "help-formulation-list.png",
    title: "Formulation List",
    summary: "Create and manage formula recipes.",
    steps: [
      "Formula recipes output FML items.",
      "Inputs are RM or intermediate FML only.",
      "Validate percent totals before release."
    ],
    howTo: [
      "Click Create Formulation.",
      "Select the output Formula (FML).",
      "Add ingredient lines and set percentages.",
      "Save in Draft and review validations."
    ]
  },
  {
    id: "formulation-detail",
    image: "help-formulation-detail.png",
    title: "Formulation Detail",
    summary: "Build line items and manage formula structure.",
    steps: [
      "Add inputs with percentages and UOMs.",
      "Use line ordering to control process sequence.",
      "Workflow tab shows current approvals."
    ],
    howTo: [
      "Open a formulation from the list.",
      "Checkout to edit the line items.",
      "Add RM or intermediate formula inputs.",
      "Use drag/reorder to adjust sequence.",
      "Submit for release when ready."
    ]
  },
  {
    id: "fg-structures",
    image: "help-fg-list.png",
    title: "FG Structures",
    summary: "Create and manage Finished Good structures in one place.",
    steps: [
      "FG structure parent is the Finished Good item.",
      "Children should include formula output and packaging lines.",
      "Use actions for checkout/checkin/revise/copy/delete."
    ],
    howTo: [
      "Open FG Structures from the left navigation.",
      "Create a structure for the selected FG item.",
      "Add formula and packaging child lines with quantity and UOM.",
      "Save draft, validate, then check in when ready."
    ]
  },
  {
    id: "fg-structure-detail",
    image: "help-fg-detail.png",
    title: "FG Structure Detail",
    summary: "Edit structure lines, validate composition, and track version history.",
    steps: [
      "Draft structures allow inline edits.",
      "Use line ordering to control packaging execution sequence.",
      "History tab shows prior structure revisions."
    ],
    howTo: [
      "Open an FG structure from the FG list.",
      "Checkout to edit lines.",
      "Update formula/packaging lines and save.",
      "Review warnings, then check in."
    ]
  },
  {
    id: "specifications",
    image: "help-specifications.png",
    title: "Specification Templates",
    summary: "Configure spec attributes used by items and formulas.",
    steps: [
      "Add spec fields by category.",
      "Changes reflect across item/formula spec editors.",
      "Use units from the UOM configuration."
    ],
    howTo: [
      "Open Specifications from the left nav.",
      "Select the industry and attribute group.",
      "Add spec fields with min/max and units.",
      "Save to make them available to items and formulas."
    ]
  },
  {
    id: "documents",
    image: "help-documents.png",
    title: "Documents",
    summary: "Upload, classify, and link documents to materials and formulas.",
    steps: [
      "Drag and drop files to auto-name documents.",
      "Set classification and type before saving.",
      "Link documents from item/formula detail pages."
    ],
    howTo: [
      "Open Documents and click Upload.",
      "Drag a file onto the drop zone.",
      "Confirm name, classification, and type.",
      "Save to generate the document number."
    ]
  },
  {
    id: "document-detail",
    image: "help-document-detail.png",
    title: "Document Detail",
    summary: "View metadata, linked objects, and version information for a document.",
    steps: [
      "Review classification, numbering, and linked items/formulas.",
      "Use the right panel to update attributes where allowed.",
      "Check the history tab for previous revisions."
    ],
    howTo: [
      "Open a document from the list.",
      "Review metadata and linked objects.",
      "Use the action menu for revisions if needed."
    ]
  },
  {
    id: "artworks",
    image: "help-artworks.png",
    title: "Artwork Management",
    summary: "Create and track artwork records linked to FG, formula, and release objects.",
    steps: [
      "Use Create Artwork to capture legal copy, warnings, and market context.",
      "Link FG and formula so release/change impact stays connected.",
      "Use row Actions for checkout/checkin/revise/copy/delete."
    ],
    howTo: [
      "Open Artworks from the left navigation.",
      "Click Create Artwork and fill title, market, claims, and links.",
      "Save to auto-generate the artwork number.",
      "Open a row to manage components, proofs, and compliance."
    ]
  },
  {
    id: "artwork-detail",
    image: "help-artwork-detail.png",
    title: "Artwork Detail and Proofing",
    summary: "Manage artwork components, upload proofs, annotate, preview files, and delete obsolete proofs.",
    steps: [
      "Proofing tab supports PDF/image inline preview in a large panel.",
      "Design-native formats like .ai show a fallback message and download option.",
      "Delete Proof removes the file record and storage file.",
      "If a file is missing on storage, download/preview returns a safe 404 message."
    ],
    howTo: [
      "Open an artwork record and go to Proofing.",
      "Upload SOURCE/PROOF/FINAL files and assign to a component if needed.",
      "Pick a file from the list to load preview in the right panel.",
      "Add annotations from the Annotate File dropdown.",
      "Use Delete Proof for obsolete files."
    ]
  },
  {
    id: "changes",
    image: "help-changes.png",
    title: "Change Requests",
    summary: "Manage changes and capture downstream impact.",
    steps: [
      "Add affected objects to auto-collect linked data.",
      "Workflow status is visible on the change record.",
      "Use tasks to complete approvals."
    ],
    howTo: [
      "Create a Change Request from the list or from an item action.",
      "Add affected items and formulas.",
      "Review the auto-collected impact list.",
      "Submit to start the workflow."
    ]
  },
  {
    id: "change-detail",
    image: "help-change-detail.png",
    title: "Change Request Detail",
    summary: "Track impact, linked objects, and workflow progress for a change.",
    steps: [
      "Review linked items and formulas collected automatically.",
      "Use the workflow tab to see current task ownership.",
      "Submit or complete tasks to advance the change."
    ],
    howTo: [
      "Open a Change Request.",
      "Review the Impact panel for downstream objects.",
      "Open the Workflow tab for current task status.",
      "Complete tasks assigned to you."
    ]
  },
  {
    id: "releases",
    image: "help-releases.png",
    title: "Release Requests",
    summary: "Initial release workflows for new items and formulas.",
    steps: [
      "Add formula/FG structures to auto-collect linked objects.",
      "Kick off workflow after submission.",
      "Track tasks in My Tasks."
    ],
    howTo: [
      "Create a Release Request.",
      "Add the formula or FG structure for release.",
      "Review the collected objects list.",
      "Submit to start approvals."
    ]
  },
  {
    id: "release-detail",
    image: "help-release-detail.png",
    title: "Release Request Detail",
    summary: "Validate release package contents and approvals.",
    steps: [
      "Confirm all linked objects are included in the release bundle.",
      "Review workflow status and assigned approvers.",
      "Advance tasks to complete release."
    ],
    howTo: [
      "Open a Release Request.",
      "Review linked objects and statuses.",
      "Complete assigned workflow tasks."
    ]
  },
  {
    id: "tasks",
    image: "help-tasks.png",
    title: "My Tasks",
    summary: "All workflow tasks assigned to you.",
    steps: [
      "Use the notification bell for quick access.",
      "Open a task to see routing and action options.",
      "Complete tasks to advance workflows."
    ],
    howTo: [
      "Click the bell icon to preview tasks.",
      "Open My Tasks to view all assignments.",
      "Open a task to see action options.",
      "Complete the task to advance workflow."
    ]
  },
  {
    id: "labeling",
    image: "help-labeling.png",
    title: "Labeling",
    summary: "Generate ingredient and nutrition statements.",
    steps: [
      "FG labels roll up formula ingredients only.",
      "Packaging is excluded from ingredient lists.",
      "Nutrition is pulled from formula specs."
    ],
    howTo: [
      "Open Labeling.",
      "Select the Finished Good.",
      "Review ingredient roll-up and nutrition facts.",
      "Export label content when ready."
    ]
  },
  {
    id: "configuration",
    image: "help-configuration.png",
    title: "Configuration",
    summary: "Configure numbering, revisions, UOMs, attributes, workflows, and mail.",
    steps: [
      "Use numbering to control auto-IDs for all entities.",
      "Define UOM lists for dropdowns.",
      "Configure mail server to enable workflow email."
    ],
    howTo: [
      "Open Configuration from the left nav.",
      "Select the module (UOM, Numbering, Revisions, etc.).",
      "Update settings and save changes.",
      "Return to the application to see updates."
    ]
  }
];

const imageModules = import.meta.glob("../../assets/help/*.png", { eager: true, import: "default" }) as Record<string, string>;
const helpImageMap = Object.entries(imageModules).reduce<Record<string, string>>((acc, [path, url]) => {
  const filename = path.split("/").pop();
  if (filename) {
    acc[filename] = url;
  }
  return acc;
}, {});

function HelpScreenCard({
  title,
  summary,
  steps,
  howTo,
  image,
  onZoom
}: {
  title: string;
  summary: string;
  steps: string[];
  howTo: string[];
  image?: string;
  onZoom?: (payload: { title: string; imageUrl: string }) => void;
}): JSX.Element {
  const imageUrl = image ? helpImageMap[image] : undefined;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <h3 className="font-heading text-lg font-semibold text-slate-900">{title}</h3>
          <p className="mt-2 text-sm text-slate-600">{summary}</p>
          <div className="mt-3 space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Key Points</p>
              <ul className="mt-2 list-disc pl-5 text-sm text-slate-600">
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Step-by-Step</p>
              <ol className="mt-2 list-decimal pl-5 text-sm text-slate-600">
                {howTo.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          </div>
        </div>
        {imageUrl ? (
          <button
            type="button"
            onClick={() => onZoom?.({ title, imageUrl })}
            className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-left"
          >
            <img src={imageUrl} alt={`${title} screenshot`} className="h-full w-full object-cover transition duration-200 hover:scale-[1.01]" />
          </button>
        ) : (
          <div className="flex h-full min-h-[180px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center text-xs text-slate-500">
            <div className="space-y-2 px-4">
              <p className="font-medium text-slate-600">Screenshot placeholder</p>
              <p>Add a screenshot for this screen to the Help Center.</p>
              <p className="text-[11px] text-slate-400">You can drop images into /packages/frontend/src/assets/help.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function HelpCenterPage(): JSX.Element {
  const [zoomedImage, setZoomedImage] = useState<{ title: string; imageUrl: string } | null>(null);

  useEffect(() => {
    if (!zoomedImage) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setZoomedImage(null);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [zoomedImage]);

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Help Center</p>
        <h1 className="mt-2 font-heading text-2xl font-semibold text-slate-900">Tatva Guide</h1>
        <p className="mt-2 text-sm text-slate-600">
          This guide explains each screen, the required actions, and how data flows through the PLM lifecycle. Add
          screenshots to make this a complete training reference for new users.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Contents</p>
          <nav className="mt-3 space-y-4 text-sm text-slate-700">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Overview</p>
              <a className="block hover:text-primary" href="#getting-started">Getting Started</a>
              <a className="block hover:text-primary" href="#data-model">Data Model Rules</a>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Core Screens</p>
              <a className="block hover:text-primary" href="#screen-dashboard">Dashboard</a>
              <a className="block hover:text-primary" href="#screen-materials">Materials List</a>
              <a className="block hover:text-primary" href="#screen-material-detail">Material Detail</a>
              <a className="block hover:text-primary" href="#screen-formulation-list">Formulation List</a>
              <a className="block hover:text-primary" href="#screen-formulation-detail">Formulation Detail</a>
              <a className="block hover:text-primary" href="#screen-fg-structures">FG Structures</a>
              <a className="block hover:text-primary" href="#screen-fg-structure-detail">FG Structure Detail</a>
              <a className="block hover:text-primary" href="#screen-specifications">Specifications</a>
              <a className="block hover:text-primary" href="#screen-documents">Documents</a>
              <a className="block hover:text-primary" href="#screen-document-detail">Document Detail</a>
              <a className="block hover:text-primary" href="#screen-artworks">Artwork Management</a>
              <a className="block hover:text-primary" href="#screen-artwork-detail">Artwork Detail</a>
              <a className="block hover:text-primary" href="#screen-labeling">Labeling</a>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Governance</p>
              <a className="block hover:text-primary" href="#screen-changes">Change Requests</a>
              <a className="block hover:text-primary" href="#screen-change-detail">Change Detail</a>
              <a className="block hover:text-primary" href="#screen-releases">Release Requests</a>
              <a className="block hover:text-primary" href="#screen-release-detail">Release Detail</a>
              <a className="block hover:text-primary" href="#screen-tasks">My Tasks</a>
              <a className="block hover:text-primary" href="#screen-configuration">Configuration</a>
            </div>
          </nav>
        </aside>

        <div className="space-y-6">
          <section id="getting-started" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-heading text-lg font-semibold text-slate-900">Getting Started</h2>
            <p className="mt-2 text-sm text-slate-600">
              Tatva is container-driven. Everything you create is scoped to the selected container and inherits
              its industry context. Start every session by confirming the active container.
            </p>
            <div className="mt-4 grid gap-3 text-sm text-slate-700">
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <span className="font-medium text-slate-800">Step 1:</span> Select a container from the header.
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <span className="font-medium text-slate-800">Step 2:</span> Create materials, then define formula and FG structures.
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <span className="font-medium text-slate-800">Step 3:</span> Submit release or change requests to trigger workflow.
              </div>
            </div>
          </section>

          <section id="data-model" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-heading text-lg font-semibold text-slate-900">Core Data Model Rules</h2>
            <p className="mt-2 text-sm text-slate-600">Tatva enforces structure rules to keep process recipes valid.</p>
            <ul className="mt-3 list-disc pl-5 text-sm text-slate-600">
              <li>FG BOM: parent FG, inputs must be Formula + Packaging.</li>
              <li>Formula recipe: parent FML, inputs must be RM or intermediate FML.</li>
              <li>Specifications are configured centrally but created on items/formulas.</li>
              <li>Only latest versions appear in lists; prior revisions are in History.</li>
              <li>Checkout is allowed only in Draft; check-in locks editing.</li>
            </ul>
          </section>

          <section id="screens" className="space-y-4">
            <h2 className="font-heading text-lg font-semibold text-slate-900">Screen-by-Screen Help</h2>
            <div className="space-y-4">
              {helpScreens.map((screen) => {
                const anchor = `screen-${screen.id}`;
                return (
                  <div key={screen.id} id={anchor} className="scroll-mt-24">
                    <HelpScreenCard
                      title={screen.title}
                      summary={screen.summary}
                      steps={screen.steps}
                      howTo={screen.howTo}
                      image={screen.image}
                      onZoom={setZoomedImage}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </section>

      {zoomedImage ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <button type="button" className="absolute inset-0 h-full w-full" aria-label="Close screenshot zoom" onClick={() => setZoomedImage(null)} />
          <div className="relative z-10 max-h-[95vh] w-full max-w-7xl overflow-hidden rounded-xl border border-slate-300 bg-slate-900 p-2 shadow-2xl">
            <div className="mb-2 flex items-center justify-between px-2">
              <p className="text-sm font-medium text-white">{zoomedImage.title}</p>
              <button type="button" onClick={() => setZoomedImage(null)} className="rounded border border-slate-400 px-2 py-1 text-xs text-white">
                Close
              </button>
            </div>
            <div className="max-h-[86vh] overflow-auto rounded bg-black">
              <img src={zoomedImage.imageUrl} alt={`${zoomedImage.title} zoomed screenshot`} className="mx-auto h-auto max-h-[86vh] w-auto max-w-full" />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
