import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface ContainerRecord {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  status: "ACTIVE" | "ARCHIVED";
}

interface ContainerRoleRecord {
  id: string;
  name: string;
  description?: string | null;
  permissions: string[];
}

interface ContainerMemberRecord {
  id: string;
  userId: string;
  containerRoleId: string;
  user: { id: string; name: string; email: string };
  containerRole: { id: string; name: string };
}

interface UserOption {
  id: string;
  name: string;
  email: string;
  role: { name: string };
}

const defaults = ["ITEM_READ", "ITEM_WRITE", "FORMULA_READ", "FORMULA_WRITE", "BOM_READ", "BOM_WRITE", "DOCUMENT_READ", "DOCUMENT_WRITE"];

export function ContainersPage(): JSX.Element {
  const queryClient = useQueryClient();
  const [selectedContainerId, setSelectedContainerId] = useState("");
  const [createForm, setCreateForm] = useState({ code: "", name: "", description: "", industry: "CHEMICAL" });
  const [roleForm, setRoleForm] = useState({ name: "", description: "", permissions: defaults.join(",") });
  const [memberForm, setMemberForm] = useState({ userId: "", containerRoleId: "" });
  const [message, setMessage] = useState("");

  const containers = useQuery({
    queryKey: ["containers"],
    queryFn: async () => (await api.get<{ data: ContainerRecord[] }>("/containers")).data
  });

  const selected = useMemo(
    () => containers.data?.data.find((container) => container.id === selectedContainerId),
    [containers.data?.data, selectedContainerId]
  );

  const permissionsQuery = useQuery({
    queryKey: ["container-permissions"],
    queryFn: async () => (await api.get<{ data: string[] }>("/containers/permissions")).data
  });

  const roles = useQuery({
    queryKey: ["container-roles", selectedContainerId],
    queryFn: async () => (await api.get<{ data: ContainerRoleRecord[] }>(`/containers/${selectedContainerId}/roles`)).data,
    enabled: Boolean(selectedContainerId)
  });

  const members = useQuery({
    queryKey: ["container-members", selectedContainerId],
    queryFn: async () => (await api.get<{ data: ContainerMemberRecord[] }>(`/containers/${selectedContainerId}/members`)).data,
    enabled: Boolean(selectedContainerId)
  });

  const users = useQuery({
    queryKey: ["container-user-options"],
    queryFn: async () => (await api.get<{ data: UserOption[] }>("/containers/user-options")).data
  });

  const createContainer = useMutation({
    mutationFn: async () => {
      const payload = { ...createForm, description: createForm.description || undefined };
      const created = await api.post<ContainerRecord>("/containers", payload);
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

  return (
    <div className="space-y-4 rounded-xl bg-white p-4">
      <h2 className="font-heading text-xl">Product Containers & Access Control</h2>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h3 className="mb-3 font-heading text-lg">Create Product Container</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <input
            value={createForm.code}
            onChange={(event) => setCreateForm({ ...createForm, code: event.target.value })}
            placeholder="Container Code"
            className="rounded border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={createForm.name}
            onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })}
            placeholder="Container Name"
            className="rounded border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={createForm.description}
            onChange={(event) => setCreateForm({ ...createForm, description: event.target.value })}
            placeholder="Description"
            className="rounded border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={createForm.industry}
            onChange={(event) => setCreateForm({ ...createForm, industry: event.target.value })}
            className="rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="FOOD_BEVERAGE">Food & Beverage</option>
            <option value="CPG">CPG</option>
            <option value="CHEMICAL">Chemical</option>
            <option value="PAINT">Paints & Coatings</option>
            <option value="TYRE">Tyre & Rubber</option>
          </select>
        </div>
        <button
          type="button"
          onClick={() => createContainer.mutate()}
          disabled={!createForm.code || !createForm.name || createContainer.isPending}
          className="mt-3 rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {createContainer.isPending ? "Creating..." : "Create Container"}
        </button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h3 className="mb-3 font-heading text-lg">Containers</h3>
        <div className="space-y-2">
          {containers.data?.data.map((container) => (
            <button
              type="button"
              key={container.id}
              onClick={() => setSelectedContainerId(container.id)}
              className={`w-full rounded border px-3 py-2 text-left text-sm ${
                selectedContainerId === container.id ? "border-primary bg-blue-50" : "border-slate-200 bg-white"
              }`}
            >
              <span className="font-mono text-xs text-slate-500">{container.code}</span> - {container.name} ({container.status})
            </button>
          ))}
        </div>
      </div>

      {selected ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="mb-3 font-heading text-lg">Container Roles</h3>
            <div className="grid gap-2">
              <input
                value={roleForm.name}
                onChange={(event) => setRoleForm({ ...roleForm, name: event.target.value })}
                placeholder="Role name"
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={roleForm.description}
                onChange={(event) => setRoleForm({ ...roleForm, description: event.target.value })}
                placeholder="Description"
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <textarea
                value={roleForm.permissions}
                onChange={(event) => setRoleForm({ ...roleForm, permissions: event.target.value })}
                className="min-h-24 rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <p className="text-xs text-slate-500">Allowed permissions: {(permissionsQuery.data?.data ?? []).join(", ")}</p>
            </div>
            <button
              type="button"
              onClick={() => createRole.mutate()}
              disabled={!roleForm.name || createRole.isPending}
              className="mt-3 rounded border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {createRole.isPending ? "Saving..." : "Create Role"}
            </button>
            <div className="mt-3 space-y-2">
              {roles.data?.data.map((role) => (
                <div key={role.id} className="rounded border border-slate-200 bg-white p-2 text-sm">
                  <p className="font-medium">{role.name}</p>
                  <p className="text-xs text-slate-500">{role.description || "No description"}</p>
                  <p className="mt-1 text-xs">{role.permissions.join(", ")}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="mb-3 font-heading text-lg">Memberships</h3>
            <div className="grid gap-2">
              <select
                value={memberForm.userId}
                onChange={(event) => setMemberForm({ ...memberForm, userId: event.target.value })}
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Select user</option>
                {users.data?.data.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.role.name})
                  </option>
                ))}
              </select>
              <select
                value={memberForm.containerRoleId}
                onChange={(event) => setMemberForm({ ...memberForm, containerRoleId: event.target.value })}
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Select container role</option>
                {roles.data?.data.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => assignMember.mutate()}
              disabled={!memberForm.userId || !memberForm.containerRoleId || assignMember.isPending}
              className="mt-3 rounded border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {assignMember.isPending ? "Saving..." : "Assign/Update Membership"}
            </button>
            <div className="mt-3 space-y-2">
              {members.data?.data.map((membership) => (
                <div key={membership.id} className="rounded border border-slate-200 bg-white p-2 text-sm">
                  {membership.user.name} ({membership.user.email}) - <span className="font-medium">{membership.containerRole.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {message ? <p className="text-sm text-slate-700">{message}</p> : null}
    </div>
  );
}
