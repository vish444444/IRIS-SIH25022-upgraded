import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ModeToggle } from '@/components/ModeToggle';
import { useTheme } from '@/components/theme-provider';
import { HeroHighlight } from '@/components/ui/hero-highlight';
import { useAuth, getUserRole, getLandingRouteForRole } from '@/context/AuthContext';
import { Train, LogOut, User } from 'lucide-react';

interface LandingLayoutProps {
  children: React.ReactNode;
  showNav?: boolean;
  showFooter?: boolean;
  compactHeader?: boolean;
}

export const LandingLayout: React.FC<LandingLayoutProps> = ({
  children,
  showNav = true,
  showFooter = true,
  compactHeader = false,
}) => {
  const { theme } = useTheme();
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const isHome = pathname === '/';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Get user display name
  const getUserDisplayName = () => {
    if (!user) return '';
    return user.name || user.email.split('@')[0];
  };

  // Get dashboard route based on role
  const getDashboardRoute = () => {
    const role = getUserRole(user);
    return getLandingRouteForRole(role);
  };

  const headerContent = (
    <header className="w-full py-6 px-4 sm:px-6 lg:px-8 flex-shrink-0">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={`mx-auto flex items-center justify-between px-6 py-3 backdrop-blur-md ${
          isHome ? 'max-w-4xl rounded-full' : 'max-w-7xl rounded-2xl w-full'
        } ${isDark ? 'bg-slate-800/60 border border-slate-700/50' : 'bg-white/70 border border-slate-300 shadow-sm'}`}
      >
        {/* Logo - Left */}
        <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDark ? 'bg-slate-700' : 'bg-slate-900'}`}>
            <Train className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-base dark:text-white text-slate-900 flex items-center gap-1.5">
            IRIS
            {!isHome && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            )}
          </span>
        </Link>

          {/* Navigation - Center */}
          {showNav && (
            <nav className="hidden md:flex items-center gap-6">
              <Link
                to="/simulation"
                className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Simulation
              </Link>

              {user?.role === 'system_admin' && (
                <Link
                  to="/admin/timetable"
                  className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  Timetable
                </Link>
              )}
              
              {isAuthenticated ? (
                <div className="flex items-center gap-3">
                  <Link
                    to={getDashboardRoute()}
                    className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    <User className="w-4 h-4" />
                    {getUserDisplayName()}
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="text-sm font-medium px-4 py-1.5 rounded-full bg-slate-600 hover:bg-slate-700 text-white transition-colors flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="text-sm font-medium px-4 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                >
                  Login
                </Link>
              )}
            </nav>
          )}

      {/* Theme Toggle - Right */}
      <ModeToggle />
    </motion.div>
  </header>
  );

  const footerContent = (
    <footer className="w-full py-12 px-6 flex-shrink-0">
      <div className="max-w-6xl mx-auto flex flex-col items-center justify-center gap-6">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-900'}`}>
            <Train className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-slate-900 dark:text-white">IRIS</span>
        </div>

        {/* Links */}
        <div className="flex items-center gap-6">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            GitHub
          </a>
          <a
            href="#"
            className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            Documentation
          </a>
        </div>

        {/* Copyright */}
        <p className="text-sm text-slate-500 dark:text-slate-400">
          © {new Date().getFullYear()} IRIS. Built for SIH 2025.
        </p>
      </div>
    </footer>
  );

  if (isHome) {
    return (
      <HeroHighlight>
        <div className="min-h-screen flex flex-col">
          {headerContent}
          <main className="flex-1">
            {children}
          </main>
          {showFooter && footerContent}
        </div>
      </HeroHighlight>
    );
  }

  return (
    <div className={`min-h-screen w-full flex flex-col ${isDark ? 'bg-[#090d16] text-white' : 'bg-slate-50 text-slate-900'}`}>
      {headerContent}
      <main className="flex-1 flex flex-col min-h-0">
        {children}
      </main>
      {showFooter && footerContent}
    </div>
  );
};

export default LandingLayout;
