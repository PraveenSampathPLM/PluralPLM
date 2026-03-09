import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from "react-router-dom";
const configLinks = [
    { to: "/configuration/numbering", title: "Smart Numbering", description: "Configure prefixes, padding, and next numbers." },
    { to: "/configuration/revisions", title: "Revision Schemes", description: "Set major/minor revision formatting by entity." },
    { to: "/configuration/columns", title: "List Columns", description: "Select columns visible in list tables." },
    { to: "/configuration/attributes", title: "Custom Attributes", description: "Manage item attribute definitions." },
    { to: "/configuration/uoms", title: "Units of Measure", description: "Standardize UOM list across the app." },
    { to: "/configuration/mail", title: "Mail Server", description: "Configure SMTP for workflow notifications." },
    { to: "/configuration/workflows", title: "Workflow Designer", description: "Build release and change workflows." }
];
export function ConfigurationIndexPage() {
    return (_jsxs("div", { className: "space-y-4 rounded-xl bg-white p-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs uppercase text-slate-500", children: "Administration" }), _jsx("h2", { className: "font-heading text-xl", children: "Configuration" }), _jsx("p", { className: "text-sm text-slate-500", children: "Select a configuration area to manage." })] }), _jsx("div", { className: "grid gap-3 md:grid-cols-2", children: configLinks.map((link) => (_jsxs(Link, { to: link.to, className: "rounded-lg border border-slate-200 bg-slate-50 p-4 hover:border-primary", children: [_jsx("p", { className: "text-sm font-semibold text-slate-800", children: link.title }), _jsx("p", { className: "mt-1 text-xs text-slate-500", children: link.description })] }, link.to))) })] }));
}
//# sourceMappingURL=index-page.js.map