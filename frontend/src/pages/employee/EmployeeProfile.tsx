import React, { useEffect, useState } from "react";
import { Building2, Calendar, Mail, Phone } from "lucide-react";

import ProfileAvatar from "@/components/common/ProfileAvatar";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { apiService } from "@/services/api";
import ProfileImageManager from "@/components/profile/ProfileImageManager";

type ProfileView = {
  fullName: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  employeeId: string;
  dateOfJoining: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  paymentMode: string;
};

const EmployeeProfile: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const profileImageUrl = user?.profileImage || user?.profilePhotoUrl || "";
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<ProfileView>({
    fullName: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || user?.phoneNumber || "",
    department: user?.department || "",
    designation: "",
    employeeId: "",
    dateOfJoining: "",
    bankName: "",
    accountNumber: "",
    ifscCode: "",
    paymentMode: "",
  });

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const employee = await apiService.getMyEmployeeProfile();
        setProfile({
          fullName: employee.fullName || user?.name || "",
          email: employee.email || user?.email || "",
          phone: employee.phone || user?.phone || user?.phoneNumber || "",
          department: employee.department || user?.department || "",
          designation: employee.designation || "",
          employeeId: employee.employeeId || "",
          dateOfJoining: employee.joiningDate ? new Date(employee.joiningDate).toLocaleDateString() : "",
          bankName: employee.bankDetails?.bankName || "",
          accountNumber: employee.bankDetails?.accountNumber || "",
          ifscCode: employee.bankDetails?.ifscCode || "",
          paymentMode: employee.bankDetails?.paymentMode || "",
        });
      } catch {
        setProfile({
          fullName: user?.name || "",
          email: user?.email || "",
          phone: user?.phone || user?.phoneNumber || "",
          department: user?.department || "",
          designation: "",
          employeeId: "",
          dateOfJoining: "",
          bankName: "",
          accountNumber: "",
          ifscCode: "",
          paymentMode: "",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.department, user?.email, user?.name, user?.phone, user?.phoneNumber]);

  const infoRows = [
    { label: "Email", value: profile.email || "-", icon: Mail },
    { label: "Phone", value: profile.phone || "-", icon: Phone },
    { label: "Department", value: profile.department || "-", icon: Building2 },
    { label: "Joining Date", value: profile.dateOfJoining || "-", icon: Calendar },
  ];

  const detailRows = [
    { label: "Full Name", value: profile.fullName || "-" },
    { label: "Designation", value: profile.designation || "-" },
    { label: "Employee ID", value: profile.employeeId || "-" },
    { label: "Department", value: profile.department || "-" },
    { label: "Email", value: profile.email || "-" },
    { label: "Phone", value: profile.phone || "-" },
    { label: "Bank Name", value: profile.bankName || "-" },
    { label: "Account Number", value: profile.accountNumber ? `****${profile.accountNumber.slice(-4)}` : "-" },
    { label: "IFSC Code", value: profile.ifscCode || "-" },
    { label: "Payment Mode", value: profile.paymentMode || "-" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Profile"
        subtitle={user?.role === "admin" ? "Your account details and profile image" : "Your profile details and profile image"}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="text-center">
          <CardContent className="space-y-4 pt-6">
            <ProfileAvatar
              name={profile.fullName || user?.name || "User"}
              imageUrl={profileImageUrl}
              className="mx-auto h-24 w-24"
              fallbackClassName="gradient-primary text-2xl font-bold text-primary-foreground"
            />

            <div>
              <h2 className="text-lg font-semibold text-card-foreground">{profile.fullName || user?.name}</h2>
              <p className="text-sm text-muted-foreground">{profile.designation || user?.role || "-"}</p>
            </div>

            <ProfileImageManager
              name={profile.fullName || user?.name || "User"}
              imageUrl={profileImageUrl}
              onUpload={async (file) => {
                const updatedUser = await apiService.updateMyProfilePhoto(file);
                console.log("Uploaded URL:", updatedUser.profileImage || updatedUser.profilePhotoUrl || "");
                console.log("Saved user:", updatedUser);
                await refreshProfile();
              }}
              onRemove={async () => {
                const updatedUser = await apiService.removeMyProfilePhoto();
                console.log("Saved user:", updatedUser);
                await refreshProfile();
              }}
            />

            <div className="space-y-3 border-t border-border pt-4 text-left">
              {infoRows.map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <item.icon className="h-4 w-4" />
                  {item.value}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Profile Details</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <p className="mb-4 text-sm text-muted-foreground">Loading profile...</p> : null}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {detailRows.map((item) => (
                <div key={item.label} className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{item.label}</Label>
                  <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-foreground">
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EmployeeProfile;
