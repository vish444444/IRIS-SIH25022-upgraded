import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth, getUserRole, getLandingRouteForRole } from "../context/AuthContext";

interface ProtectedRouteProps {
  allowedRoles?: string[];
  children?: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles, children }) => {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  // Show nothing while loading auth state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated, preserve the intended destination
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Force password change if required (unless already on change-password page)
  if (user?.force_password_change && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }

  // Get user role
  const userRole = getUserRole(user);

  // Check role authorization if allowedRoles specified
  if (allowedRoles && allowedRoles.length > 0) {
    const hasAllowedRole = userRole && allowedRoles.includes(userRole);
    if (!hasAllowedRole) {
      // Redirect to appropriate dashboard based on their actual role
      const redirectPath = getLandingRouteForRole(userRole);
      console.log('[ProtectedRoute] User role', userRole, 'not in allowed', allowedRoles, '-> redirecting to', redirectPath);
      return <Navigate to={redirectPath} replace />;
    }
  }

  // Render children or outlet for nested routes
  return children ? <>{children}</> : <Outlet />;
};

export default ProtectedRoute;
