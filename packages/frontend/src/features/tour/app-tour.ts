import { type DriveStep } from "driver.js";

export const APP_TOUR_STEPS: DriveStep[] = [
  {
    popover: {
      title: "Welcome to Tatva 👋",
      description:
        "Tatva is your end-to-end Product Lifecycle Management platform for process industries. This quick tour will show you the key areas. You can re-run it any time from the Help Center.",
      side: "over",
      align: "center",
    },
  },
  {
    element: "#tour-sidebar-nav",
    popover: {
      title: "Navigation",
      description:
        "The sidebar gives you access to every module — Home, Items, Formulas, NPD, Changes, Releases, and more. Active items are highlighted in blue.",
      side: "right",
      align: "center",
    },
  },
  {
    element: "#tour-container-selector",
    popover: {
      title: "Product Container",
      description:
        "A Container is an isolated workspace for a brand, plant, or product line. Switch containers here to work across multiple portfolios without mixing data.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: "#tour-nav-home",
    popover: {
      title: "Home — Control Tower",
      description:
        "Your dashboard shows real-time KPIs across the entire PLM portfolio: open changes, active formulas, release status, and NPD pipeline trends.",
      side: "right",
      align: "center",
    },
  },
  {
    element: "#tour-nav-items",
    popover: {
      title: "Items — Master Registry",
      description:
        "All raw materials, packaging components, formulations, and finished goods live here. Every item tracks lifecycle status from DRAFT through RELEASED.",
      side: "right",
      align: "center",
    },
  },
  {
    element: "#tour-nav-formulas",
    popover: {
      title: "Formulas — Versioned Recipes",
      description:
        "Build multi-level formulas with ingredient weights and percentages. Every change creates a new version with a full audit trail.",
      side: "right",
      align: "center",
    },
  },
  {
    element: "#tour-nav-npd",
    popover: {
      title: "NPD — Stage-Gate Pipeline",
      description:
        "Manage new product development across Discovery → Feasibility → Development → Validation → Launch. Gate reviews and sign-offs are built in.",
      side: "right",
      align: "center",
    },
  },
  {
    element: "#tour-nav-changes",
    popover: {
      title: "Changes — Change Control",
      description:
        "Raise ECRs and ECNs, track affected items and formulas, route through multi-role sign-offs, and link to downstream releases — all with a full audit trail.",
      side: "right",
      align: "center",
    },
  },
  {
    element: "#tour-nav-releases",
    popover: {
      title: "Releases — Release Management",
      description:
        "Package approved changes into numbered release requests. Track readiness across your portfolio and monitor per-release progress.",
      side: "right",
      align: "center",
    },
  },
  {
    element: "#tour-nav-labeling",
    popover: {
      title: "Labeling — Regulatory Labels",
      description:
        "Link a label template to a formula and click Generate. Tatva recursively walks the formula tree, sorts ingredients by weight, detects allergens, and builds the full label declaration.",
      side: "right",
      align: "center",
    },
  },
  {
    element: "#tour-help-center",
    popover: {
      title: "Help Center & Re-run Tour",
      description:
        "Access documentation and re-run this tour any time by clicking 'Take a Tour' in the Help Center. You're all set — enjoy using Tatva!",
      side: "bottom",
      align: "end",
    },
  },
];

export const TOUR_DONE_KEY = "tatva_tour_done";
