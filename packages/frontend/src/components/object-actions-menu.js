import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
const defaultActions = [
    { key: "checkout", label: "Check Out" },
    { key: "checkin", label: "Check In" },
    { key: "revise", label: "Revise" },
    { key: "copy", label: "Copy" },
    { key: "delete", label: "Delete", danger: true }
];
export function ObjectActionsMenu({ onAction, actions = defaultActions }) {
    const [open, setOpen] = useState(false);
    return (_jsxs("div", { className: "relative inline-block text-left", children: [_jsx("button", { type: "button", onClick: () => setOpen((current) => !current), className: "rounded border border-slate-300 bg-white px-2 py-1 text-xs", children: "Actions" }), open ? (_jsx("div", { className: "absolute right-0 z-20 mt-1 w-36 rounded border border-slate-200 bg-white p-1 shadow-lg", children: actions.map((action) => (_jsx("button", { type: "button", disabled: action.disabled, onClick: () => {
                        setOpen(false);
                        if (!action.disabled) {
                            onAction(action.key);
                        }
                    }, className: `block w-full rounded px-2 py-1 text-left text-xs ${action.disabled ? "cursor-not-allowed text-slate-400" : action.danger ? "text-danger hover:bg-red-50" : "text-slate-700 hover:bg-slate-100"}`, children: action.label }, action.key))) })) : null] }));
}
//# sourceMappingURL=object-actions-menu.js.map