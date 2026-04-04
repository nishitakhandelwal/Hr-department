import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import { useNavigate } from "react-router-dom";

import { useAuth } from "@/context/AuthContext";
import { apiService, isUnauthorizedError, type CandidateRecord, type JoiningFormRecord, type NotificationItem } from "@/services/api";

type CandidatePortalContextValue = {
  candidate: CandidateRecord | null;
  joiningForm: JoiningFormRecord | null;
  notifications: NotificationItem[];
  loading: boolean;
  error: string;
  unreadCount: number;
  refreshPortal: () => Promise<void>;
  setNotifications: React.Dispatch<React.SetStateAction<NotificationItem[]>>;
  setCandidate: React.Dispatch<React.SetStateAction<CandidateRecord | null>>;
  setJoiningForm: React.Dispatch<React.SetStateAction<JoiningFormRecord | null>>;
};

const CandidatePortalContext = createContext<CandidatePortalContextValue | undefined>(undefined);

export const CandidatePortalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [candidate, setCandidate] = useState<CandidateRecord | null>(null);
  const [joiningForm, setJoiningForm] = useState<JoiningFormRecord | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refreshPortal = async () => {
    setLoading(true);
    setError("");
    try {
      const [candidateData, joiningData, notificationData] = await Promise.all([
        apiService.getMyCandidateApplication(),
        apiService.getMyJoiningForm().catch(() => null),
        apiService.listNotifications().catch(() => []),
      ]);
      setCandidate(candidateData);
      setJoiningForm(joiningData);
      setNotifications(notificationData);
    } catch (error) {
      if (isUnauthorizedError(error)) {
        await logout();
        navigate("/login", { replace: true });
        return;
      }
      const message = error instanceof Error ? error.message : "Unable to load your candidate portal.";
      console.error("[CandidatePortal] Failed to refresh portal", error);
      setCandidate(null);
      setJoiningForm(null);
      setNotifications([]);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshPortal();
  }, []);

  const value = useMemo(
    () => ({
      candidate,
      joiningForm,
      notifications,
      loading,
      error,
      unreadCount: notifications.filter((item) => !item.read).length,
      refreshPortal,
      setNotifications,
      setCandidate,
      setJoiningForm,
    }),
    [candidate, joiningForm, loading, notifications, error],
  );

  return <CandidatePortalContext.Provider value={value}>{children}</CandidatePortalContext.Provider>;
};

export const useCandidatePortal = () => {
  const context = useContext(CandidatePortalContext);
  if (!context) throw new Error("useCandidatePortal must be used within CandidatePortalProvider");
  return context;
};
