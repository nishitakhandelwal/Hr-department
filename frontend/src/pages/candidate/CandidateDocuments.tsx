import React, { useMemo, useState } from "react";
import { FileText, Trash2, Upload } from "lucide-react";

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
  const [selectedFileToRemove, setSelectedFileToRemove] = useState<number | null>(null);

  const existingFiles = useMemo(() => {
    const list = candidate?.documents?.uploadedFiles || [];
    const legacy = [
      candidate?.documents?.resume?.url
        ? { url: candidate.documents.resume.url, originalName: candidate.documents.resume.originalName || "Resume" }
        : null,
      candidate?.documents?.certificates?.url
        ? { url: candidate.documents.certificates.url, originalName: candidate.documents.certificates.originalName || "Certificates" }
        : null,
    ].filter(Boolean) as Array<{ url?: string; originalName?: string }>;

    const seen = new Set<string>();
    return [...legacy, ...list].filter((item) => {
      const key = `${item.url || ""}-${item.originalName || ""}`;
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        subtitle="Upload multiple files, review them before submitting, and keep all your uploaded documents in one place."
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
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <FileText className="h-4 w-4 text-primary" />
                    {file.originalName || `File ${index + 1}`}
                  </div>
                  {file.url ? (
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-sm text-primary underline"
                    >
                      View File
                    </a>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">File URL unavailable.</p>
                  )}
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
