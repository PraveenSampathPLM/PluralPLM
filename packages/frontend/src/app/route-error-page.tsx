import { isRouteErrorResponse, Link, useRouteError } from "react-router-dom";

export function RouteErrorPage(): JSX.Element {
  const error = useRouteError();

  let title = "Something went wrong";
  let message = "The page could not be loaded.";

  if (isRouteErrorResponse(error)) {
    title = `${error.status} ${error.statusText}`;
    message = typeof error.data === "string" ? error.data : "The requested page is unavailable.";
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <div className="min-h-screen bg-mainbg p-6">
      <div className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-slate-500">Plural PLM</p>
        <h1 className="mt-2 font-heading text-2xl text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
        <div className="mt-4 flex items-center gap-2">
          <Link to="/" className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700">
            Go to Dashboard
          </Link>
          <Link to="/items" className="rounded bg-primary px-3 py-1.5 text-sm text-white">
            Open Items
          </Link>
        </div>
      </div>
    </div>
  );
}
