import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Link, useParams } from "react-router-dom";
export function TaskDetailPage() {
    const params = useParams();
    const taskId = String(params.id ?? "");
    const { data, isLoading } = useQuery({
        queryKey: ["workflow-tasks"],
        queryFn: async () => (await api.get("/workflows/tasks")).data
    });
    const task = data?.data.find((row) => row.instanceId === taskId);
    if (isLoading) {
        return _jsx("div", { className: "rounded-lg bg-white p-4", children: "Loading task..." });
    }
    if (!task) {
        return _jsx("div", { className: "rounded-lg bg-white p-4", children: "Task not found." });
    }
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
    return (_jsxs("div", { className: "space-y-4 rounded-xl bg-white p-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs text-slate-500", children: "Workflow Task" }), _jsx("h2", { className: "font-heading text-xl", children: task.definitionName }), _jsxs("p", { className: "text-sm text-slate-500", children: [task.entityType, " \u00B7 ", task.currentState] })] }), _jsx(Link, { to: "/tasks", className: "rounded border border-slate-300 bg-white px-3 py-1 text-sm", children: "Back to Tasks" })] }), _jsxs("div", { className: "rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm", children: [_jsx("p", { className: "mb-2 font-medium", children: "Assigned Roles" }), _jsx("p", { className: "text-slate-700", children: task.assignedRoles.join(", ") || "N/A" })] }), _jsxs("div", { className: "rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm", children: [_jsx("p", { className: "mb-2 font-medium", children: "Task Description" }), _jsx("p", { className: "text-slate-700", children: task.description || "No task description configured." })] }), _jsxs("div", { className: "rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm", children: [_jsx("p", { className: "mb-2 font-medium", children: "Routing" }), detailLink === "#" ? (_jsx("p", { className: "text-slate-500", children: "No object link available." })) : (_jsx(Link, { to: detailLink, className: "rounded border border-slate-300 bg-white px-3 py-1 text-xs", children: "Open Object" }))] })] }));
}
//# sourceMappingURL=detail-page.js.map