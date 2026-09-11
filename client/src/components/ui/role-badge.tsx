import React from "react";

interface RoleBadgeProps {
  role: string;
  size?: "sm" | "md" | "lg";
}

const roleConfig: Record<string, { label: string; bgClass: string }> = {
  system_admin: {
    label: "Admin",
    bgClass: "bg-rose-500/10 text-rose-600 dark:text-rose-450 border-rose-500/25 dark:border-rose-500/40",
  },
  section_controller: {
    label: "Controller",
    bgClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/25 dark:border-indigo-500/40",
  },
  signal_operator: {
    label: "Operator",
    bgClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25 dark:border-amber-500/40",
  },
  loco_pilot: {
    label: "Driver",
    bgClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 dark:border-emerald-500/40",
  },
};

const sizeClasses = {
  sm: "text-[11px] px-2 py-0.5 font-semibold",
  md: "text-xs px-2.5 py-1 font-semibold",
  lg: "text-sm px-3 py-1.5 font-bold",
};

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role, size = "sm" }) => {
  const config = roleConfig[role] || {
    label: role,
    bgClass: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
  };

  return (
    <span
      className={`inline-flex items-center rounded-md border ${config.bgClass} ${sizeClasses[size]}`}
    >
      {config.label}
    </span>
  );
};

export default RoleBadge;
