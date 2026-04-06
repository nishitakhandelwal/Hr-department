import React, { useMemo, useState } from "react";
import { ExternalLink, FileText, Trash2, Upload, Video } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useCandidatePortal } from "@/context/CandidatePortalContext";
import { apiService } from "@/services/api";
import DeleteConfirmDialog from "@/components/common/DeleteConfirmDialog";
import { destructiveIconButtonClass } from "@/lib/destructive";

const CandidateDocuments: React.FC = () => {
  const { toast } = useToast();
  const { candidate, setCandidate } = useCandidatePortal();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [openingFileUrl, setOpeningFileUrl] = useState("");
  const [selectedFileToRemove, setSelectedFileToRemove] = useState<number | null>(null);

  const existingFiles = useMemo(() => {
    const items = [
      candidate?.documents?.resume?.url || candidate?.resumeUrl
        ? {
            category: "Resume",
            url: candidate?.documents?.resume?.url || candidate?.resumeUrl,
            originalName: candidate?.documents?.resume?.originalName || candidate?.resumeFileName || "Resume",
            uploadedAt: candidate?.documents?.resume?.uploadedAt || candidate?.stage2SubmittedAt || candidate?.submittedAt || null,
            kind: "file" as const,
          }
        : null,
      candidate?.documents?.certificates?.url
        ? {
            category: "Certificates",
            url: candidate.documents.certificates.url,
            originalName: candidate.documents.certificates.originalName || "Certificates",
            uploadedAt: candidate.documents.certificates.uploadedAt || null,
            kind: "file" as const,
          }
        : null,
      ...(candidate?.documents?.uploadedFiles || []).map((file, index) => ({
        category: `Document ${index + 1}`,
        url: file.url,
        originalName: file.originalName || `Supporting file ${index + 1}`,
        uploadedAt: file.uploadedAt || null,
        kind: "file" as const,
      })),
      candidate?.videoIntroduction?.url
        ? {
            category: "Video Introduction",
            url: candidate.videoIntroduction.url,
            originalName: candidate.videoIntroduction.originalName || "Video introduction",
            uploadedAt: candidate.videoIntroduction.uploadedAt || null,
            kind: "video" as const,
          }
        : null,
    ].filter(Boolean) as Array<{
      category: string;
      url?: string;
      originalName?: string;
      uploadedAt?: string | null;
      kind: "file" | "video";
    }>;

    const seen = new Set<string>();
    return items.filter((item) => {
      const key = `${item.category}-${item.url || ""}-${item.originalName || ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [candidate]);

  const handleSelectFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    setSelectedFiles((prev) => {
      const seen = new Set(prev.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
      const next = [...prev];
      for (const file of files) {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        if (!seen.has(key)) {
          next.push(file);
          seen.add(key);
        }
      }
      return next;
    });

    event.target.value = "";
  };

  const handleRemoveSelected = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, fileIndex) => fileIndex !== index));
  };

  const handleUpload = async () => {
    if (!selectedFiles.length) {
      toast({ title: "No files selected", description: "Choose at least one file to upload.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const updated = await apiService.updateMyCandidateDocuments({ files: selectedFiles });
      setCandidate(updated);
      setSelectedFiles([]);
      toast({ title: "Files uploaded", description: "Your files have been saved successfully." });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Unable to upload documents.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        subtitle="Upload multiple files, review them before submitting, and see every document or video you have already uploaded in one place."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Upload Multiple Files</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={handleSelectFiles}
            />

            {selectedFiles.length ? (
              <div className="space-y-3">
                <p className="text-sm font-medium">Selected files</p>
                {selectedFiles.map((file, index) => (
                  <div key={`${file.name}-${file.lastModified}`} className="flex items-center justify-between rounded-xl border border-border/80 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                    <Button type="button" size="sm" className={destructiveIconButtonClass} onClick={() => setSelectedFileToRemove(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No files selected yet.</p>
            )}

            <Button onClick={() => void handleUpload()} disabled={saving || selectedFiles.length === 0} className="gap-2">
              <Upload className="h-4 w-4" />
              {saving ? "Uploading..." : "Upload Files"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Uploaded Files</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {existingFiles.length ? (
              existingFiles.map((file, index) => (
                <div key={`${file.url || "file"}-${index}`} className="rounded-xl border border-border/80 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-medium">
                        {file.kind === "video" ? <Video className="h-4 w-4 text-primary" /> : <FileText className="h-4 w-4 text-primary" />}
                        {file.originalName || `File ${index + 1}`}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{file.category}</p>
                      {file.uploadedAt ? (
                        <p className="mt-1 text-xs text-muted-foreground">Uploaded: {new Date(file.uploadedAt).toLocaleString()}</p>
                      ) : null}
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
                  {!file.url ? (
                    <p className="mt-2 text-sm text-muted-foreground">File URL unavailable.</p>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No files uploaded yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
      <DeleteConfirmDialog
        open={selectedFileToRemove !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedFileToRemove(null);
        }}
        title="Remove Selected File"
        description="Are you sure you want to remove this file from the selected upload list?"
        confirmLabel="Remove"
        onConfirm={() => {
          if (selectedFileToRemove === null) return;
          handleRemoveSelected(selectedFileToRemove);
          setSelectedFileToRemove(null);
        }}
      />
    </div>
  );
};

export default CandidateDocuments;
