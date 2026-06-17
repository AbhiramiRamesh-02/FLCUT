
"use client";

import { useState, useEffect } from "react";


interface LinkItem {
  id: string;
  url: string;
  shortCode: string;
  alias: string | null;
  createdAt: string;
  goLiveAt: string | null;
  expiresAt: string | null;
  clickLimit: number | null;
  clickCount: number;
}

interface AnalyticsData {
  link: {
    id: string;
    url: string;
    shortCode: string;
    alias: string | null;
    createdAt: string;
    goLiveAt: string | null;
    expiresAt: string | null;
    clickLimit: number | null;
  };
  stats: {
    totalClicks: number;
    uniqueClicks: number;
    botClicks: number;
    referrers: { name: string; count: number }[];
    devices: { name: string; count: number }[];
    locations: { name: string; count: number }[];
    timeSeries: { time: string; clicks: number; uniqueClicks: number }[];
  };
}

function formatDateTime(dateString: string | null): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const formattedHours = String(hours).padStart(2, "0");

  return `${day}-${month}-${year} ${formattedHours}:${minutes} ${ampm}`;
}

const copyToClipboard = async (text: string): Promise<boolean> => {
  if (typeof window === "undefined") return false;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn("Secure clipboard write failed, using fallback:", err);
    }
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "0";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const successful = document.execCommand("copy");
    document.body.removeChild(textarea);
    return successful;
  } catch (err) {
    console.error("Clipboard fallback failed:", err);
    return false;
  }
};

export default function Home() {
  const [passcode, setPasscode] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [authError, setAuthError] = useState("");

  // Dashboard state
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [selectedLink, setSelectedLink] = useState<LinkItem | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Link form state
  const [formUrl, setFormUrl] = useState("");
  const [formAlias, setFormAlias] = useState("");
  const [goLiveDate, setGoLiveDate] = useState("");
  const [goLiveHour, setGoLiveHour] = useState("12");
  const [goLiveMinute, setGoLiveMinute] = useState("00");
  const [goLiveAmpm, setGoLiveAmpm] = useState("AM");

  const [expiresDate, setExpiresDate] = useState("");
  const [expiresHour, setExpiresHour] = useState("12");
  const [expiresMinute, setExpiresMinute] = useState("00");
  const [expiresAmpm, setExpiresAmpm] = useState("AM");
  const [formLimit, setFormLimit] = useState("");
  
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hostUrl, setHostUrl] = useState("");
  const [currentTime, setCurrentTime] = useState("");

  // Share Modal State
  const [showShareModal, setShowShareModal] = useState(false);
  const [createdLinkForModal, setCreatedLinkForModal] = useState<LinkItem | null>(null);
  const [activeTemplateTab, setActiveTemplateTab] = useState("registration");
  const [templateCopySuccess, setTemplateCopySuccess] = useState(false);

  // Check auth on mount and run clock
  useEffect(() => {
    if (typeof window !== "undefined") {
      setHostUrl(window.location.host);
      setShowAuthGate(true);
    }
    const updateTime = () => {
      const now = new Date();
      const day = String(now.getDate()).padStart(2, "0");
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const month = months[now.getMonth()];
      const year = now.getFullYear();
      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const seconds = String(now.getSeconds()).padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      hours = hours ? hours : 12;
      const formattedHours = String(hours).padStart(2, "0");
      setCurrentTime(`${day}-${month}-${year} ${formattedHours}:${minutes}:${seconds} ${ampm}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Poll analytics for selected link
  useEffect(() => {
    if (selectedLink && isAuthenticated) {
      fetchAnalytics(selectedLink.shortCode);
      const interval = setInterval(() => {
        fetchAnalytics(selectedLink.shortCode);
      }, 5000); // refresh every 5s for real-time feel
      return () => clearInterval(interval);
    }
  }, [selectedLink, isAuthenticated]);

  const verifyAndLoad = async (codeToTry: string) => {
    setLoadingLinks(true);
    try {
      const res = await fetch("/api/links", {
        headers: {
          "x-flcut-passcode": codeToTry,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setLinks(data);
        setIsAuthenticated(true);
        setShowAuthGate(false);
        setPasscode(codeToTry);
      } else {
        let errorMessage = "Invalid FLC passcode. Try again.";
        try {
          const errData = await res.json();
          if (errData && errData.error) {
            errorMessage = errData.error;
          }
        } catch {
          // If response is not JSON
          if (res.status === 500) {
            errorMessage = "Internal Server Error (500). Did you run 'npx prisma db push'? Check your terminal logs.";
          } else {
            errorMessage = `Request failed with status ${res.status}`;
          }
        }
        setAuthError(errorMessage);
        setShowAuthGate(true);
      }
    } catch (err) {
      setAuthError("Connection error. Could not connect to API server.");
      setShowAuthGate(true);
    } finally {
      setLoadingLinks(false);
    }
  };

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) {
      setAuthError("Passcode is required.");
      return;
    }
    verifyAndLoad(passcode.trim());
  };

  const fetchLinks = async () => {
    try {
      const res = await fetch("/api/links", {
        headers: { "x-flcut-passcode": passcode },
      });
      if (res.ok) {
        const data = await res.json();
        setLinks(data);
      }
    } catch (err) {
      console.error("Failed to load links", err);
    }
  };

  const fetchAnalytics = async (code: string) => {
    setLoadingAnalytics(true);
    try {
      const res = await fetch(`/api/analytics/${code}`, {
        headers: { "x-flcut-passcode": passcode },
      });
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
        // Sync click count in the left list
        setLinks((prevLinks) =>
          prevLinks.map((l) =>
            l.shortCode === code
              ? { ...l, clickCount: data.stats.totalClicks }
              : l
          )
        );
      }
    } catch (err) {
      console.error("Failed to load analytics", err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");
    setIsSubmitting(true);

    if (!formUrl) {
      setFormError("Destination URL is required.");
      setIsSubmitting(false);
      return;
    }

    const getCombinedDateTime = (date: string, hour: string, minute: string, ampm: string) => {
      if (!date) return null;
      let h = parseInt(hour, 10);
      if (ampm === "PM" && h < 12) h += 12;
      if (ampm === "AM" && h === 12) h = 0;
      const formattedHour = String(h).padStart(2, "0");
      return `${date}T${formattedHour}:${minute}:00`;
    };

    const goLiveCombined = getCombinedDateTime(goLiveDate, goLiveHour, goLiveMinute, goLiveAmpm);
    const expiresCombined = getCombinedDateTime(expiresDate, expiresHour, expiresMinute, expiresAmpm);

    try {
      const res = await fetch("/api/links", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-flcut-passcode": passcode,
        },
        body: JSON.stringify({
          url: formUrl,
          alias: formAlias || null,
          goLiveAt: goLiveCombined,
          expiresAt: expiresCombined,
          clickLimit: formLimit || null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setCreatedLinkForModal(data);
        setShowShareModal(true);
        setFormUrl("");
        setFormAlias("");
        setGoLiveDate("");
        setGoLiveHour("12");
        setGoLiveMinute("00");
        setGoLiveAmpm("AM");
        setExpiresDate("");
        setExpiresHour("12");
        setExpiresMinute("00");
        setExpiresAmpm("AM");
        setFormLimit("");
        fetchLinks();
        // Automatically select the newly created link
        setSelectedLink(data);
      } else {
        setFormError(data.error || "Failed to create short link.");
      }
    } catch (err) {
      setFormError("Something went wrong. Please check connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    setShowAuthGate(true);
    setLinks([]);
    setSelectedLink(null);
    setAnalytics(null);
    setPasscode("");
  };

  const handleDeleteLink = async (id: string, code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete the short link /${code}? This will permanently delete all its analytics.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/links?id=${id}`, {
        method: "DELETE",
        headers: {
          "x-flcut-passcode": passcode,
        },
      });

      if (res.ok) {
        if (selectedLink?.id === id) {
          setSelectedLink(null);
          setAnalytics(null);
        }
        fetchLinks();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete link.");
      }
    } catch (err) {
      alert("Failed to delete link. Check your connection.");
    }
  };

  // Filter links by search query
  const filteredLinks = links.filter((link) => {
    const search = searchQuery.toLowerCase();
    return (
      link.url.toLowerCase().includes(search) ||
      link.shortCode.toLowerCase().includes(search) ||
      (link.alias && link.alias.toLowerCase().includes(search))
    );
  });

  const getLinkStatus = (link: LinkItem) => {
    const now = new Date();
    if (link.expiresAt && now > new Date(link.expiresAt)) {
      return { label: "[SHUTDOWN]", color: "text-rose-600 font-mono" };
    }
    if (link.goLiveAt && now < new Date(link.goLiveAt)) {
      return { label: "[PENDING]", color: "text-emerald-600/70 font-mono" };
    }
    if (link.clickLimit && link.clickCount >= link.clickLimit) {
      return { label: "[CAP_MAX]", color: "text-yellow-600 font-mono animate-pulse" };
    }
    return { label: "[ACTIVE]", color: "text-emerald-400 font-mono font-bold" };
  };

  // Custom SVG Chart Generator
  const renderSVGChart = (timeSeries: { time: string; clicks: number; uniqueClicks: number }[]) => {
    if (!timeSeries || timeSeries.length === 0) {
      return (
        <div className="h-48 flex items-center justify-center text-emerald-950/60 text-xs font-mono">
          NO CLICK TRAFFIC RECORDED YET.
        </div>
      );
    }

    const height = 180;
    const width = 500;
    const padding = 25;

    const maxClicks = Math.max(...timeSeries.map((d) => d.clicks), 1);

    const points = timeSeries.map((d, index) => {
      const x = padding + (index / (timeSeries.length - 1 || 1)) * (width - padding * 2);
      const y = height - padding - (d.clicks / maxClicks) * (height - padding * 2);
      return { x, y, ...d };
    });

    const uniquePoints = timeSeries.map((d, index) => {
      const x = padding + (index / (timeSeries.length - 1 || 1)) * (width - padding * 2);
      const y = height - padding - (d.uniqueClicks / maxClicks) * (height - padding * 2);
      return { x, y };
    });

    const pathD = points.reduce((acc, p, i) => `${acc} ${i === 0 ? "M" : "L"} ${p.x} ${p.y}`, "");
    const areaD = timeSeries.length > 0 ? `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z` : "";

    const uniqPathD = uniquePoints.reduce((acc, p, i) => `${acc} ${i === 0 ? "M" : "L"} ${p.x} ${p.y}`, "");

    return (
      <div className="relative w-full">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
          <defs>
            <linearGradient id="chartGlow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#11201a" strokeDasharray="3 3" />
          <line x1={padding} y1={(height - padding * 2) / 2 + padding} x2={width - padding} y2={(height - padding * 2) / 2 + padding} stroke="#11201a" strokeDasharray="3 3" />
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#183027" />

          {/* Area under curve */}
          {areaD && <path d={areaD} fill="url(#chartGlow)" />}

          {/* Main click lines */}
          {pathD && <path d={pathD} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />}
          {uniqPathD && <path d={uniqPathD} fill="none" stroke="#6ee7b7" strokeWidth="1.2" strokeDasharray="4 2" strokeLinecap="round" />}

          {/* Data points */}
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="3" className="fill-emerald-500 stroke-[#050807] stroke-2 hover:fill-emerald-300 transition-all cursor-pointer" />
              {/* Tooltip on hover */}
              <title>{`${p.time}\nClicks: ${p.clicks}\nUnique: ${p.uniqueClicks}`}</title>
            </g>
          ))}
        </svg>
        <div className="flex justify-between text-[9px] text-emerald-800/80 mt-1.5 px-6 font-mono uppercase tracking-widest">
          <span>{timeSeries[0]?.time.split(" ")[0] || ""}</span>
          <span>Timeline (Grouped Hourly)</span>
          <span>{timeSeries[timeSeries.length - 1]?.time.split(" ")[0] || ""}</span>
        </div>
      </div>
    );
  };

  // Full Auth screen
  if (showAuthGate) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#050807] px-6 relative overflow-hidden font-mono">
        {/* Glow Effects */}
        <div className="absolute w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[160px] -top-60 -left-20 pointer-events-none"></div>
        <div className="absolute w-[600px] h-[600px] bg-teal-500/3 rounded-full blur-[160px] -bottom-60 -right-20 pointer-events-none"></div>

        <div className="z-10 w-full max-w-lg bg-[#0a0f0d]/80 backdrop-blur-2xl border border-emerald-950/40 rounded-3xl p-8 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] relative">
          
          {/* Terminal Top Bar */}
          <div className="flex items-center justify-between border-b border-emerald-950/40 pb-4 mb-6">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/30"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/20 border border-yellow-500/30"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/40 border border-emerald-500/60 shadow-[0_0_8px_rgba(16,185,129,0.3)] animate-pulse"></span>
            </div>
            <span className="text-[10px] text-emerald-800 uppercase tracking-widest">FLCUT-GATE v2.4.0</span>
          </div>

          <div className="mb-8 font-sans">
            <div className="text-[10px] font-mono text-emerald-600/70 mb-2 uppercase tracking-widest font-bold">
              [ Secure Link Access Terminal ]
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-emerald-100 font-mono">
              FLCut Gateway
            </h1>
            
            {/* Monospace Diagnostics */}
            <div className="mt-4 p-3 bg-black/40 border border-emerald-950/20 rounded-xl font-mono text-[10px] text-emerald-500/80 space-y-1">
              <div>HOST: {hostUrl && !hostUrl.includes("localhost") && !hostUrl.includes("127.0.0.1") ? hostUrl : "flcut-console.finiteloop.club"}</div>
              <div>SECURITY: HIGH</div>
              <div className="flex items-center gap-1.5">
                STATUS: <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981] animate-ping"></span> ONLINE
              </div>
            </div>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-emerald-600 uppercase tracking-widest font-mono">
                Security Passcode
              </label>
              
              <div className="flex items-center gap-2 font-mono text-sm bg-black/40 border border-emerald-950/45 focus-within:border-emerald-500/40 focus-within:ring-2 focus-within:ring-emerald-500/5 rounded-xl px-4 py-3.5 transition-all">
                <span className="text-emerald-500/60 select-none">passcode@flcut:~$</span>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  className="flex-1 bg-transparent border-none outline-none text-emerald-400 placeholder:text-emerald-950/40 font-mono tracking-widest"
                  autoFocus
                />
              </div>

              {authError && (
                <p className="text-rose-400 text-[10px] mt-3 flex items-center justify-center gap-1.5 font-medium border border-rose-500/10 bg-rose-500/5 py-2.5 rounded-xl">
                  ERR: {authError}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loadingLinks}
              className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-[#070a09] font-bold rounded-xl transition-all shadow-md shadow-emerald-500/5 active:translate-y-0.5 cursor-pointer text-xs tracking-wider uppercase font-mono border border-emerald-400/20"
            >
              {loadingLinks ? "VALIDATING KEY..." : "EXECUTE ACCESS"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#050807] text-[#e2e8f0]">
      {/* Header */}
      <header className="border-b border-emerald-950/40 bg-[#0a0f0d]/70 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-emerald-500 flex items-center justify-center font-bold text-[#070a09] text-sm shadow-[0_0_12px_rgba(16,185,129,0.2)] border border-emerald-400/25 font-mono">
            FL
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-emerald-100 font-sans">
              FLCut Console <span className="text-[9px] text-emerald-400 font-bold tracking-widest px-2.5 py-0.5 border border-emerald-500/25 rounded-lg ml-2 font-mono bg-emerald-500/5">SYS:SECURE</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="hidden sm:inline text-[11px] text-emerald-600/90 font-mono tracking-widest mr-2">
            {currentTime || "00-Jun-2026 00:00:00 AM"}
          </span>
          <span className="text-xs text-emerald-500 bg-emerald-950/20 border border-emerald-950/40 px-3.5 py-1.5 rounded-xl font-mono flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            {links.length} Active Codes
          </span>
          <button
            onClick={logout}
            className="text-xs text-emerald-600 hover:text-emerald-300 px-3.5 py-1.5 hover:bg-emerald-950/30 border border-transparent hover:border-emerald-950/60 rounded-xl transition-all cursor-pointer font-mono"
          >
            Lock Console
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 max-w-7xl w-full mx-auto">
        {/* Left column: Generator & List */}
        <div className="lg:col-span-5 flex flex-col gap-6 h-full">
          {/* Section: Shortener Form */}
          <div className="bg-[#0a0f0d]/50 border border-emerald-950/45 rounded-3xl p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden font-mono">
            <h2 className="text-sm font-bold text-emerald-400 mb-6 flex items-center gap-2 uppercase tracking-wider">
              [ Create Short Link ]
            </h2>

            <form onSubmit={handleCreateLink} className="space-y-5">
              <div>
                <label className="block text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-2">
                  01 / Destination URL
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://finiteloop.club/register/hackfest"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  className="w-full px-4 py-3 bg-black/30 border border-emerald-950/50 focus:border-emerald-500/40 rounded-xl text-xs outline-none text-emerald-100 placeholder:text-emerald-950/40 transition-all focus:ring-4 focus:ring-emerald-500/5 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-2">
                    02 / Slug (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="hackfest26"
                    value={formAlias}
                    onChange={(e) => setFormAlias(e.target.value)}
                    className="w-full px-4 py-3 bg-black/30 border border-emerald-950/50 focus:border-emerald-500/40 rounded-xl text-xs outline-none text-emerald-100 placeholder:text-emerald-950/40 transition-all focus:ring-4 focus:ring-emerald-500/5 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-2">
                    03 / Click Cap (Opt)
                  </label>
                  <input
                    type="number"
                    placeholder="100"
                    value={formLimit}
                    onChange={(e) => setFormLimit(e.target.value)}
                    className="w-full px-4 py-3 bg-black/30 border border-emerald-950/50 focus:border-emerald-500/40 rounded-xl text-xs outline-none text-emerald-100 placeholder:text-emerald-950/40 transition-all focus:ring-4 focus:ring-emerald-500/5 font-mono"
                  />
                </div>
              </div>

              {/* Advanced Scheduling */}
              <div className="border-t border-emerald-950/30 pt-4 mt-2">
                <p className="text-[10px] font-bold text-emerald-500/90 mb-3 uppercase tracking-widest">[ 04 / Advanced Schedule ]</p>
                <div className="grid grid-cols-2 gap-4">
                  {/* Go-Live picker */}
                  <div className="space-y-2">
                    <label className="block text-[8px] font-bold text-emerald-700 uppercase tracking-widest">
                      Go-Live Date
                    </label>
                    <div className="space-y-1.5">
                      <input
                        type="date"
                        value={goLiveDate}
                        onChange={(e) => setGoLiveDate(e.target.value)}
                        className="w-full px-3 py-2 bg-black/30 border border-emerald-950/50 focus:border-emerald-500/40 rounded-xl text-[10px] outline-none text-emerald-300 font-mono"
                      />
                      <div className="flex items-center gap-1">
                        <select
                          value={goLiveHour}
                          onChange={(e) => setGoLiveHour(e.target.value)}
                          className="flex-1 px-1.5 py-1.5 bg-black/45 border border-emerald-950/60 rounded-xl text-[10px] text-emerald-300 outline-none focus:border-emerald-500/40 font-mono"
                        >
                          {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((h) => (
                            <option key={h} className="bg-[#0a0f0d]" value={h}>{h}</option>
                          ))}
                        </select>
                        <span className="text-emerald-900">:</span>
                        <select
                          value={goLiveMinute}
                          onChange={(e) => setGoLiveMinute(e.target.value)}
                          className="flex-1 px-1.5 py-1.5 bg-black/45 border border-emerald-950/60 rounded-xl text-[10px] text-emerald-300 outline-none focus:border-emerald-500/40 font-mono"
                        >
                          {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")).map((m) => (
                            <option key={m} className="bg-[#0a0f0d]" value={m}>{m}</option>
                          ))}
                        </select>
                        <select
                          value={goLiveAmpm}
                          onChange={(e) => setGoLiveAmpm(e.target.value)}
                          className="px-1 py-1.5 bg-black/45 border border-emerald-950/60 rounded-xl text-[10px] text-emerald-300 outline-none focus:border-emerald-500/40 font-bold font-mono"
                        >
                          <option className="bg-[#0a0f0d]" value="AM">AM</option>
                          <option className="bg-[#0a0f0d]" value="PM">PM</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Expiration picker */}
                  <div className="space-y-2">
                    <label className="block text-[8px] font-bold text-emerald-700 uppercase tracking-widest">
                      Expiration Date
                    </label>
                    <div className="space-y-1.5">
                      <input
                        type="date"
                        value={expiresDate}
                        onChange={(e) => setExpiresDate(e.target.value)}
                        className="w-full px-3 py-2 bg-black/30 border border-emerald-950/50 focus:border-emerald-500/40 rounded-xl text-[10px] outline-none text-emerald-300 font-mono"
                      />
                      <div className="flex items-center gap-1">
                        <select
                          value={expiresHour}
                          onChange={(e) => setExpiresHour(e.target.value)}
                          className="flex-1 px-1.5 py-1.5 bg-black/45 border border-emerald-950/60 rounded-xl text-[10px] text-emerald-300 outline-none focus:border-emerald-500/40 font-mono"
                        >
                          {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((h) => (
                            <option key={h} className="bg-[#0a0f0d]" value={h}>{h}</option>
                          ))}
                        </select>
                        <span className="text-emerald-900">:</span>
                        <select
                          value={expiresMinute}
                          onChange={(e) => setExpiresMinute(e.target.value)}
                          className="flex-1 px-1.5 py-1.5 bg-black/45 border border-emerald-950/60 rounded-xl text-[10px] text-emerald-300 outline-none focus:border-emerald-500/40 font-mono"
                        >
                          {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")).map((m) => (
                            <option key={m} className="bg-[#0a0f0d]" value={m}>{m}</option>
                          ))}
                        </select>
                        <select
                          value={expiresAmpm}
                          onChange={(e) => setExpiresAmpm(e.target.value)}
                          className="px-1 py-1.5 bg-black/45 border border-emerald-950/60 rounded-xl text-[10px] text-emerald-300 outline-none focus:border-emerald-500/40 font-bold font-mono"
                        >
                          <option className="bg-[#0a0f0d]" value="AM">AM</option>
                          <option className="bg-[#0a0f0d]" value="PM">PM</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {formError && (
                <p className="text-rose-400 text-[10px] font-medium bg-rose-500/5 border border-rose-500/10 px-3.5 py-2.5 rounded-xl text-center font-mono">
                  ERR: {formError}
                </p>
              )}

              {formSuccess && (
                <p className="text-emerald-400 text-[10px] font-medium bg-emerald-500/5 border border-emerald-500/10 px-3.5 py-2.5 rounded-xl text-center font-mono">
                  SUCCESS: {formSuccess}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-[#070a09] font-bold rounded-xl text-xs uppercase tracking-widest shadow-md shadow-emerald-500/5 transition-all active:translate-y-0.5 cursor-pointer border border-emerald-400/20 font-mono"
              >
                {isSubmitting ? "GENERATING..." : "BUILD SMART LINK"}
              </button>
            </form>
          </div>

          {/* Section: List of Links */}
          <div className="flex-1 bg-[#0a0f0d]/50 border border-emerald-950/45 rounded-3xl p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col min-h-[350px] font-mono">
            <div className="flex items-center justify-between mb-6 gap-2">
              <h2 className="text-sm font-bold text-emerald-400 uppercase tracking-wider">[ Shortcut Catalog ]</h2>
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3 py-1.5 bg-black/30 border border-emerald-950/60 focus:border-emerald-500/40 rounded-lg text-xs outline-none w-36 transition-all text-emerald-100 placeholder:text-emerald-950/40"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 max-h-[400px] pr-1 scrollbar-thin">
              {filteredLinks.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-emerald-900/60 py-12 text-center">
                  <p className="text-xs">No matching shortcuts found.</p>
                </div>
              ) : (
                filteredLinks.map((link) => {
                  const status = getLinkStatus(link);
                  const isSelected = selectedLink?.id === link.id;

                  return (
                    <div
                      key={link.id}
                      onClick={() => setSelectedLink(link)}
                      className={`p-4 border rounded-2xl cursor-pointer transition-all flex flex-col gap-2 ${
                        isSelected
                          ? "bg-emerald-500/5 border-emerald-500/40 shadow-sm shadow-emerald-500/5"
                          : "bg-black/20 border-emerald-950/30 hover:border-emerald-500/20 hover:bg-black/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold text-emerald-100 text-xs flex items-center gap-1.5">
                          /{link.shortCode}
                          {link.alias && (
                            <span className="text-[8px] text-emerald-400/70 font-normal bg-emerald-950/50 border border-emerald-900/20 px-1.5 py-0.5 rounded uppercase tracking-wider">
                              alias
                            </span>
                          )}
                        </span>
                        <span className={`text-[9px] ${status.color}`}>
                          {status.label}
                        </span>
                      </div>

                      <p className="text-[10px] text-emerald-700/80 truncate font-mono">{link.url}</p>

                      <div className="flex items-center justify-between text-[10px] text-emerald-600/90 mt-1.5">
                        <span className="flex items-center gap-1 font-medium font-mono">
                          <strong className="text-emerald-300 font-bold">{link.clickCount}</strong> clicks
                        </span>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(`http://${hostUrl}/${link.shortCode}`);
                              alert("Link copied to clipboard!");
                            }}
                            className="hover:text-emerald-300 flex items-center gap-1 font-bold cursor-pointer transition-all text-[9px] uppercase tracking-wider"
                          >
                            Copy
                          </button>
                          <button
                            onClick={(e) => handleDeleteLink(link.id, link.shortCode, e)}
                            className="hover:text-rose-500 text-emerald-800 flex items-center gap-1 font-bold cursor-pointer transition-all text-[9px] uppercase tracking-wider"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
        {/* Right column: Analytics Panel */}
        <div className="lg:col-span-7 bg-[#0a0f0d]/50 border border-emerald-950/45 rounded-3xl p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col h-full min-h-[500px] font-mono">
          {!selectedLink ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-emerald-900/50 my-auto relative">
              {/* Technical background decoration */}
              <div className="absolute top-4 left-4 text-[8px] text-emerald-950 font-mono tracking-widest select-none">
                [ viewport: 0x7b // secure_session ]
              </div>
              <div className="absolute bottom-4 right-4 text-[8px] text-emerald-950 font-mono tracking-widest select-none">
                [ system_v: 2.4.0 ]
              </div>
              
              <div className="w-14 h-14 rounded-2xl bg-black/30 border border-emerald-950/80 flex items-center justify-center text-emerald-500/80 text-sm mb-6 font-bold shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                FL
              </div>
              <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-2">
                // Click Analytics Viewer
              </h3>
              <p className="text-[10px] text-emerald-800 max-w-xs leading-relaxed uppercase tracking-wider">
                Select an active shortcut from the catalog index to inspect live click metrics, bot filtering, and announcement templates.
              </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-6">
              {/* Analytics Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-emerald-950/30 pb-5">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-bold text-emerald-150 uppercase tracking-wider">
                      Stats for <span className="text-emerald-400">/{selectedLink.shortCode}</span>
                    </h3>
                    <a
                      href={`/${selectedLink.shortCode}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[9px] text-emerald-400 hover:text-emerald-300 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/25 cursor-pointer uppercase tracking-wider"
                    >
                      Test Link ↗
                    </a>
                  </div>
                  <p className="text-[10px] text-emerald-700/80 truncate max-w-md">
                    Destination: {selectedLink.url}
                  </p>
                </div>

                <div className="text-right space-y-1 text-[9px] text-emerald-700 font-bold uppercase tracking-widest">
                  <div>
                    <span className="text-emerald-900 mr-2">Created</span>
                    <span className="text-emerald-400">
                      {new Date(selectedLink.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  {selectedLink.goLiveAt && (
                    <div>
                      <span className="text-emerald-900 mr-2">Go-Live</span>
                      <span className="text-yellow-600">
                        {formatDateTime(selectedLink.goLiveAt)}
                      </span>
                    </div>
                  )}
                  {selectedLink.expiresAt && (
                    <div>
                      <span className="text-emerald-900 mr-2">Expires</span>
                      <span className="text-rose-600">
                        {formatDateTime(selectedLink.expiresAt)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {loadingAnalytics && !analytics ? (
                <div className="flex-1 flex items-center justify-center text-emerald-400 my-auto">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400"></div>
                </div>
              ) : analytics ? (
                <div className="space-y-6 flex-1 overflow-y-auto max-h-[800px] pr-1 scrollbar-thin">
                  {/* Cards Row */}
                  <div className="grid grid-cols-3 bg-black/30 border border-emerald-950/40 rounded-2xl overflow-hidden divide-x divide-emerald-950/45 font-mono">
                    <div className="p-4">
                      <p className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest mb-1">
                        01 / TOTAL
                      </p>
                      <h4 className="text-2xl font-extrabold text-emerald-400">
                        {analytics.stats.totalClicks}
                      </h4>
                      <p className="text-[8px] text-emerald-900 mt-1 uppercase font-bold">Verified human</p>
                    </div>

                    <div className="p-4">
                      <p className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest mb-1">
                        02 / UNIQUE
                      </p>
                      <h4 className="text-2xl font-extrabold text-emerald-300">
                        {analytics.stats.uniqueClicks}
                      </h4>
                      <p className="text-[8px] text-emerald-900 mt-1 uppercase font-bold">
                        {analytics.stats.totalClicks > 0
                          ? `${Math.round((analytics.stats.uniqueClicks / analytics.stats.totalClicks) * 100)}%`
                          : "0%"} unique
                      </p>
                    </div>

                    <div className="p-4">
                      <p className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest mb-1">
                        03 / BOTS
                      </p>
                      <h4 className="text-2xl font-extrabold text-emerald-600">
                        {analytics.stats.botClicks}
                      </h4>
                      <p className="text-[8px] text-emerald-900 mt-1 uppercase font-bold">Scrapers & Bots</p>
                    </div>
                  </div>

                  {/* Share & QR Code Panel */}
                  <div className="bg-black/20 border border-emerald-950/45 p-5 rounded-2xl grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
                    {/* QR Code Container */}
                    <div className="sm:col-span-4 flex flex-col items-center gap-1 sm:border-r sm:border-emerald-950/45 pr-4 relative">
                      <div className="bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-900/20 shadow-inner">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(`http://${hostUrl}/${analytics.link.shortCode}`)}`}
                          alt="Link QR Code"
                          className="w-24 h-24 invert opacity-90"
                        />
                      </div>
                      <button
                        onClick={() => {
                          window.open(`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(`http://${hostUrl}/${analytics.link.shortCode}`)}`, "_blank");
                        }}
                        className="text-[8px] text-emerald-500 hover:text-emerald-300 font-bold mt-1 cursor-pointer uppercase tracking-wider"
                      >
                        [ Download QR ]
                      </button>
                    </div>

                    {/* Sharing links */}
                    <div className="sm:col-span-8 space-y-3">
                      <h4 className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest">
                        // Quick Sharing Options
                      </h4>
                      <div className="flex gap-2">
                        {/* Copy Link */}
                        <button
                          onClick={() => {
                            copyToClipboard(`http://${hostUrl}/${analytics.link.shortCode}`);
                            alert("Link copied!");
                          }}
                          className="flex-1 py-2.5 bg-emerald-950/20 hover:bg-emerald-900/35 border border-emerald-900/40 text-emerald-400 hover:text-emerald-350 font-bold rounded-xl text-[9px] uppercase tracking-wider transition-all cursor-pointer text-center font-mono"
                        >
                          Copy Link
                        </button>

                        {/* WhatsApp */}
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(`http://${hostUrl}/${analytics.link.shortCode}?src=whatsapp`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 py-2.5 bg-emerald-950/20 hover:bg-emerald-900/35 border border-emerald-900/40 text-emerald-400 hover:text-emerald-350 font-bold rounded-xl text-[9px] uppercase tracking-wider transition-all cursor-pointer text-center font-mono"
                        >
                          WhatsApp
                        </a>

                        {/* Instagram Story */}
                        <button
                          onClick={() => {
                            copyToClipboard(`http://${hostUrl}/${analytics.link.shortCode}?src=instagram`);
                            alert("Link copied!\n\nTo share on Instagram:\n1. Open Instagram Story\n2. Add a 'Link' Sticker\n3. Paste the URL you just copied");
                          }}
                          className="flex-1 py-2.5 bg-emerald-950/20 hover:bg-emerald-900/35 border border-emerald-900/40 text-emerald-400 hover:text-emerald-350 font-bold rounded-xl text-[9px] uppercase tracking-wider transition-all cursor-pointer text-center font-mono"
                        >
                          Insta Story
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Poster Announcement Generator Section */}
                  <div className="bg-black/20 border border-emerald-950/45 p-5 rounded-2xl">
                    <h4 className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-3">
                      // Announcement Copy Templates
                    </h4>

                    {/* Tabs */}
                    <div className="flex gap-1.5 border-b border-emerald-950/30 mb-4 overflow-x-auto pb-1.5 scrollbar-thin">
                      {[
                        { id: "registration", label: "Register" },
                        { id: "resources", label: "Resources" },
                        { id: "feedback", label: "Feedback" },
                        { id: "discord", label: "Invite" },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => {
                            setActiveTemplateTab(tab.id);
                            setTemplateCopySuccess(false);
                          }}
                          className={`text-[9px] font-bold px-3 py-1.5 rounded-lg border whitespace-nowrap transition-all cursor-pointer uppercase tracking-wider ${
                            activeTemplateTab === tab.id
                              ? "bg-emerald-900/35 text-emerald-300 border-emerald-500/35 shadow-[0_0_8px_rgba(16,185,129,0.1)]"
                              : "bg-transparent border-transparent text-emerald-800 hover:text-emerald-600"
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {/* Live Preview Screen */}
                    <div className="bg-black/40 border border-emerald-950/30 rounded-2xl p-4 mb-4 relative">
                      <div className="absolute top-2.5 right-2.5 text-[8px] bg-black/60 border border-emerald-950/40 px-2 py-0.5 rounded text-emerald-600/70 font-bold uppercase tracking-wider">
                        CONSOLE_OUTPUT
                      </div>
                      <pre className="text-xs font-mono text-emerald-300 whitespace-pre-wrap break-words leading-relaxed select-text font-normal pr-12">
                        {(() => {
                          const shortUrlString = `http://${hostUrl}/${analytics.link.shortCode}`;
                          switch (activeTemplateTab) {
                            case "registration":
                              return `🚀 FLC Hackathon 2026 is now open!\nRegister here 👇\n${shortUrlString}\n\n⚡ Limited seats available – don’t miss out!`;
                            case "resources":
                              return `📂 FLC has shared event resources for you\nAccess here 👇\n${shortUrlString}\n\n📌 Includes slides, problem statement & guidelines`;
                            case "feedback":
                              return `📝 We value your feedback on FLC Event!\nSubmit here 👇\n${shortUrlString}\n\n💡 It takes less than 2 minutes`;
                            case "discord":
                              return `💬 Join the official FLC Discord community!\nJoin here 👇\n${shortUrlString}\n\n🔥 Connect with peers & stay updated on events`;
                            default:
                              return "";
                          }
                        })()}
                      </pre>
                    </div>

                    {/* Copy Template Button */}
                    <button
                      onClick={() => {
                        const shortUrlString = `http://${hostUrl}/${analytics.link.shortCode}`;
                        let activeText = "";
                        switch (activeTemplateTab) {
                          case "registration":
                            activeText = `🚀 FLC Hackathon 2026 is now open!\nRegister here 👇\n${shortUrlString}\n\n⚡ Limited seats available – don’t miss out!`;
                            break;
                          case "resources":
                            activeText = `📂 FLC has shared event resources for you\nAccess here 👇\n${shortUrlString}\n\n📌 Includes slides, problem statement & guidelines`;
                            break;
                          case "feedback":
                            activeText = `📝 We value your feedback on FLC Event!\nSubmit here 👇\n${shortUrlString}\n\n💡 It takes less than 2 minutes`;
                            break;
                          case "discord":
                            activeText = `💬 Join the official FLC Discord community!\nJoin here 👇\n${shortUrlString}\n\n🔥 Connect with peers & stay updated on events`;
                            break;
                        }
                        copyToClipboard(activeText);
                        setTemplateCopySuccess(true);
                        setTimeout(() => setTemplateCopySuccess(false), 2000);
                      }}
                      className={`w-full py-3 font-bold rounded-xl text-xs transition-all active:translate-y-0.5 flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-widest ${
                        templateCopySuccess
                          ? "bg-emerald-600 text-[#070a09] shadow-md shadow-emerald-500/5"
                          : "bg-emerald-500 hover:bg-emerald-400 text-[#070a09] shadow-md shadow-emerald-500/5 border border-emerald-450/20"
                      }`}
                    >
                      {templateCopySuccess ? "COPIED TO CLIPBOARD" : "COPY POSTER TEXT"}
                    </button>
                  </div>

                  {/* Chart Section */}
                  <div className="bg-black/20 border border-emerald-950/45 p-5 rounded-2xl">
                    <h4 className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest mb-4 flex items-center justify-between">
                      <span>// Click Spikes Over Time</span>
                      <span className="text-[8px] text-emerald-500 font-bold normal-case">5s Real-time poll</span>
                    </h4>
                    {renderSVGChart(analytics.stats.timeSeries)}
                  </div>

                  {/* Referrers & Devices grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Referrers */}
                    <div className="bg-black/20 border border-emerald-950/45 p-4 rounded-2xl">
                      <h4 className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest mb-3">
                        // Traffic Referrers
                      </h4>
                      <div className="space-y-2.5 max-h-[180px] overflow-y-auto pr-1 scrollbar-thin">
                        {analytics.stats.referrers.length === 0 ? (
                          <p className="text-[10px] text-emerald-900/60 font-mono">No referrer logs found.</p>
                        ) : (
                          analytics.stats.referrers.map((ref, idx) => (
                            <div key={idx} className="flex items-center justify-between text-[11px] font-mono">
                              <span className="text-emerald-300 truncate max-w-[150px]">{ref.name}</span>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-emerald-400">{ref.count}</span>
                                <span className="text-emerald-900 text-[9px]">
                                  ({Math.round((ref.count / analytics.stats.totalClicks) * 100)}%)
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Devices */}
                    <div className="bg-black/20 border border-emerald-950/45 p-4 rounded-2xl">
                      <h4 className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest mb-3">
                        // Device Analytics
                      </h4>
                      <div className="space-y-3 font-mono">
                        {analytics.stats.devices.length === 0 ? (
                          <p className="text-[10px] text-emerald-900/60 font-mono">No device logs found.</p>
                        ) : (
                          analytics.stats.devices.map((dev, idx) => {
                            const pct = Math.round((dev.count / analytics.stats.totalClicks) * 100);
                            return (
                              <div key={idx} className="space-y-1">
                                <div className="flex items-center justify-between text-[10px]">
                                  <span className="text-emerald-300">{dev.name}</span>
                                  <span className="font-bold text-emerald-400">{pct}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-black/45 rounded-full overflow-hidden border border-emerald-950/30">
                                  <div
                                    className={`h-full rounded-full ${
                                      dev.name === "Mobile"
                                        ? "bg-emerald-500 shadow-[0_0_8px_#10b981]"
                                        : dev.name === "Tablet"
                                        ? "bg-emerald-400"
                                        : "bg-emerald-750"
                                    }`}
                                    style={{ width: `${pct}%` }}
                                  ></div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Geolocation breakdown */}
                  <div className="bg-black/20 border border-emerald-950/45 p-4 rounded-2xl">
                    <h4 className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest mb-3">
                      // Geography metrics
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 font-mono">
                      {analytics.stats.locations.length === 0 ? (
                        <p className="text-[10px] text-emerald-900/60 col-span-2">No location logs found.</p>
                      ) : (
                        analytics.stats.locations.map((loc, idx) => (
                          <div key={idx} className="flex items-center justify-between text-[11px] border-b border-emerald-950/20 pb-1.5">
                            <span className="text-emerald-350 truncate max-w-[150px]">{loc.name}</span>
                            <span className="font-bold text-emerald-400">{loc.count} clicks</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-rose-400 my-auto text-xs uppercase tracking-widest">
                  ERR: Metrics offline.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {/* Share Modal */}
      {showShareModal && createdLinkForModal && (() => {
        const shortUrlString = `http://${hostUrl}/${createdLinkForModal.shortCode}`;
        
        // Helper to get formatted text for each announcement template type
        const getAnnouncementText = (type: string) => {
          switch (type) {
            case "registration":
              return `🚀 FLC Hackathon 2026 is now open!\nRegister here 👇\n${shortUrlString}\n\n⚡ Limited seats available – don’t miss out!`;
            case "resources":
              return `📂 FLC has shared event resources for you\nAccess here 👇\n${shortUrlString}\n\n📌 Includes slides, problem statement & guidelines`;
            case "feedback":
              return `📝 We value your feedback on FLC Event!\nSubmit here 👇\n${shortUrlString}\n\n💡 It takes less than 2 minutes`;
            case "discord":
              return `💬 Join the official FLC Discord community!\nJoin here 👇\n${shortUrlString}\n\n🔥 Connect with peers & stay updated on events`;
            default:
              return "";
          }
        };

        const activeText = getAnnouncementText(activeTemplateTab);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#050807]/90 backdrop-blur-md overflow-y-auto font-mono">
            <div className="w-full max-w-lg bg-[#0a0f0d]/95 border border-emerald-950/50 rounded-3xl p-6 shadow-[0_25px_60px_rgba(0,0,0,0.8)] animate-in fade-in zoom-in-95 duration-200 my-8">
              {/* Header */}
              <div className="flex justify-between items-center mb-6 border-b border-emerald-950/30 pb-4">
                <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
                  [ // Link Generated Successfully ]
                </h3>
                <button
                  onClick={() => {
                    setShowShareModal(false);
                    setCreatedLinkForModal(null);
                    setTemplateCopySuccess(false);
                  }}
                  className="text-emerald-700 hover:text-emerald-400 text-xs font-bold p-1 hover:bg-emerald-950/30 rounded-lg transition-all"
                >
                  [ CLOSE ]
                </button>
              </div>

              {/* Grid for QR Code and Copy Link */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 mb-5 items-center">
                {/* QR Code */}
                <div className="sm:col-span-4 flex flex-col items-center gap-1">
                  <div className="bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-900/20 shadow-inner">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(shortUrlString)}`}
                      alt="QR Code"
                      className="w-24 h-24 invert opacity-90"
                    />
                  </div>
                  <button
                    onClick={() => {
                      window.open(`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(shortUrlString)}`, "_blank");
                    }}
                    className="text-[8px] text-emerald-500 hover:text-emerald-300 font-bold mt-1 uppercase tracking-wider"
                  >
                    [ Download QR ]
                  </button>
                </div>

                {/* Quick Copy & Standard Social Buttons */}
                <div className="sm:col-span-8 space-y-3">
                  {/* Link field */}
                  <div className="w-full bg-black/35 border border-emerald-950/50 rounded-xl p-2.5 flex items-center justify-between gap-3">
                    <span className="text-xs font-mono text-emerald-300 truncate max-w-[190px]">
                      {shortUrlString}
                    </span>
                    <button
                      onClick={() => {
                        copyToClipboard(shortUrlString);
                        alert("Shortlink copied!");
                      }}
                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-[#070a09] font-bold text-[9px] uppercase tracking-widest font-mono rounded-lg transition-all cursor-pointer"
                    >
                      Copy Link
                    </button>
                  </div>

                  {/* Standard Share Buttons */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* WhatsApp */}
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(`Register for our event here: ${shortUrlString}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center justify-center py-2 bg-emerald-950/20 hover:bg-emerald-900/35 border border-emerald-900/40 text-emerald-400 font-bold rounded-xl text-[9px] uppercase tracking-wider transition-all cursor-pointer font-mono"
                    >
                      WhatsApp
                    </a>

                    {/* Instagram Story Instruction */}
                    <button
                      onClick={() => {
                        copyToClipboard(shortUrlString);
                        alert("Shortlink copied!\n\nTo share on Instagram:\n1. Open Instagram Story\n2. Add a 'Link' Sticker\n3. Paste the URL you just copied");
                      }}
                      className="flex flex-col items-center justify-center py-2 bg-emerald-950/20 hover:bg-emerald-900/35 border border-emerald-900/40 text-emerald-400 font-bold rounded-xl text-[9px] uppercase tracking-wider transition-all cursor-pointer font-mono"
                    >
                      Insta Story
                    </button>
                  </div>
                </div>
              </div>

              {/* Poster Announcement Generator Section */}
              <div className="border-t border-emerald-950/30 pt-4 mt-2">
                <h4 className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest mb-3">
                  // Announcement Copy Templates
                </h4>

                {/* Tabs */}
                <div className="flex gap-1.5 border-b border-emerald-950/30 mb-4 overflow-x-auto pb-1.5 scrollbar-thin">
                  {[
                    { id: "registration", label: "Register" },
                    { id: "resources", label: "Resources" },
                    { id: "feedback", label: "Feedback" },
                    { id: "discord", label: "Invite" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTemplateTab(tab.id);
                        setTemplateCopySuccess(false);
                      }}
                      className={`text-[9px] font-bold px-3 py-1.5 rounded-lg border whitespace-nowrap transition-all uppercase tracking-wider ${
                        activeTemplateTab === tab.id
                          ? "bg-emerald-900/35 text-emerald-300 border-emerald-500/35 shadow-[0_0_8px_rgba(16,185,129,0.1)]"
                          : "bg-transparent border-transparent text-emerald-800 hover:text-emerald-600"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Live Preview Screen */}
                <div className="bg-black/40 border border-emerald-950/30 rounded-2xl p-4 mb-4 relative">
                  <div className="absolute top-2.5 right-2.5 text-[8px] bg-black/60 border border-emerald-950/40 px-2 py-0.5 rounded text-emerald-600/70 font-bold uppercase tracking-wider">
                    CONSOLE_OUTPUT
                  </div>
                  <pre className="text-xs font-mono text-emerald-300 whitespace-pre-wrap break-words leading-relaxed select-text font-normal pr-12">
                    {activeText}
                  </pre>
                </div>

                {/* Copy Template Button */}
                <button
                  onClick={() => {
                    copyToClipboard(activeText);
                    setTemplateCopySuccess(true);
                    setTimeout(() => setTemplateCopySuccess(false), 2000);
                  }}
                  className={`w-full py-3 font-bold rounded-xl text-xs uppercase tracking-widest transition-all font-mono shadow-md ${
                    templateCopySuccess
                      ? "bg-emerald-600 text-[#070a09] shadow-md shadow-emerald-500/5"
                      : "bg-emerald-500 hover:bg-emerald-400 text-[#070a09] shadow-md shadow-emerald-500/5 border border-emerald-450/20"
                  }`}
                >
                  {templateCopySuccess ? "COPIED TO CLIPBOARD" : "COPY POSTER TEXT"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}