import React from "react";
import { Train, Radio, AlertTriangle } from "lucide-react";
import LandingLayout from "@/components/layouts/LandingLayout";
import { motion } from "framer-motion";
import { useTheme } from "@/components/theme-provider";

interface DashboardPlaceholderProps {
  title: string;
  role: string;
  description: string;
  icon?: React.ReactNode;
}

const DashboardPlaceholder: React.FC<DashboardPlaceholderProps> = ({
  title,
  role,
  description,
  icon,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <LandingLayout showFooter={false}>
      <section className="w-full py-20 px-6 flex items-center justify-center min-h-[70vh]">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl w-full"
        >
          <div className={`rounded-2xl backdrop-blur-md shadow-lg p-8 ${isDark ? 'bg-slate-800/40 border border-slate-700/50' : 'bg-white/70 border border-slate-300'}`}>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center">
                {icon || <Train className="w-7 h-7 text-white" />}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm">{role}</p>
              </div>
            </div>
            
            <div className={`rounded-xl p-6 ${isDark ? 'bg-slate-700/30 border border-slate-600/50' : 'bg-slate-50 border border-slate-200'}`}>
              <p className="text-slate-600 dark:text-slate-300 text-center">{description}</p>
              <p className="text-slate-400 dark:text-slate-500 text-sm text-center mt-4">
                This dashboard will be connected to IRIS decision engine in future sprints.
              </p>
            </div>
          </div>
        </motion.div>
      </section>
    </LandingLayout>
  );
};

// Controller Dashboard
export const ControllerDashboard: React.FC = () => (
  <DashboardPlaceholder
    title="Section Controller Dashboard"
    role="Train Scheduling & Precedence Control"
    description="View and manage train schedules, accept or override AI recommendations for precedence and crossings."
    icon={<Train className="w-7 h-7 text-white" />}
  />
);

// Signals Dashboard
export const SignalsDashboard: React.FC = () => (
  <DashboardPlaceholder
    title="Signal Operator Dashboard"
    role="Signal Monitoring & Alerts"
    description="Monitor signal status across sections, acknowledge alerts, and coordinate with controllers."
    icon={<Radio className="w-7 h-7 text-white" />}
  />
);

// Driver Dashboard
export const DriverDashboard: React.FC = () => (
  <DashboardPlaceholder
    title="Loco Pilot Dashboard"
    role="Driver Instructions"
    description="View operational instructions, speed limits, and station alerts for your assigned routes."
    icon={<AlertTriangle className="w-7 h-7 text-white" />}
  />
);

export default DashboardPlaceholder;
