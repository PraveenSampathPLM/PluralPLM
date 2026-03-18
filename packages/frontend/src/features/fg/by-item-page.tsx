import { useQuery } from "@tanstack/react-query";
import { Navigate, Link, useParams } from "react-router-dom";
import { api } from "@/lib/api";

interface FGByItemResponse {
  data: Array<{ id: string; version: number }>;
}

export function FgByItemPage(): JSX.Element {
  const params = useParams();
  const itemId = String(params.itemId ?? "");

  const query = useQuery({
    queryKey: ["fg-by-item", itemId],
    queryFn: async () =>
      (
        await api.get<FGByItemResponse>("/fg", {
          params: { fgItemId: itemId, page: 1, pageSize: 1 }
        })
      ).data,
    enabled: Boolean(itemId)
  });

  if (query.isLoading) {
    return <div className="rounded-lg bg-white p-4">Loading FG structure...</div>;
  }

  const latest = query.data?.data?.[0];
  if (latest?.id) {
    return <Navigate to={`/fg/${latest.id}`} replace />;
  }

  return (
    <div className="rounded-lg bg-white p-4 text-sm">
      <p className="mb-2 text-slate-600">No FG structure exists yet for this item.</p>
      <Link to={`/items/${itemId}`} className="rounded border border-slate-300 px-3 py-1 text-xs">
        Open Item Structure Tab
      </Link>
    </div>
  );
}
