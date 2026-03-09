import { jsx as _jsx } from "react/jsx-runtime";
import { Package, PackageCheck, Boxes, FlaskConical, Atom, Layers, FileText, GitCompare, Rocket } from "lucide-react";
const iconMap = {
    item: Package,
    formula: FlaskConical,
    bom: Layers,
    document: FileText,
    change: GitCompare,
    release: Rocket
};
export function EntityIcon({ kind, size = 16, className, variant }) {
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
    return _jsx(Icon, { size: size, strokeWidth: 1.7, className: className });
}
//# sourceMappingURL=entity-icon.js.map