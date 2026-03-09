import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import logoUrl from "@/assets/plural-plm-logo.svg";
export function PluralLogo({ compact = false }) {
    return (_jsx("div", { className: "flex items-center gap-3", children: compact ? (_jsxs("svg", { width: 28, height: 28, viewBox: "0 0 34 34", "aria-hidden": "true", children: [_jsx("defs", { children: _jsxs("linearGradient", { id: "pluralLogoGrad", x1: "0%", y1: "0%", x2: "100%", y2: "100%", children: [_jsx("stop", { offset: "0%", stopColor: "#1B4F72" }), _jsx("stop", { offset: "100%", stopColor: "#E67E22" })] }) }), _jsx("rect", { x: "1.5", y: "1.5", width: "31", height: "31", rx: "9", fill: "#0F2027" }), _jsx("path", { d: "M9 9h8.4c4.4 0 7.1 2.3 7.1 6.2 0 3.9-2.7 6.2-7.1 6.2h-4.2V25H9V9Zm8.2 9.3c2 0 3.1-1 3.1-2.9s-1.1-2.8-3.1-2.8h-4v5.7h4Z", fill: "url(#pluralLogoGrad)" })] })) : (_jsx("img", { src: logoUrl, alt: "Plural PLM", className: "h-8 w-auto" })) }));
}
//# sourceMappingURL=plural-logo.js.map