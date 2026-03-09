import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Link } from "react-router-dom";
import { useContainerStore } from "@/store/container.store";
function toTitle(input) {
    return input
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (character) => character.toUpperCase())
        .trim();
}
function statusColor(status) {
    if (status === "IMPLEMENTED" || status === "APPROVED" || status === "RELEASED") {
        return "bg-green-100 text-green-700";
    }
    if (status === "UNDER_REVIEW" || status === "IN_REVIEW" || status === "SUBMITTED") {
        return "bg-amber-100 text-amber-700";
    }
    return "bg-slate-100 text-slate-700";
}
export function DashboardPage() {
    const { selectedContainerId } = useContainerStore();
    const { data, isLoading } = useQuery({
        queryKey: ["dashboard", selectedContainerId],
        queryFn: async () => (await api.get("/dashboard", {
            params: { ...(selectedContainerId ? { containerId: selectedContainerId } : {}) }
        })).data
    });
    const tasksQuery = useQuery({
        queryKey: ["workflow-tasks"],
        queryFn: async () => (await api.get("/workflows/tasks")).data
    });
    if (isLoading) {
        return _jsx("div", { className: "rounded-lg bg-white p-6", children: "Loading dashboard..." });
    }
    const kpis = data?.kpis ?? {
        activeFormulas: 0,
        pendingChanges: 0,
        itemsUnderReview: 0,
        upcomingExpiries: 0
    };
    const recent = data?.recent ?? { items: [], formulas: [], boms: [] };
    const change = data?.changeDashboard ?? { byStatus: [], monthlyTrend: [] };
    const activity = data?.recentActivity ?? { items: [], formulas: [], boms: [] };
    const tasks = tasksQuery.data?.data ?? [];
    const maxStatus = Math.max(...change.byStatus.map((entry) => entry.count), 1);
    const maxTrend = Math.max(...change.monthlyTrend.flatMap((entry) => [entry.created, entry.implemented]), 1);
    const maxActivity = Math.max(...[...activity.items, ...activity.formulas, ...activity.boms].map((entry) => entry.count), 1);
    return (_jsxs("div", { className: "space-y-5", children: [_jsx("div", { className: "grid gap-4 md:grid-cols-2 xl:grid-cols-4", children: Object.entries(kpis).map(([key, value]) => (_jsxs("div", { className: "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm", children: [_jsx("p", { className: "text-[11px] uppercase tracking-wide text-slate-500", children: toTitle(key) }), _jsx("p", { className: "mt-2 text-3xl font-semibold text-primary", children: value })] }, key))) }), _jsxs("div", { className: "grid gap-4 lg:grid-cols-4", children: [_jsxs("div", { className: "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-1", children: [_jsxs("div", { className: "mb-3 flex items-center justify-between", children: [_jsx("h3", { className: "font-heading text-lg", children: "My Workflow Tasks" }), _jsx(Link, { to: "/tasks", className: "text-xs text-primary hover:underline", children: "View all" })] }), _jsxs("div", { className: "space-y-2", children: [tasks.length === 0 ? _jsx("p", { className: "text-sm text-slate-500", children: "No tasks assigned." }) : null, tasks.slice(0, 5).map((task) => (_jsxs("div", { className: "rounded-lg border border-slate-200 bg-slate-50 px-3 py-2", children: [_jsx("p", { className: "text-xs text-slate-500", children: task.definitionName }), _jsxs("p", { className: "text-sm font-medium text-slate-800", children: [task.entityType, " \u00B7 ", task.currentState] }), _jsx(Link, { to: task.entityType === "CHANGE_REQUEST"
                                                    ? `/changes/${task.entityId}`
                                                    : task.entityType === "RELEASE_REQUEST"
                                                        ? `/releases/${task.entityId}`
                                                        : task.entityType === "FORMULA"
                                                            ? `/formulas/${task.entityId}`
                                                            : task.entityType === "BOM"
                                                                ? `/bom/${task.entityId}`
                                                                : task.entityType === "ITEM"
                                                                    ? `/items/${task.entityId}`
                                                                    : "#", className: "text-xs text-primary hover:underline", children: "Open" })] }, task.instanceId)))] })] }), [
                        { title: "Item Activity (7 days)", data: activity.items },
                        { title: "Formulation Activity (7 days)", data: activity.formulas },
                        { title: "BOM Activity (7 days)", data: activity.boms }
                    ].map((card) => (_jsxs("div", { className: "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-1", children: [_jsxs("div", { className: "mb-3 flex items-center justify-between", children: [_jsx("h3", { className: "font-heading text-lg", children: card.title }), _jsx("span", { className: "text-xs text-slate-500", children: "Last 7 days" })] }), _jsx("div", { className: "grid grid-cols-7 items-end gap-2", children: card.data.map((entry) => (_jsxs("div", { className: "flex flex-col items-center gap-1 text-xs text-slate-500", children: [_jsx("div", { className: "h-16 w-full rounded bg-slate-100", children: _jsx("div", { className: "h-full w-full rounded bg-primary", style: { transform: `scaleY(${entry.count / maxActivity})`, transformOrigin: "bottom" } }) }), _jsx("span", { children: entry.day.slice(8) })] }, entry.day))) })] }, card.title)))] }), _jsxs("div", { className: "grid gap-4 lg:grid-cols-2", children: [_jsxs("div", { className: "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm", children: [_jsx("h3", { className: "mb-3 font-heading text-lg", children: "Change Requests by Status" }), _jsxs("div", { className: "space-y-3", children: [change.byStatus.length === 0 ? _jsx("p", { className: "text-sm text-slate-500", children: "No change requests found." }) : null, change.byStatus.map((entry) => (_jsxs("div", { children: [_jsxs("div", { className: "mb-1 flex items-center justify-between text-xs", children: [_jsx("span", { className: `rounded-full px-2 py-0.5 ${statusColor(entry.status)}`, children: entry.status }), _jsx("span", { className: "text-slate-500", children: entry.count })] }), _jsx("div", { className: "h-2 rounded bg-slate-100", children: _jsx("div", { className: "h-2 rounded bg-primary", style: { width: `${(entry.count / maxStatus) * 100}%` } }) })] }, entry.status)))] })] }), _jsxs("div", { className: "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm", children: [_jsx("h3", { className: "mb-3 font-heading text-lg", children: "Change Trend (Created vs Implemented)" }), _jsx("div", { className: "space-y-3", children: change.monthlyTrend.map((entry) => (_jsxs("div", { children: [_jsxs("div", { className: "mb-1 flex items-center justify-between text-xs text-slate-600", children: [_jsx("span", { children: entry.month }), _jsxs("span", { children: ["Created ", entry.created, " \u00B7 Implemented ", entry.implemented] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx("div", { className: "h-2 rounded bg-slate-100", children: _jsx("div", { className: "h-2 rounded bg-accent", style: { width: `${(entry.created / maxTrend) * 100}%` } }) }), _jsx("div", { className: "h-2 rounded bg-slate-100", children: _jsx("div", { className: "h-2 rounded bg-success", style: { width: `${(entry.implemented / maxTrend) * 100}%` } }) })] })] }, entry.month))) })] })] }), _jsxs("div", { className: "grid gap-4 xl:grid-cols-3", children: [_jsxs("div", { className: "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm", children: [_jsxs("div", { className: "mb-3 flex items-center justify-between", children: [_jsx("h3", { className: "font-heading text-lg", children: "Recently Created Items" }), _jsx(Link, { to: "/items", className: "text-xs text-primary hover:underline", children: "View all" })] }), _jsxs("div", { className: "space-y-2", children: [recent.items.length === 0 ? _jsx("p", { className: "text-sm text-slate-500", children: "No items found." }) : null, recent.items.map((item) => (_jsxs(Link, { to: `/items/${item.id}`, className: "block rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 hover:bg-slate-100", children: [_jsx("p", { className: "font-mono text-xs text-slate-500", children: item.itemCode }), _jsx("p", { className: "text-sm font-medium text-slate-800", children: item.name })] }, item.id)))] })] }), _jsxs("div", { className: "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm", children: [_jsxs("div", { className: "mb-3 flex items-center justify-between", children: [_jsx("h3", { className: "font-heading text-lg", children: "Recently Created Formulas" }), _jsx(Link, { to: "/formulas", className: "text-xs text-primary hover:underline", children: "View all" })] }), _jsxs("div", { className: "space-y-2", children: [recent.formulas.length === 0 ? _jsx("p", { className: "text-sm text-slate-500", children: "No formulas found." }) : null, recent.formulas.map((formula) => (_jsxs(Link, { to: `/formulas/${formula.id}`, className: "block rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 hover:bg-slate-100", children: [_jsxs("p", { className: "font-mono text-xs text-slate-500", children: [formula.formulaCode, " v", formula.version] }), _jsx("p", { className: "text-sm font-medium text-slate-800", children: formula.name })] }, formula.id)))] })] }), _jsxs("div", { className: "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm", children: [_jsxs("div", { className: "mb-3 flex items-center justify-between", children: [_jsx("h3", { className: "font-heading text-lg", children: "Recently Created BOMs" }), _jsx(Link, { to: "/bom", className: "text-xs text-primary hover:underline", children: "View all" })] }), _jsxs("div", { className: "space-y-2", children: [recent.boms.length === 0 ? _jsx("p", { className: "text-sm text-slate-500", children: "No BOMs found." }) : null, recent.boms.map((bom) => (_jsxs(Link, { to: `/bom/${bom.id}`, className: "block rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 hover:bg-slate-100", children: [_jsxs("p", { className: "font-mono text-xs text-slate-500", children: [bom.bomCode, " v", bom.version] }), _jsx("p", { className: "text-sm font-medium text-slate-800", children: bom.type })] }, bom.id)))] })] })] })] }));
}
//# sourceMappingURL=page.js.map