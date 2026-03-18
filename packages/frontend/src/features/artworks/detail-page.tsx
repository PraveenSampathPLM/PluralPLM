import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DetailHeaderCard } from "@/components/detail-header-card";
import { EntityIcon } from "@/components/entity-icon";
import { StatusBadge } from "@/components/status-badge";
import { FloatingInput, FloatingSelect } from "@/components/floating-field";
import { ObjectActionsMenu, type ObjectActionKey } from "@/components/object-actions-menu";

interface ArtworkComponent {
  id: string;
  componentType: string;
  name: string;
  dimensions?: string | null;
  substrate?: string | null;
  printProcess?: string | null;
  variantKey?: string | null;
  files?: ArtworkFile[];
}

interface Annotation {
  id: string;
  annotation: string;
  status: string;
  createdAt: string;
}

interface ArtworkFile {
  id: string;
  fileType: string;
  fileName: string;
  mimeType?: string;
  createdAt: string;
  annotations: Annotation[];
}

interface ArtworkDetail {
  id: string;
  artworkCode: string;
  title: string;
  containerId?: string | null;
  brand?: string | null;
  packSize?: string | null;
  market?: string | null;
  languageSet?: string[] | null;
  status: string;
  revisionLabel: string;
  legalCopy?: string | null;
  claims?: string[] | null;
  warnings?: string | null;
  storageConditions?: string | null;
  usageInstructions?: string | null;
  fgItem?: { id: string; itemCode: string; name: string } | null;
  packagingItem?: { id: string; itemCode: string; name: string } | null;
  formula?: { id: string; formulaCode: string; version: number; name: string } | null;
  releaseRequest?: { id: string; rrNumber: string; title: string; status: string } | null;
  components: ArtworkComponent[];
  files: ArtworkFile[];
  links: Array<{ id: string; entityType: string; entityId: string }>;
}

interface ComplianceResponse {
  compliant: boolean;
  issues: Array<{ severity: "HIGH" | "MEDIUM" | "LOW"; code: string; message: string }>;
}

interface PrintPackResponse {
  header: {
    artworkCode: string;
    revisionLabel: string;
    status: string;
    title: string;
    market?: string | null;
    brand?: string | null;
    packSize?: string | null;
  };
  approvals: Array<{ id: string; stage: string; approverRole: string; decision?: string | null; decidedAt?: string | null }>;
  files: {
    artworkLevelFinalFiles: Array<{ id: string; fileName: string; fileType: string }>;
    componentFiles: Array<{ component: string; type: string; files: Array<{ id: string; fileName: string; fileType: string }> }>;
  };
  generatedAt: string;
}

interface TraceabilityResponse {
  directLinks: {
    fgItem?: { id: string; itemCode: string; name: string } | null;
    packagingItem?: { id: string; itemCode: string; name: string } | null;
    formula?: { id: string; formulaCode: string; version: number; name: string } | null;
    releaseRequest?: { id: string; rrNumber: string; title: string; status: string } | null;
    objectLinks: Array<{ id: string; entityType: string; entityId: string }>;
  };
  relatedArtworks: Array<{ id: string; artworkCode: string; title: string; status: string; revisionLabel: string }>;
  history: Array<{ id: string; action: string; createdAt: string; actorId?: string | null }>;
}

export function ArtworkDetailPage(): JSX.Element {
  const params = useParams();
  const artworkId = String(params.id ?? "");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"details" | "components" | "proofing" | "compliance" | "print" | "traceability">("details");
  const [message, setMessage] = useState("");
  const [newComponent, setNewComponent] = useState({
    componentType: "LABEL",
    name: "",
    dimensions: "",
    substrate: "",
    printProcess: "",
    variantKey: ""
  });
  const [upload, setUpload] = useState({ fileType: "PROOF", componentId: "" });
  const [file, setFile] = useState<File | null>(null);
  const [newAnnotation, setNewAnnotation] = useState({ fileId: "", annotation: "" });
  const [selectedPreviewFileId, setSelectedPreviewFileId] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewKind, setPreviewKind] = useState<"pdf" | "image" | "unsupported">("unsupported");
  const [previewLoading, setPreviewLoading] = useState(false);

  const artwork = useQuery({
    queryKey: ["artwork-detail", artworkId],
    queryFn: async () => (await api.get<ArtworkDetail>(`/artworks/${artworkId}`)).data,
    enabled: Boolean(artworkId)
  });

  const compliance = useQuery({
    queryKey: ["artwork-compliance", artworkId],
    queryFn: async () => (await api.get<ComplianceResponse>(`/artworks/${artworkId}/compliance-check`)).data,
    enabled: Boolean(artworkId) && activeTab === "compliance"
  });

  const printPack = useQuery({
    queryKey: ["artwork-print-pack", artworkId],
    queryFn: async () => (await api.get<PrintPackResponse>(`/artworks/${artworkId}/print-pack`)).data,
    enabled: Boolean(artworkId) && activeTab === "print"
  });

  const traceability = useQuery({
    queryKey: ["artwork-traceability", artworkId],
    queryFn: async () => (await api.get<TraceabilityResponse>(`/artworks/${artworkId}/traceability`)).data,
    enabled: Boolean(artworkId) && activeTab === "traceability"
  });

  const updateArtwork = useMutation({
    mutationFn: async (payload: Partial<ArtworkDetail>) => {
      await api.put(`/artworks/${artworkId}`, payload);
    },
    onSuccess: async () => {
      setMessage("Artwork updated.");
      await queryClient.invalidateQueries({ queryKey: ["artwork-detail", artworkId] });
      await queryClient.invalidateQueries({ queryKey: ["artworks"] });
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "Update failed")
  });

  const addComponent = useMutation({
    mutationFn: async () => {
      await api.post(`/artworks/${artworkId}/components`, {
        componentType: newComponent.componentType,
        name: newComponent.name,
        dimensions: newComponent.dimensions || undefined,
        substrate: newComponent.substrate || undefined,
        printProcess: newComponent.printProcess || undefined,
        variantKey: newComponent.variantKey || undefined
      });
    },
    onSuccess: async () => {
      setMessage("Artwork component added.");
      setNewComponent({ componentType: "LABEL", name: "", dimensions: "", substrate: "", printProcess: "", variantKey: "" });
      await queryClient.invalidateQueries({ queryKey: ["artwork-detail", artworkId] });
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "Component create failed")
  });

  const uploadFile = useMutation({
    mutationFn: async () => {
      if (!file) {
        throw new Error("Pick a file to upload.");
      }
      const formData = new FormData();
      formData.append("file", file);
      formData.append("fileType", upload.fileType);
      if (upload.componentId) {
        formData.append("componentId", upload.componentId);
      }
      await api.post(`/artworks/${artworkId}/files`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
    },
    onSuccess: async () => {
      setMessage("Artwork file uploaded.");
      setFile(null);
      setUpload({ fileType: "PROOF", componentId: "" });
      await queryClient.invalidateQueries({ queryKey: ["artwork-detail", artworkId] });
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "Upload failed")
  });

  const addAnnotation = useMutation({
    mutationFn: async () => {
      if (!newAnnotation.fileId || !newAnnotation.annotation.trim()) {
        throw new Error("Select file and annotation text.");
      }
      await api.post(`/artworks/files/${newAnnotation.fileId}/annotations`, {
        annotation: newAnnotation.annotation
      });
    },
    onSuccess: async () => {
      setMessage("Annotation added.");
      setNewAnnotation({ fileId: "", annotation: "" });
      await queryClient.invalidateQueries({ queryKey: ["artwork-detail", artworkId] });
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "Annotation failed")
  });

  const deleteArtworkFile = useMutation({
    mutationFn: async (fileId: string) => {
      await api.delete(`/artworks/files/${fileId}`);
    },
    onSuccess: async () => {
      setMessage("Artwork proof deleted.");
      await queryClient.invalidateQueries({ queryKey: ["artwork-detail", artworkId] });
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "Delete failed")
  });

  const actionMutation = useMutation({
    mutationFn: async (action: ObjectActionKey) => {
      const current = artwork.data;
      if (!current) {
        throw new Error("Artwork not loaded.");
      }
      if (action === "create_release") {
        await api.post("/releases", {
          title: `Release ${current.artworkCode}`,
          description: `Release request created from artwork ${current.artworkCode} - ${current.title}.`,
          containerId: current.containerId || undefined,
          targetItems: current.fgItem?.id ? [current.fgItem.id] : [],
          targetFormulas: current.formula?.id ? [current.formula.id] : [],
          status: "NEW"
        });
        return "Release request created.";
      }
      if (action === "create_change") {
        await api.post("/changes", {
          title: `Change for ${current.artworkCode}`,
          description: `Change request created from artwork ${current.artworkCode} - ${current.title}.`,
          containerId: current.containerId || undefined,
          type: "DCO",
          priority: "MEDIUM",
          status: "NEW",
          affectedItems: current.fgItem?.itemCode ? [current.fgItem.itemCode] : [],
          affectedFormulas: current.formula?.formulaCode ? [current.formula.formulaCode] : []
        });
        return "Change request created.";
      }
      if (action === "checkout") {
        await api.post(`/artworks/${artworkId}/check-out`);
        return "Artwork checked out.";
      }
      if (action === "checkin") {
        await api.post(`/artworks/${artworkId}/check-in`);
        return "Artwork checked in.";
      }
      if (action === "revise") {
        await api.post(`/artworks/${artworkId}/revise`);
        return "Artwork revised.";
      }
      if (action === "copy") {
        await api.post(`/artworks/${artworkId}/copy`);
        return "Artwork copied.";
      }
      if (action === "delete") {
        if (!window.confirm(`Delete artwork ${current.artworkCode}?`)) {
          return "Delete cancelled.";
        }
        await api.delete(`/artworks/${artworkId}`);
        return "Artwork deleted.";
      }
      return "Action completed.";
    },
    onSuccess: async (resultMessage) => {
      setMessage(resultMessage);
      await queryClient.invalidateQueries({ queryKey: ["artwork-detail", artworkId] });
      await queryClient.invalidateQueries({ queryKey: ["artworks"] });
      await queryClient.invalidateQueries({ queryKey: ["artworks-dashboard"] });
      if (resultMessage === "Artwork deleted.") {
        navigate("/artworks");
      }
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "Action failed")
  });

  const allFiles = useMemo(() => {
    const rows = [...(artwork.data?.files ?? [])];
    for (const component of artwork.data?.components ?? []) {
      rows.push(...(component.files ?? []));
    }
    return rows;
  }, [artwork.data]);

  useEffect(() => {
    if (!allFiles.length) {
      setSelectedPreviewFileId("");
      setPreviewUrl((current) => {
        if (current) {
          URL.revokeObjectURL(current);
        }
        return "";
      });
      return;
    }
    if (!selectedPreviewFileId || !allFiles.some((row) => row.id === selectedPreviewFileId)) {
      setSelectedPreviewFileId(allFiles[0]?.id ?? "");
    }
  }, [allFiles, selectedPreviewFileId]);

  useEffect(() => {
    let cancelled = false;
    async function loadPreview(fileId: string): Promise<void> {
      const row = allFiles.find((entry) => entry.id === fileId);
      if (!row) {
        return;
      }
      const extension = row.fileName.split(".").pop()?.toLowerCase() ?? "";
      const mime = row.mimeType?.toLowerCase() ?? "";
      if (extension === "ai" || mime.includes("postscript") || mime.includes("illustrator")) {
        setPreviewKind("unsupported");
        setPreviewUrl((current) => {
          if (current) {
            URL.revokeObjectURL(current);
          }
          return "";
        });
        return;
      }
      const isPdf = mime.includes("pdf") || extension === "pdf";
      const isImage = mime.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(extension);
      if (!isPdf && !isImage) {
        setPreviewKind("unsupported");
        setPreviewUrl((current) => {
          if (current) {
            URL.revokeObjectURL(current);
          }
          return "";
        });
        return;
      }
      setPreviewLoading(true);
      try {
        const response = await api.get<Blob>(`/artworks/files/${fileId}/download`, {
          responseType: "blob"
        });
        if (cancelled) {
          return;
        }
        const objectUrl = URL.createObjectURL(response.data);
        setPreviewKind(isPdf ? "pdf" : "image");
        setPreviewUrl((current) => {
          if (current) {
            URL.revokeObjectURL(current);
          }
          return objectUrl;
        });
      } catch {
        if (!cancelled) {
          setPreviewKind("unsupported");
          setPreviewUrl((current) => {
            if (current) {
              URL.revokeObjectURL(current);
            }
            return "";
          });
        }
      } finally {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      }
    }
    if (selectedPreviewFileId) {
      void loadPreview(selectedPreviewFileId);
    }
    return () => {
      cancelled = true;
    };
  }, [allFiles, selectedPreviewFileId]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  if (artwork.isLoading) {
    return <div className="rounded-lg bg-white p-4">Loading artwork...</div>;
  }
  if (!artwork.data) {
    return <div className="rounded-lg bg-white p-4">Artwork not found.</div>;
  }

  const objectActions: Array<{ key: ObjectActionKey; label: string; disabled?: boolean; danger?: boolean }> = [
    { key: "create_release", label: "Create Release" },
    { key: "create_change", label: "Create Change" },
    { key: "checkout", label: "Check Out" },
    { key: "checkin", label: "Check In" },
    { key: "revise", label: "Revise" },
    { key: "copy", label: "Copy" },
    { key: "delete", label: "Delete", danger: true }
  ];

  return (
    <div className="space-y-4 rounded-xl bg-white p-4">
      <DetailHeaderCard
        icon={<EntityIcon kind="artwork" size={20} />}
        code={`${artwork.data.artworkCode} (${artwork.data.revisionLabel})`}
        title={artwork.data.title}
        meta={`${artwork.data.market ?? "No market"} · ${artwork.data.brand ?? "No brand"}`}
        backTo="/artworks"
        backLabel="Back to Artworks"
        actions={<ObjectActionsMenu onAction={(action) => void actionMutation.mutate(action)} actions={objectActions} />}
      />

      <div className="flex items-center gap-2 text-sm text-slate-500">
        <span>Status</span>
        <StatusBadge status={artwork.data.status} />
      </div>

      {message ? <p className="rounded border border-slate-200 bg-slate-50 p-2 text-sm text-slate-700">{message}</p> : null}

      <div className="flex items-center gap-2 border-b border-slate-200 text-sm">
        {[
          ["details", "Details"],
          ["components", "Components"],
          ["proofing", "Proofing"],
          ["compliance", "Compliance"],
          ["print", "Print Pack"],
          ["traceability", "Traceability"]
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key as "details" | "components" | "proofing" | "compliance" | "print" | "traceability")}
            className={`px-3 py-2 ${activeTab === key ? "border-b-2 border-primary font-medium text-primary" : "text-slate-500"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "details" ? (
        <div className="space-y-3 rounded border border-slate-200 bg-slate-50 p-3 text-sm">
          <div className="grid gap-3 md:grid-cols-3">
            <FloatingInput label="Title" value={artwork.data.title} onChange={(event) => updateArtwork.mutate({ title: event.target.value })} />
            <FloatingInput label="Brand" value={artwork.data.brand ?? ""} onChange={(event) => updateArtwork.mutate({ brand: event.target.value })} />
            <FloatingInput label="Market" value={artwork.data.market ?? ""} onChange={(event) => updateArtwork.mutate({ market: event.target.value })} />
            <FloatingInput label="Pack Size" value={artwork.data.packSize ?? ""} onChange={(event) => updateArtwork.mutate({ packSize: event.target.value })} />
            <FloatingInput
              label="Claims (comma-separated)"
              value={(artwork.data.claims ?? []).join(", ")}
              onChange={(event) => updateArtwork.mutate({ claims: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })}
            />
            <FloatingInput label="Warnings" value={artwork.data.warnings ?? ""} onChange={(event) => updateArtwork.mutate({ warnings: event.target.value })} />
            <FloatingInput label="Storage Conditions" value={artwork.data.storageConditions ?? ""} onChange={(event) => updateArtwork.mutate({ storageConditions: event.target.value })} />
            <FloatingInput label="Usage Instructions" value={artwork.data.usageInstructions ?? ""} onChange={(event) => updateArtwork.mutate({ usageInstructions: event.target.value })} />
            <FloatingInput label="Legal Copy" value={artwork.data.legalCopy ?? ""} onChange={(event) => updateArtwork.mutate({ legalCopy: event.target.value })} />
          </div>
          <div className="rounded border border-slate-200 bg-white p-3 text-xs">
            <p className="mb-1.5 font-medium text-slate-600">Linked Objects</p>
            <div className="flex flex-wrap gap-3">
              <span className="text-slate-400">FG Item:</span>
              {artwork.data.fgItem ? (
                <Link to={`/items/${artwork.data.fgItem.id}`} className="font-mono text-primary hover:underline">
                  {artwork.data.fgItem.itemCode} — {artwork.data.fgItem.name}
                </Link>
              ) : <span className="italic text-slate-400">None</span>}
            </div>
            <div className="mt-1 flex flex-wrap gap-3">
              <span className="text-slate-400">Packaging:</span>
              {artwork.data.packagingItem ? (
                <Link to={`/items/${artwork.data.packagingItem.id}`} className="font-mono text-primary hover:underline">
                  {artwork.data.packagingItem.itemCode} — {artwork.data.packagingItem.name}
                </Link>
              ) : <span className="italic text-slate-400">None</span>}
            </div>
            <div className="mt-1 flex flex-wrap gap-3">
              <span className="text-slate-400">Formula:</span>
              {artwork.data.formula ? (
                <Link to={`/formulas/${artwork.data.formula.id}`} className="font-mono text-primary hover:underline">
                  {artwork.data.formula.formulaCode} v{artwork.data.formula.version} — {artwork.data.formula.name}
                </Link>
              ) : <span className="italic text-slate-400">None</span>}
            </div>
            <div className="mt-1 flex flex-wrap gap-3">
              <span className="text-slate-400">Release:</span>
              {artwork.data.releaseRequest ? (
                <Link to={`/releases/${artwork.data.releaseRequest.id}`} className="font-mono text-primary hover:underline">
                  {artwork.data.releaseRequest.rrNumber} — {artwork.data.releaseRequest.title}
                </Link>
              ) : <span className="italic text-slate-400">None</span>}
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "components" ? (
        <div className="space-y-3 rounded border border-slate-200 bg-slate-50 p-3 text-sm">
          <div className="grid gap-2 md:grid-cols-3">
            <FloatingSelect label="Type" value={newComponent.componentType} onChange={(event) => setNewComponent({ ...newComponent, componentType: event.target.value })}>
              <option value="LABEL">LABEL</option>
              <option value="CARTON">CARTON</option>
              <option value="LEAFLET">LEAFLET</option>
              <option value="SHRINK">SHRINK</option>
              <option value="SLEEVE">SLEEVE</option>
              <option value="OTHER">OTHER</option>
            </FloatingSelect>
            <FloatingInput label="Name" value={newComponent.name} onChange={(event) => setNewComponent({ ...newComponent, name: event.target.value })} />
            <FloatingInput label="Dimensions" value={newComponent.dimensions} onChange={(event) => setNewComponent({ ...newComponent, dimensions: event.target.value })} />
            <FloatingInput label="Substrate" value={newComponent.substrate} onChange={(event) => setNewComponent({ ...newComponent, substrate: event.target.value })} />
            <FloatingInput label="Print Process" value={newComponent.printProcess} onChange={(event) => setNewComponent({ ...newComponent, printProcess: event.target.value })} />
            <FloatingInput label="Variant Key" value={newComponent.variantKey} onChange={(event) => setNewComponent({ ...newComponent, variantKey: event.target.value })} />
          </div>
          <button type="button" onClick={() => addComponent.mutate()} disabled={!newComponent.name || addComponent.isPending} className="rounded bg-primary px-3 py-1 text-xs text-white disabled:opacity-60">
            {addComponent.isPending ? "Adding..." : "Add Component"}
          </button>
          <div className="space-y-2">
            {artwork.data.components.map((component) => (
              <div key={component.id} className="rounded border border-slate-200 bg-white p-2">
                <p className="text-sm font-medium text-slate-800">
                  {component.componentType} · {component.name}
                </p>
                <p className="text-xs text-slate-500">
                  {component.dimensions ?? "No dimensions"} · {component.substrate ?? "No substrate"} · {component.printProcess ?? "No process"}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {activeTab === "proofing" ? (
        <div className="space-y-3 rounded border border-slate-200 bg-slate-50 p-3 text-sm">
          <div className="grid gap-2 md:grid-cols-4">
            <FloatingSelect label="File Type" value={upload.fileType} onChange={(event) => setUpload({ ...upload, fileType: event.target.value })}>
              <option value="SOURCE">SOURCE</option>
              <option value="PROOF">PROOF</option>
              <option value="FINAL">FINAL</option>
            </FloatingSelect>
            <FloatingSelect label="Component" value={upload.componentId} onChange={(event) => setUpload({ ...upload, componentId: event.target.value })}>
              <option value="">Artwork Level</option>
              {artwork.data.components.map((component) => (
                <option key={component.id} value={component.id}>
                  {component.componentType} - {component.name}
                </option>
              ))}
            </FloatingSelect>
            <label className="rounded border border-slate-300 bg-white px-3 py-2 text-xs text-slate-600">
              {file ? file.name : "Pick file"}
              <input type="file" className="mt-1 block w-full text-xs" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
            </label>
            <button type="button" onClick={() => uploadFile.mutate()} disabled={!file || uploadFile.isPending} className="rounded bg-primary px-3 py-1 text-xs text-white disabled:opacity-60">
              {uploadFile.isPending ? "Uploading..." : "Upload"}
            </button>
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            <FloatingSelect label="Annotate File" value={newAnnotation.fileId} onChange={(event) => setNewAnnotation({ ...newAnnotation, fileId: event.target.value })}>
              <option value="">Select file</option>
              {allFiles.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.fileName}
                </option>
              ))}
            </FloatingSelect>
            <FloatingInput label="Annotation" value={newAnnotation.annotation} onChange={(event) => setNewAnnotation({ ...newAnnotation, annotation: event.target.value })} />
            <button type="button" onClick={() => addAnnotation.mutate()} disabled={addAnnotation.isPending} className="rounded border border-slate-300 px-3 py-1 text-xs">
              Add Annotation
            </button>
          </div>

          <div className="grid gap-3 lg:grid-cols-12">
            <div className="space-y-2 lg:col-span-4">
              {allFiles.map((row) => (
                <div
                  key={row.id}
                  className={`rounded border bg-white p-2 ${selectedPreviewFileId === row.id ? "border-primary ring-1 ring-primary/30" : "border-slate-200"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedPreviewFileId(row.id)}
                      className="text-left text-sm font-medium text-slate-800 hover:text-primary"
                    >
                      {row.fileType} · {row.fileName}
                    </button>
                    <a href={`/api/artworks/files/${row.id}/download`} className="rounded border border-slate-300 px-2 py-1 text-xs">
                      Download
                    </a>
                  </div>
                  <div className="mt-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (!window.confirm(`Delete proof file ${row.fileName}?`)) {
                          return;
                        }
                        deleteArtworkFile.mutate(row.id);
                      }}
                      disabled={deleteArtworkFile.isPending}
                      className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-60"
                    >
                      Delete Proof
                    </button>
                  </div>
                  <div className="mt-1 space-y-1">
                    {row.annotations.map((annotation) => (
                      <p key={annotation.id} className="text-xs text-slate-600">
                        [{annotation.status}] {annotation.annotation}
                      </p>
                    ))}
                    {row.annotations.length === 0 ? <p className="text-xs text-slate-500">No annotations</p> : null}
                  </div>
                </div>
              ))}
            </div>

            <div className="lg:col-span-8">
              <div className="rounded border border-slate-200 bg-white p-2">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-700">Preview Panel</p>
                  {selectedPreviewFileId ? (
                    <a href={`/api/artworks/files/${selectedPreviewFileId}/download`} className="rounded border border-slate-300 px-2 py-1 text-xs">
                      Download Selected
                    </a>
                  ) : null}
                </div>
                <div className="h-[78vh] min-h-[680px] overflow-auto rounded border border-slate-100 bg-slate-50">
                  {previewLoading ? <p className="p-3 text-xs text-slate-500">Loading preview...</p> : null}
                  {!previewLoading && previewKind === "image" && previewUrl ? (
                    <img src={previewUrl} alt="Artwork preview" className="h-full w-full object-contain" />
                  ) : null}
                  {!previewLoading && previewKind === "pdf" && previewUrl ? (
                    <iframe title="Artwork PDF preview" src={`${previewUrl}#zoom=page-fit&view=FitH`} className="h-full w-full border-0" />
                  ) : null}
                  {!previewLoading && previewKind === "unsupported" ? (
                    <div className="p-3 text-xs text-slate-600">
                      <p className="font-medium text-slate-700">Preview unavailable for this format.</p>
                      <p className="mt-1">`.ai` and other design-native formats are not browser-renderable here. Download the file to open in Illustrator.</p>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "compliance" ? (
        <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
          {compliance.isLoading ? (
            <p>Running compliance checks...</p>
          ) : (
            <>
              <p className="mb-2 text-sm font-medium">
                Compliance Result: {compliance.data?.compliant ? <span className="text-emerald-700">Compliant</span> : <span className="text-rose-700">Issues Found</span>}
              </p>
              <div className="space-y-2">
                {(compliance.data?.issues ?? []).map((issue) => (
                  <div key={`${issue.code}-${issue.message}`} className="rounded border border-slate-200 bg-white px-2 py-1">
                    <p className="text-xs font-medium text-slate-700">
                      {issue.severity} · {issue.code}
                    </p>
                    <p className="text-xs text-slate-600">{issue.message}</p>
                  </div>
                ))}
                {(compliance.data?.issues ?? []).length === 0 ? <p className="text-xs text-slate-500">No issues detected.</p> : null}
              </div>
            </>
          )}
        </div>
      ) : null}

      {activeTab === "print" ? (
        <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
          {printPack.isLoading ? (
            <p>Preparing print pack...</p>
          ) : printPack.data ? (
            <div className="space-y-2">
              <p className="font-medium">
                {printPack.data.header.artworkCode} · {printPack.data.header.revisionLabel} · {printPack.data.header.status}
              </p>
              <p className="text-xs text-slate-600">Generated at {new Date(printPack.data.generatedAt).toLocaleString()}</p>
              <div className="rounded border border-slate-200 bg-white p-2">
                <p className="mb-1 text-xs font-medium text-slate-700">Final Files</p>
                {(printPack.data.files.artworkLevelFinalFiles ?? []).map((fileRow) => (
                  <p key={fileRow.id} className="text-xs text-slate-600">
                    {fileRow.fileType} · {fileRow.fileName}
                  </p>
                ))}
                {(printPack.data.files.artworkLevelFinalFiles ?? []).length === 0 ? <p className="text-xs text-slate-500">No artwork-level final files.</p> : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {activeTab === "traceability" ? (
        <div className="space-y-3 rounded border border-slate-200 bg-slate-50 p-3 text-sm">
          {traceability.isLoading ? (
            <p>Loading traceability...</p>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded border border-slate-200 bg-white p-2">
                  <p className="mb-2 text-xs font-medium text-slate-700">Direct Links</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-16 shrink-0 text-slate-400">FG Item</span>
                      {traceability.data?.directLinks.fgItem ? (
                        <Link to={`/items/${traceability.data.directLinks.fgItem.id}`} className="font-mono text-primary hover:underline">
                          {traceability.data.directLinks.fgItem.itemCode} — {traceability.data.directLinks.fgItem.name}
                        </Link>
                      ) : <span className="italic text-slate-400">None</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-16 shrink-0 text-slate-400">Packaging</span>
                      {traceability.data?.directLinks.packagingItem ? (
                        <Link to={`/items/${traceability.data.directLinks.packagingItem.id}`} className="font-mono text-primary hover:underline">
                          {traceability.data.directLinks.packagingItem.itemCode} — {traceability.data.directLinks.packagingItem.name}
                        </Link>
                      ) : <span className="italic text-slate-400">None</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-16 shrink-0 text-slate-400">Formula</span>
                      {traceability.data?.directLinks.formula ? (
                        <Link to={`/formulas/${traceability.data.directLinks.formula.id}`} className="font-mono text-primary hover:underline">
                          {traceability.data.directLinks.formula.formulaCode} v{traceability.data.directLinks.formula.version}
                        </Link>
                      ) : <span className="italic text-slate-400">None</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-16 shrink-0 text-slate-400">Release</span>
                      {traceability.data?.directLinks.releaseRequest ? (
                        <Link to={`/releases/${traceability.data.directLinks.releaseRequest.id}`} className="font-mono text-primary hover:underline">
                          {traceability.data.directLinks.releaseRequest.rrNumber}
                        </Link>
                      ) : <span className="italic text-slate-400">None</span>}
                    </div>
                  </div>
                </div>
                <div className="rounded border border-slate-200 bg-white p-2">
                  <p className="mb-1 text-xs font-medium text-slate-700">Related Artworks</p>
                  {(traceability.data?.relatedArtworks ?? []).map((row) => (
                    <Link key={row.id} to={`/artworks/${row.id}`} className="block text-xs text-primary hover:underline">
                      {row.artworkCode} ({row.revisionLabel}) - {row.title}
                    </Link>
                  ))}
                  {(traceability.data?.relatedArtworks ?? []).length === 0 ? <p className="text-xs text-slate-500">No related artworks.</p> : null}
                </div>
              </div>
              <div className="rounded border border-slate-200 bg-white p-2">
                <p className="mb-1 text-xs font-medium text-slate-700">Audit History</p>
                {(traceability.data?.history ?? []).map((entry) => (
                  <p key={entry.id} className="text-xs text-slate-600">
                    {new Date(entry.createdAt).toLocaleString()} · {entry.action} · {entry.actorId ?? "system"}
                  </p>
                ))}
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
