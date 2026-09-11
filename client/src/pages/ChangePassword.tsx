import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, getUserRole, getLandingRouteForRole } from "../context/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Eye, EyeOff, Lock } from "lucide-react";
import LandingLayout from "@/components/layouts/LandingLayout";
import { motion } from "framer-motion";
import { useTheme } from "@/components/theme-provider";

const ChangePassword: React.FC = () => {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { changePassword, user } = useAuth();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const isForcedChange = user?.force_password_change;

  const validatePassword = (password: string): string[] => {
    const errors: string[] = [];
    if (password.length < 8) {
      errors.push("Password must be at least 8 characters long");
    }
    if (!/[a-z]/.test(password)) {
      errors.push("Password must contain at least one lowercase letter");
    }
    if (!/[A-Z]/.test(password)) {
      errors.push("Password must contain at least one uppercase letter");
    }
    if (!/[0-9]/.test(password)) {
      errors.push("Password must contain at least one number");
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push("Password must contain at least one special character");
    }
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    // Validate password strength
    const validationErrors = validatePassword(newPassword);
    if (validationErrors.length > 0) {
      toast.error(validationErrors[0]);
      return;
    }

    setLoading(true);

    try {
      await changePassword(isForcedChange ? null : oldPassword, newPassword);
      toast.success("Password changed successfully");

      // Redirect based on role
      const role = getUserRole(user);
      const landingRoute = getLandingRouteForRole(role);
      navigate(landingRoute, { replace: true });
    } catch (error: any) {
      toast.error(error.message || "Password change failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <LandingLayout showFooter={false}>
      <section className="w-full py-20 lg:py-32 px-6 flex items-center justify-center min-h-[70vh]">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          <div className={`rounded-2xl backdrop-blur-md shadow-lg p-8 ${isDark ? 'bg-slate-800/40 border border-slate-700/50' : 'bg-white/70 border border-slate-300'}`}>
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-600 rounded-full mb-4">
                <Lock className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                {isForcedChange ? "Change Your Password" : "Update Password"}
              </h1>
              {isForcedChange && (
                <p className="text-amber-600 dark:text-amber-400 text-sm">
                  You must change your password before continuing
                </p>
              )}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {!isForcedChange && (
                <div>
                  <label
                    htmlFor="oldPassword"
                    className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
                  >
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      id="oldPassword"
                      type={showOldPassword ? "text" : "password"}
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      required
                      className={`w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all pr-12 ${isDark ? 'bg-slate-700/50 border border-slate-600 text-white placeholder-slate-400' : 'bg-white border border-slate-300 text-slate-900 placeholder-slate-500'}`}
                      placeholder="Enter current password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOldPassword(!showOldPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showOldPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label
                  htmlFor="newPassword"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
                >
                  New Password
                </label>
                <div className="relative">
                  <input
                    id="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className={`w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all pr-12 ${isDark ? 'bg-slate-700/50 border border-slate-600 text-white placeholder-slate-400' : 'bg-white border border-slate-300 text-slate-900 placeholder-slate-500'}`}
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Must be at least 8 characters with uppercase, lowercase, number, and special character
                </p>
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
                >
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className={`w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all pr-12 ${isDark ? 'bg-slate-700/50 border border-slate-600 text-white placeholder-slate-400' : 'bg-white border border-slate-300 text-slate-900 placeholder-slate-500'}`}
                    placeholder="Confirm new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-medium transition-colors text-lg"
              >
                {loading ? "Changing Password..." : "Change Password"}
              </Button>
            </form>
          </div>
        </motion.div>
      </section>
    </LandingLayout>
  );
};

export default ChangePassword;
