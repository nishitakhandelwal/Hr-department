import React from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { destructiveButtonClass } from "@/lib/destructive";

type DeleteConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
};

const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  open,
  onOpenChange,
  title = "Confirm deletion",
  description,
  confirmLabel = "Delete",
  loading = false,
  onConfirm,
}) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              onClick={onConfirm}
              disabled={loading}
              className={destructiveButtonClass}
            >
              {loading ? "Deleting..." : confirmLabel}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteConfirmDialog;
