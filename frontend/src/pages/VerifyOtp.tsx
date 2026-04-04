import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Mail, RotateCcw, ShieldCheck } from "lucide-react";

import { AuthShell } from "@/components/AuthShell";
import InlineStatusMessage from "@/components/InlineStatusMessage";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiService } from "@/services/api";

type VerificationLocationState = {
  email?: string;
  expiresInSeconds?: number;
  resendCooldownSeconds?: number;
};

const formatCountdown = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
};

const VerifyOtp: React.FC = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const state = (location.state || {}) as VerificationLocationState;
  const [email, setEmail] = useState(state.email || searchParams.get("email") || "");
  const [otp, setOtp] = useState("");
  const [expiresIn, setExpiresIn] = useState(state.expiresInSeconds || 0);
  const [resendCooldown, setResendCooldown] = useState(state.resendCooldownSeconds || 0);
  const [loading, setLoading] = useState(false);
  const [inlineError, setInlineError] = useState("");

  useEffect(() => {
    if (expiresIn <= 0) return undefined;
    const timer = window.setInterval(() => {
      setExpiresIn((current) => (current > 0 ? current - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [expiresIn]);

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = window.setInterval(() => {
      setResendCooldown((current) => (current > 0 ? current - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const expiryLabel = useMemo(() => formatCountdown(expiresIn), [expiresIn]);

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    setInlineError("");
    setLoading(true);

    try {
      const response = await apiService.verifyRegistrationOtp({ email, otp });
      toast({ title: "Email verified", description: response.message });
      navigate("/login", { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to verify code.";
      setInlineError(message);
      toast({ title: "Verification failed", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setInlineError("");
    setLoading(true);

    try {
      const response = await apiService.resendRegistrationOtp(email);
      setExpiresIn(response.expiresInSeconds);
      setResendCooldown(response.resendCooldownSeconds);
      setOtp("");
      toast({ title: "Code resent", description: "A fresh verification code was sent to your email." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to resend code.";
      setInlineError(message);
      toast({ title: "Resend failed", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      badge="Account Verification"
      title="Verify your email"
      subtitle="Enter the 6-digit code sent to your inbox to activate your account and continue to the candidate portal."
      footer={
        <p className="text-center text-sm text-muted-foreground">
          Already verified?{" "}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Go to Sign In
          </Link>
        </p>
      }
    >
      <form className="space-y-5" onSubmit={handleVerify}>
        <div className="space-y-2">
          <Label>Email</Label>
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-slate-50 px-4 py-3">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">{email || "No email provided"}</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="registration-otp">6 Digit OTP</Label>
            <span className="text-xs font-semibold text-primary">{expiresIn > 0 ? expiryLabel : "Expired"}</span>
          </div>
          <InputOTP id="registration-otp" maxLength={6} value={otp} onChange={(value) => setOtp(value.replace(/\D/g, "").slice(0, 6))}>
            <InputOTPGroup className="w-full justify-between">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <InputOTPSlot key={index} index={index} className="h-14 w-12 rounded-2xl border border-border bg-white text-base shadow-sm" />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>

        <Button type="submit" className="w-full" disabled={loading || otp.length !== 6 || !email}>
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Verifying...</> : <><ShieldCheck className="h-4 w-4" />Verify OTP</>}
        </Button>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={loading || resendCooldown > 0 || !email}
          onClick={() => void handleResend()}
        >
          <RotateCcw className="h-4 w-4" />
          {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : "Resend OTP"}
        </Button>

        {inlineError ? <InlineStatusMessage type="error" message={inlineError} /> : null}
      </form>
    </AuthShell>
  );
};

export default VerifyOtp;
