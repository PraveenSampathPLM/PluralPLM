import { Navigate, createBrowserRouter } from "react-router-dom";
import { AppLayout } from "@/components/layout";
import { DashboardPage } from "@/features/dashboard/page";
import { ItemsPage } from "@/features/items/page";
import { ItemDetailPage } from "@/features/items/detail-page";
import { ItemThreadPage } from "@/features/items/thread-page";
import { FormulasPage } from "@/features/formulas/page";
import { FormulaDetailPage } from "@/features/formulas/detail-page";
import { FormulaThreadPage } from "@/features/formulas/thread-page";
import { LabelingPage } from "@/features/labeling/page";
import { FgPage } from "@/features/fg/page";
import { FgDetailPage } from "@/features/fg/detail-page";
import { FgByItemPage } from "@/features/fg/by-item-page";
import { ChangesPage } from "@/features/changes/page";
import { ChangeDetailPage } from "@/features/changes/detail-page";
import { ReleasesPage } from "@/features/releases/page";
import { ReleaseDetailPage } from "@/features/releases/detail-page";
import { LoginPage } from "@/features/auth/login-page";
import { ProtectedRoute } from "@/app/protected-route";
import { RouteErrorPage } from "@/app/route-error-page";
import { SpecificationsPage } from "@/features/specifications/page";
import { SpecificationDetailPage } from "@/features/specifications/detail-page";
import { ConfigurationIndexPage } from "@/features/configuration/index-page";
import { ConfigurationNumberingPage } from "@/features/configuration/numbering-page";
import { ConfigurationRevisionsPage } from "@/features/configuration/revisions-page";
import { ConfigurationColumnsPage } from "@/features/configuration/columns-page";
import { ConfigurationAttributesPage } from "@/features/configuration/attributes-page";
import { ConfigurationUomsPage } from "@/features/configuration/uoms-page";
import { ConfigurationWorkflowsPage } from "@/features/configuration/workflows-page";
import { ConfigurationMailPage } from "@/features/configuration/mail-page";
import { ConfigurationServerStatsPage } from "@/features/configuration/server-stats-page";
import { ContainersPage } from "@/features/containers/page";
import { TasksPage } from "@/features/tasks/page";
import { TaskDetailPage } from "@/features/tasks/detail-page";
import { DocumentsPage } from "@/features/documents/page";
import { DocumentDetailPage } from "@/features/documents/detail-page";
import { HelpCenterPage } from "@/features/help/page";
import { AdvancedSearchPage } from "@/features/search/page";
import { ArtworksPage } from "@/features/artworks/page";
import { ArtworkDetailPage } from "@/features/artworks/detail-page";
import { ReportsPage } from "@/features/reports/page";
import { NpdPage } from "@/features/npd/page";
import { NpdDetailPage } from "@/features/npd/detail-page";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
    errorElement: <RouteErrorPage />
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "items", element: <ItemsPage /> },
      { path: "items/:id", element: <ItemDetailPage /> },
      { path: "items/:id/thread", element: <ItemThreadPage /> },
      { path: "formulas", element: <FormulasPage /> },
      { path: "formulas/:id", element: <FormulaDetailPage /> },
      { path: "formulas/:id/thread", element: <FormulaThreadPage /> },
      { path: "labeling", element: <LabelingPage /> },
      { path: "fg", element: <FgPage /> },
      { path: "fg/item/:itemId", element: <FgByItemPage /> },
      { path: "fg/:id", element: <FgDetailPage /> },
      { path: "bom", element: <Navigate to="/fg" replace /> },
      { path: "bom/:id", element: <Navigate to="/fg" replace /> },
      { path: "changes", element: <ChangesPage /> },
      { path: "changes/:id", element: <ChangeDetailPage /> },
      { path: "releases", element: <ReleasesPage /> },
      { path: "releases/:id", element: <ReleaseDetailPage /> },
      { path: "npd", element: <NpdPage /> },
      { path: "npd/:id", element: <NpdDetailPage /> },
      { path: "workflows", element: <Navigate to="/configuration/workflows" replace /> },
      { path: "tasks", element: <TasksPage /> },
      { path: "tasks/:id", element: <TaskDetailPage /> },
      { path: "documents", element: <DocumentsPage /> },
      { path: "documents/:id", element: <DocumentDetailPage /> },
      { path: "artworks", element: <ArtworksPage /> },
      { path: "artworks/:id", element: <ArtworkDetailPage /> },
      { path: "search", element: <AdvancedSearchPage /> },
      { path: "reports", element: <ReportsPage /> },
      { path: "specifications", element: <SpecificationsPage /> },
      { path: "specifications/:id", element: <SpecificationDetailPage /> },
      { path: "containers", element: <ContainersPage /> },
      { path: "configuration", element: <ConfigurationIndexPage /> },
      { path: "configuration/numbering", element: <ConfigurationNumberingPage /> },
      { path: "configuration/revisions", element: <ConfigurationRevisionsPage /> },
      { path: "configuration/columns", element: <ConfigurationColumnsPage /> },
      { path: "configuration/attributes", element: <ConfigurationAttributesPage /> },
      { path: "configuration/uoms", element: <ConfigurationUomsPage /> },
      { path: "configuration/mail", element: <ConfigurationMailPage /> },
      { path: "configuration/server-stats", element: <ConfigurationServerStatsPage /> },
      { path: "configuration/workflows", element: <ConfigurationWorkflowsPage /> },
      { path: "help", element: <HelpCenterPage /> }
    ]
  }
]);
