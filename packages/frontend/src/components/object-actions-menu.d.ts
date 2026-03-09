export type ObjectActionKey = "checkout" | "checkin" | "revise" | "copy" | "delete" | "create_release" | "create_change";
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
export declare function ObjectActionsMenu({ onAction, actions }: ObjectActionsMenuProps): JSX.Element;
export {};
