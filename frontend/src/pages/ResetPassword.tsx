import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Loader2, Lock, Mail, RotateCcw } from "lucide-react";

import { AuthShell } from "@/components/AuthShell";
import InlineStatusMessage from "@/components/InlineStatusMessage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiService } from "@/services/api";

type ResetLocationState = {
  email?: string;
  expiresInSeconds?: number;
  resendCooldownSeconds?: number;
  otpRequested?: boolean;
};

const formatCountdown = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
};

const ResetPassword: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const state = (location.state || {}) as ResetLocationState;
  const { token: tokenFromPath = "" } = useParams<{ token?: string }>();
  const [searchParams] = useSearchParams();
  const token = useMemo(() => tokenFromPath || searchParams.get("token") || "", [searchParams, tokenFromPath]);
  const emailFromQuery = searchParams.get("email") || "";
  const otpMode = !token;
  const [email, setEmail] = useState(state.email || emailFromQuery);
  const [otp, setOtp] = useState("");
  const [expiresIn, setExpiresIn] = useState(state.expiresInSeconds || 0);
  const [resendCooldown, setResendCooldown] = useState(state.resendCooldownSeconds || 0);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inlineError, setInlineError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const hasOtpRequestContext = Boolean(token || state.otpRequested || state.expiresInSeconds || state.resendCooldownSeconds);

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

  const validatePasswords = () => {
    if (password.length < 6) {
      const message = "Password must be at least 6 characters.";
      setInlineError(message);
      toast({ title: "Weak password", description: message, variant: "destructive" });
      return false;
    }

    if (password !== confirmPassword) {
      const message = "Password and Confirm Password must match.";
      setInlineError(message);
      toast({ title: "Password mismatch", description: message, variant: "destructive" });
      return false;
    }

    return true;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setInlineError("");

    if (!validatePasswords()) return;

    if (otpMode && (!email || otp.length !== 6)) {
      const message = "Enter your email and 6-digit OTP to continue.";
      setInlineError(message);
      toast({ title: "OTP required", description: message, variant: "destructive" });
      return;
    }

    if (!otpMode && !token) {
      const message = "This reset link is invalid or incomplete.";
      setInlineError(message);
      toast({ title: "Invalid link", description: message, variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const response = otpMode
        ? await apiService.resetPasswordWithOtp({ email, otp, password })
        : await apiService.resetPassword(token, password);

      setSuccessMessage(response.message);
      toast({ title: "Password reset successful", description: response.message });
      window.setTimeout(() => navigate("/login", { replace: true }), 1500);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not reset password.";
      setInlineError(message);
      toast({ title: "Reset failed", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) return;
    setInlineError("");
    setLoading(true);

    try {
      const response = await apiService.resendPasswordResetOtp(email);
      setExpiresIn(response.data?.expiresInSeconds || 300);
      setResendCooldown(response.data?.resendCooldownSeconds || 30);
      setOtp("");
      toast({ title: "OTP resent", description: "A fresh password reset OTP was sent to your email." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to resend OTP.";
      setInlineError(message);
      toast({ title: "Resend failed", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      badge="Credential Security"
      title="Reset password"
      subtitle={
        otpMode
          ? "Enter the OTP sent to your email, then create a new password for your account."
          : "Create a strong new password for your account using the secure link from your email."
      }
      footer={
        <p className="text-center text-sm text-muted-foreground">
          Back to{" "}
          <Link className="font-semibold text-primary hover:underline" to="/login">
            Sign in
          </Link>
        </p>
      }
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        {otpMode && !hasOtpRequestContext ? (
          <InlineStatusMessage
            type="error"
            message="Request a password reset OTP first. If the email is valid, you will be taken to this screen automatically."
          />
        ) : null}

        {otpMode ? (
          <>
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
                  required
                  disabled={loading || Boolean(successMessage)}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="password-reset-otp">6 Digit OTP</Label>
                <span className="text-xs font-semibold text-primary">{expiresIn > 0 ? expiryLabel : "OTP sent to email"}</span>
              </div>
              <InputOTP
                id="password-reset-otp"
                maxLength={6}
                value={otp}
                onChange={(value) => setOtp(value.replace(/\D/g, "").slice(0, 6))}
                disabled={loading || Boolean(successMessage)}
              >
                <InputOTPGroup className="w-full justify-between">
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <InputOTPSlot key={index} index={index} className="h-14 w-12 rounded-2xl border border-border bg-white text-base text-black shadow-sm" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
          </>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="password">New Password</Label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="pl-11 pr-11"
              required
              minLength={6}
              disabled={loading || Boolean(successMessage)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              disabled={loading || Boolean(successMessage)}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirm Password</Label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="confirm-password"
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="pl-11 pr-11"
              required
              minLength={6}
              disabled={loading || Boolean(successMessage)}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              disabled={loading || Boolean(successMessage)}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={loading || Boolean(successMessage) || (otpMode && (!hasOtpRequestContext || !email || otp.length !== 6))}
        >
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Updating...</> : "Reset Password"}
        </Button>

        {otpMode ? (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={loading || resendCooldown > 0 || !email || Boolean(successMessage) || !hasOtpRequestContext}
            onClick={() => void handleResend()}
          >
            <RotateCcw className="h-4 w-4" />
            {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : "Resend OTP"}
          </Button>
        ) : null}

        {!otpMode && !token ? (
          <InlineStatusMessage
            type="error"
            message="Reset link missing. Open the reset link from your email again, or request a new one from the login page."
          />
        ) : null}
        {inlineError ? <InlineStatusMessage type="error" message={inlineError} /> : null}
        {successMessage ? <InlineStatusMessage type="success" message={successMessage} /> : null}
      </form>
    </AuthShell>
  );
};

export default ResetPassword;
