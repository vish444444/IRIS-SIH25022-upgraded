import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/components/theme-provider";
import LandingLayout from "@/components/layouts/LandingLayout";
import {
  Clock,
  Train,
  Search,
  Filter,
  Edit2,
  ChevronDown,
  ChevronUp,
  Save,
  X,
  ArrowRight,
  RefreshCw,
  Users,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Layers,
  Plus,
  Trash2,
  Sliders
} from "lucide-react";

interface StopTime {
  station: string;
  arrival: string;
  departure: string;
}

interface TimetableTrain {
  train_id: string;
  trip_id?: string;
  from: string;
  to: string;
  departure: string;
  direction?: "UP" | "DOWN" | string;
  service_type?: "slow" | "fast" | string;
  stop_times: StopTime[];
  flags?: {
    is_ac?: boolean;
    is_womens?: boolean;
    is_fast?: boolean;
    is_peak_service?: boolean;
  };
  color?: string;
  [key: string]: any;
}

const ALL_STATIONS = [
  "CSMT",
  "MASJID",
  "SANDHURST_ROAD",
  "BYCULLA",
  "CHINCHPOKLI",
  "CURREY_ROAD",
  "PAREL",
  "DADAR",
  "MATUNGA",
  "SION",
  "KURLA",
  "VIDYAVIHAR",
  "GHATKOPAR",
  "VIKHROLI",
  "KANJUR_MARG",
  "BHANDUP",
  "NAHUR",
  "MULUND",
  "THANE",
  "KALVA",
  "MUMBRA",
  "DIVA",
  "KOPAR",
  "DOMBIVLI",
  "THAKURLI",
  "KALYAN",
];

const FAST_STATIONS = [
  "CSMT",
  "BYCULLA",
  "DADAR",
  "KURLA",
  "GHATKOPAR",
  "THANE",
  "DOMBIVLI",
  "KALYAN",
];

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

// Time math helpers (HH:MM)
const addMinutesToTime = (timeStr: string, minutesToAdd: number): string => {
  if (!timeStr || !timeStr.includes(":")) return timeStr;
  const [h, m] = timeStr.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return timeStr;
  let totalMin = h * 60 + m + minutesToAdd;
  totalMin = ((totalMin % 1440) + 1440) % 1440;
  const newH = Math.floor(totalMin / 60);
  const newM = totalMin % 60;
  return `${newH.toString().padStart(2, "0")}:${newM.toString().padStart(2, "0")}`;
};

export const AdminTimetable: React.FC = () => {
  const { accessToken } = useAuth();
  const { theme } = useTheme();
  const isDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  const [timetable, setTimetable] = useState<TimetableTrain[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [directionFilter, setDirectionFilter] = useState<"ALL" | "UP" | "DOWN">("ALL");
  const [serviceFilter, setServiceFilter] = useState<"ALL" | "slow" | "fast">("ALL");

  // Expanded stop rows
  const [expandedTrainId, setExpandedTrainId] = useState<string | null>(null);

  // Edit Modal State
  const [editingTrain, setEditingTrain] = useState<TimetableTrain | null>(null);
  const [editDeparture, setEditDeparture] = useState("");
  const [editStopTimes, setEditStopTimes] = useState<StopTime[]>([]);

  // Add Train Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTrainId, setNewTrainId] = useState("");
  const [newDirection, setNewDirection] = useState<"UP" | "DOWN">("UP");
  const [newServiceType, setNewServiceType] = useState<"slow" | "fast">("slow");
  const [newDeparture, setNewDeparture] = useState("06:30");
  const [newFrom, setNewFrom] = useState("CSMT");
  const [newTo, setNewTo] = useState("KALYAN");
  const [newColor, setNewColor] = useState("#007AFF");
  const [newStopTimes, setNewStopTimes] = useState<StopTime[]>([]);

  const getAuthHeaders = () => {
    const token = accessToken || localStorage.getItem("access_token");
    return { Authorization: `Bearer ${token}` };
  };

  // Fetch timetable from admin endpoint
  const fetchTimetable = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${getApiBaseUrl()}/api/v1/admin/timetable`, {
        headers: getAuthHeaders(),
      });
      if (res.data.success && Array.isArray(res.data.timetable)) {
        setTimetable(res.data.timetable);
      }
    } catch (err: any) {
      console.error("Failed to fetch timetable:", err);
      toast.error(err.response?.data?.error || "Failed to load timetable");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimetable();
  }, []);

  // Filtered Trains
  const filteredTrains = useMemo(() => {
    return timetable.filter((t) => {
      const matchesSearch =
        search === "" ||
        t.train_id.toLowerCase().includes(search.toLowerCase()) ||
        t.from.toLowerCase().includes(search.toLowerCase()) ||
        t.to.toLowerCase().includes(search.toLowerCase()) ||
        t.stop_times.some((s) => s.station.toLowerCase().includes(search.toLowerCase()));

      const matchesDirection =
        directionFilter === "ALL" || (t.direction && t.direction.toUpperCase() === directionFilter);

      const matchesService =
        serviceFilter === "ALL" ||
        (t.service_type && t.service_type.toLowerCase() === serviceFilter.toLowerCase());

      return matchesSearch && matchesDirection && matchesService;
    });
  }, [timetable, search, directionFilter, serviceFilter]);

  // Open Edit Modal
  const handleStartEdit = (train: TimetableTrain) => {
    setEditingTrain(train);
    setEditDeparture(train.departure || "06:00");
    setEditStopTimes(
      train.stop_times.map((s) => ({
        station: s.station,
        arrival: s.arrival,
        departure: s.departure,
      }))
    );
  };

  // Shift all times by N minutes in edit modal
  const handleShiftAll = (minutes: number) => {
    setEditDeparture((prev) => addMinutesToTime(prev, minutes));
    setEditStopTimes((prev) =>
      prev.map((stop) => ({
        ...stop,
        arrival: addMinutesToTime(stop.arrival, minutes),
        departure: addMinutesToTime(stop.departure, minutes),
      }))
    );
    toast.info(`Shifted all stop times by ${minutes > 0 ? `+${minutes}` : minutes} minutes`);
  };

  // Update specific stop time in edit modal
  const handleStopTimeChange = (index: number, field: "arrival" | "departure", value: string) => {
    setEditStopTimes((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
      if (index === 0 && field === "departure") {
        setEditDeparture(value);
      }
      return updated;
    });
  };

  // Save changes for edited train
  const handleSaveSchedule = async () => {
    if (!editingTrain) return;
    setSaving(true);
    try {
      const res = await axios.put(
        `${getApiBaseUrl()}/api/v1/admin/timetable/${editingTrain.train_id}`,
        {
          departure: editDeparture,
          stop_times: editStopTimes,
        },
        {
          headers: getAuthHeaders(),
        }
      );

      if (res.data.success) {
        toast.success(`Schedule for ${editingTrain.train_id} updated successfully!`);
        setTimetable((prev) =>
          prev.map((t) =>
            t.train_id === editingTrain.train_id
              ? { ...t, departure: editDeparture, stop_times: editStopTimes }
              : t
          )
        );
        setEditingTrain(null);
      }
    } catch (err: any) {
      console.error("Failed to update timetable:", err);
      toast.error(err.response?.data?.error || "Failed to save timetable changes");
    } finally {
      setSaving(false);
    }
  };

  // Delete train
  const handleDeleteTrain = async (trainId: string) => {
    if (!window.confirm(`Are you sure you want to delete train '${trainId}' from the timetable?`)) {
      return;
    }

    try {
      const res = await axios.delete(`${getApiBaseUrl()}/api/v1/admin/timetable/${trainId}`, {
        headers: getAuthHeaders(),
      });

      if (res.data.success) {
        toast.success(`Train ${trainId} removed from timetable.`);
        setTimetable((prev) => prev.filter((t) => t.train_id !== trainId));
      }
    } catch (err: any) {
      console.error("Failed to delete train:", err);
      toast.error(err.response?.data?.error || "Failed to delete train");
    }
  };

  // Helper to generate stops automatically for Add Train
  const generateRouteStops = (
    direction: "UP" | "DOWN",
    serviceType: "slow" | "fast",
    departureTime: string
  ) => {
    let stationList = serviceType === "fast" ? [...FAST_STATIONS] : [...ALL_STATIONS];
    if (direction === "DOWN") {
      stationList.reverse();
    }

    const intervalMinutes = serviceType === "fast" ? 6 : 2.5;
    let currentMinOffset = 0;

    const stops: StopTime[] = stationList.map((station, idx) => {
      const arr = addMinutesToTime(departureTime, Math.round(currentMinOffset));
      const dep = idx === 0 ? departureTime : addMinutesToTime(arr, 0.5 > 0 ? 1 : 0);
      currentMinOffset += intervalMinutes;
      return {
        station,
        arrival: arr,
        departure: dep,
      };
    });

    return stops;
  };

  // Open Add Modal and prepopulate defaults
  const handleOpenAddModal = () => {
    const nextNum = timetable.length + 1;
    const suggestedId = `UP_SLOW_${nextNum}`;
    setNewTrainId(suggestedId);
    setNewDirection("UP");
    setNewServiceType("slow");
    setNewDeparture("06:30");
    setNewFrom("CSMT");
    setNewTo("KALYAN");
    setNewColor("#007AFF");
    const stops = generateRouteStops("UP", "slow", "06:30");
    setNewStopTimes(stops);
    setShowAddModal(true);
  };

  // When direction or service type changes in Add Modal
  const handleDirectionOrServiceChange = (
    dir: "UP" | "DOWN",
    serv: "slow" | "fast",
    dep: string = newDeparture
  ) => {
    setNewDirection(dir);
    setNewServiceType(serv);
    const from = dir === "UP" ? "CSMT" : "KALYAN";
    const to = dir === "UP" ? "KALYAN" : "CSMT";
    setNewFrom(from);
    setNewTo(to);
    setNewColor(serv === "fast" ? "#9333ea" : dir === "UP" ? "#007AFF" : "#f59e0b");

    const stops = generateRouteStops(dir, serv, dep);
    setNewStopTimes(stops);
  };

  // Submit Add Train
  const handleCreateTrain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTrainId.trim()) {
      toast.error("Please enter a valid Train ID");
      return;
    }
    if (newStopTimes.length < 2) {
      toast.error("Train must have at least 2 station stops");
      return;
    }

    setSaving(true);
    try {
      const res = await axios.post(
        `${getApiBaseUrl()}/api/v1/admin/timetable`,
        {
          train_id: newTrainId.trim().toUpperCase(),
          from: newFrom,
          to: newTo,
          departure: newDeparture,
          direction: newDirection,
          service_type: newServiceType,
          color: newColor,
          stop_times: newStopTimes,
        },
        {
          headers: getAuthHeaders(),
        }
      );

      if (res.data.success) {
        toast.success(`Train ${newTrainId.toUpperCase()} created successfully! (Saved to JSON)`);
        setTimetable((prev) => [...prev, res.data.train]);
        setShowAddModal(false);
      }
    } catch (err: any) {
      console.error("Failed to add train:", err);
      toast.error(err.response?.data?.error || "Failed to create train");
    } finally {
      setSaving(false);
    }
  };

  const totalTrains = timetable.length;
  const upTrains = timetable.filter((t) => t.direction === "UP").length;
  const downTrains = timetable.filter((t) => t.direction === "DOWN").length;
  const fastTrains = timetable.filter((t) => t.service_type === "fast").length;

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
            <Link
              to="/admin/users"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Users className="w-4 h-4" />
              User Management
            </Link>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-sm">
              <Calendar className="w-4 h-4" />
              Timetable Schedule (Admin)
            </div>
            <Link
              to="/simulation"
              className="ml-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors"
            >
              <Train className="w-3.5 h-3.5" />
              Open Simulator
            </Link>
          </div>

          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-1.5 flex items-center gap-2.5">
                <Clock className="w-8 h-8 text-emerald-500" />
                Timetable Management
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                View, add, and edit train schedules. All changes persist directly to JSON without a database.
              </p>
            </div>

            <div className="flex items-center gap-3 self-start sm:self-auto">
              <button
                onClick={fetchTimetable}
                disabled={loading}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>

              <button
                onClick={handleOpenAddModal}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <Plus className="w-4 h-4" />
                Add New Train
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div
              className={`rounded-2xl p-4 backdrop-blur-md ${
                isDark ? "bg-slate-800/40 border border-slate-700/50" : "bg-white/70 border border-slate-300"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-600/20 rounded-xl flex items-center justify-center">
                  <Train className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalTrains}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Total Trains</p>
                </div>
              </div>
            </div>

            <div
              className={`rounded-2xl p-4 backdrop-blur-md ${
                isDark ? "bg-slate-800/40 border border-slate-700/50" : "bg-white/70 border border-slate-300"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center">
                  <span className="text-xs font-black text-blue-600 dark:text-blue-400">UP</span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{upTrains}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">UP Line (CSMT → Kalyan)</p>
                </div>
              </div>
            </div>

            <div
              className={`rounded-2xl p-4 backdrop-blur-md ${
                isDark ? "bg-slate-800/40 border border-slate-700/50" : "bg-white/70 border border-slate-300"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-600/20 rounded-xl flex items-center justify-center">
                  <span className="text-xs font-black text-amber-600 dark:text-amber-400">DN</span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{downTrains}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">DOWN Line (Kalyan → CSMT)</p>
                </div>
              </div>
            </div>

            <div
              className={`rounded-2xl p-4 backdrop-blur-md ${
                isDark ? "bg-slate-800/40 border border-slate-700/50" : "bg-white/70 border border-slate-300"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-600/20 rounded-xl flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{fastTrains}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Fast / Express</p>
                </div>
              </div>
            </div>
          </div>

          {/* Search & Filters */}
          <div
            className={`p-4 rounded-2xl mb-6 backdrop-blur-md flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between ${
              isDark ? "bg-slate-800/30 border border-slate-700/50" : "bg-white/70 border border-slate-300"
            }`}
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search train ID, station, route..."
                className="w-full pl-10 pr-4 py-2 text-sm bg-transparent border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>

            <div className="flex items-center gap-3">
              {/* Direction Filter */}
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={directionFilter}
                  onChange={(e) => setDirectionFilter(e.target.value as any)}
                  className="px-3 py-2 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="ALL">All Directions</option>
                  <option value="UP">UP Line</option>
                  <option value="DOWN">DOWN Line</option>
                </select>
              </div>

              {/* Service Type Filter */}
              <select
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value as any)}
                className="px-3 py-2 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
              >
                <option value="ALL">All Service Types</option>
                <option value="slow">Slow</option>
                <option value="fast">Fast</option>
              </select>
            </div>
          </div>

          {/* Timetable Table */}
          <div
            className={`rounded-2xl overflow-hidden backdrop-blur-md shadow-sm ${
              isDark ? "bg-slate-800/40 border border-slate-700/50" : "bg-white/80 border border-slate-300"
            }`}
          >
            {loading ? (
              <div className="py-20 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-500" />
                Loading timetable data...
              </div>
            ) : filteredTrains.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-sm">
                No trains match the selected filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr
                      className={`border-b text-xs font-semibold text-slate-500 dark:text-slate-400 ${
                        isDark ? "border-slate-700/60 bg-slate-900/40" : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      <th className="py-3.5 px-4">Train ID</th>
                      <th className="py-3.5 px-4">Direction & Type</th>
                      <th className="py-3.5 px-4">Route</th>
                      <th className="py-3.5 px-4">Departure Time</th>
                      <th className="py-3.5 px-4">Stops</th>
                      <th className="py-3.5 px-4">Journey Window</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/50 dark:divide-slate-700/50">
                    {filteredTrains.map((train) => {
                      const isExpanded = expandedTrainId === train.train_id;
                      const stops = train.stop_times || [];
                      const firstStop = stops[0];
                      const lastStop = stops[stops.length - 1];

                      return (
                        <React.Fragment key={train.train_id}>
                          <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-colors">
                            {/* Train ID */}
                            <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: train.color || (train.direction === "UP" ? "#3b82f6" : "#f59e0b") }}
                              />
                              {train.train_id}
                            </td>

                            {/* Direction & Type */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    train.direction === "UP"
                                      ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                  }`}
                                >
                                  {train.direction || "UP"}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                    train.service_type === "fast"
                                      ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                                      : "bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20"
                                  }`}
                                >
                                  {train.service_type || "slow"}
                                </span>
                              </div>
                            </td>

                            {/* Route */}
                            <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-300">
                              <div className="flex items-center gap-1.5">
                                <span>{train.from}</span>
                                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                                <span>{train.to}</span>
                              </div>
                            </td>

                            {/* Departure Time */}
                            <td className="py-3.5 px-4">
                              <span className="inline-flex items-center gap-1.5 font-mono font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                <Clock className="w-3 h-3" />
                                {train.departure}
                              </span>
                            </td>

                            {/* Stops Count */}
                            <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                              <button
                                onClick={() => setExpandedTrainId(isExpanded ? null : train.train_id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                              >
                                <Layers className="w-3 h-3 text-slate-400" />
                                {stops.length} stops
                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>
                            </td>

                            {/* Journey Window */}
                            <td className="py-3.5 px-4 font-mono text-xs text-slate-500 dark:text-slate-400">
                              {firstStop?.departure || train.departure} → {lastStop?.arrival || "—"}
                            </td>

                            {/* Actions */}
                            <td className="py-3.5 px-4 text-right">
                              <div className="inline-flex items-center gap-2">
                                <button
                                  onClick={() => handleStartEdit(train)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all"
                                  title="Edit Train Schedule"
                                >
                                  <Edit2 className="w-3 h-3" />
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteTrain(train.train_id)}
                                  className="p-1.5 rounded-xl text-xs font-semibold text-rose-500 hover:bg-rose-500/10 transition-colors"
                                  title="Delete Train"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded Stops Timeline Drawer */}
                          {isExpanded && (
                            <tr className={isDark ? "bg-slate-900/30" : "bg-slate-50/70"}>
                              <td colSpan={7} className="p-4">
                                <div className="max-w-4xl mx-auto rounded-xl p-4 border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50">
                                  <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                      <Clock className="w-3.5 h-3.5 text-emerald-500" />
                                      Station Stop Schedule: {train.train_id}
                                    </h4>
                                    <button
                                      onClick={() => handleStartEdit(train)}
                                      className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                      Modify Times
                                    </button>
                                  </div>

                                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                                    {stops.map((stop, idx) => (
                                      <div
                                        key={idx}
                                        className="p-2 rounded-lg bg-slate-100/70 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600/50 text-xs"
                                      >
                                        <div className="font-semibold text-slate-900 dark:text-white truncate mb-1" title={stop.station}>
                                          {idx + 1}. {stop.station}
                                        </div>
                                        <div className="flex justify-between font-mono text-[11px] text-slate-600 dark:text-slate-300">
                                          <span>Arr: {stop.arrival}</span>
                                          <span>Dep: {stop.departure}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>
      </section>

      {/* Add New Train Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border ${
              isDark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Add New Train to Schedule</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Define route, direction, initial departure, and station timings
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTrain} className="flex-1 overflow-y-auto flex flex-col">
              {/* Train Config Section */}
              <div className="p-6 border-b border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-600 dark:text-slate-300">
                    Train ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={newTrainId}
                    onChange={(e) => setNewTrainId(e.target.value.toUpperCase())}
                    placeholder="e.g. UP_SLOW_5"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent font-mono text-sm font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-600 dark:text-slate-300">
                    Direction *
                  </label>
                  <select
                    value={newDirection}
                    onChange={(e) =>
                      handleDirectionOrServiceChange(e.target.value as "UP" | "DOWN", newServiceType)
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="UP">UP Line (CSMT → Kalyan)</option>
                    <option value="DOWN">DOWN Line (Kalyan → CSMT)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-600 dark:text-slate-300">
                    Service Type *
                  </label>
                  <select
                    value={newServiceType}
                    onChange={(e) =>
                      handleDirectionOrServiceChange(newDirection, e.target.value as "slow" | "fast")
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="slow">Slow (All Stations)</option>
                    <option value="fast">Fast (Key Stations)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-600 dark:text-slate-300">
                    Departure Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={newDeparture}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewDeparture(val);
                      handleDirectionOrServiceChange(newDirection, newServiceType, val);
                    }}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent font-mono text-sm font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-600 dark:text-slate-300">
                    Origin Station
                  </label>
                  <input
                    type="text"
                    required
                    value={newFrom}
                    onChange={(e) => setNewFrom(e.target.value.toUpperCase())}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-600 dark:text-slate-300">
                    Destination Station
                  </label>
                  <input
                    type="text"
                    required
                    value={newTo}
                    onChange={(e) => setNewTo(e.target.value.toUpperCase())}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Station Stops Configuration */}
              <div className="p-6 flex-1 overflow-y-auto min-h-[220px]">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-emerald-500" />
                    Generated Stops ({newStopTimes.length} stations)
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      const lastStop = newStopTimes[newStopTimes.length - 1];
                      const newArr = lastStop ? addMinutesToTime(lastStop.departure, 3) : newDeparture;
                      const newDep = addMinutesToTime(newArr, 1);
                      setNewStopTimes((prev) => [
                        ...prev,
                        { station: "NEW_STATION", arrival: newArr, departure: newDep },
                      ]);
                    }}
                    className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Custom Stop
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 px-2 pb-1">
                    <div className="col-span-1">#</div>
                    <div className="col-span-5">Station</div>
                    <div className="col-span-3">Arrival</div>
                    <div className="col-span-2">Departure</div>
                    <div className="col-span-1 text-center">Del</div>
                  </div>

                  {newStopTimes.map((stop, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-2 items-center p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 text-xs"
                    >
                      <div className="col-span-1 font-mono text-slate-400">{idx + 1}</div>
                      <div className="col-span-5">
                        <input
                          type="text"
                          value={stop.station}
                          onChange={(e) => {
                            const val = e.target.value.toUpperCase();
                            setNewStopTimes((prev) => {
                              const updated = [...prev];
                              updated[idx] = { ...updated[idx], station: val };
                              return updated;
                            });
                          }}
                          className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-semibold"
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="time"
                          value={stop.arrival}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewStopTimes((prev) => {
                              const updated = [...prev];
                              updated[idx] = { ...updated[idx], arrival: val };
                              return updated;
                            });
                          }}
                          className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 font-mono text-xs"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="time"
                          value={stop.departure}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewStopTimes((prev) => {
                              const updated = [...prev];
                              updated[idx] = { ...updated[idx], departure: val };
                              return updated;
                            });
                          }}
                          className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 font-mono text-xs"
                        />
                      </div>
                      <div className="col-span-1 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setNewStopTimes((prev) => prev.filter((_, i) => i !== idx));
                          }}
                          className="p-1 rounded text-rose-500 hover:bg-rose-500/10"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Saves to simulator & API timetable JSON
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Creating Train...
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        Create Train
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Edit Timetable Modal */}
      {editingTrain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border ${
              isDark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Edit Train Schedule</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {editingTrain.train_id} ({editingTrain.from} → {editingTrain.to})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingTrain(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Shift Helper Bar */}
            <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <label className="font-semibold text-slate-600 dark:text-slate-300">
                  Initial Departure:
                </label>
                <input
                  type="time"
                  value={editDeparture}
                  onChange={(e) => {
                    const newDep = e.target.value;
                    setEditDeparture(newDep);
                    if (editStopTimes.length > 0) {
                      setEditStopTimes((prev) => {
                        const updated = [...prev];
                        updated[0] = { ...updated[0], departure: newDep };
                        return updated;
                      });
                    }
                  }}
                  className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 font-mono font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 dark:text-slate-400 mr-1">Shift All Stops:</span>
                <button
                  type="button"
                  onClick={() => handleShiftAll(-10)}
                  className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 font-mono font-medium"
                >
                  -10m
                </button>
                <button
                  type="button"
                  onClick={() => handleShiftAll(-5)}
                  className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 font-mono font-medium"
                >
                  -5m
                </button>
                <button
                  type="button"
                  onClick={() => handleShiftAll(5)}
                  className="px-2 py-1 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 font-mono font-medium"
                >
                  +5m
                </button>
                <button
                  type="button"
                  onClick={() => handleShiftAll(10)}
                  className="px-2 py-1 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 font-mono font-medium"
                >
                  +10m
                </button>
              </div>
            </div>

            {/* Scrollable Stop Times Table */}
            <div className="flex-1 overflow-y-auto p-6 min-h-[250px]">
              <div className="space-y-2.5">
                <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 px-2 pb-1">
                  <div className="col-span-1">#</div>
                  <div className="col-span-5">Station</div>
                  <div className="col-span-3">Arrival</div>
                  <div className="col-span-3">Departure</div>
                </div>

                {editStopTimes.map((stop, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2 items-center p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 text-xs"
                  >
                    <div className="col-span-1 font-mono text-slate-400">{idx + 1}</div>
                    <div className="col-span-5 font-semibold text-slate-900 dark:text-white truncate">
                      {stop.station}
                    </div>
                    <div className="col-span-3">
                      <input
                        type="time"
                        value={stop.arrival}
                        onChange={(e) => handleStopTimeChange(idx, "arrival", e.target.value)}
                        className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 font-mono text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div className="col-span-3">
                      <input
                        type="time"
                        value={stop.departure}
                        onChange={(e) => handleStopTimeChange(idx, "departure", e.target.value)}
                        className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 font-mono text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Direct JSON file persistence
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingTrain(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveSchedule}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Saving Changes...
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      Save Schedule
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </LandingLayout>
  );
};

export default AdminTimetable;
