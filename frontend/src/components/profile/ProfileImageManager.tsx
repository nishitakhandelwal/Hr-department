import React, { useRef, useState } from "react";
import { Camera, Loader2, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import DeleteConfirmDialog from "@/components/common/DeleteConfirmDialog";
import ProfileAvatar from "@/components/common/ProfileAvatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type ProfileImageManagerProps = {
  name: string;
  imageUrl?: string;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
  disabled?: boolean;
};

const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png"];

const ProfileImageManager: React.FC<ProfileImageManagerProps> = ({
  name,
  imageUrl = "",
  onUpload,
  onRemove,
  disabled = false,
}) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [optimisticallyRemoved, setOptimisticallyRemoved] = useState(false);

  const effectiveImageUrl = (optimisticallyRemoved ? "" : imageUrl) || "";
  const clearSelection = () => {
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const validateFile = (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) return "Invalid file type. Use JPG or PNG only.";
    if (file.size > MAX_IMAGE_SIZE_BYTES) return "Image must be 2MB or smaller.";
    return "";
  };

  const handleSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const error = validateFile(file);
    if (error) {
      toast({ title: "Upload failed", description: error, variant: "destructive" });
      event.target.value = "";
      return;
    }

    setBusy(true);
    try {
      await onUpload(file);
      setOptimisticallyRemoved(false);
      toast({ title: "Image uploaded successfully" });
      clearSelection();
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Unable to upload image.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setOptimisticallyRemoved(true);
    setBusy(true);
    try {
      await onRemove();
      clearSelection();
      setRemoveOpen(false);
      toast({ title: "Image removed successfully" });
    } catch (error) {
      setOptimisticallyRemoved(false);
      toast({
        title: "Remove failed",
        description: error instanceof Error ? error.message : "Unable to remove image.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-4 transition-all duration-200 sm:flex-row sm:items-center">
      <div className="relative w-fit rounded-xl">
        <ProfileAvatar
          name={name}
          imageUrl={effectiveImageUrl}
          className="h-24 w-24 border border-border"
          fallbackClassName="text-2xl"
          allowTemporary={false}
        />
        <span className="absolute -bottom-1 -right-1 rounded-full bg-primary p-2 text-white shadow">
          <Camera className="h-4 w-4" />
        </span>
      </div>

      <div className="space-y-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,image/jpeg,image/png"
          onChange={(event) => void handleSelect(event)}
          className="hidden"
          disabled={busy || disabled}
        />
        <p className="text-xs text-muted-foreground">JPG/PNG only, max 2MB. Changes reflect instantly in profile and navbar.</p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="rounded-lg transition-all duration-200 hover:-translate-y-0.5"
              disabled={busy || disabled}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Manage Image
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuItem onClick={() => fileInputRef.current?.click()} disabled={busy || disabled}>
              <Upload className="mr-2 h-4 w-4" />
              Upload Image
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setRemoveOpen(true)}
              disabled={busy || disabled || !imageUrl}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Remove Image
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <DeleteConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title="Remove Profile Image"
        description="Are you sure you want to remove your profile image and use the default avatar?"
        confirmLabel="Remove"
        loading={busy}
        onConfirm={() => void handleRemove()}
      />
    </div>
  );
};

export default ProfileImageManager;
