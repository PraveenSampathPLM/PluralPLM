const helpScreens = [
  {
    id: "dashboard",
    image: "help-dashboard.png",
    title: "Dashboard",
    summary: "KPIs, recent objects, change request trends, and quick navigation.",
    steps: [
      "Select a container from the header to scope KPIs and lists.",
      "Use the Recent Items/Formulas/BOMs tables to open records.",
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
    id: "bom-list",
    image: "help-bom-list.png",
    title: "BOM List",
    summary: "Finished good and formula BOMs.",
    steps: [
      "FG BOM requires FML + PKG inputs.",
      "Formula BOM consumes RM/FML and outputs a formula.",
      "State badges show Draft/Released."
    ],
    howTo: [
      "Click Create BOM.",
      "Choose FG BOM or Formula BOM type.",
      "Select the parent item (FG or FML).",
      "Add child lines and save."
    ]
  },
  {
    id: "bom-detail",
    image: "help-bom-detail.png",
    title: "BOM Detail",
    summary: "Edit line items and validate structure.",
    steps: [
      "Draft BOMs allow inline edits and reordering.",
      "Validation warns about missing formula line on FG BOMs.",
      "Line numbers auto-increment on save."
    ],
    howTo: [
      "Open a BOM from the list.",
      "Checkout to edit line items.",
      "Add a Formula line if FG BOM.",
      "Add Packaging lines as needed.",
      "Reorder lines and save."
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
      "Add affected items, formulas, or BOMs.",
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
      "Review linked items, formulas, and BOMs collected automatically.",
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
    summary: "Initial release workflows for new items, formulas, and BOMs.",
    steps: [
      "Add BOM/Formula to auto-collect linked objects.",
      "Kick off workflow after submission.",
      "Track tasks in My Tasks."
    ],
    howTo: [
      "Create a Release Request.",
      "Add the BOM or Formula for release.",
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
  image
}: {
  title: string;
  summary: string;
  steps: string[];
  howTo: string[];
  image?: string;
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
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            <img src={imageUrl} alt={`${title} screenshot`} className="h-full w-full object-cover" />
          </div>
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
  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Help Center</p>
        <h1 className="mt-2 font-heading text-2xl font-semibold text-slate-900">Plural PLM Guide</h1>
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
              <a className="block hover:text-primary" href="#screen-bom-list">BOM List</a>
              <a className="block hover:text-primary" href="#screen-bom-detail">BOM Detail</a>
              <a className="block hover:text-primary" href="#screen-specifications">Specifications</a>
              <a className="block hover:text-primary" href="#screen-documents">Documents</a>
              <a className="block hover:text-primary" href="#screen-document-detail">Document Detail</a>
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
              Plural PLM is container-driven. Everything you create is scoped to the selected container and inherits
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
            <p className="mt-2 text-sm text-slate-600">Plural PLM enforces structure rules to keep process recipes valid.</p>
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
                    />
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
