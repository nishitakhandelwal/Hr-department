import React from "react";
import { ExternalLink, FileText, Trash2, Upload, Video } from "lucide-react";

import DeleteConfirmDialog from "@/components/common/DeleteConfirmDialog";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { destructiveIconButtonClass } from "@/lib/destructive";
import { apiService, type CandidateRecord, type PublicSettingsPayload } from "@/services/api";
import { useCandidatePortal } from "@/context/CandidatePortalContext";

type CandidateDocumentField = PublicSettingsPayload["documents"]["candidateFields"][number];
type CertificateType = PublicSettingsPayload["documents"]["certificateTypes"][number];
type UploadedDocument = NonNullable<CandidateRecord["documents"]>["uploadedFiles"] extends Array<infer T> ? T : never;

const DEFAULT_ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const DEFAULT_CERTIFICATE_TYPES: CertificateType[] = [
  { typeId: "education", label: "Educational Certificate" },
  { typeId: "experience", label: "Experience Certificate" },
];

const mimeTypeToAcceptToken = (mimeType: string) => {
  if (mimeType === "application/pdf") return ".pdf";
  if (mimeType === "image/jpeg") return ".jpg,.jpeg";
  if (mimeType === "image/png") return ".png";
  return mimeType;
};

const CandidateDocuments: React.FC = () => {
  const { toast } = useToast();
  const { candidate, setCandidate } = useCandidatePortal();
  const [documentFields, setDocumentFields] = React.useState<CandidateDocumentField[]>([]);
  const [allowedFileTypes, setAllowedFileTypes] = React.useState<string[]>(DEFAULT_ALLOWED_TYPES);
  const [maxUploadSizeMb, setMaxUploadSizeMb] = React.useState(10);
  const [certificateTypes, setCertificateTypes] = React.useState<CertificateType[]>(DEFAULT_CERTIFICATE_TYPES);
  const [pendingFiles, setPendingFiles] = React.useState<Record<string, File | null>>({});
  const [selectedCertificateTypeId, setSelectedCertificateTypeId] = React.useState("");
  const [uploadingFieldId, setUploadingFieldId] = React.useState("");
  const [openingFileUrl, setOpeningFileUrl] = React.useState("");
  const [deleteTarget, setDeleteTarget] = React.useState<{ fieldId: string; label: string; documentId?: string } | null>(null);
  const [deletingFieldId, setDeletingFieldId] = React.useState("");

  React.useEffect(() => {
    void (async () => {
      try {
        const publicSettings = await apiService.getPublicSettings();
        setAllowedFileTypes(DEFAULT_ALLOWED_TYPES);
        setMaxUploadSizeMb(Number(publicSettings.documents?.maxUploadSizeMb || 10));
        setDocumentFields((publicSettings.documents?.candidateFields || []).filter((field) => field.status !== "disabled"));
        setCertificateTypes(
          Array.isArray(publicSettings.documents?.certificateTypes) && publicSettings.documents.certificateTypes.length
            ? publicSettings.documents.certificateTypes
            : DEFAULT_CERTIFICATE_TYPES
        );
      } catch {
        setAllowedFileTypes(DEFAULT_ALLOWED_TYPES);
        setMaxUploadSizeMb(10);
        setCertificateTypes(DEFAULT_CERTIFICATE_TYPES);
        setDocumentFields([
          { fieldId: "resume", label: "Resume", status: "required" },
          { fieldId: "pan-card", label: "PAN Card", status: "optional" },
          { fieldId: "aadhaar-card", label: "Aadhaar Card", status: "optional" },
          { fieldId: "passport-size-photo", label: "Passport Size Photo", status: "optional" },
          { fieldId: "certificates", label: "Certificates", status: "optional" },
        ]);
      }
    })();
  }, []);

  const documentMap = React.useMemo(() => {
    const uploadedFiles = Array.isArray(candidate?.documents?.uploadedFiles) ? candidate.documents.uploadedFiles : [];
    return {
      resume: candidate?.documents?.resume || null,
      ...Object.fromEntries(
        uploadedFiles
          .filter((file) => file?.fieldId && file.fieldId !== "certificates")
          .map((file) => [String(file.fieldId), file])
      ),
    };
  }, [candidate]);

  const groupedCertificates = React.useMemo(() => {
    const uploadedFiles = Array.isArray(candidate?.documents?.uploadedFiles) ? candidate.documents.uploadedFiles : [];
    const groups = new Map<string, { groupId: string; groupLabel: string; files: UploadedDocument[] }>();

    uploadedFiles
      .filter((file) => file?.fieldId === "certificates" && file.url)
      .forEach((file, index) => {
        const groupId = String(file.categoryId || file.documentId || `certificate-${index + 1}`);
        const groupLabel = String(file.categoryLabel || file.label || "Certificates");
        const existing = groups.get(groupId);
        if (existing) {
          existing.files.push(file);
          return;
        }
        groups.set(groupId, { groupId, groupLabel, files: [file] });
      });

    if (candidate?.documents?.certificates?.url) {
      groups.set("legacy", {
        groupId: "legacy",
        groupLabel: candidate.documents.certificates.categoryLabel || "Certificates",
        files: [candidate.documents.certificates],
      });
    }

    return Array.from(groups.values());
  }, [candidate]);

  const legacyFiles = React.useMemo(
    () =>
      (Array.isArray(candidate?.documents?.uploadedFiles) ? candidate.documents.uploadedFiles : [])
        .filter((file) => !file?.fieldId)
        .map((file, index) => ({
          category: file.label || `Legacy Document ${index + 1}`,
          url: file.url,
          originalName: file.originalName || `Legacy file ${index + 1}`,
          uploadedAt: file.uploadedAt || null,
        })),
    [candidate]
  );

  const accept = React.useMemo(
    () =>
      Array.from(
        new Set(
          allowedFileTypes.flatMap((mimeType) => mimeTypeToAcceptToken(mimeType).split(",").map((token) => token.trim()).filter(Boolean))
        )
      ).join(","),
    [allowedFileTypes]
  );

  const validateFile = (file: File) => {
    if (!DEFAULT_ALLOWED_TYPES.includes(file.type)) {
      return "Allowed file types are PDF, JPG, and PNG.";
    }
    if (file.size > maxUploadSizeMb * 1024 * 1024) {
      return `File must be ${maxUploadSizeMb} MB or smaller.`;
    }
    return "";
  };

  const handleSelectFile = (fieldId: string, file: File | null) => {
    if (!file) return;
    const error = validateFile(file);
    if (error) {
      toast({ title: "Upload failed", description: error, variant: "destructive" });
      return;
    }
    setPendingFiles((prev) => ({ ...prev, [fieldId]: file }));
  };

  const handleUpload = async (field: CandidateDocumentField) => {
    const selectedFile = pendingFiles[field.fieldId];
    if (!selectedFile) {
      toast({ title: "No file selected", description: `Choose a file for ${field.label}.`, variant: "destructive" });
      return;
    }
    if (field.fieldId === "certificates" && !selectedCertificateTypeId) {
      toast({ title: "Certificate type required", description: "Choose a certificate type before uploading.", variant: "destructive" });
      return;
    }

    setUploadingFieldId(field.fieldId);
    try {
      const updated = await apiService.updateMyCandidateDocuments({
        documents: { [field.fieldId]: selectedFile },
        certificateTypeId: field.fieldId === "certificates" ? selectedCertificateTypeId : undefined,
      });
      setCandidate(updated);
      setPendingFiles((prev) => ({ ...prev, [field.fieldId]: null }));
      if (field.fieldId === "certificates") {
        setSelectedCertificateTypeId("");
      }
      toast({ title: "Document uploaded", description: `${field.label} saved successfully.` });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Unable to upload document.",
        variant: "destructive",
      });
    } finally {
      setUploadingFieldId("");
    }
  };

  const handleOpenFile = async (fileUrl: string) => {
    setOpeningFileUrl(fileUrl);
    try {
      const blob = await apiService.downloadProtectedFile(fileUrl);
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (error) {
      toast({
        title: "Open failed",
        description: error instanceof Error ? error.message : "Unable to open this file right now.",
        variant: "destructive",
      });
    } finally {
      setOpeningFileUrl("");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeletingFieldId(deleteTarget.documentId || deleteTarget.fieldId);
    try {
      const updated = await apiService.deleteMyCandidateDocument(deleteTarget.fieldId, {
        documentId: deleteTarget.documentId,
      });
      setCandidate(updated);
      toast({ title: "Document removed", description: `${deleteTarget.label} has been removed.` });
      setDeleteTarget(null);
    } catch (error) {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Unable to remove this document.",
        variant: "destructive",
      });
    } finally {
      setDeletingFieldId("");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        subtitle="Upload only the documents currently enabled by your organization. Required files must be kept on record."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {documentFields.map((field) => {
          const uploadedDocument = documentMap[field.fieldId];
          const pendingFile = pendingFiles[field.fieldId];
          const isCertificateField = field.fieldId === "certificates";
          const isBusy = uploadingFieldId === field.fieldId;

          return (
            <Card key={field.fieldId}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3">
                  <span>{field.label}</span>
                  <span className={`text-xs font-medium ${field.status === "required" ? "text-destructive" : "text-muted-foreground"}`}>
                    {field.status === "required" ? "Required" : "Optional"}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isCertificateField ? (
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={selectedCertificateTypeId}
                    onChange={(event) => setSelectedCertificateTypeId(event.target.value)}
                    disabled={isBusy}
                  >
                    <option value="">Select certificate type</option>
                    {certificateTypes.map((entry) => (
                      <option key={entry.typeId} value={entry.typeId}>
                        {entry.label}
                      </option>
                    ))}
                  </select>
                ) : null}

                <Input
                  type="file"
                  accept={accept}
                  onChange={(event) => handleSelectFile(field.fieldId, event.target.files?.[0] || null)}
                  disabled={isBusy}
                />
                <p className="text-xs text-muted-foreground">
                  Allowed: PDF, JPG, PNG. Max size: {maxUploadSizeMb} MB.
                </p>

                {pendingFile ? (
                  <div className="rounded-xl border border-border/80 p-3">
                    <p className="truncate text-sm font-medium">{pendingFile.name}</p>
                    <p className="text-xs text-muted-foreground">{(pendingFile.size / (1024 * 1024)).toFixed(2)} MB selected</p>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => void handleUpload(field)}
                    disabled={!pendingFile || isBusy || (isCertificateField && !selectedCertificateTypeId)}
                    className="gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    {uploadingFieldId === field.fieldId ? "Uploading..." : isCertificateField ? "Upload Certificate" : uploadedDocument?.url ? "Replace File" : "Upload File"}
                  </Button>
                  {!isCertificateField && uploadedDocument?.url ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void handleOpenFile(uploadedDocument.url || "")}
                      disabled={openingFileUrl === uploadedDocument.url || Boolean(deletingFieldId)}
                      className="gap-2"
                    >
                      <ExternalLink className="h-4 w-4" />
                      {openingFileUrl === uploadedDocument.url ? "Opening..." : "View"}
                    </Button>
                  ) : null}
                  {!isCertificateField && uploadedDocument?.url ? (
                    <Button
                      type="button"
                      variant="outline"
                      className={destructiveIconButtonClass}
                      onClick={() => setDeleteTarget({ fieldId: field.fieldId, label: field.label })}
                      disabled={field.status === "required" || Boolean(deletingFieldId)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>

                {isCertificateField ? (
                  groupedCertificates.length ? (
                    <div className="space-y-3">
                      {groupedCertificates.map((group) => (
                        <div key={group.groupId} className="rounded-xl border border-border/80 p-3">
                          <p className="text-sm font-semibold">{group.groupLabel}</p>
                          <div className="mt-3 space-y-3">
                            {group.files.map((file, index) => {
                              const deleteKey = file.documentId || `${group.groupId}-${index}`;
                              return (
                                <div key={deleteKey} className="flex items-start justify-between gap-3 rounded-lg border border-border/60 p-3">
                                  <div>
                                    <div className="flex items-center gap-2 text-sm font-medium">
                                      <FileText className="h-4 w-4 text-primary" />
                                      {file.originalName || `Certificate ${index + 1}`}
                                    </div>
                                    {file.uploadedAt ? (
                                      <p className="mt-1 text-xs text-muted-foreground">
                                        Uploaded: {new Date(file.uploadedAt).toLocaleString()}
                                      </p>
                                    ) : null}
                                  </div>
                                  <div className="flex gap-2">
                                    {file.url ? (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => void handleOpenFile(file.url || "")}
                                        disabled={openingFileUrl === file.url || deletingFieldId === deleteKey}
                                      >
                                        {openingFileUrl === file.url ? "Opening..." : "View"}
                                      </Button>
                                    ) : null}
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className={destructiveIconButtonClass}
                                      onClick={() =>
                                        setDeleteTarget({
                                          fieldId: "certificates",
                                          documentId: file.documentId,
                                          label: file.originalName || group.groupLabel,
                                        })
                                      }
                                      disabled={deletingFieldId === deleteKey}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No certificates uploaded yet.</p>
                  )
                ) : uploadedDocument?.url ? (
                  <div className="rounded-xl border border-border/80 p-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <FileText className="h-4 w-4 text-primary" />
                      {uploadedDocument.originalName || field.label}
                    </div>
                    {uploadedDocument.uploadedAt ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Uploaded: {new Date(uploadedDocument.uploadedAt).toLocaleString()}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No file uploaded yet.</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {legacyFiles.length || candidate?.videoIntroduction?.url ? (
        <Card>
          <CardHeader>
            <CardTitle>Existing Uploaded Files</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {legacyFiles.map((file, index) => (
              <div key={`${file.url || "legacy"}-${index}`} className="rounded-xl border border-border/80 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <FileText className="h-4 w-4 text-primary" />
                      {file.originalName}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{file.category}</p>
                  </div>
                  {file.url ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="inline-flex items-center gap-1 text-sm text-primary"
                      onClick={() => void handleOpenFile(file.url || "")}
                      disabled={openingFileUrl === file.url}
                    >
                      {openingFileUrl === file.url ? "Opening..." : "Open"}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}

            {candidate?.videoIntroduction?.url ? (
              <div className="rounded-xl border border-border/80 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Video className="h-4 w-4 text-primary" />
                      {candidate.videoIntroduction.originalName || "Video introduction"}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Video Introduction</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="inline-flex items-center gap-1 text-sm text-primary"
                    onClick={() => void handleOpenFile(candidate.videoIntroduction?.url || "")}
                    disabled={openingFileUrl === candidate.videoIntroduction?.url}
                  >
                    {openingFileUrl === candidate.videoIntroduction?.url ? "Opening..." : "Open"}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <DeleteConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Remove Document"
        description={`Are you sure you want to remove ${deleteTarget?.label || "this document"}?`}
        confirmLabel="Remove"
        loading={Boolean(deletingFieldId)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
};

export default CandidateDocuments;
