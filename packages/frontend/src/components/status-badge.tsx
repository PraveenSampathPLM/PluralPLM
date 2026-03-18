interface StatusBadgeProps {
  status: string | null | undefined;
}

function normalizeStatus(status?: string | null): string {
  if (!status) {
    return "UNKNOWN";
  }
  return String(status).toUpperCase();
}

function statusClasses(status: string): string {
  if (["RELEASED", "IMPLEMENTED", "COMPLETED", "CLOSED"].includes(status)) {
    return "bg-emerald-100 text-emerald-700 ring-emerald-200";
  }
  if (["UNDER_REVIEW", "SUBMITTED", "PENDING", "ON_HOLD"].includes(status)) {
    return "bg-amber-100 text-amber-700 ring-amber-200";
  }
  if (["REJECTED", "FAILED", "ARCHIVED", "CANCELLED", "CANCELED"].includes(status)) {
    return "bg-rose-100 text-rose-700 ring-rose-200";
  }
  if (["OBSOLETE"].includes(status)) {
    return "bg-red-100 text-red-700 ring-red-300";
  }
  if (["IN_WORK", "NEW"].includes(status)) {
    return "bg-slate-100 text-slate-700 ring-slate-200";
  }
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

export function StatusBadge({ status }: StatusBadgeProps): JSX.Element {
  const normalized = normalizeStatus(status);
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${statusClasses(normalized)}`}>
      {normalized}
    </span>
  );
}
