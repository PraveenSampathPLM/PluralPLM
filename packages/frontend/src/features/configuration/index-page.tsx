import { Link } from "react-router-dom";

const configLinks = [
  { to: "/configuration/numbering", title: "Smart Numbering", description: "Configure prefixes, padding, and next numbers." },
  { to: "/configuration/revisions", title: "Revision Schemes", description: "Set major/minor revision formatting by entity." },
  { to: "/configuration/columns", title: "List Columns", description: "Select columns visible in list tables." },
  { to: "/configuration/attributes", title: "Custom Attributes", description: "Manage item attribute definitions." },
  { to: "/configuration/uoms", title: "Units of Measure", description: "Standardize UOM list across the app." },
  { to: "/configuration/mail", title: "Mail Server", description: "Configure SMTP for workflow notifications." },
  { to: "/configuration/server-stats", title: "Server Stats", description: "View runtime health, resource usage, and login activity." },
  { to: "/configuration/workflows", title: "Workflow Designer", description: "Build release and change workflows." }
];

export function ConfigurationIndexPage(): JSX.Element {
  return (
    <div className="space-y-4 rounded-xl bg-white p-4">
      <div>
        <p className="text-xs uppercase text-slate-500">Administration</p>
        <h2 className="font-heading text-xl">Configuration</h2>
        <p className="text-sm text-slate-500">Select a configuration area to manage.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {configLinks.map((link) => (
          <Link key={link.to} to={link.to} className="rounded-lg border border-slate-200 bg-slate-50 p-4 hover:border-primary">
            <p className="text-sm font-semibold text-slate-800">{link.title}</p>
            <p className="mt-1 text-xs text-slate-500">{link.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
