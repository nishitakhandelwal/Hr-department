import React, { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ExportButton } from "@/components/common/ExportButton";
import { apiService } from "@/services/api";
import DeleteConfirmDialog from "@/components/common/DeleteConfirmDialog";
import { destructiveIconButtonClass } from "@/lib/destructive";

interface Department {
  _id?: string;
  name: string;
  description: string;
}

const departmentExportColumns = [
  { key: "name", label: "Department Name" },
  { key: "description", label: "Description" },
];

const emptyDept: Department = { name: "", description: "" };

const AdminDepartments: React.FC = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [form, setForm] = useState<Department>(emptyDept);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const { toast } = useToast();

  const loadDepartments = async () => {
    setLoading(true);
    try {
      const data = await apiService.list<Department>("departments");
      setDepartments(data);
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to fetch departments", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    void loadDepartments();
  }, []);

  const openAdd = () => { setForm(emptyDept); setEditIndex(null); setDialogOpen(true); };
  const openEdit = (i: number) => { setForm({ ...departments[i] }); setEditIndex(i); setDialogOpen(true); };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast({ title: "Validation Error", description: "Department name is required.", variant: "destructive" });
      return;
    }
    void (async () => {
      try {
        if (editIndex !== null && departments[editIndex]?._id) {
          await apiService.update("departments", departments[editIndex]._id!, form);
          toast({ title: "Department Updated", description: `${form.name} updated.` });
        } else {
          await apiService.create("departments", form);
          toast({ title: "Department Added", description: `${form.name} added.` });
        }
        setDialogOpen(false);
        await loadDepartments();
      } catch (error) {
        toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to save department", variant: "destructive" });
      }
    })();
  };

  const handleDelete = () => {
    void (async () => {
      if (deleteIndex !== null && departments[deleteIndex]?._id) {
        try {
          const name = departments[deleteIndex].name;
          await apiService.remove("departments", departments[deleteIndex]._id!);
          toast({ title: "Department Deleted", description: `${name} has been removed.` });
          setDeleteIndex(null);
          await loadDepartments();
        } catch (error) {
          toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to delete department", variant: "destructive" });
        }
      }
    })();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments"
        subtitle="Manage organizational departments"
        action={
          <div className="flex gap-2">
            <Button onClick={openAdd} className="gradient-primary text-primary-foreground gap-2"><Plus className="w-4 h-4" />Add Department</Button>
            <ExportButton
              moduleName="departments"
              rows={departments}
              fallbackRows={departments}
              columns={departmentExportColumns}
              loading={loading}
              emptyMessage="No data to export"
              preferServerExport={false}
            />
          </div>
        }
      />
      {loading ? <div className="text-sm text-muted-foreground">Loading departments...</div> : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {departments.map((dept, i) => (
          <motion.div
            key={dept.name + i}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="bg-card rounded-xl p-5 border border-border shadow-card hover:shadow-card-hover transition-shadow group relative cursor-pointer"
            onClick={() => openEdit(i)}
          >
            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={(event) => { event.stopPropagation(); openEdit(i); }}><Edit2 className="w-3.5 h-3.5" /></Button>
              <Button size="sm" className={`h-7 w-7 p-0 ${destructiveIconButtonClass}`} onClick={(event) => { event.stopPropagation(); setDeleteIndex(i); }}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
            <h3 className="font-display font-semibold text-card-foreground">{dept.name}</h3>
            <p className="text-sm text-muted-foreground mt-1">{dept.description || "No description"}</p>
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
              <div>
                <p className="text-xl font-bold text-card-foreground">{dept.name.slice(0, 2).toUpperCase()}</p>
                <p className="text-xs text-muted-foreground">Department</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editIndex !== null ? "Edit Department" : "Add Department"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1.5"><Label>Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Engineering" /></div>
            <div className="space-y-1.5"><Label>Description</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Department details" /></div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleSave} className="gradient-primary text-primary-foreground">{editIndex !== null ? "Update" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={deleteIndex !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteIndex(null);
        }}
        title="Delete Department"
        description={`Are you sure you want to delete ${deleteIndex !== null ? departments[deleteIndex]?.name : "this department"}?`}
        onConfirm={handleDelete}
      />
    </div>
  );
};

export default AdminDepartments;
