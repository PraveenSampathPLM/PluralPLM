type EntityKind = "item" | "formula" | "bom" | "document" | "change" | "release";
type ItemVariant = "RAW_MATERIAL" | "INTERMEDIATE" | "FINISHED_GOOD" | "PACKAGING" | string | undefined;
interface Props {
    kind: EntityKind;
    size?: number;
    className?: string;
    variant?: ItemVariant;
}
export declare function EntityIcon({ kind, size, className, variant }: Props): JSX.Element;
export {};
