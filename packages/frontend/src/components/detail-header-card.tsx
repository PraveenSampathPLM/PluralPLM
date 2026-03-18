import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface DetailHeaderCardProps {
  icon?: ReactNode;
  code?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  backTo: string;
  backLabel: string;
  actions?: ReactNode;
}

export function DetailHeaderCard({
  icon,
  code,
  title,
  meta,
  backTo,
  backLabel,
  actions
}: DetailHeaderCardProps): JSX.Element {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {icon ? <div className="rounded-full bg-slate-100 p-2">{icon}</div> : null}
          <div>
            {code ? <p className="font-mono text-sm text-slate-500">{code}</p> : null}
            <h2 className="font-heading text-xl">{title}</h2>
            {meta ? <p className="text-sm text-slate-500">{meta}</p> : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {actions}
          <Link to={backTo} className="rounded border border-slate-300 bg-white px-3 py-1 text-sm">
            {backLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}

