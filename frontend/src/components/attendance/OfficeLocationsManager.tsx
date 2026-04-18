import React, { useCallback, useEffect, useMemo, useState } from "react";
import { MapPinPlus, PencilLine, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/DataTable";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { OfficeLocationRecord } from "@/services/api";
import { apiService } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

type OfficeLocationsManagerProps = {
  canManage: boolean;
};

const formatCoordinate = (value: number) => Number(value).toFixed(6);

const OfficeLocationsManager: React.FC<OfficeLocationsManagerProps> = ({ canManage }) => {
  const { toast } = useToast();
  const [locations, setLocations] = useState<OfficeLocationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteLoadingId, setDeleteLoadingId] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState("");
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    name: "",
    latitude: "",
    longitude: "",
    radiusMeters: "",
  });

  const loadLocations = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiService.listOfficeLocations();
      setLocations(data);
    } catch (error) {
      toast({
        title: "Location error",
        description: error instanceof Error ? error.message : "Failed to load office locations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadLocations();
  }, [loadLocations]);

  const resetForm = () => {
    setEditingLocationId("");
    setForm({
      name: "",
      latitude: "",
      longitude: "",
      radiusMeters: "",
    });
    setFormError("");
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (location: OfficeLocationRecord) => {
    setEditingLocationId(location._id);
    setForm({
      name: location.name,
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      radiusMeters: String(location.radiusMeters),
    });
    setFormError("");
    setDialogOpen(true);
  };

  const validateForm = () => {
    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);
    const radiusMeters = Number(form.radiusMeters);

    if (!form.name.trim()) return "Location name is required.";
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return "Latitude must be between -90 and 90.";
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return "Longitude must be between -180 and 180.";
    if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) return "Radius must be greater than zero.";
    return "";
  };

  const handleSave = async () => {
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    const payload = {
      name: form.name.trim(),
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      radiusMeters: Number(form.radiusMeters),
    };

    setSaving(true);
    try {
      if (editingLocationId) {
        await apiService.updateOfficeLocation(editingLocationId, payload);
        toast({ title: "Location updated", description: "The office boundary has been updated successfully." });
      } else {
        await apiService.createOfficeLocation(payload);
        toast({ title: "Location created", description: "A new office boundary is now available immediately." });
      }

      setDialogOpen(false);
      resetForm();
      await loadLocations();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to save office location");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (location: OfficeLocationRecord) => {
    setDeleteLoadingId(location._id);
    try {
      await apiService.deleteOfficeLocation(location._id);
      toast({ title: "Location deleted", description: `${location.name} has been removed.` });
      await loadLocations();
    } catch (error) {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Failed to delete office location",
        variant: "destructive",
      });
    } finally {
      setDeleteLoadingId("");
    }
  };

  const rows = useMemo(
    () =>
      locations.map((location) => ({
        ...location,
        latitudeText: formatCoordinate(location.latitude),
        longitudeText: formatCoordinate(location.longitude),
        radiusText: `${location.radiusMeters} m`,
      })),
    [locations]
  );

  return (
    <section className="space-y-4 rounded-[28px] border bg-white p-5 shadow-card sm:p-6 dark:border-[#2A2623] dark:bg-[linear-gradient(135deg,#111111,#1A1816)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950 dark:text-[#F5F5F5]">Office Locations</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage live geo-fence boundaries. Employees can mark attendance only when their device coordinates match one of these office zones.
          </p>
        </div>
        {canManage ? (
          <Button type="button" onClick={openCreateDialog} className="gap-2 rounded-2xl">
            <MapPinPlus className="h-4 w-4" />
            Add Office Location
          </Button>
        ) : null}
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading office locations...</div>
      ) : (
        <DataTable
          columns={[
            { key: "name", label: "Office Name" },
            { key: "latitudeText", label: "Latitude" },
            { key: "longitudeText", label: "Longitude" },
            { key: "radiusText", label: "Radius" },
            {
              key: "actions",
              label: "Actions",
              render: (item) =>
                canManage ? (
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-xl"
                      onClick={(event) => {
                        event.stopPropagation();
                        openEditDialog(item as OfficeLocationRecord);
                      }}
                    >
                      <PencilLine className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-xl border-destructive/20 text-destructive hover:bg-destructive/5"
                      disabled={deleteLoadingId === String(item._id)}
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleDelete(item as OfficeLocationRecord);
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {deleteLoadingId === String(item._id) ? "Deleting..." : "Delete"}
                    </Button>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">View only</span>
                ),
            },
          ]}
          data={rows}
        />
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (saving) return;
          setDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-w-2xl rounded-[28px]">
          <DialogHeader>
            <DialogTitle>{editingLocationId ? "Edit Office Location" : "Add Office Location"}</DialogTitle>
            <DialogDescription>
              Save the office name, latitude, longitude, and allowed radius. Attendance validation will start using the updated boundary immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Office Name</label>
              <Input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                className="rounded-2xl"
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Latitude</label>
              <Input
                value={form.latitude}
                onChange={(event) => setForm((prev) => ({ ...prev, latitude: event.target.value }))}
                placeholder="28.535517"
                className="rounded-2xl"
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Longitude</label>
              <Input
                value={form.longitude}
                onChange={(event) => setForm((prev) => ({ ...prev, longitude: event.target.value }))}
                placeholder="77.391029"
                className="rounded-2xl"
                disabled={saving}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Radius in meters</label>
              <Input
                value={form.radiusMeters}
                onChange={(event) => setForm((prev) => ({ ...prev, radiusMeters: event.target.value }))}
                placeholder="250"
                className="rounded-2xl"
                disabled={saving}
              />
            </div>
          </div>

          {formError ? (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {formError}
            </div>
          ) : null}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={saving} onClick={() => setDialogOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button type="button" disabled={saving} onClick={() => void handleSave()} className="rounded-xl">
              {saving ? "Saving..." : editingLocationId ? "Save Changes" : "Create Location"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default OfficeLocationsManager;
