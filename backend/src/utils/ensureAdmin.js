import bcrypt from "bcryptjs";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { createDefaultPermissions } from "./permissions.js";

export const ensureAdmin = async () => {
  if (!env.adminEmail || !env.adminPassword) return;
  const email = env.adminEmail.toLowerCase().trim();
  const existing = await User.findOne({ email });
  if (existing) {
    let changed = false;
    if (existing.accessRole !== "super_admin") {
      existing.accessRole = "super_admin";
      changed = true;
    }
    if (existing.role !== "admin") {
      existing.role = "admin";
      changed = true;
    }
    if (existing.accountStatus !== "active") {
      existing.accountStatus = "active";
      changed = true;
    }
    if (!existing.permissions?.modules?.userManagement) {
      existing.permissions = createDefaultPermissions("super_admin");
      changed = true;
    }
    if (changed) await existing.save();
    return;
  }

  const password = await bcrypt.hash(env.adminPassword, 10);
  await User.create({
    name: "Super Admin",
    email,
    password,
    role: "admin",
    accessRole: "super_admin",
    department: "Human Resources",
    accountStatus: "active",
    permissions: createDefaultPermissions("super_admin"),
    isActive: true,
  });
};
