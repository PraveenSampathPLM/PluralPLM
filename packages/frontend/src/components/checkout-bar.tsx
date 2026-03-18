import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface CheckoutInfo {
  checkedOutById?: string | null | undefined;
  checkedOutBy?: { id: string; name: string } | null | undefined;
  checkedOutAt?: string | null | undefined;
  status: string;
}

interface CheckoutBarProps {
  entityType: "items" | "formulas" | "documents" | "fg";
  entityId: string;
  info: CheckoutInfo;
  currentUserId: string;
  isAdmin?: boolean;
  queryKey: unknown[];
}

export function CheckoutBar({
  entityType,
  entityId,
  info,
  currentUserId,
  isAdmin = false,
  queryKey
}: CheckoutBarProps): JSX.Element | null {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const basePath = `/${entityType}/${entityId}`;

  const isCheckedOutByMe = info.checkedOutById === currentUserId;
  const isCheckedOutByOther = Boolean(info.checkedOutById) && !isCheckedOutByMe;
  const isInWork = info.status === "IN_WORK" || info.status === "DRAFT";
  const isReleased = info.status === "RELEASED";

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const checkout = useMutation({
    mutationFn: () => api.post(`${basePath}/checkout`),
    onSuccess: () => { invalidate(); toast.success("Checked out successfully."); },
    onError: (e) => toast.error((e as Error).message || "Checkout failed.")
  });

  const checkin = useMutation({
    mutationFn: () => api.post(`${basePath}/checkin`, {}),
    onSuccess: () => { invalidate(); toast.success("Checked in. Revision iteration bumped."); },
    onError: (e) => toast.error((e as Error).message || "Check-in failed.")
  });

  const undoCheckout = useMutation({
    mutationFn: () => api.post(`${basePath}/undo-checkout`),
    onSuccess: () => { invalidate(); toast.warning("Checkout undone — edits discarded."); },
    onError: (e) => toast.error((e as Error).message || "Undo checkout failed.")
  });

  const revise = useMutation({
    mutationFn: () => api.post(`${basePath}/revise`),
    onSuccess: (data: { data?: { id: string } }) => {
      toast.success("New revision created.");
      if (data?.data?.id) {
        setTimeout(() => navigate(`/${entityType}/${data.data!.id}`), 1200);
      } else {
        invalidate();
      }
    },
    onError: (e) => toast.error((e as Error).message || "Revision failed.")
  });

  const error =
    (checkout.error as Error)?.message ||
    (checkin.error as Error)?.message ||
    (undoCheckout.error as Error)?.message ||
    (revise.error as Error)?.message;

  if (!isInWork && !isReleased) return null;

  return (
    <div className="rounded border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          {isCheckedOutByMe ? (
            <>
              <span className="inline-flex items-center gap-1.5 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Checked out by you
              </span>
              {info.checkedOutAt ? (
                <span className="text-xs text-slate-400">
                  since {new Date(info.checkedOutAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                </span>
              ) : null}
            </>
          ) : isCheckedOutByOther ? (
            <span className="inline-flex items-center gap-1.5 rounded bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              Checked out by {info.checkedOutBy?.name ?? "another user"}
            </span>
          ) : isInWork ? (
            <span className="text-xs text-slate-500">Not checked out — check out to edit</span>
          ) : (
            <span className="text-xs text-slate-500">Released — create a new revision to edit</span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {isInWork && !info.checkedOutById ? (
            <button
              type="button"
              disabled={checkout.isPending}
              onClick={() => checkout.mutate()}
              className="rounded border border-primary px-3 py-1 text-xs font-medium text-primary hover:bg-primary hover:text-white disabled:opacity-60"
            >
              {checkout.isPending ? "Checking out..." : "Check Out"}
            </button>
          ) : null}

          {isCheckedOutByMe ? (
            <>
              <button
                type="button"
                disabled={checkin.isPending}
                onClick={() => checkin.mutate()}
                className="rounded border border-green-600 bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-60"
              >
                {checkin.isPending ? "Checking in..." : "Check In"}
              </button>
              <button
                type="button"
                disabled={undoCheckout.isPending}
                onClick={() => {
                  if (confirm("This will discard all unsaved edits and restore the object to its pre-checkout state. Continue?")) {
                    undoCheckout.mutate();
                  }
                }}
                className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:border-red-400 hover:text-red-600 disabled:opacity-60"
              >
                Undo Checkout
              </button>
            </>
          ) : null}

          {isCheckedOutByOther && isAdmin ? (
            <button
              type="button"
              disabled={undoCheckout.isPending}
              onClick={() => {
                if (confirm("Admin override: discard the other user's checkout and restore the object. Continue?")) {
                  undoCheckout.mutate();
                }
              }}
              className="rounded border border-orange-400 px-3 py-1 text-xs font-medium text-orange-700 hover:bg-orange-50 disabled:opacity-60"
            >
              Admin: Force Undo Checkout
            </button>
          ) : null}

          {isReleased && entityType !== "documents" && entityType !== "fg" ? (
            <button
              type="button"
              disabled={revise.isPending}
              onClick={() => {
                if (confirm("Create a new IN_WORK revision based on this released version?")) {
                  revise.mutate();
                }
              }}
              className="rounded border border-blue-600 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-60"
            >
              {revise.isPending ? "Creating revision..." : "Revise"}
            </button>
          ) : null}
        </div>
      </div>

      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
