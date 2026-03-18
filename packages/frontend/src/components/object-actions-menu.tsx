import { useState } from "react";

export type ObjectActionKey =
  | "checkout"
  | "checkin"
  | "revise"
  | "copy"
  | "delete"
  | "create_release"
  | "create_change"
  | "create_npd";

interface ObjectActionItem {
  key: ObjectActionKey;
  label: string;
  disabled?: boolean;
  danger?: boolean;
}

interface ObjectActionsMenuProps {
  onAction: (action: ObjectActionKey) => void;
  actions?: ObjectActionItem[];
}

const defaultActions: ObjectActionItem[] = [
  { key: "checkout", label: "Check Out" },
  { key: "checkin", label: "Check In" },
  { key: "revise", label: "Revise" },
  { key: "copy", label: "Save as Copy" },
  { key: "delete", label: "Delete", danger: true }
];

export function ObjectActionsMenu({ onAction, actions = defaultActions }: ObjectActionsMenuProps): JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block text-left">
      <button type="button" onClick={() => setOpen((current) => !current)} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs">
        Actions
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-1 w-36 rounded border border-slate-200 bg-white p-1 shadow-lg">
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              disabled={action.disabled}
              onClick={() => {
                setOpen(false);
                if (!action.disabled) {
                  onAction(action.key);
                }
              }}
              className={`block w-full rounded px-2 py-1 text-left text-xs ${
                action.disabled ? "cursor-not-allowed text-slate-400" : action.danger ? "text-danger hover:bg-red-50" : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
