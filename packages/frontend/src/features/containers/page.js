import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
const defaults = ["ITEM_READ", "ITEM_WRITE", "FORMULA_READ", "FORMULA_WRITE", "BOM_READ", "BOM_WRITE", "DOCUMENT_READ", "DOCUMENT_WRITE"];
export function ContainersPage() {
    const queryClient = useQueryClient();
    const [selectedContainerId, setSelectedContainerId] = useState("");
    const [createForm, setCreateForm] = useState({ code: "", name: "", description: "", industry: "CHEMICAL" });
    const [roleForm, setRoleForm] = useState({ name: "", description: "", permissions: defaults.join(",") });
    const [memberForm, setMemberForm] = useState({ userId: "", containerRoleId: "" });
    const [message, setMessage] = useState("");
    const containers = useQuery({
        queryKey: ["containers"],
        queryFn: async () => (await api.get("/containers")).data
    });
    const selected = useMemo(() => containers.data?.data.find((container) => container.id === selectedContainerId), [containers.data?.data, selectedContainerId]);
    const permissionsQuery = useQuery({
        queryKey: ["container-permissions"],
        queryFn: async () => (await api.get("/containers/permissions")).data
    });
    const roles = useQuery({
        queryKey: ["container-roles", selectedContainerId],
        queryFn: async () => (await api.get(`/containers/${selectedContainerId}/roles`)).data,
        enabled: Boolean(selectedContainerId)
    });
    const members = useQuery({
        queryKey: ["container-members", selectedContainerId],
        queryFn: async () => (await api.get(`/containers/${selectedContainerId}/members`)).data,
        enabled: Boolean(selectedContainerId)
    });
    const users = useQuery({
        queryKey: ["container-user-options"],
        queryFn: async () => (await api.get("/containers/user-options")).data
    });
    const createContainer = useMutation({
        mutationFn: async () => {
            const payload = { ...createForm, description: createForm.description || undefined };
            const created = await api.post("/containers", payload);
            return created.data;
        },
        onSuccess: async (created) => {
            setMessage(`Container ${created.code} created.`);
            setCreateForm({ code: "", name: "", description: "", industry: "CHEMICAL" });
            setSelectedContainerId(created.id);
            await queryClient.invalidateQueries({ queryKey: ["containers"] });
        },
        onError: (error) => setMessage(error instanceof Error ? error.message : "Create failed")
    });
    const createRole = useMutation({
        mutationFn: async () => {
            if (!selectedContainerId) {
                throw new Error("Select a container first");
            }
            const permissions = roleForm.permissions
                .split(",")
                .map((entry) => entry.trim())
                .filter(Boolean);
            await api.post(`/containers/${selectedContainerId}/roles`, {
                name: roleForm.name,
                description: roleForm.description || undefined,
                permissions
            });
        },
        onSuccess: async () => {
            setRoleForm({ name: "", description: "", permissions: defaults.join(",") });
            setMessage("Container role created.");
            await queryClient.invalidateQueries({ queryKey: ["container-roles", selectedContainerId] });
        },
        onError: (error) => setMessage(error instanceof Error ? error.message : "Create role failed")
    });
    const assignMember = useMutation({
        mutationFn: async () => {
            if (!selectedContainerId || !memberForm.userId || !memberForm.containerRoleId) {
                throw new Error("Select container, user, and role");
            }
            await api.post(`/containers/${selectedContainerId}/members`, memberForm);
        },
        onSuccess: async () => {
            setMessage("Container membership saved.");
            setMemberForm({ userId: "", containerRoleId: "" });
            await queryClient.invalidateQueries({ queryKey: ["container-members", selectedContainerId] });
        },
        onError: (error) => setMessage(error instanceof Error ? error.message : "Assign member failed")
    });
    return (_jsxs("div", { className: "space-y-4 rounded-xl bg-white p-4", children: [_jsx("h2", { className: "font-heading text-xl", children: "Product Containers & Access Control" }), _jsxs("div", { className: "rounded-lg border border-slate-200 bg-slate-50 p-4", children: [_jsx("h3", { className: "mb-3 font-heading text-lg", children: "Create Product Container" }), _jsxs("div", { className: "grid gap-3 md:grid-cols-3", children: [_jsx("input", { value: createForm.code, onChange: (event) => setCreateForm({ ...createForm, code: event.target.value }), placeholder: "Container Code", className: "rounded border border-slate-300 px-3 py-2 text-sm" }), _jsx("input", { value: createForm.name, onChange: (event) => setCreateForm({ ...createForm, name: event.target.value }), placeholder: "Container Name", className: "rounded border border-slate-300 px-3 py-2 text-sm" }), _jsx("input", { value: createForm.description, onChange: (event) => setCreateForm({ ...createForm, description: event.target.value }), placeholder: "Description", className: "rounded border border-slate-300 px-3 py-2 text-sm" }), _jsxs("select", { value: createForm.industry, onChange: (event) => setCreateForm({ ...createForm, industry: event.target.value }), className: "rounded border border-slate-300 px-3 py-2 text-sm", children: [_jsx("option", { value: "FOOD_BEVERAGE", children: "Food & Beverage" }), _jsx("option", { value: "CPG", children: "CPG" }), _jsx("option", { value: "CHEMICAL", children: "Chemical" }), _jsx("option", { value: "PAINT", children: "Paints & Coatings" }), _jsx("option", { value: "TYRE", children: "Tyre & Rubber" })] })] }), _jsx("button", { type: "button", onClick: () => createContainer.mutate(), disabled: !createForm.code || !createForm.name || createContainer.isPending, className: "mt-3 rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60", children: createContainer.isPending ? "Creating..." : "Create Container" })] }), _jsxs("div", { className: "rounded-lg border border-slate-200 bg-slate-50 p-4", children: [_jsx("h3", { className: "mb-3 font-heading text-lg", children: "Containers" }), _jsx("div", { className: "space-y-2", children: containers.data?.data.map((container) => (_jsxs("button", { type: "button", onClick: () => setSelectedContainerId(container.id), className: `w-full rounded border px-3 py-2 text-left text-sm ${selectedContainerId === container.id ? "border-primary bg-blue-50" : "border-slate-200 bg-white"}`, children: [_jsx("span", { className: "font-mono text-xs text-slate-500", children: container.code }), " - ", container.name, " (", container.status, ")"] }, container.id))) })] }), selected ? (_jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "rounded-lg border border-slate-200 bg-slate-50 p-4", children: [_jsx("h3", { className: "mb-3 font-heading text-lg", children: "Container Roles" }), _jsxs("div", { className: "grid gap-2", children: [_jsx("input", { value: roleForm.name, onChange: (event) => setRoleForm({ ...roleForm, name: event.target.value }), placeholder: "Role name", className: "rounded border border-slate-300 px-3 py-2 text-sm" }), _jsx("input", { value: roleForm.description, onChange: (event) => setRoleForm({ ...roleForm, description: event.target.value }), placeholder: "Description", className: "rounded border border-slate-300 px-3 py-2 text-sm" }), _jsx("textarea", { value: roleForm.permissions, onChange: (event) => setRoleForm({ ...roleForm, permissions: event.target.value }), className: "min-h-24 rounded border border-slate-300 px-3 py-2 text-sm" }), _jsxs("p", { className: "text-xs text-slate-500", children: ["Allowed permissions: ", (permissionsQuery.data?.data ?? []).join(", ")] })] }), _jsx("button", { type: "button", onClick: () => createRole.mutate(), disabled: !roleForm.name || createRole.isPending, className: "mt-3 rounded border border-slate-300 bg-white px-3 py-2 text-sm", children: createRole.isPending ? "Saving..." : "Create Role" }), _jsx("div", { className: "mt-3 space-y-2", children: roles.data?.data.map((role) => (_jsxs("div", { className: "rounded border border-slate-200 bg-white p-2 text-sm", children: [_jsx("p", { className: "font-medium", children: role.name }), _jsx("p", { className: "text-xs text-slate-500", children: role.description || "No description" }), _jsx("p", { className: "mt-1 text-xs", children: role.permissions.join(", ") })] }, role.id))) })] }), _jsxs("div", { className: "rounded-lg border border-slate-200 bg-slate-50 p-4", children: [_jsx("h3", { className: "mb-3 font-heading text-lg", children: "Memberships" }), _jsxs("div", { className: "grid gap-2", children: [_jsxs("select", { value: memberForm.userId, onChange: (event) => setMemberForm({ ...memberForm, userId: event.target.value }), className: "rounded border border-slate-300 px-3 py-2 text-sm", children: [_jsx("option", { value: "", children: "Select user" }), users.data?.data.map((user) => (_jsxs("option", { value: user.id, children: [user.name, " (", user.role.name, ")"] }, user.id)))] }), _jsxs("select", { value: memberForm.containerRoleId, onChange: (event) => setMemberForm({ ...memberForm, containerRoleId: event.target.value }), className: "rounded border border-slate-300 px-3 py-2 text-sm", children: [_jsx("option", { value: "", children: "Select container role" }), roles.data?.data.map((role) => (_jsx("option", { value: role.id, children: role.name }, role.id)))] })] }), _jsx("button", { type: "button", onClick: () => assignMember.mutate(), disabled: !memberForm.userId || !memberForm.containerRoleId || assignMember.isPending, className: "mt-3 rounded border border-slate-300 bg-white px-3 py-2 text-sm", children: assignMember.isPending ? "Saving..." : "Assign/Update Membership" }), _jsx("div", { className: "mt-3 space-y-2", children: members.data?.data.map((membership) => (_jsxs("div", { className: "rounded border border-slate-200 bg-white p-2 text-sm", children: [membership.user.name, " (", membership.user.email, ") - ", _jsx("span", { className: "font-medium", children: membership.containerRole.name })] }, membership.id))) })] })] })) : null, message ? _jsx("p", { className: "text-sm text-slate-700", children: message }) : null] }));
}
//# sourceMappingURL=page.js.map