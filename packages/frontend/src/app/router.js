import { jsx as _jsx } from "react/jsx-runtime";
import { Navigate, createBrowserRouter } from "react-router-dom";
import { AppLayout } from "@/components/layout";
import { DashboardPage } from "@/features/dashboard/page";
import { ItemsPage } from "@/features/items/page";
import { ItemDetailPage } from "@/features/items/detail-page";
import { FormulasPage } from "@/features/formulas/page";
import { FormulaDetailPage } from "@/features/formulas/detail-page";
import { LabelingPage } from "@/features/labeling/page";
import { BomPage } from "@/features/bom/page";
import { BomDetailPage } from "@/features/bom/detail-page";
import { ChangesPage } from "@/features/changes/page";
import { ChangeDetailPage } from "@/features/changes/detail-page";
import { ReleasesPage } from "@/features/releases/page";
import { ReleaseDetailPage } from "@/features/releases/detail-page";
import { LoginPage } from "@/features/auth/login-page";
import { ProtectedRoute } from "@/app/protected-route";
import { SpecificationsPage } from "@/features/specifications/page";
import { ConfigurationIndexPage } from "@/features/configuration/index-page";
import { ConfigurationNumberingPage } from "@/features/configuration/numbering-page";
import { ConfigurationRevisionsPage } from "@/features/configuration/revisions-page";
import { ConfigurationColumnsPage } from "@/features/configuration/columns-page";
import { ConfigurationAttributesPage } from "@/features/configuration/attributes-page";
import { ConfigurationUomsPage } from "@/features/configuration/uoms-page";
import { ConfigurationWorkflowsPage } from "@/features/configuration/workflows-page";
import { ConfigurationMailPage } from "@/features/configuration/mail-page";
import { ContainersPage } from "@/features/containers/page";
import { TasksPage } from "@/features/tasks/page";
import { TaskDetailPage } from "@/features/tasks/detail-page";
import { DocumentsPage } from "@/features/documents/page";
import { DocumentDetailPage } from "@/features/documents/detail-page";
import { HelpCenterPage } from "@/features/help/page";
import { AdvancedSearchPage } from "@/features/search/page";
export const router = createBrowserRouter([
    {
        path: "/login",
        element: _jsx(LoginPage, {})
    },
    {
        path: "/",
        element: (_jsx(ProtectedRoute, { children: _jsx(AppLayout, {}) })),
        children: [
            { index: true, element: _jsx(DashboardPage, {}) },
            { path: "items", element: _jsx(ItemsPage, {}) },
            { path: "items/:id", element: _jsx(ItemDetailPage, {}) },
            { path: "formulas", element: _jsx(FormulasPage, {}) },
            { path: "formulas/:id", element: _jsx(FormulaDetailPage, {}) },
            { path: "labeling", element: _jsx(LabelingPage, {}) },
            { path: "bom", element: _jsx(BomPage, {}) },
            { path: "bom/:id", element: _jsx(BomDetailPage, {}) },
            { path: "changes", element: _jsx(ChangesPage, {}) },
            { path: "changes/:id", element: _jsx(ChangeDetailPage, {}) },
            { path: "releases", element: _jsx(ReleasesPage, {}) },
            { path: "releases/:id", element: _jsx(ReleaseDetailPage, {}) },
            { path: "workflows", element: _jsx(Navigate, { to: "/configuration/workflows", replace: true }) },
            { path: "tasks", element: _jsx(TasksPage, {}) },
            { path: "tasks/:id", element: _jsx(TaskDetailPage, {}) },
            { path: "documents", element: _jsx(DocumentsPage, {}) },
            { path: "documents/:id", element: _jsx(DocumentDetailPage, {}) },
            { path: "search", element: _jsx(AdvancedSearchPage, {}) },
            { path: "specifications", element: _jsx(SpecificationsPage, {}) },
            { path: "containers", element: _jsx(ContainersPage, {}) },
            { path: "configuration", element: _jsx(ConfigurationIndexPage, {}) },
            { path: "configuration/numbering", element: _jsx(ConfigurationNumberingPage, {}) },
            { path: "configuration/revisions", element: _jsx(ConfigurationRevisionsPage, {}) },
            { path: "configuration/columns", element: _jsx(ConfigurationColumnsPage, {}) },
            { path: "configuration/attributes", element: _jsx(ConfigurationAttributesPage, {}) },
            { path: "configuration/uoms", element: _jsx(ConfigurationUomsPage, {}) },
            { path: "configuration/mail", element: _jsx(ConfigurationMailPage, {}) },
            { path: "configuration/workflows", element: _jsx(ConfigurationWorkflowsPage, {}) },
            { path: "help", element: _jsx(HelpCenterPage, {}) }
        ]
    }
]);
//# sourceMappingURL=router.js.map