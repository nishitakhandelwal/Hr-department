import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, Mail, UserRound } from "lucide-react";

import { AuthShell } from "@/components/AuthShell";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import InlineStatusMessage from "@/components/InlineStatusMessage";

const Register: React.FC = () => {
  const { registerCandidate } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inlineError, setInlineError] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setInlineError("");

    if (password !== confirmPassword) {
      const message = "Password and Confirm Password must match.";
      setInlineError(message);
      toast({ title: "Password mismatch", description: message, variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const verification = await registerCandidate({ name, email, password });
      toast({ title: "Registration successful", description: "We sent a verification code to your email." });
      navigate(`/verify-otp?email=${encodeURIComponent(verification.email)}`, {
        replace: true,
        state: {
          email: verification.email,
          expiresInSeconds: verification.expiresInSeconds,
          resendCooldownSeconds: verification.resendCooldownSeconds,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to register account";
      setInlineError(message);
      toast({ title: "Registration failed", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      badge="Candidate Registration"
      title="Create your account"
      subtitle="Set up your secure candidate access to apply, track updates, and complete onboarding steps."
      footer={
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="name">Full Name</Label>
          <div className="relative">
            <UserRound className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="name" value={name} onChange={(event) => setName(event.target.value)} className="pl-11" required />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="pl-11" required />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
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
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((value) => !value)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Creating account..." : "Register"}
        </Button>

        <div className="min-h-[20px]">
          {inlineError ? <InlineStatusMessage type="error" message={inlineError} /> : null}
        </div>
      </form>
    </AuthShell>
  );
};

export default Register;
