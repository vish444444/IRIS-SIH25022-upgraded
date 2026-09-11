import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth, getUserRole, getLandingRouteForRole } from "../context/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import LandingLayout from "@/components/layouts/LandingLayout";
import { motion } from "framer-motion";
import { useTheme } from "@/components/theme-provider";

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  // Get redirect destination from location state
  const from = (location.state as any)?.from?.pathname || null;

  useEffect(() => {
    if (isAuthenticated && user) {
      // If user needs to change password, redirect to change password page
      if (user.force_password_change) {
        navigate("/change-password", { replace: true });
        return;
      }

      // Get the user's role
      const role = getUserRole(user);
      console.log('[Login] Authenticated user role:', role);

      // If there's a redirect destination, go there
      if (from) {
        console.log('[Login] Redirecting to stored path:', from);
        navigate(from, { replace: true });
        return;
      }

      // Otherwise redirect based on role
      const landingRoute = getLandingRouteForRole(role);
      console.log('[Login] Redirecting to landing route:', landingRoute);
      navigate(landingRoute, { replace: true });
    }
  }, [isAuthenticated, user, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(email, password);
      toast.success("Login successful");
      // Navigation will happen in useEffect
    } catch (error: any) {
      toast.error(error.message || "Login failed");
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
          <div className={`rounded-2xl backdrop-blur-md shadow-xl p-8 transition-all duration-300 ${
            isDark 
              ? 'bg-slate-800/40 border border-slate-700/50 shadow-emerald-500/5 dark:shadow-[0_0_50px_rgba(16,185,129,0.05)]' 
              : 'bg-white/70 border border-slate-300/80 shadow-gray-200'
          }`}>
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2">Welcome Back</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Sign in to access IRIS platform</p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={`w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all ${isDark ? 'bg-slate-700/50 border border-slate-600 text-white placeholder-slate-500' : 'bg-white border border-slate-300 text-slate-900 placeholder-slate-400'}`}
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className={`w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all pr-12 ${isDark ? 'bg-slate-700/50 border border-slate-600 text-white placeholder-slate-500' : 'bg-white border border-slate-300 text-slate-900 placeholder-slate-400'}`}
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white py-3 rounded-xl font-semibold transition-all duration-300 shadow-md hover:shadow-emerald-500/10 hover:scale-[1.01] flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          </div>
        </motion.div>
      </section>
    </LandingLayout>
  );
};

export default Login;
