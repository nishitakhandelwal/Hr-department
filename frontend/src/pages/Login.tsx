import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";

import { AuthShell } from "@/components/AuthShell";
import { useAuth } from "@/context/AuthContext";
import { useSystemSettings } from "@/context/SystemSettingsContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import InlineStatusMessage from "@/components/InlineStatusMessage";

const Login: React.FC = () => {
  const { login } = useAuth();
  const { publicSettings } = useSystemSettings();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [inlineError, setInlineError] = useState("");
  const [loading, setLoading] = useState(false);

  const getRedirectPath = (user: { role: string; accessRole?: string }) => {
    if (user.accessRole === "super_admin" || user.accessRole === "admin" || user.role === "admin") {
      return publicSettings?.preferences?.defaultDashboardPage || "/admin/dashboard";
    }
    if (user.accessRole === "hr_manager") return "/hr/dashboard";
    if (user.accessRole === "recruiter") return "/recruiter/dashboard";
    return "/candidate/dashboard";
  };

  const handleEmailLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setInlineError("");
    setLoading(true);

    try {
      const response = await login(email, password, { rememberMe });
      if (response.requiresTwoFactor) {
        const message = "This screen now supports email and password login only.";
        setInlineError(message);
        toast({ title: "Additional verification required", description: message, variant: "destructive" });
        return;
      }
      if (!response.user) {
        setInlineError("Unable to login. Please retry.");
        return;
      }
      if (response.mustResetPassword) {
        toast({ title: "Password reset required", description: "Please use Forgot password to set a new password.", variant: "destructive" });
        navigate("/forgot-password");
        return;
      }
      navigate(getRedirectPath(response.user));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid credentials";
      setInlineError(message);
      toast({ title: "Login failed", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      badge="Secure Sign In"
      title="Welcome back"
      subtitle="Sign in to access your HR workspace."
      footer={
        <div className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link to="/register" className="font-semibold text-primary hover:underline">
            Register here
          </Link>
        </div>
      }
    >
      <form onSubmit={handleEmailLogin} className="space-y-5">
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
              />
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
                className="h-12 rounded-2xl pl-11 pr-11"
                placeholder="Enter password"
                minLength={6}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-muted-foreground">
              <Checkbox checked={rememberMe} onCheckedChange={(checked) => setRememberMe(Boolean(checked))} />
              Remember me
            </label>
            <button
              type="button"
              className="font-semibold text-primary transition-colors hover:text-primary/80"
              onClick={() => navigate("/forgot-password")}
            >
              Forgot password?
            </button>
          </div>

          <Button type="submit" className="h-12 w-full rounded-2xl" disabled={loading}>
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Signing in...</> : "Sign In"}
          </Button>

          <div className="min-h-[20px]">
            {inlineError ? <InlineStatusMessage type="error" message={inlineError} /> : null}
          </div>
      </form>
    </AuthShell>
  );
};

export default Login;
