import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { Button } from "@/components/ui/button";
import { RoleBadge } from "@/components/ui/role-badge";
import { toast } from "sonner";
import axios from "axios";
import LandingLayout from "@/components/layouts/LandingLayout";
import { useTheme } from "@/components/theme-provider";
import { motion } from "framer-motion";
import {
  Plus,
  Search,
  Edit,
  Key,
  Ban,
  CheckCircle,
  Users,
  Shield,
  X,
  Copy,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Calendar,
  Train,
} from "lucide-react";
import { Link } from "react-router-dom";

const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_SERVER_URL;
  if (
    envUrl &&
    typeof envUrl === "string" &&
    envUrl !== "undefined" &&
    envUrl !== "serverurl" &&
    envUrl.startsWith("http")
  ) {
    return envUrl;
  }
  return "http://localhost:3000";
};

interface User {
  _id: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  role: string;
  status: "active" | "disabled" | "pending";
  force_password_change: boolean;
  last_login_at?: string;
  createdAt?: string;
}

interface UsersResponse {
  users: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const VALID_ROLES = [
  { id: "system_admin", label: "System Admin" },
  { id: "section_controller", label: "Section Controller" },
  { id: "signal_operator", label: "Signal Operator" },
  { id: "loco_pilot", label: "Loco Pilot" },
];

const AdminUsers: React.FC = () => {
  const { accessToken } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  
  // State
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  
  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [credentialsData, setCredentialsData] = useState<{ email: string; password: string } | null>(null);
  const [credentialsCopied, setCredentialsCopied] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    email: "",
    name: "",
    role: "loco_pilot",
    initial_password: "",
  });
  const [resetPasswordData, setResetPasswordData] = useState({
    new_password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch users
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("limit", "10");
      if (search) params.append("search", search);
      if (roleFilter) params.append("role", roleFilter);
      if (statusFilter) params.append("status", statusFilter);

      const response = await axios.get<UsersResponse>(
        `${getApiBaseUrl()}/api/v1/admin/users?${params.toString()}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      setUsers(response.data.users);
      setTotalPages(response.data.totalPages);
      setTotal(response.data.total);
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, roleFilter, statusFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchUsers();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Create user - password REQUIRED
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.role) {
      toast.error("Please select a role");
      return;
    }

    if (!formData.initial_password || formData.initial_password.trim() === '') {
      toast.error("Initial password is required");
      return;
    }
    
    setSubmitting(true);

    try {
      await axios.post(
        `${getApiBaseUrl()}/api/v1/admin/users`,
        formData,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      toast.success("User created successfully");
      
      // Show credentials modal with LOCAL form data (not server response)
      setCredentialsData({
        email: formData.email,
        password: formData.initial_password,
      });
      setCredentialsCopied(false);
      setShowAddModal(false);
      setShowCredentialsModal(true);
      
      // Reset form
      setFormData({ email: "", name: "", role: "loco_pilot", initial_password: "" });
      fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to create user");
    } finally {
      setSubmitting(false);
    }
  };

  // Update user
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    
    if (!formData.role) {
      toast.error("Please select a role");
      return;
    }
    
    setSubmitting(true);

    try {
      await axios.patch(
        `${getApiBaseUrl()}/api/v1/admin/users/${selectedUser._id}`,
        { name: formData.name, role: formData.role },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      toast.success("User updated successfully");
      setShowEditModal(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to update user");
    } finally {
      setSubmitting(false);
    }
  };

  // Reset password - opens modal to set new password
  const openResetPasswordModal = (user: User) => {
    setSelectedUser(user);
    setResetPasswordData({ new_password: "" });
    setShowResetPasswordModal(true);
  };

  // Submit reset password with new password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    if (!resetPasswordData.new_password || resetPasswordData.new_password.trim() === '') {
      toast.error("New password is required");
      return;
    }

    setSubmitting(true);

    try {
      await axios.post(
        `${getApiBaseUrl()}/api/v1/admin/users/${selectedUser._id}/reset-password`,
        { new_password: resetPasswordData.new_password },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      toast.success("Password reset successfully");
      
      // Show credentials modal with the new password
      setCredentialsData({
        email: selectedUser.email,
        password: resetPasswordData.new_password,
      });
      setCredentialsCopied(false);
      setShowResetPasswordModal(false);
      setShowCredentialsModal(true);
      
      setSelectedUser(null);
      setResetPasswordData({ new_password: "" });
      fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to reset password");
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle status
  const handleToggleStatus = async (user: User) => {
    const newStatus = user.status === "disabled" ? "active" : "disabled";
    const action = newStatus === "disabled" ? "disable" : "enable";

    try {
      await axios.patch(
        `${getApiBaseUrl()}/api/v1/admin/users/${user._id}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      toast.success(`User ${action}d successfully`);
      fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.error || `Failed to ${action} user`);
    }
  };

  // Open edit modal
  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setFormData({
      email: user.email,
      name: user.name || "",
      role: user.role,
      initial_password: "",
    });
    setShowEditModal(true);
  };

  // Copy credentials to clipboard
  const copyCredentials = () => {
    if (credentialsData) {
      const text = `Email: ${credentialsData.email}\nPassword: ${credentialsData.password}`;
      navigator.clipboard.writeText(text);
      setCredentialsCopied(true);
      toast.success("Credentials copied to clipboard");
    }
  };

  // Get display name
  const getDisplayName = (user: User) => {
    return user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email.split("@")[0];
  };

  // Status badge
  const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const config: Record<string, { className: string; icon: React.ReactNode }> = {
      active: { className: "bg-green-600/20 text-green-600 dark:text-green-300 border-green-500/30", icon: <CheckCircle className="w-3 h-3" /> },
      disabled: { className: "bg-red-600/20 text-red-600 dark:text-red-300 border-red-500/30", icon: <Ban className="w-3 h-3" /> },
      pending: { className: "bg-yellow-600/20 text-yellow-600 dark:text-yellow-300 border-yellow-500/30", icon: <Key className="w-3 h-3" /> },
    };
    const { className, icon } = config[status] || config.pending;
    return (
      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${className}`}>
        {icon}
        {status}
      </span>
    );
  };

  return (
    <LandingLayout showFooter={false}>
      <section className="w-full py-8 px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-6xl mx-auto"
        >
          {/* Admin Navigation Tabs */}
          <div className="flex items-center gap-2 mb-8 border-b border-slate-200 dark:border-slate-700 pb-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shadow-sm">
              <Users className="w-4 h-4" />
              User Management
            </div>
            <Link
              to="/admin/timetable"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Calendar className="w-4 h-4" />
              Timetable Schedule (Admin)
            </Link>
            <Link
              to="/simulation"
              className="ml-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors"
            >
              <Train className="w-3.5 h-3.5" />
              Open Simulator
            </Link>
          </div>

          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">User Management</h1>
            <p className="text-slate-600 dark:text-slate-400">Manage IRIS platform users and their roles</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className={`rounded-2xl p-4 backdrop-blur-md ${isDark ? 'bg-slate-800/40 border border-slate-700/50' : 'bg-white/70 border border-slate-300'}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{total}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Total Users</p>
                </div>
              </div>
            </div>
            <div className={`rounded-2xl p-4 backdrop-blur-md ${isDark ? 'bg-slate-800/40 border border-slate-700/50' : 'bg-white/70 border border-slate-300'}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-600/20 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {users.filter(u => u.status === "active").length}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Active Users</p>
                </div>
              </div>
            </div>
            <div className={`rounded-2xl p-4 backdrop-blur-md ${isDark ? 'bg-slate-800/40 border border-slate-700/50' : 'bg-white/70 border border-slate-300'}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center">
                  <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {users.filter(u => u.role === "system_admin").length}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Administrators</p>
                </div>
              </div>
            </div>
          </div>

          {/* Filters and actions */}
          <div className={`rounded-2xl p-4 mb-6 backdrop-blur-md ${isDark ? 'bg-slate-800/40 border border-slate-700/50' : 'bg-white/70 border border-slate-300'}`}>
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <div className="flex flex-wrap gap-3 items-center">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className={`pl-10 pr-4 py-2 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-64 ${isDark ? 'bg-slate-700/50 border border-slate-600 text-white' : 'bg-white border border-slate-300 text-slate-900'}`}
                  />
                </div>
                
                {/* Role filter */}
                <select
                  value={roleFilter}
                  onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
                  className={`px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isDark ? 'bg-slate-700/50 border border-slate-600 text-white' : 'bg-white border border-slate-300 text-slate-900'}`}
                >
                  <option value="">All Roles</option>
                  {VALID_ROLES.map(r => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>

                {/* Status filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                  className={`px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isDark ? 'bg-slate-700/50 border border-slate-600 text-white' : 'bg-white border border-slate-300 text-slate-900'}`}
                >
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>

              <Button
                onClick={() => {
                  setFormData({ email: "", name: "", role: "loco_pilot", initial_password: "" });
                  setShowAddModal(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add User
              </Button>
            </div>
          </div>

          {/* Users table */}
          <div className={`rounded-2xl overflow-hidden backdrop-blur-md ${isDark ? 'bg-slate-800/40 border border-slate-700/50' : 'bg-white/70 border border-slate-300'}`}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${isDark ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-100 border-slate-200'}`}>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">User</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Last Login</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-slate-700' : 'divide-slate-200'}`}>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                        <div className="flex items-center justify-center gap-2">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-500"></div>
                          Loading...
                        </div>
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                        No users found
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user._id} className={`${isDark ? 'hover:bg-slate-700/30' : 'hover:bg-slate-50'}`}>
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-slate-900 dark:text-white font-medium">{getDisplayName(user)}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{user.email}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <RoleBadge role={user.role} />
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={user.status} />
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                          {user.last_login_at
                            ? new Date(user.last_login_at).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "Never"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEditModal(user)}
                              className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-600' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'}`}
                              title="Edit user"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openResetPasswordModal(user)}
                              className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-slate-400 hover:text-amber-400 hover:bg-slate-600' : 'text-slate-500 hover:text-amber-600 hover:bg-amber-50'}`}
                              title="Reset password & copy credentials"
                            >
                              <Key className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleToggleStatus(user)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                user.status === "disabled"
                                  ? "text-green-500 hover:bg-green-50 dark:hover:bg-green-600/20"
                                  : "text-red-500 hover:bg-red-50 dark:hover:bg-red-600/20"
                              }`}
                              title={user.status === "disabled" ? "Enable user" : "Disable user"}
                            >
                              {user.status === "disabled" ? (
                                <CheckCircle className="w-4 h-4" />
                              ) : (
                                <Ban className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className={`px-4 py-3 border-t flex items-center justify-between ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Showing {(page - 1) * 10 + 1} to {Math.min(page * 10, total)} of {total}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className={`p-1.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-600' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'}`}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className={`p-1.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-600' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'}`}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </section>

      {/* Add User Modal - Password REQUIRED */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`rounded-2xl w-full max-w-md ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'}`}
          >
            <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Add New User</h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={`w-full px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isDark ? 'bg-slate-700/50 border border-slate-600 text-white' : 'bg-white border border-slate-300 text-slate-900'}`}
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isDark ? 'bg-slate-700/50 border border-slate-600 text-white' : 'bg-white border border-slate-300 text-slate-900'}`}
                  placeholder="Full Name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Role *</label>
                <div className="space-y-2">
                  {VALID_ROLES.map((role) => (
                    <label key={role.id} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="role"
                        value={role.id}
                        checked={formData.role === role.id}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                      />
                      <RoleBadge role={role.id} size="md" />
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Initial Password *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={formData.initial_password}
                    onChange={(e) => setFormData({ ...formData, initial_password: e.target.value })}
                    className={`w-full px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 pr-10 ${isDark ? 'bg-slate-700/50 border border-slate-600 text-white' : 'bg-white border border-slate-300 text-slate-900'}`}
                    placeholder="Min 8 chars, upper, lower, number, special"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Must contain: 8+ chars, uppercase, lowercase, number, special char
                </p>
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                  {submitting ? "Creating..." : "Create User"}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`rounded-2xl w-full max-w-md ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'}`}
          >
            <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Edit User</h2>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                <input
                  type="email"
                  disabled
                  value={formData.email}
                  className={`w-full px-3 py-2 rounded-xl cursor-not-allowed ${isDark ? 'bg-slate-700/30 border border-slate-600 text-slate-400' : 'bg-slate-100 border border-slate-200 text-slate-500'}`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isDark ? 'bg-slate-700/50 border border-slate-600 text-white' : 'bg-white border border-slate-300 text-slate-900'}`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Role *</label>
                <div className="space-y-2">
                  {VALID_ROLES.map((role) => (
                    <label key={role.id} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="role"
                        value={role.id}
                        checked={formData.role === role.id}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                      />
                      <RoleBadge role={role.id} size="md" />
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                  {submitting ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetPasswordModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`rounded-2xl w-full max-w-md ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'}`}
          >
            <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Reset Password</h2>
              <button onClick={() => setShowResetPasswordModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleResetPassword} className="p-6 space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Set a new password for <strong>{selectedUser.email}</strong>
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  New Password *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={resetPasswordData.new_password}
                    onChange={(e) => setResetPasswordData({ new_password: e.target.value })}
                    className={`w-full px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 pr-10 ${isDark ? 'bg-slate-700/50 border border-slate-600 text-white' : 'bg-white border border-slate-300 text-slate-900'}`}
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Must contain: 8+ chars, uppercase, lowercase, number, special char
                </p>
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowResetPasswordModal(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting} className="flex-1 bg-amber-600 hover:bg-amber-700">
                  {submitting ? "Resetting..." : "Set & Copy"}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Credentials Modal */}
      {showCredentialsModal && credentialsData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`rounded-2xl w-full max-w-md ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'}`}
          >
            <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">User Credentials</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className={`rounded-xl p-4 ${isDark ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-amber-50 border border-amber-200'}`}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-amber-700 dark:text-amber-300 text-sm">
                    Copy these credentials now. User must change password on first login.
                  </p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Email</label>
                  <input
                    type="text"
                    readOnly
                    value={credentialsData.email}
                    className={`w-full px-3 py-2 rounded-xl font-mono text-sm ${isDark ? 'bg-slate-700/50 border border-slate-600 text-white' : 'bg-slate-100 border border-slate-300 text-slate-900'}`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Password</label>
                  <input
                    type="text"
                    readOnly
                    value={credentialsData.password}
                    className={`w-full px-3 py-2 rounded-xl font-mono text-sm ${isDark ? 'bg-slate-700/50 border border-slate-600 text-white' : 'bg-slate-100 border border-slate-300 text-slate-900'}`}
                  />
                </div>
              </div>

              <Button onClick={copyCredentials} variant="outline" className="w-full">
                <Copy className="w-4 h-4 mr-2" />
                Copy Both to Clipboard
              </Button>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={credentialsCopied}
                  onChange={(e) => setCredentialsCopied(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm text-slate-600 dark:text-slate-400">I have copied the credentials</span>
              </label>

              <Button
                onClick={() => { setShowCredentialsModal(false); setCredentialsData(null); setCredentialsCopied(false); }}
                disabled={!credentialsCopied}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Done
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </LandingLayout>
  );
};

export default AdminUsers;
