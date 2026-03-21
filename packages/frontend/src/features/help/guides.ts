export type Callout = { type: "tip" | "warning" | "note"; text: string };
export type FaqItem = { q: string; a: string };
export type Concept = { term: string; definition: string };
export type FlowStep = { label: string; desc: string };

export interface ModuleGuide {
  id: string;
  label: string;
  icon: string; // emoji used as icon
  tagline: string;
  overview: string[];
  concepts: Concept[];
  flow: FlowStep[];
  howTo: { title: string; steps: string[] }[];
  callouts: Callout[];
  faq: FaqItem[];
  image?: string;
}

export const MODULE_GUIDES: ModuleGuide[] = [
  // ─── HOME ────────────────────────────────────────────────────
  {
    id: "home",
    label: "Home",
    icon: "🏠",
    tagline: "Real-time KPIs across your entire PLM portfolio",
    image: "help-dashboard.png",
    overview: [
      "The Home screen is your command centre. It consolidates the most important metrics across every module into a single view so you can spot issues, track progress, and navigate to detail pages without switching between sections.",
      "All data on the Home screen is scoped to the container you select in the top-right header. Switching containers instantly refreshes every widget — useful when you manage multiple brands or plants in the same Tatva instance.",
      "KPI tiles show live counts of open Changes, active Formulas, pending Release approvals, and overdue NPD gates. Charts break down Change Request volume by month and status, giving you a visual trend at a glance."
    ],
    concepts: [
      { term: "Container", definition: "An isolated workspace for a brand, plant, or product line. All records — items, formulas, changes — belong to one container." },
      { term: "KPI Tile", definition: "A summary metric card. Clicking a tile navigates to the filtered list that produces the count." },
      { term: "Recent Objects", definition: "The last 20 records touched by any user in the active container. Quick shortcut back to in-progress work." }
    ],
    flow: [
      { label: "Select Container", desc: "Pick the brand or plant scope from the header dropdown." },
      { label: "Review KPI Tiles", desc: "Scan open changes, pending releases, active formulas, and overdue NPD gates." },
      { label: "Inspect Charts", desc: "Change request trends by month highlight bottlenecks or spikes." },
      { label: "Open Recent Object", desc: "Click any row in the recent list to jump directly to that record." }
    ],
    howTo: [
      {
        title: "Switching containers",
        steps: [
          "Click the container selector in the top header bar.",
          "Choose the brand or plant workspace you want to work in.",
          "All tiles, charts, and recent lists refresh automatically."
        ]
      },
      {
        title: "Drilling into a KPI",
        steps: [
          "Click any KPI tile (e.g., 'Open Changes').",
          "The list page opens pre-filtered to match exactly the KPI condition.",
          "Use list filters to narrow further if needed."
        ]
      }
    ],
    callouts: [
      { type: "tip", text: "Pin the Home page as your browser start page for daily PLM health checks." },
      { type: "note", text: "KPI counts only reflect the selected container. 'All Accessible Containers' shows the aggregate across every container you have access to." }
    ],
    faq: [
      { q: "Why are my KPI tiles showing zero?", a: "Check that a container is selected in the header. An empty container selector will aggregate across all containers you have access to, and some may genuinely be empty." },
      { q: "Can I customise which KPIs appear?", a: "Not yet — the dashboard tiles are fixed to the most commonly used PLM health metrics. Custom dashboards are on the roadmap." }
    ]
  },

  // ─── ITEMS ───────────────────────────────────────────────────
  {
    id: "items",
    label: "Items",
    icon: "📦",
    tagline: "The master registry for every material in your product portfolio",
    image: "help-materials-list.png",
    overview: [
      "Items are the fundamental building blocks in Tatva. Every raw material, intermediate formula, finished good, and packaging component is represented as an Item. Each Item has a unique system-generated Item Code and follows a strict lifecycle from Draft through to Obsolete.",
      "Tatva supports four Item types: Raw Material (RM), Formulation (FML), Finished Good (FG), and Packaging (PKG). The type determines which objects can reference the item — for example, only RM and FML types can be used as inputs in a formula recipe.",
      "Items are versioned. When a released item needs to change, you create a new revision rather than editing the released record. This preserves a complete audit trail and ensures traceability for regulatory purposes."
    ],
    concepts: [
      { term: "Item Code", definition: "A system-generated, container-scoped unique identifier (e.g. RM-0042). Codes are defined in Configuration → Numbering." },
      { term: "Item Type", definition: "RM (Raw Material), FML (Formulation intermediate), FG (Finished Good), PKG (Packaging). Controls which BOMs and formulas the item can appear in." },
      { term: "Revision", definition: "A version of an item record. Only the latest revision appears in lists; older revisions are accessible via the History tab." },
      { term: "Lifecycle Status", definition: "Draft → In Review → Released → Obsolete. Editing is only possible in Draft status after a Checkout." },
      { term: "Checkout / Check-in", definition: "Checkout puts a Draft item into an editable state (locked from others). Check-in saves and locks the item for review or release." },
      { term: "Specification", definition: "A set of measurable attributes (pH, viscosity, particle size, etc.) defined per item and validated against min/max limits configured in Specification Templates." }
    ],
    flow: [
      { label: "Create Item", desc: "Provide the item name, type, and base attributes. The system assigns a unique Item Code." },
      { label: "Checkout (Draft)", desc: "Click Checkout to unlock the form for editing." },
      { label: "Add Details", desc: "Fill attributes, add specifications, link documents, and set UOM." },
      { label: "Check-in", desc: "Save and lock the draft. Status moves to 'In Review' once a Release Request is submitted." },
      { label: "Release", desc: "Approved Release Request moves status to Released. Item is now available in formulas and BOMs." },
      { label: "Revise / Obsolete", desc: "Create a new revision for future changes, or mark as Obsolete when discontinued." }
    ],
    howTo: [
      {
        title: "Creating a new item",
        steps: [
          "Go to Items in the left navigation.",
          "Select the correct type tab: RM, FML, FG, or PKG.",
          "Click 'Create Item' and fill the name, description, and base attributes.",
          "Save — the system auto-assigns the Item Code.",
          "Click 'Checkout' to enter edit mode.",
          "Add specifications, link documents, and confirm UOM.",
          "Click 'Check-in' when ready for review."
        ]
      },
      {
        title: "Revising a released item",
        steps: [
          "Find the released item in the list.",
          "Open the row action menu and select 'Revise'.",
          "A new Draft revision is created. The previous revision is preserved in History.",
          "Checkout and edit the new revision.",
          "Submit a Change Request or Release Request to promote the revision."
        ]
      },
      {
        title: "Adding specifications",
        steps: [
          "Open an item in Draft/Checkout state.",
          "Go to the Specifications tab.",
          "Click 'Add Spec' and select the attribute group.",
          "Enter min, max, and target values.",
          "Save before checking in."
        ]
      }
    ],
    callouts: [
      { type: "tip", text: "Use the Copy action to duplicate an existing item with similar attributes. This saves time when creating variants of the same material." },
      { type: "warning", text: "You cannot change the Item Type after creation. Choose RM, FML, FG, or PKG carefully — the type controls which formulas and BOMs the item can appear in." },
      { type: "note", text: "Only the latest revision appears in the item list. Click into an item and open the History tab to view and compare prior revisions." }
    ],
    faq: [
      { q: "Can I delete an item?", a: "Draft items that have never been released can be deleted. Released items can only be set to Obsolete to preserve the audit trail." },
      { q: "Why can't I edit the item?", a: "You need to Checkout the item first. Only Draft-status items can be checked out. If the item is Released, you need to Revise it to create an editable Draft copy." },
      { q: "What is the difference between FML and FG?", a: "FML (Formulation) is an intermediate or bulk recipe output used as an ingredient in other formulas. FG (Finished Good) is the final consumer-facing product. FG items can have an FG Structure (BOM) linking them to formula + packaging." },
      { q: "Can two items share the same name?", a: "Yes — names are not unique. Only the system-generated Item Code is guaranteed unique within a container." }
    ]
  },

  // ─── FORMULAS ────────────────────────────────────────────────
  {
    id: "formulas",
    label: "Formulas",
    icon: "⚗️",
    tagline: "Build, version, and release multi-level product recipes",
    image: "help-formulation-list.png",
    overview: [
      "A Formula in Tatva is a versioned recipe that describes how to combine ingredients to produce a Formulation (FML) item. Each formula line defines an ingredient (RM or FML), its quantity or percentage contribution, and optionally its process sequence.",
      "Formulas can be multi-level — an ingredient in one formula can itself be the output of another formula. When Tatva generates a regulatory label, it recursively walks the entire formula tree, flattening all ingredients down to their raw material leaf nodes and aggregating weights by component.",
      "Every formula change creates a new version rather than overwriting the existing record. Released formulas are immutable. This guarantees that any label generated at any point in time can be reproduced exactly from the historical formula version."
    ],
    concepts: [
      { term: "Formula Output", definition: "The FML item that this recipe produces. Set once on creation and cannot be changed." },
      { term: "Formula Line", definition: "A single ingredient row: input item, quantity/percentage, UOM, and optional process step." },
      { term: "Percentage Validation", definition: "Total ingredient percentages must equal 100% (or within tolerance) before a formula can be submitted for release." },
      { term: "Multi-level Formula", definition: "A formula whose ingredients include other FML items (sub-formulas). Tatva resolves these recursively for labeling and impact analysis." },
      { term: "Formula Version", definition: "A numbered snapshot (V1, V2 …) of the recipe. Versions are immutable once released." },
      { term: "Process Step", definition: "An optional ordering field on a formula line that defines the manufacturing sequence (mixing, blending, etc.)." }
    ],
    flow: [
      { label: "Create Formula", desc: "Select the FML output item. The system generates a Formula number." },
      { label: "Add Lines", desc: "Add ingredient rows (RM or FML inputs), enter percentages and UOM." },
      { label: "Validate", desc: "Confirm totals sum to 100%. Fix any validation warnings before proceeding." },
      { label: "Submit Release", desc: "Attach the formula to a Release Request to trigger the approval workflow." },
      { label: "Release", desc: "Approved formula moves to Released state and becomes available for labeling and FG structures." },
      { label: "Revise", desc: "Create a new version to update ingredients. The previous version is preserved in History." }
    ],
    howTo: [
      {
        title: "Building a formula from scratch",
        steps: [
          "Navigate to Formulas and click 'Create Formula'.",
          "Select the FML output item from the item picker.",
          "Add ingredient lines: choose the RM or FML input, set percentage, and UOM.",
          "Repeat for all ingredients until the percentage total reaches 100%.",
          "Click Save — the system validates totals and highlights any errors.",
          "Submit a Release Request when the formula is ready for approval."
        ]
      },
      {
        title: "Creating a multi-level formula",
        steps: [
          "First create and release the sub-formula (the intermediate FML item).",
          "In the parent formula, add the FML item as an ingredient line.",
          "Set the percentage contribution of the sub-formula in the parent.",
          "When generating labels, Tatva will recursively expand the sub-formula into its raw material components."
        ]
      },
      {
        title: "Revising a released formula",
        steps: [
          "Open the released formula from the list.",
          "Click 'Revise' from the action menu.",
          "A new Draft version is created (V2, V3, etc.).",
          "Edit ingredient lines in the new version.",
          "Submit via a Change Request or Release Request to approve the new version."
        ]
      }
    ],
    callouts: [
      { type: "tip", text: "Use intermediate FML items to model modular bases or concentrates that appear across multiple finished goods. Changes to the base automatically propagate impact through all parent formulas." },
      { type: "warning", text: "Never delete a released formula version — it is referenced by historical labels and may be required for regulatory audits." },
      { type: "note", text: "Ingredient sort order in the final label is determined by descending weight, not the order you entered lines. Tatva handles this automatically during label generation." }
    ],
    faq: [
      { q: "Can I use the same ingredient twice in one formula?", a: "No — each ingredient item can appear only once per formula version. Use quantity/percentage to set the correct contribution." },
      { q: "My percentages add up to 100 but the validation still fails. Why?", a: "Check for floating-point rounding. Tatva uses two decimal precision. Adjust the last line's percentage to absorb any sub-0.01% remainder." },
      { q: "Can packaging items be added to a formula?", a: "No — formulas only accept RM and FML inputs. Packaging is added at the FG Structure level, not the formula level." },
      { q: "How are water-of-crystallisation and carry-over solvents handled?", a: "Model each as separate RM lines with the appropriate percentage. The label generator will include them unless you mark them as 'carry-over exempt' in their item spec." }
    ]
  },

  // ─── FG STRUCTURES ───────────────────────────────────────────
  {
    id: "fg",
    label: "FG Structures",
    icon: "🏗️",
    tagline: "Bill of Materials linking finished goods to formula and packaging",
    image: "help-bom-list.png",
    overview: [
      "An FG Structure (also called an FG BOM) defines the complete assembly of a Finished Good — which formula produces the product content, and which packaging components house it. Where a formula describes 'what the product is made of', the FG Structure describes 'how the complete product is assembled'.",
      "The parent of every FG Structure must be an FG item. Child lines fall into two categories: the formula output (FML item) that provides the product content, and packaging components (PKG items) such as bottles, closures, labels, and cartons.",
      "FG Structures are versioned and follow the same checkout/check-in lifecycle as items and formulas. They are used by the Release module to bundle the formula, FG item, and packaging into a single approval package."
    ],
    concepts: [
      { term: "FG Structure Parent", definition: "The Finished Good (FG) item at the top of the structure. Each FG item can have one active structure revision." },
      { term: "Formula Line", definition: "The FML child line — points to the formula output item that provides the product content." },
      { term: "Packaging Line", definition: "A PKG child line representing a packaging component (bottle, cap, label, outer carton, etc.) with quantity and UOM." },
      { term: "Structure Revision", definition: "Versioned snapshot of the complete assembly. Released revisions are immutable." }
    ],
    flow: [
      { label: "Select FG Item", desc: "Choose the finished good that this structure describes." },
      { label: "Add Formula Line", desc: "Link the FML item output from the appropriate formula." },
      { label: "Add Packaging Lines", desc: "Add each PKG component with quantity (e.g. 1 × 500ml bottle, 1 × closure, 1 × label)." },
      { label: "Validate", desc: "Review the structure for completeness — at least one formula line is required." },
      { label: "Release", desc: "Submit via a Release Request. All child items and the formula must also be Released." }
    ],
    howTo: [
      {
        title: "Creating an FG Structure",
        steps: [
          "Navigate to FG Structures and click 'Create Structure'.",
          "Select the parent FG item from the picker.",
          "Click 'Add Line' and choose the FML formula output as the first child.",
          "Add further lines for each packaging component (bottle, closure, label, etc.).",
          "Set quantity and UOM for each packaging line.",
          "Save and check in when complete.",
          "Submit a Release Request to formally release the structure."
        ]
      }
    ],
    callouts: [
      { type: "warning", text: "The formula linked in the FG Structure must be Released before the structure can be released. Release all dependent formulas first." },
      { type: "tip", text: "Use the Copy action to clone an FG structure when creating market variants (different pack sizes, markets, etc.) of the same product." },
      { type: "note", text: "Packaging lines are intentionally excluded from ingredient label generation. Only the formula lines (and their recursive ingredients) flow into the Labeling module." }
    ],
    faq: [
      { q: "Can an FG Structure have multiple formula lines?", a: "Currently one formula line per structure is the standard model. If your FG blends two formulas at fill, model a top-level FML that combines both sub-formulas, then reference that in the FG structure." },
      { q: "Do packaging items need specifications?", a: "Specifications on PKG items are optional but recommended for quality control purposes (e.g. HDPE grade, closure torque range)." }
    ]
  },

  // ─── NPD ─────────────────────────────────────────────────────
  {
    id: "npd",
    label: "NPD Projects",
    icon: "🚀",
    tagline: "Stage-gate pipeline to manage new product development end-to-end",
    image: "help-dashboard.png",
    overview: [
      "NPD Projects manage the full journey of a new product from initial concept through to commercial launch. Tatva uses a stage-gate model: each project moves through defined phases (Discovery → Feasibility → Development → Validation → Launch), and gate reviews must be completed before advancing to the next stage.",
      "Each NPD project is linked to an FG item and optionally to formula, FG structure, artwork, and release records. This provides full traceability from business brief to released commercial product.",
      "Gate reviews capture who approved the phase transition, when, and any conditions attached. Every decision is time-stamped and attributed to the approving user, providing a full audit record for stage-gate governance."
    ],
    concepts: [
      { term: "Stage", definition: "A phase in the product development lifecycle: Discovery, Feasibility, Development, Validation, Launch." },
      { term: "Gate", definition: "A formal decision checkpoint between stages. A gate review must be completed (with a Go / No-Go / Hold decision) before the project advances." },
      { term: "Gate Decision", definition: "Go (advance to next stage), No-Go (terminate or return to prior stage), or Hold (pause pending information)." },
      { term: "Project Owner", definition: "The user responsible for progressing the NPD project and submitting gate reviews." },
      { term: "Linked Objects", definition: "The FG item, formula, FG structure, artwork, and release records associated with this NPD project." }
    ],
    flow: [
      { label: "Create Project", desc: "Define the project name, objective, target launch date, and responsible team." },
      { label: "Discovery Stage", desc: "Capture the concept, market opportunity, and initial feasibility assumptions." },
      { label: "Gate 1 Review", desc: "Submit gate review for Go/No-Go decision to proceed to Feasibility." },
      { label: "Feasibility Stage", desc: "Confirm technical feasibility, cost model, and regulatory requirements." },
      { label: "Gate 2 → Development", desc: "Approved gate unlocks Development stage: formula work, pack design, artwork briefing." },
      { label: "Gate 3 → Validation", desc: "Development complete. Move to plant trials, stability, and regulatory submission." },
      { label: "Gate 4 → Launch", desc: "Validation signed off. Proceed to commercial release and customer rollout." }
    ],
    howTo: [
      {
        title: "Starting a new NPD project",
        steps: [
          "Go to NPD Projects in the left navigation.",
          "Click 'New Project' and fill the project name, description, and target launch date.",
          "Assign a project owner and link the target FG item.",
          "Save — the project starts in Discovery stage.",
          "Complete the stage activities and click 'Submit Gate Review' to request stage advancement.",
          "Once approved, the project automatically moves to the next stage."
        ]
      },
      {
        title: "Completing a gate review",
        steps: [
          "Open the NPD project.",
          "Click 'Gate Review' on the current stage.",
          "Fill the review checklist and select Go, No-Go, or Hold.",
          "Add notes and supporting documents.",
          "Submit — the decision is logged and the project status updates."
        ]
      }
    ],
    callouts: [
      { type: "tip", text: "Link formula and artwork records early (even in Draft state) so the NPD project page gives you a single view of all development artefacts." },
      { type: "warning", text: "A No-Go gate decision does not delete the project — it places it in a Hold state. Projects can be reactivated if the business decision changes." },
      { type: "note", text: "NPD project timelines show against the target launch date. Red highlights indicate stages that have overrun their planned duration." }
    ],
    faq: [
      { q: "Can a project skip a stage?", a: "Gates enforce sequential progression. However, an admin can override the gate decision to skip a stage when business conditions justify it — all overrides are logged." },
      { q: "How do I link a formula that isn't ready yet?", a: "You can link any formula regardless of its status. The link is informational — it doesn't enforce that the formula must be released before the gate passes." }
    ]
  },

  // ─── CHANGES ─────────────────────────────────────────────────
  {
    id: "changes",
    label: "Changes",
    icon: "🔄",
    tagline: "Structured change control with full impact analysis and multi-role sign-offs",
    image: "help-changes.png",
    overview: [
      "The Changes module manages Engineering Change Requests (ECRs) and Engineering Change Notices (ECNs). Every proposed change to a released item, formula, FG structure, or artwork must go through a Change Request so that impact is assessed, stakeholders are notified, and approvals are formally documented.",
      "When you add affected objects to a Change Request, Tatva automatically analyses downstream impact — for example, adding a formula triggers collection of all FG structures that reference it, all artworks linked to those FGs, and all previous releases containing the formula.",
      "The workflow engine routes the Change Request through a configurable approval chain. Tasks are assigned to named roles (e.g. Formulator, QA, Regulatory, Procurement). Each role completes their task in the My Tasks inbox before the change advances to the next step."
    ],
    concepts: [
      { term: "ECR (Change Request)", definition: "The initial proposal to change something. Describes the reason, urgency, and affected objects before approval." },
      { term: "ECN (Change Notice)", definition: "The authorised, approved instruction to implement the change. Issued after the ECR is approved." },
      { term: "Affected Objects", definition: "Items, formulas, FG structures, artworks, or documents that need to change. Adding them triggers automatic downstream impact analysis." },
      { term: "Impact Analysis", definition: "Tatva's automatic collection of all records that reference the affected objects — showing what else will be impacted by the change." },
      { term: "Change Classification", definition: "Major (requires full approval chain) or Minor (abbreviated review). Defined during Change Request creation." },
      { term: "Workflow Task", definition: "An action item assigned to a specific role as part of the approval chain. Visible in My Tasks." }
    ],
    flow: [
      { label: "Raise Change Request", desc: "Create an ECR describing the reason, urgency, and classification (Major/Minor)." },
      { label: "Add Affected Objects", desc: "Link all items, formulas, structures, and artworks that need to change." },
      { label: "Impact Analysis", desc: "Tatva automatically surfaces all downstream records referencing the affected objects." },
      { label: "Submit for Approval", desc: "The workflow engine creates approval tasks and routes them to the appropriate roles." },
      { label: "Review & Approve", desc: "Each assigned role reviews the change in My Tasks and approves or rejects." },
      { label: "Issue ECN", desc: "Fully approved change becomes an ECN. Implementation tasks are raised if configured." },
      { label: "Close", desc: "Once all implementation actions are confirmed, the change is closed and archived." }
    ],
    howTo: [
      {
        title: "Raising a Change Request",
        steps: [
          "Go to Changes and click 'New Change Request'.",
          "Enter the change title, description, reason, and urgency level.",
          "Select Major or Minor classification.",
          "Click 'Add Affected Objects' and search for the items, formulas, or artworks to change.",
          "Review the auto-populated Impact Analysis section.",
          "Click 'Submit' to start the approval workflow."
        ]
      },
      {
        title: "Reviewing and approving a change",
        steps: [
          "Open My Tasks — your pending approvals appear here.",
          "Click the task to open the Change Request.",
          "Review the change description and impact analysis.",
          "Click 'Approve' or 'Reject' with your comments.",
          "Approval advances the change to the next workflow step."
        ]
      }
    ],
    callouts: [
      { type: "tip", text: "Add all affected objects before submitting. You cannot add new affected objects after the workflow has started without resetting the change back to draft." },
      { type: "warning", text: "Rejecting a change task returns the entire Change Request to the originator. The workflow resets — all previous approvals are cleared." },
      { type: "note", text: "Minor changes follow a shorter approval chain. Use Minor only for low-risk administrative corrections (e.g. fixing a typo in an item description)." }
    ],
    faq: [
      { q: "Can I edit the affected object list after submitting?", a: "No — once submitted, the affected object list is locked. If you need to add more objects, the change must be reset to Draft by an admin." },
      { q: "What happens to the revised items after a change is approved?", a: "The change approval does not automatically release the revised items. You still need to submit a Release Request for the new item/formula revisions created as part of implementing the change." },
      { q: "Can a change affect objects in different containers?", a: "No — Change Requests are scoped to a single container. Cross-container impacts must be raised as separate change requests." }
    ]
  },

  // ─── RELEASES ────────────────────────────────────────────────
  {
    id: "releases",
    label: "Releases",
    icon: "✅",
    tagline: "Bundle and approve new items and formulas for commercial use",
    image: "help-releases.png",
    overview: [
      "The Releases module handles the initial release of new or revised items, formulas, and FG structures into a Released state that makes them commercially available. While the Changes module manages modifications to existing released records, the Releases module handles promotion from Draft to Released.",
      "When you add a formula or FG structure to a Release Request, Tatva automatically collects all dependent objects — the formula's ingredient items, the FG structure's packaging components, and linked documents — into a single release bundle. Every object in the bundle must be in a releasable state before the request can be submitted.",
      "Releases follow a multi-step approval workflow. Each approver reviews the complete bundle — not individual objects — ensuring that the product as a whole meets all requirements before anything is marked as Released."
    ],
    concepts: [
      { term: "Release Bundle", definition: "The complete set of objects being released together: formula, all ingredient items, FG structure, packaging items, and linked documents." },
      { term: "Release Readiness", definition: "A check that all objects in the bundle are in a valid Draft state with no outstanding validation errors before submission." },
      { term: "Release Workflow", definition: "The approval chain for the release package. Configured per container in Configuration → Workflows." },
      { term: "Release Status", definition: "Draft (building) → Submitted (workflow active) → Approved (released to production) → Rejected." }
    ],
    flow: [
      { label: "Create Release Request", desc: "Give the release a title and description (e.g. 'New Vitamin C Serum V1')." },
      { label: "Add Objects", desc: "Add the formula or FG structure. Tatva auto-collects the full dependency bundle." },
      { label: "Review Bundle", desc: "Confirm all objects in the auto-collected list are correct and in a releasable state." },
      { label: "Submit", desc: "Trigger the approval workflow. Pending approval tasks are distributed to assigned roles." },
      { label: "Approve", desc: "Each approver reviews and signs off in My Tasks." },
      { label: "Release", desc: "Full approval promotes all bundled objects from Draft to Released." }
    ],
    howTo: [
      {
        title: "Creating a release request",
        steps: [
          "Go to Releases and click 'New Release Request'.",
          "Enter a descriptive title and the target release date.",
          "Click 'Add Object' — select either a formula or an FG structure.",
          "Tatva populates the full dependency bundle automatically.",
          "Review the bundle list for any missing or error objects.",
          "Click 'Submit' to start the approval workflow."
        ]
      }
    ],
    callouts: [
      { type: "warning", text: "If any object in the bundle has validation errors (e.g. formula percentages don't total 100%), the release cannot be submitted until errors are fixed." },
      { type: "tip", text: "You can add multiple formulas and structures to a single Release Request to batch-release an entire new product family in one approval cycle." },
      { type: "note", text: "Once a Release Request is approved, the Released status is permanent. To modify a released object, raise a Change Request and create a new revision." }
    ],
    faq: [
      { q: "Do I need a separate release for each item in the bundle?", a: "No — adding a formula auto-collects all dependent items. One Release Request can release the entire product stack in a single approval cycle." },
      { q: "What happens if one approver rejects the release?", a: "The entire Release Request is rejected and returned to Draft. No objects are released. Fix the issue and resubmit." }
    ]
  },

  // ─── LABELING ────────────────────────────────────────────────
  {
    id: "labeling",
    label: "Labeling",
    icon: "🏷️",
    tagline: "Auto-generate regulatory-compliant ingredient declarations from your formula tree",
    image: "help-labeling.png",
    overview: [
      "The Labeling module generates consumer-facing ingredient declarations, allergen statements, and nutrition fact panels directly from the formula data already in Tatva — no manual transcription required. When you click Generate on a label template, Tatva recursively traverses the formula tree and flattens all ingredients down to their raw-material leaf nodes.",
      "Ingredients are automatically sorted in descending order of weight contribution, exactly as required by EU Regulation 1169/2011, US FDA 21 CFR, and most global food labeling standards. Compound ingredients are expanded with their sub-components shown in parentheses in line with regulatory requirements.",
      "Allergen detection works by reading the allergen flags on each RM item's specification. As Tatva walks the formula tree, it collects all allergens found at any level and presents a deduplicated 'Contains:' statement. Cross-contact allergens can be flagged separately."
    ],
    concepts: [
      { term: "Label Template", definition: "A label configuration record that links a finished good (or formula) to its regulatory label output. You can have multiple templates per product (e.g. EU, US, APAC variants)." },
      { term: "Formula Rollup", definition: "The recursive process of expanding multi-level formulas down to their raw material leaf nodes to build the full ingredient list." },
      { term: "Ingredient Declaration", definition: "The sorted, formatted list of ingredients as it will appear on-pack. Generated from the formula rollup." },
      { term: "Allergen Statement", definition: "The 'Contains:' or 'May contain:' statement auto-populated from allergen flags set on raw material items." },
      { term: "Compound Ingredient", definition: "An ingredient that is itself a mixture (FML type). Regulatory standards require its sub-components to be listed in brackets after the compound name." },
      { term: "Nutrition Panel", definition: "Per-100g nutrient values pulled from formula specifications (energy, fat, carbohydrates, protein, etc.)." }
    ],
    flow: [
      { label: "Create Template", desc: "Create a label template and link it to the target finished good." },
      { label: "Select Formula", desc: "Choose the formula version to base the label on." },
      { label: "Generate", desc: "Click Generate — Tatva recursively walks the formula tree and builds the full ingredient list, allergen statement, and nutrition panel." },
      { label: "Review", desc: "Check the generated declaration for correctness. Edit text overrides if needed for compliance nuances." },
      { label: "Export", desc: "Copy the declaration text to your artwork/design system." }
    ],
    howTo: [
      {
        title: "Generating an ingredient declaration",
        steps: [
          "Navigate to Labeling in the left navigation.",
          "Click 'New Label Template' and enter the template name.",
          "Select the Finished Good item — the product name auto-fills.",
          "Click 'Generate' to trigger the formula rollup.",
          "Review the sorted ingredient list and the allergen statement.",
          "Check nutrition values pulled from formula specifications.",
          "Copy or export the label content to your artwork system."
        ]
      },
      {
        title: "Setting allergen flags on raw materials",
        steps: [
          "Open the RM item in the Items module.",
          "Go to the Specifications tab.",
          "In the Allergen section, tick all applicable allergens (Gluten, Milk, Eggs, etc.).",
          "Save — the allergens will appear automatically on the next label generation."
        ]
      }
    ],
    callouts: [
      { type: "tip", text: "Always generate the label from the exact formula version that will be used in production. Use the formula version picker to ensure you're labelling the right version." },
      { type: "warning", text: "Tatva automates the ingredient sort and allergen detection, but regulatory review by a qualified person is still required before printing on-pack. Tatva is a tool, not a legal guarantee." },
      { type: "note", text: "Water added during processing that is evaporated off should be excluded from the declaration. Mark it as 'Processing Aid' in the RM item spec to suppress it from the label output." }
    ],
    faq: [
      { q: "Why are some ingredients missing from the generated declaration?", a: "Check that all RM items in the formula are in Released status. Draft items are included in the rollup, but if an ingredient item has no name or is marked as a Processing Aid, it is suppressed." },
      { q: "Can I have different label templates for different markets?", a: "Yes — create one template per market variant. Each template can be linked to a different formula version and can have its own text overrides." },
      { q: "How is the percentage calculation done for multi-level formulas?", a: "Tatva multiplies each sub-formula's percentage contribution through the tree. For example, if a sub-formula contributes 30% of the parent, and has an ingredient at 50%, that ingredient contributes 15% to the final product." }
    ]
  },

  // ─── ARTWORKS ────────────────────────────────────────────────
  {
    id: "artworks",
    label: "Artworks",
    icon: "🎨",
    tagline: "Manage packaging artwork, proofing cycles, and compliance sign-off",
    image: "help-artworks.png",
    overview: [
      "The Artworks module manages the complete lifecycle of packaging artwork — from the initial design brief through multiple proofing rounds to final print-ready sign-off. Each Artwork record is linked to the FG item, formula, and release it belongs to, giving full traceability from commercial brief to on-shelf pack.",
      "Artwork proofing is handled directly inside Tatva. You upload proof files (PDF, PNG, JPG), preview them in the inline viewer, and add annotations with comments. Design-native formats like .ai or .psd are flagged with a download option since browser preview is not possible for those formats.",
      "Every proof upload, annotation, and sign-off is time-stamped and attributed to the acting user, creating a complete proofing audit trail for retailer submissions, regulatory bodies, and internal governance."
    ],
    concepts: [
      { term: "Artwork Record", definition: "The master record for a pack design. Captures the market, format, language, legal copy, and all proofing artefacts." },
      { term: "Artwork Component", definition: "A distinct design element within the artwork (e.g. front face, back panel, side panel). Proofs are uploaded per component." },
      { term: "Proof", definition: "A file revision of a component (PDF, image). Classified as SOURCE (designer's working file), PROOF (review copy), or FINAL (print-ready approved file)." },
      { term: "Annotation", definition: "A comment pinned to a specific proof, used to request corrections or flag compliance issues during the proofing cycle." },
      { term: "Artwork Status", definition: "Draft → In Review → Approved → Obsolete. Approved status requires sign-off by all required roles." }
    ],
    flow: [
      { label: "Create Artwork", desc: "Define market, format, language, and link the FG and formula." },
      { label: "Add Components", desc: "Break the design into components (front, back, side, etc.)." },
      { label: "Upload Proofs", desc: "Upload the initial proof files from the design agency." },
      { label: "Review & Annotate", desc: "Stakeholders preview proofs inline and add correction annotations." },
      { label: "Upload Revised Proof", desc: "Designer uploads the corrected proof. Proofing cycle continues until all annotations are resolved." },
      { label: "Final Approval", desc: "Qualified reviewer marks the proof as FINAL and signs off the artwork record." }
    ],
    howTo: [
      {
        title: "Setting up an artwork record",
        steps: [
          "Navigate to Artworks and click 'Create Artwork'.",
          "Enter the artwork title, market, format, and language.",
          "Link the FG item and the associated formula.",
          "Save — the system generates an Artwork number.",
          "Go to the Components tab and add design components (e.g. Front Panel, Back Panel).",
          "Go to Proofing and upload the initial SOURCE file from the designer."
        ]
      },
      {
        title: "Running a proofing review",
        steps: [
          "Open an artwork record and go to the Proofing tab.",
          "Select a proof file from the list — it loads in the inline preview panel.",
          "Add annotations by clicking 'Annotate' and typing your correction notes.",
          "Notify the designer — they upload a revised PROOF file.",
          "Repeat until all annotations are resolved.",
          "Upload the final print-ready file and classify it as FINAL.",
          "Sign off the artwork to mark it as Approved."
        ]
      }
    ],
    callouts: [
      { type: "tip", text: "Use the annotation system rather than emailing correction notes. All feedback is stored on the proof record, making it easy to verify corrections in the next round." },
      { type: "warning", text: "Deleting a proof permanently removes the file from storage. Only delete proofs that were uploaded in error — use 'Obsolete' status for superseded versions." },
      { type: "note", text: "Adobe Illustrator (.ai) and InDesign (.indd) files cannot be previewed inline. Tatva shows a download option for these formats. Upload a PDF render alongside the native file to enable inline review." }
    ],
    faq: [
      { q: "Can multiple people annotate the same proof simultaneously?", a: "Yes — annotations are stored individually per user. Multiple reviewers can add separate annotations to the same proof." },
      { q: "How do I know which proof version is the current one?", a: "The most recently uploaded proof appears at the top of the list sorted by date. FINAL-classified proofs are visually highlighted." }
    ]
  },

  // ─── DOCUMENTS ───────────────────────────────────────────────
  {
    id: "documents",
    label: "Documents",
    icon: "📄",
    tagline: "Centralised document library with version control and object links",
    image: "help-documents.png",
    overview: [
      "The Documents module is Tatva's centralised repository for all product-related documents — specifications, COAs, safety data sheets, regulatory dossiers, test reports, and supplier certificates. Every document is classified, versioned, and linked to the items or formulas it relates to.",
      "Documents can be linked to items and formulas from the detail page of those records, or from the document itself. Links create bidirectional traceability: from an item you can see all its documents, and from a document you can see all the objects it covers.",
      "Like items and formulas, documents are versioned. When a document is revised, a new version is created and the previous version is preserved in history. This is critical for audit purposes — you can always reproduce the exact document set that was current at any past point in time."
    ],
    concepts: [
      { term: "Document Number", definition: "A system-generated, container-scoped unique identifier assigned on creation (e.g. DOC-0017)." },
      { term: "Classification", definition: "The document category: Specification, Test Report, Safety Data Sheet, Certificate, Regulatory, Other." },
      { term: "Document Version", definition: "A numbered revision of the document file. Previous versions are preserved in the History tab." },
      { term: "Linked Objects", definition: "The items and formulas that this document relates to. Links appear on both the document and the linked object." }
    ],
    flow: [
      { label: "Upload File", desc: "Drag and drop or browse to upload the document file." },
      { label: "Classify", desc: "Set the document name, classification, and type." },
      { label: "Save", desc: "System assigns a Document Number." },
      { label: "Link Objects", desc: "Link the document to the relevant items or formulas." },
      { label: "Revise", desc: "Upload a new file version when the document is updated." }
    ],
    howTo: [
      {
        title: "Uploading a new document",
        steps: [
          "Go to Documents and click 'Upload Document'.",
          "Drag the file onto the upload area or click to browse.",
          "Confirm the auto-populated document name (editable).",
          "Set the Classification (Specification, Test Report, etc.) and Type.",
          "Click Save — the system assigns a Document Number.",
          "Go to the Links tab to associate the document with relevant items or formulas."
        ]
      }
    ],
    callouts: [
      { type: "tip", text: "Link documents during item creation to build a complete data pack before submitting for release. Reviewers can then access all supporting documents from the release bundle." },
      { type: "note", text: "Maximum file size is 50MB per document. For larger files (e.g. video test reports), use an external link in the document description and upload a summary PDF." }
    ],
    faq: [
      { q: "Can the same document be linked to multiple items?", a: "Yes — a single document can be linked to any number of items and formulas. This is useful for shared specifications like a supplier quality agreement." },
      { q: "How do I update a document that has changed?", a: "Open the document record and click 'Revise'. Upload the new file version. The old version moves to History." }
    ]
  },

  // ─── SPECIFICATIONS ──────────────────────────────────────────
  {
    id: "specifications",
    label: "Specifications",
    icon: "📐",
    tagline: "Configure quality attribute templates used across items and formulas",
    image: "help-specifications.png",
    overview: [
      "The Specifications module is where you define the attribute templates that items and formulas use for quality and regulatory data. Think of it as the master configuration for what can be measured — pH range, viscosity, particle size, nutritional values, allergen flags, and so on.",
      "Specifications are grouped by attribute category (Physical, Chemical, Microbiological, Nutritional, Allergens, etc.) and industry type. Once you define an attribute in the Specifications template, it becomes available for input on any item or formula's Spec tab.",
      "Each specification attribute can have minimum, maximum, and target values, a unit of measure, and a test method reference. When a COA (Certificate of Analysis) value is entered on an item, Tatva validates it against the min/max limits automatically."
    ],
    concepts: [
      { term: "Attribute Group", definition: "A category of related specification attributes (e.g. Physical Attributes, Nutritional Values, Allergens)." },
      { term: "Attribute", definition: "A single measurable property (e.g. pH, Viscosity cP, Sodium mg/100g)." },
      { term: "Min / Max / Target", definition: "Acceptance limits for the attribute. Values entered on items are validated against these limits." },
      { term: "UOM (Unit of Measure)", definition: "The measurement unit for the attribute (e.g. mg, %, cP, °C). Units are configured in Configuration → UOM." }
    ],
    flow: [
      { label: "Select Industry", desc: "Choose the industry context (Food, Personal Care, Pharma, etc.)." },
      { label: "Open Attribute Group", desc: "Select the group to add attributes to (Physical, Chemical, Nutritional, etc.)." },
      { label: "Add Attributes", desc: "Define each attribute: name, unit, min, max, target, and test method." },
      { label: "Save", desc: "Attributes are immediately available on item and formula Spec tabs." }
    ],
    howTo: [
      {
        title: "Adding a new specification attribute",
        steps: [
          "Go to Specifications in the left navigation.",
          "Select the applicable industry and attribute group.",
          "Click 'Add Attribute'.",
          "Enter the attribute name, select UOM from the dropdown, and set min/max/target values.",
          "Optionally enter a test method reference.",
          "Save — the attribute is immediately available on item and formula spec tabs."
        ]
      }
    ],
    callouts: [
      { type: "warning", text: "Deleting a specification attribute removes it from all items and formulas that have data entered against it. Archive unused attributes instead of deleting them." },
      { type: "note", text: "UOM options in the attribute editor are drawn from Configuration → UOM. Add new units there before creating attributes that require them." }
    ],
    faq: [
      { q: "Can I have different spec templates for different item types?", a: "Yes — spec attributes are filtered by industry and attribute group. Configure separate groups for RM physical attributes vs. FG nutritional values." },
      { q: "Can I import specification templates from a spreadsheet?", a: "Bulk import is on the roadmap. Currently attributes must be entered manually, though the Copy action can speed up creating similar attribute sets." }
    ]
  },

  // ─── MY TASKS ────────────────────────────────────────────────
  {
    id: "tasks",
    label: "My Tasks",
    icon: "✔️",
    tagline: "Your personalised inbox for all workflow approvals and action items",
    image: "help-tasks.png",
    overview: [
      "My Tasks is your personal workflow inbox. Every time a Change Request, Release Request, or NPD gate review reaches a step assigned to your role, a task appears here. Tatva will also show the bell notification count in the header so you never miss a pending action.",
      "Each task shows the originating workflow, the action required (Review & Approve, Verify Implementation, etc.), and the deadline if one was set. Clicking a task takes you directly to the relevant record — you do not need to navigate there manually.",
      "Task completion is binary: Approve or Reject (with a mandatory comment on rejection). Both actions are time-stamped and attributed to you, forming the permanent approval record on the parent Change/Release."
    ],
    concepts: [
      { term: "Task", definition: "A single workflow action item assigned to you or your role. Has a type (Approve, Review, Verify), a parent record, and a status (Pending, Completed)." },
      { term: "Role Assignment", definition: "Tasks are assigned to roles (QA Approver, Regulatory, Procurement) rather than named users. Any user with that role can complete the task." },
      { term: "Task Deadline", definition: "An optional due date set on the workflow step. Overdue tasks are highlighted in red." },
      { term: "Notification Bell", definition: "The bell icon in the header shows the count of unread tasks. Click it for a quick preview without leaving the current page." }
    ],
    flow: [
      { label: "Receive Task", desc: "A workflow step routes to your role. Task appears in My Tasks and notification count increases." },
      { label: "Open Record", desc: "Click the task to open the associated Change or Release Request." },
      { label: "Review", desc: "Read the change description, affected objects, and impact analysis." },
      { label: "Decide", desc: "Click Approve or Reject. Rejection requires a comment explaining why." },
      { label: "Complete", desc: "Task is marked Complete. Workflow advances to the next step (or closes if this was the final approval)." }
    ],
    howTo: [
      {
        title: "Completing an approval task",
        steps: [
          "Click the bell icon in the header or go to My Tasks from the left navigation.",
          "Find the pending task — tasks are sorted by deadline.",
          "Click the task to open the associated record.",
          "Review all relevant information: description, affected objects, documents.",
          "Return to the task and click 'Approve' or 'Reject'.",
          "If rejecting, enter a comment explaining the reason.",
          "The workflow automatically advances or loops back based on your decision."
        ]
      }
    ],
    callouts: [
      { type: "tip", text: "Use the notification bell for a quick check without navigating away from your current work. The popover shows the top 5 pending tasks." },
      { type: "warning", text: "Rejecting a task sends the entire workflow back to the originator. Make sure your rejection comment is specific and actionable so the originator knows exactly what to fix." },
      { type: "note", text: "Completed tasks are removed from My Tasks but remain visible on the parent workflow record for audit purposes." }
    ],
    faq: [
      { q: "I completed a task but the change is still showing as Pending. Why?", a: "The change may have multiple parallel approval tasks. All must be completed before the workflow advances. Check the Workflow tab on the change record to see which tasks are still open." },
      { q: "Can I reassign a task to a colleague?", a: "Tasks are assigned to roles, not individuals. Any user with the required role can complete the task. If you need an individual reassignment, contact an Admin to update role assignments." }
    ]
  },

  // ─── CONFIGURATION ───────────────────────────────────────────
  {
    id: "configuration",
    label: "Configuration",
    icon: "⚙️",
    tagline: "System-wide settings for numbering, UOM, workflows, and integrations",
    image: "help-configuration.png",
    overview: [
      "Configuration is the admin control panel for your Tatva instance. It controls how entity numbers are generated, which units of measure are available, how revision schemes work, what workflow steps are required for changes and releases, and how email notifications are sent.",
      "Most configuration settings are container-scoped — meaning you can have different numbering schemes, workflow chains, and approval requirements for different brands or plants within the same Tatva instance.",
      "Changes to configuration take effect immediately. Existing records are not affected by numbering or revision scheme changes — only newly created records after the change will follow the new scheme."
    ],
    concepts: [
      { term: "Numbering Scheme", definition: "Defines the prefix and sequence for auto-generated entity codes (e.g. RM-0001, FML-0042, DOC-0018). Configurable per entity type and container." },
      { term: "Revision Scheme", definition: "Controls how revision suffixes are generated (e.g. A, B, C or 01, 02, 03) when items and formulas are revised." },
      { term: "UOM (Unit of Measure)", definition: "The master list of measurement units available in formula ingredient lines and specification attributes." },
      { term: "Workflow Configuration", definition: "Defines the approval chain steps for Change Requests, Release Requests, and NPD gate reviews. Each step specifies the required role and optionally a deadline." },
      { term: "Mail Server", definition: "SMTP configuration for sending workflow notification emails. Required for task email alerts to work." }
    ],
    flow: [
      { label: "Open Configuration", desc: "Go to Configuration in the Governance section of the sidebar." },
      { label: "Select Module", desc: "Choose the setting area: Numbering, Revisions, UOM, Workflows, or Mail." },
      { label: "Edit Settings", desc: "Update values inline. Changes are saved immediately." },
      { label: "Verify", desc: "Create a test record to confirm the new settings apply as expected." }
    ],
    howTo: [
      {
        title: "Setting up a custom numbering scheme",
        steps: [
          "Go to Configuration → Numbering.",
          "Select the entity type (RM, FML, FG, PKG, Change, Release, etc.).",
          "Set the prefix (e.g. 'RM-'), starting number, and padding digits.",
          "Save — new records of that type will use the new scheme."
        ]
      },
      {
        title: "Adding a unit of measure",
        steps: [
          "Go to Configuration → UOM.",
          "Click 'Add UOM'.",
          "Enter the unit name (e.g. 'mg/kg') and abbreviation.",
          "Save — the unit is immediately available in formula lines and spec attributes."
        ]
      },
      {
        title: "Configuring the email server",
        steps: [
          "Go to Configuration → Mail.",
          "Enter the SMTP host, port, sender address, username, and password.",
          "Click 'Test Connection' to verify.",
          "Save — workflow notification emails will now be delivered."
        ]
      }
    ],
    callouts: [
      { type: "warning", text: "Changing the numbering scheme does not renumber existing records. Only new records will use the new scheme. Plan numbering carefully before you start creating records." },
      { type: "tip", text: "Set up the mail server early so that workflow approvers receive email notifications and don't have to log in to check their tasks manually." },
      { type: "note", text: "Workflow configuration changes only affect new workflow instances. In-progress workflows continue to follow the scheme that was active when they were submitted." }
    ],
    faq: [
      { q: "Can I delete a UOM that is already in use?", a: "No — UOMs in use by existing formula lines or spec attributes cannot be deleted. Archive them to hide them from new-entry dropdowns." },
      { q: "How do I set up a two-stage approval workflow for change requests?", a: "Go to Configuration → Workflows, select 'Change Request', and add two sequential steps with the required roles for each step." }
    ]
  }
];
