import bcrypt from "bcryptjs";
import { connectDB } from "../config/db.js";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { createDefaultPermissions } from "../utils/permissions.js";

const run = async () => {
  if (!env.adminEmail || !env.adminPassword) {
    throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD in environment.");
  }

  await connectDB();
  const email = env.adminEmail.toLowerCase().trim();
  const existing = await User.findOne({ email });
  const password = await bcrypt.hash(env.adminPassword, 10);

  if (existing) {
    existing.password = password;
    existing.role = "admin";
    existing.accessRole = "super_admin";
    existing.accountStatus = "active";
    existing.permissions = createDefaultPermissions("super_admin");
    existing.isActive = true;
    await existing.save();
    // eslint-disable-next-line no-console
    console.log("Super admin updated.");
  } else {
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
    // eslint-disable-next-line no-console
    console.log("Super admin account created.");
  }

  process.exit(0);
};

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
