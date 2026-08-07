import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, Eye, EyeOff, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import investoursLogo from "@/assets/investours-logo.png";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);
  const [hasValidSession, setHasValidSession] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // Listen for PASSWORD_RECOVERY event fired by Supabase when the reset link is clicked
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setHasValidSession(true);
        setErrorMessage(null);
        setReady(true);
      } else if (event === "SIGNED_IN" && session) {
        // PKCE code exchange completed — session is live
        setHasValidSession(true);
        setErrorMessage(null);
        setReady(true);
      }
    });

    // Also try exchanging a ?code= param (PKCE flow)
    const code = searchParams.get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
        if (error) {
          setErrorMessage("Invalid or expired reset link. Please request a new one.");
          setHasValidSession(false);
          setReady(true);
        } else if (data.session) {
          setHasValidSession(true);
          setErrorMessage(null);
          setReady(true);
        }
      });
    } else {
      // No code param — check if there's already a valid session (hash-based flow
      // sets the session before the page loads via onAuthStateChange above)
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setHasValidSession(true);
          setErrorMessage(null);
        } else {
          // Give onAuthStateChange 1.5s to fire PASSWORD_RECOVERY before showing error
          setTimeout(() => {
            setReady(prev => {
              if (!prev) {
                setErrorMessage("Invalid or expired reset link. Please request a new one.");
                setHasValidSession(false);
              }
              return true;
            });
          }, 1500);
        }
        setReady(true);
      });
    }

    return () => subscription.unsubscribe();
  }, [searchParams]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      toast({ title: "Invalid Password", description: "Password must be at least 8 characters.", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Passwords Do Not Match", description: "Both fields must match.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (error) {
      toast({ title: "Reset Failed", description: error.message, variant: "destructive" });
      return;
    }

    // Send confirmation email (fire-and-forget)
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      supabase.functions.invoke('send-notification', {
        body: { type: 'password_reset_confirm', recipient_id: user.id }
      }).catch(() => {});
    }

    setResetSuccess(true);
    toast({ title: "Password Updated!", description: "You can now log in with your new password." });
    setTimeout(() => navigate("/auth"), 2500);
  };

  // Loading
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full"
        />
      </div>
    );
  }

  // Invalid / expired link
  if (!hasValidSession && errorMessage) {
    return (
      <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <Button variant="ghost" onClick={() => navigate("/auth")} className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Login
          </Button>
          <Card variant="elevated" className="border-0 shadow-xl">
            <CardHeader className="text-center">
              <AlertCircle className="w-14 h-14 text-destructive mx-auto mb-3" />
              <img src={investoursLogo} alt="Investours" className="w-12 h-12 mx-auto mb-3" />
              <CardTitle>Reset Link Expired</CardTitle>
              <CardDescription>{errorMessage}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate("/auth?mode=forgot")} variant="hero" className="w-full">
                Request New Reset Link
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Success
  if (resetSuccess) {
    return (
      <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <Card variant="elevated" className="border-0 shadow-xl">
            <CardHeader className="text-center">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-3" />
              </motion.div>
              <img src={investoursLogo} alt="Investours" className="w-12 h-12 mx-auto mb-3" />
              <CardTitle>Password Updated!</CardTitle>
              <CardDescription>Redirecting you to login...</CardDescription>
            </CardHeader>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Reset form
  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <Button variant="ghost" onClick={() => navigate("/home")} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
        </Button>
        <Card variant="elevated" className="border-0 shadow-xl">
          <CardHeader className="text-center">
            <img src={investoursLogo} alt="Investours" className="w-16 h-16 mx-auto mb-4" />
            <CardTitle className="text-2xl">Set New Password</CardTitle>
            <CardDescription>Choose a strong password for your account</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Minimum 8 characters"
                    className="pl-10 pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    disabled={submitting}
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="confirm"
                    type={showConfirm ? "text" : "password"}
                    placeholder="Repeat your new password"
                    className="pl-10 pr-10"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={8}
                    disabled={submitting}
                    required
                  />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {password && confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-destructive">Passwords do not match</p>
              )}

              <Button type="submit" variant="hero" className="w-full" size="lg" disabled={submitting}>
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                      className="inline-block w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full" />
                    Updating...
                  </span>
                ) : "Update Password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default ResetPassword;
