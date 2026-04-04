import React from "react";
import { BellRing } from "lucide-react";

import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCandidatePortal } from "@/context/CandidatePortalContext";
import { apiService } from "@/services/api";

const CandidateNotifications: React.FC = () => {
  const { notifications, setNotifications } = useCandidatePortal();

  const markAsRead = async (id: string) => {
    await apiService.markNotificationRead(id).catch(() => null);
    setNotifications((prev) => prev.map((item) => (item._id === id ? { ...item, read: true } : item)));
  };

  const markAllRead = async () => {
    await apiService.markAllNotificationsRead().catch(() => null);
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        subtitle="Stay updated on reviews, interviews, selection decisions, and onboarding steps."
        action={<Button variant="outline" onClick={() => void markAllRead()}>Mark All Read</Button>}
      />

      <div className="space-y-3">
        {notifications.length === 0 ? (
          <EmptyState title="No notifications available yet." description="We’ll show your interview updates, decisions, and onboarding reminders here." icon={BellRing} />
        ) : (
          notifications.map((item) => (
            <Card key={item._id} className={!item.read ? "border-primary/25 bg-primary/5" : ""}>
              <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.message}</p>
                  <p className="mt-3 text-xs font-medium text-primary">{new Date(item.createdAt).toLocaleString()}</p>
                </div>
                {!item.read ? <Button variant="outline" size="sm" onClick={() => void markAsRead(item._id)}>Mark Read</Button> : null}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default CandidateNotifications;
