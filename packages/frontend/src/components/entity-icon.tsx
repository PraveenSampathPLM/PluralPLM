import {
  type LucideIcon,
  Package,
  PackageCheck,
  Boxes,
  FlaskConical,
  Atom,
  Layers,
  FileText,
  GitCompare,
  Rocket
} from "lucide-react";

type EntityKind = "item" | "formula" | "bom" | "document" | "change" | "release";
type ItemVariant = "RAW_MATERIAL" | "INTERMEDIATE" | "FINISHED_GOOD" | "PACKAGING" | string | undefined;

interface Props {
  kind: EntityKind;
  size?: number;
  className?: string;
  variant?: ItemVariant;
}

const iconMap: Record<EntityKind, LucideIcon> = {
  item: Package,
  formula: FlaskConical,
  bom: Layers,
  document: FileText,
  change: GitCompare,
  release: Rocket
};

export function EntityIcon({ kind, size = 16, className, variant }: Props): JSX.Element {
  let Icon = iconMap[kind] ?? Package;
  if (kind === "item") {
    switch (variant) {
      case "RAW_MATERIAL":
        Icon = Atom;
        break;
      case "INTERMEDIATE":
        Icon = Layers;
        break;
      case "FINISHED_GOOD":
        Icon = PackageCheck;
        break;
      case "PACKAGING":
        Icon = Boxes;
        break;
      default:
        Icon = Package;
    }
  }
  return <Icon size={size} strokeWidth={1.7} className={className} />;
}
