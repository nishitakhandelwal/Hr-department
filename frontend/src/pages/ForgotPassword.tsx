import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Mail } from "lucide-react";

import { AuthShell } from "@/components/AuthShell";
import InlineStatusMessage from "@/components/InlineStatusMessage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiService } from "@/services/api";

const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [inlineError, setInlineError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setInlineError("");
    setSuccessMessage("");
    setLoading(true);

    try {
      const response = await apiService.requestPasswordReset(email);
      const message = response.message || "OTP sent successfully.";
      setSuccessMessage(message);
      toast({ title: "OTP sent", description: message });
      window.setTimeout(() => {
        navigate(`/reset-password?email=${encodeURIComponent(email)}`, {
          state: {
            email,
            expiresInSeconds: response.data?.expiresInSeconds || 300,
            resendCooldownSeconds: response.data?.resendCooldownSeconds || 30,
            otpRequested: true,
          },
        });
      }, 600);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to send reset OTP.";
      setInlineError(message);
      toast({ title: "Request failed", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      badge="Account Security"
      title="Forgot password"
      subtitle="Enter your work email and we will send a 6-digit OTP to your email. Use that OTP to reset your password."
      footer={
        <p className="text-center text-sm text-muted-foreground">
          Back to{" "}
          <Link className="font-semibold text-primary hover:underline" to="/login">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Work Email</Label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-12 rounded-2xl pl-11"
              placeholder="you@company.com"
              required
              disabled={loading}
            />
          </div>
        </div>

        <Button type="submit" className="h-12 w-full rounded-2xl" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending OTP...
            </>
          ) : (
            "Send Reset OTP"
          )}
        </Button>

        {inlineError ? <InlineStatusMessage type="error" message={inlineError} /> : null}
        {successMessage ? <InlineStatusMessage type="success" message={successMessage} /> : null}
      </form>
    </AuthShell>
  );
};

export default ForgotPassword;
