import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function FloatingInput({ label, className = "", ...props }) {
    return (_jsxs("div", { className: "relative", children: [_jsx("input", { ...props, placeholder: " ", className: `peer w-full rounded border border-slate-300 bg-white px-3 pb-2 pt-5 text-sm focus:border-primary focus:outline-none ${className}` }), _jsx("label", { className: "pointer-events-none absolute left-3 top-2 bg-white px-1 text-xs text-slate-500 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:text-slate-400 peer-focus:top-2 peer-focus:text-xs peer-focus:text-slate-500", children: label })] }));
}
export function FloatingTextarea({ label, className = "", ...props }) {
    return (_jsxs("div", { className: "relative", children: [_jsx("textarea", { ...props, placeholder: " ", className: `peer w-full rounded border border-slate-300 bg-white px-3 pb-2 pt-5 text-sm focus:border-primary focus:outline-none ${className}` }), _jsx("label", { className: "pointer-events-none absolute left-3 top-2 bg-white px-1 text-xs text-slate-500 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:text-slate-400 peer-focus:top-2 peer-focus:text-xs peer-focus:text-slate-500", children: label })] }));
}
export function FloatingSelect({ label, className = "", value, children, ...props }) {
    const empty = value === "" || value === undefined || value === null;
    return (_jsxs("div", { className: "relative group", "data-empty": empty ? "true" : "false", children: [_jsx("select", { ...props, value: value, className: `peer w-full appearance-none rounded border border-slate-300 bg-white px-3 pb-2 pt-5 text-sm focus:border-primary focus:outline-none ${className}`, children: children }), _jsx("label", { className: "pointer-events-none absolute left-3 top-2 bg-white px-1 text-xs text-slate-500 transition-all group-data-[empty=true]:top-3.5 group-data-[empty=true]:text-sm group-data-[empty=true]:text-slate-400 peer-focus:top-2 peer-focus:text-xs peer-focus:text-slate-500", children: label })] }));
}
//# sourceMappingURL=floating-field.js.map