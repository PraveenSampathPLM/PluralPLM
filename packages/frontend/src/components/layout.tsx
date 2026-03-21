import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useContainerStore } from "@/store/container.store";
import { TatvaLogo } from "@/components/tatva-logo";
import { useAuthStore } from "@/store/auth.store";
import { EntityIcon } from "@/components/entity-icon";

type NavItem = {
  to: string;
  label: string;
  icon: (props: { className?: string }) => JSX.Element;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

function IconHome({ className }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5.5v-6a1 1 0 0 0-1-1h-1a1 1 0 0 0-1 1v6H5a1 1 0 0 1-1-1v-9.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSearch({ className }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path d="M16.3 16.3 21 21" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function IconChart({ className }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M4 20h16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M7 20v-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M12 20v-10" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M17 20v-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M7 11l5-4 5 6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconTasks({ className }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M9 11.5 10.5 13l3.5-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 4h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M8 17h8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function IconTag({ className }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M3 12V7a2 2 0 0 1 2-2h5l11 11-6 6L3 12Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M7.5 7.5h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function IconSettings({ className }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M19.4 15a8.3 8.3 0 0 0 .1-1l2-1.2-2-3.6-2.3.6a7.4 7.4 0 0 0-1.7-1L15 6h-6l-.5 2.8a7.4 7.4 0 0 0-1.7 1l-2.3-.6-2 3.6 2 1.2a8.3 8.3 0 0 0 .1 1 8.3 8.3 0 0 0-.1 1l-2 1.2 2 3.6 2.3-.6a7.4 7.4 0 0 0 1.7 1L9 22h6l.5-2.8a7.4 7.4 0 0 0 1.7-1l2.3.6 2-3.6-2-1.2a8.3 8.3 0 0 0-.1-1Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconFolder({ className }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M3.5 7.5A2.5 2.5 0 0 1 6 5h4l2 2h8a2.5 2.5 0 0 1 2.5 2.5V18A3 3 0 0 1 19.5 21h-13A3 3 0 0 1 3.5 18V7.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const navGroups: NavGroup[] = [
  {
    label: "Home",
    items: [
      { to: "/", label: "Dashboard", icon: IconHome },
      { to: "/search", label: "Advanced Search", icon: IconSearch },
      { to: "/reports", label: "Reports", icon: IconChart }
    ]
  },
  {
    label: "Execution",
    items: [
      {
        to: "/npd",
        label: "NPD Projects",
        icon: (props) => (
          <svg viewBox="0 0 24 24" aria-hidden="true" className={props.className}>
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )
      },
      { to: "/tasks", label: "My Tasks", icon: IconTasks },
      { to: "/changes", label: "Changes", icon: (props) => <EntityIcon kind="change" {...props} /> },
      { to: "/releases", label: "Releases", icon: (props) => <EntityIcon kind="release" {...props} /> }
    ]
  },
  {
    label: "Design",
    items: [
      { to: "/items", label: "Items", icon: (props) => <EntityIcon kind="item" {...props} /> },
      { to: "/formulas", label: "Formulas", icon: (props) => <EntityIcon kind="formula" {...props} /> },
      { to: "/fg", label: "FG Structures", icon: (props) => <EntityIcon kind="bom" {...props} /> },
      { to: "/artworks", label: "Artworks", icon: (props) => <EntityIcon kind="artwork" {...props} /> }
    ]
  },
  {
    label: "Reference",
    items: [
      { to: "/documents", label: "Documents", icon: (props) => <EntityIcon kind="document" {...props} /> },
      { to: "/specifications", label: "Specifications", icon: IconFolder },
      { to: "/labeling", label: "Labeling", icon: IconTag }
    ]
  },
  {
    label: "Governance",
    items: [
      { to: "/containers", label: "Containers", icon: IconFolder },
      { to: "/configuration", label: "Configuration", icon: IconSettings }
    ]
  }
];

const breadcrumbLabelMap: Record<string, string> = {
  items: "Items",
  formulas: "Formulas",
  labeling: "Labeling",
  fg: "Finished Good",
  artworks: "Artworks",
  item: "Item",
  changes: "Changes",
  releases: "Releases",
  tasks: "Tasks",
  documents: "Documents",
  search: "Advanced Search",
  reports: "Reports",
  specifications: "Specifications",
  containers: "Containers",
  configuration: "Configuration",
  numbering: "Numbering",
  revisions: "Revisions",
  columns: "Columns",
  attributes: "Attributes",
  uoms: "Units of measure",
  mail: "Mail",
  "server-stats": "Server Stats",
  workflows: "Workflows",
  help: "Help Center",
  npd: "NPD Projects"
};

const breadcrumbDetailPrefixMap: Record<string, string> = {
  items: "Item",
  formulas: "Formula",
  fg: "Finished Good",
  changes: "Change",
  releases: "Release",
  tasks: "Task",
  documents: "Document",
  npd: "NPD"
};

function breadcrumbLabelForSegment(segment: string, prevSegment?: string): string {
  const known = breadcrumbLabelMap[segment];
  if (known) {
    return known;
  }
  if (prevSegment && breadcrumbDetailPrefixMap[prevSegment]) {
    return `${breadcrumbDetailPrefixMap[prevSegment]} ${segment}`;
  }
  return segment;
}

export function AppLayout(): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const { selectedContainerId, setSelectedContainerId } = useContainerStore();
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const containers = useQuery({
    queryKey: ["layout-container-options"],
    queryFn: async () => (await api.get<{ data: Array<{ id: string; code: string; name: string }> }>("/containers")).data
  });
  const tasks = useQuery({
    queryKey: ["workflow-tasks-count"],
    queryFn: async () =>
      (
        await api.get<{
          data: Array<{ instanceId: string; title?: string; entityType?: string; entityId?: string; action?: string; state?: string }>;
        }>("/workflows/tasks")
      ).data,
    refetchInterval: 30000
  });
  const taskCount = tasks.data?.data?.length ?? 0;
  const readTaskIds = useMemo(() => {
    try {
      const stored = localStorage.getItem("plm_task_reads");
      return stored ? new Set<string>(JSON.parse(stored) as string[]) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  }, [taskCount]);
  const unreadTasks = (tasks.data?.data ?? []).filter((task) => !readTaskIds.has(task.instanceId));
  const unreadCount = unreadTasks.length;
  const breadcrumbs = useMemo(() => {
    if (location.pathname === "/") {
      return [];
    }
    const segments = location.pathname.split("/").filter(Boolean);
    const crumbs: Array<{ to: string; label: string }> = [{ to: "/", label: "Dashboard" }];
    let acc = "";
    for (let i = 0; i < segments.length; i += 1) {
      const segment = segments[i] ?? "";
      const prev = segments[i - 1];
      acc += `/${segment}`;
      crumbs.push({ to: acc, label: breadcrumbLabelForSegment(segment, prev) });
    }
    return crumbs;
  }, [location.pathname]);
  useEffect(() => {
    if (!containers.data?.data) {
      return;
    }
    if (selectedContainerId) {
      const exists = containers.data.data.some((container) => container.id === selectedContainerId);
      if (exists) {
        return;
      }
      setSelectedContainerId("");
      return;
    }
    // Default to FOOD-CORE when no container is selected so seeded F&B data is visible immediately.
    const foodContainer = containers.data.data.find((container) => container.code === "FOOD-CORE");
    if (foodContainer) {
      setSelectedContainerId(foodContainer.id);
    }
  }, [containers.data?.data, selectedContainerId, setSelectedContainerId]);

  useEffect(() => {
    if (!location.pathname.startsWith("/tasks")) {
      return;
    }
    const ids = (tasks.data?.data ?? []).map((task) => task.instanceId);
    if (!ids.length) {
      return;
    }
    localStorage.setItem("plm_task_reads", JSON.stringify(ids));
  }, [location.pathname, tasks.data?.data]);

  function markTaskRead(instanceId: string): void {
    const next = new Set(readTaskIds);
    next.add(instanceId);
    localStorage.setItem("plm_task_reads", JSON.stringify(Array.from(next)));
  }

  function isNavActive(to: string): boolean {
    if (to === "/") {
      return location.pathname === "/";
    }
    return location.pathname === to || location.pathname.startsWith(`${to}/`) || location.pathname.startsWith(to);
  }

  return (
    <div className="min-h-screen bg-mainbg">
      <aside className="fixed left-0 top-0 h-screen w-64 border-r border-slate-800/80 bg-sidebar px-4 py-5 text-slate-100 shadow-2xl shadow-slate-900/25">
        <nav className="mt-8">
          {navGroups.map((group, groupIndex) => (
            <div key={group.label} className={groupIndex === 0 ? "" : "mt-6"}>
              <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{group.label}</p>
              <div className="mt-2 space-y-1">
                {group.items.map((item) => {
                  const active = isNavActive(item.to);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`group flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                        active
                          ? "bg-gradient-to-r from-primary to-[#245e86] text-white"
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 ${
                          active ? "text-white" : "text-slate-400 group-hover:text-white"
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <main className="pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/95 px-6 backdrop-blur">
          <div className="flex flex-col gap-1">
            <Link to="/" className="inline-flex w-fit">
              <TatvaLogo />
            </Link>
            {breadcrumbs.length ? (
              <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-slate-500">
                {breadcrumbs.map((crumb, idx) => {
                  const isLast = idx === breadcrumbs.length - 1;
                  return (
                    <span key={crumb.to} className="flex items-center">
                      {idx !== 0 ? <span className="mx-1 text-slate-300">/</span> : null}
                      {isLast ? (
                        <span className="max-w-[32rem] truncate font-medium text-slate-700">{crumb.label}</span>
                      ) : (
                        <Link to={crumb.to} className="max-w-[18rem] truncate hover:text-slate-700">
                          {crumb.label}
                        </Link>
                      )}
                    </span>
                  );
                })}
              </nav>
            ) : (
              <p className="text-xs text-slate-500">Product Lifecycle Platform</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedContainerId}
              onChange={(event) => setSelectedContainerId(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs shadow-sm"
            >
              <option value="">All Accessible Containers</option>
              {containers.data?.data.map((container) => (
                <option key={container.id} value={container.id}>
                  {container.code} - {container.name}
                </option>
              ))}
            </select>
            <Link to="/help" className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700">
              Help Center
            </Link>
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotificationsOpen((prev) => !prev)}
                className="relative rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
              >
                <span className="flex items-center gap-2 text-slate-700">
                  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" className="text-slate-600">
                    <path
                      fill="currentColor"
                      d="M12 22a2.5 2.5 0 0 0 2.5-2.5h-5A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5-6.7V3a2 2 0 1 0-4 0v1.3A7 7 0 0 0 5 11v5l-2 2v1h18v-1l-2-2Z"
                    />
                  </svg>
                  Notifications
                </span>
                {unreadCount > 0 ? (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] text-white">
                    {unreadCount}
                  </span>
                ) : null}
              </button>
              {notificationsOpen ? (
                <div className="absolute right-0 mt-2 w-80 rounded-lg border border-slate-200 bg-white shadow-lg">
                  <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-xs text-slate-600">
                    <span>
                      Unread {unreadCount} / Total {taskCount}
                    </span>
                    <button
                      type="button"
                      className="text-xs text-primary"
                      onClick={() => {
                        const ids = (tasks.data?.data ?? []).map((task) => task.instanceId);
                        localStorage.setItem("plm_task_reads", JSON.stringify(ids));
                        setNotificationsOpen(false);
                        navigate("/tasks");
                      }}
                    >
                      View all
                    </button>
                  </div>
                  <div className="max-h-64 overflow-auto">
                    {tasks.isLoading ? (
                      <p className="px-3 py-3 text-xs text-slate-500">Loading tasks...</p>
                    ) : tasks.data?.data?.length ? (
                      tasks.data.data.slice(0, 5).map((task) => (
                        <button
                          key={task.instanceId}
                          type="button"
                          onClick={() => {
                            markTaskRead(task.instanceId);
                            setNotificationsOpen(false);
                            navigate(`/tasks/${task.instanceId}`);
                          }}
                          className="flex w-full flex-col gap-1 border-b border-slate-100 px-3 py-2 text-left text-xs hover:bg-slate-50"
                        >
                          <span className="font-medium text-slate-800">{task.title ?? "Workflow Task"}</span>
                          <span className="text-slate-500">
                            {task.entityType ?? "Item"} · {task.state ?? task.action ?? "Pending"}
                          </span>
                        </button>
                      ))
                    ) : (
                      <p className="px-3 py-3 text-xs text-slate-500">No tasks assigned.</p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => {
                clearAuth();
                navigate("/login");
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700"
            >
              Logout
            </button>
          </div>
        </header>
        <section className="p-6">
          <Outlet />
        </section>
      </main>
    </div>
  );
}
