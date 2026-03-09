import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Link } from "react-router-dom";
export function TasksPage() {
    const { data, isLoading } = useQuery({
        queryKey: ["workflow-tasks"],
        queryFn: async () => (await api.get("/workflows/tasks")).data
    });
    const rows = data?.data ?? [];
    return (_jsxs("div", { className: "space-y-4 rounded-xl bg-white p-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-heading text-xl", children: "My Workflow Tasks" }), _jsx("p", { className: "text-sm text-slate-500", children: "Tasks assigned to you by role assignment." })] }), isLoading ? (_jsx("p", { children: "Loading tasks..." })) : rows.length === 0 ? (_jsx("p", { className: "text-sm text-slate-500", children: "No tasks assigned." })) : (_jsxs("table", { className: "w-full text-left text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-slate-200 text-slate-500", children: [_jsx("th", { className: "py-2", children: "Entity" }), _jsx("th", { className: "py-2", children: "Workflow" }), _jsx("th", { className: "py-2", children: "State" }), _jsx("th", { className: "py-2", children: "Task" }), _jsx("th", { className: "py-2", children: "Assigned" }), _jsx("th", { className: "py-2", children: "Open" })] }) }), _jsx("tbody", { children: rows.map((task) => {
                            const detailLink = task.entityType === "CHANGE_REQUEST"
                                ? `/changes/${task.entityId}`
                                : task.entityType === "RELEASE_REQUEST"
                                    ? `/releases/${task.entityId}`
                                    : task.entityType === "FORMULA"
                                        ? `/formulas/${task.entityId}`
                                        : task.entityType === "BOM"
                                            ? `/bom/${task.entityId}`
                                            : task.entityType === "ITEM"
                                                ? `/items/${task.entityId}`
                                                : "#";
                            const taskLink = `/tasks/${task.instanceId}`;
                            return (_jsxs("tr", { className: "border-b border-slate-100", children: [_jsx("td", { className: "py-2", children: task.entityType }), _jsx("td", { className: "py-2", children: task.definitionName }), _jsx("td", { className: "py-2", children: task.currentState }), _jsx("td", { className: "py-2 text-xs text-slate-600", children: task.description || "No task description" }), _jsxs("td", { className: "py-2 text-xs text-slate-500", children: ["Roles: ", task.assignedRoles.join(", ") || "N/A"] }), _jsx("td", { className: "py-2", children: detailLink === "#" ? (_jsx("span", { className: "text-xs text-slate-400", children: "N/A" })) : (_jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx(Link, { to: taskLink, className: "rounded border border-slate-300 px-2 py-1 text-xs", children: "View Task" }), _jsx(Link, { to: detailLink, className: "rounded border border-slate-300 px-2 py-1 text-xs", children: "Open Object" })] })) })] }, task.instanceId));
                        }) })] }))] }));
}
//# sourceMappingURL=page.js.map