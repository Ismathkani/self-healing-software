import { useState, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie, LineChart, Line, ScatterChart, Scatter } from "recharts";

// ─── DESIGN TOKENS ───────────────────────────────────────────
const C = {
  bg: "bg-[#020617]",
  sidebar: "bg-[#0f172a]/80",
  card: "bg-[#1e293b]/40 backdrop-blur-xl",
  border: "border-[#334155]/50",
  accent: "#38bdf8",
  danger: "#f43f5e",
  warning: "#f59e0b",
  success: "#10b981",
  purple: "#a855f7",
  text: "text-slate-200",
  muted: "text-slate-500"
};

const API_BASE = "http://localhost:3001/api";

// ─── HELPER COMPONENTS ──────────────────────────────────────
const Card = ({ title, children, className = "", icon, subtitle }) => (
  <div className={`${C.card} ${C.border} border rounded-2xl p-6 shadow-2xl relative overflow-hidden group ${className}`}>
    {title && (
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-xs font-black uppercase tracking-[2px] text-slate-400 flex items-center gap-2">
            {icon && <span className="text-sky-400">{icon}</span>}
            {title}
          </h3>
          {subtitle && <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-wider">{subtitle}</p>}
        </div>
      </div>
    )}
    {children}
  </div>
);

const Stat = ({ label, value, unit, color, icon, trend, subValue }) => (
  <Card className="flex flex-col justify-between !p-5">
    <div className="flex justify-between items-start mb-4">
      <div className="w-10 h-10 rounded-xl bg-slate-800/50 flex items-center justify-center text-lg shadow-inner" style={{ color }}>
        {icon}
      </div>
      {trend !== undefined && (
        <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${trend >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
          {trend >= 0 ? '+' : ''}{trend}%
        </span>
      )}
    </div>
    <div>
      <p className="text-[10px] text-slate-500 font-black uppercase tracking-[1.5px] mb-1">{label}</p>
      <div className="flex items-baseline gap-1">
        <h2 className="text-3xl font-black tracking-tighter text-white">{value}</h2>
        <span className="text-xs text-slate-500 font-bold uppercase">{unit}</span>
      </div>
      {subValue && <p className="text-[9px] text-slate-600 font-bold mt-1 uppercase">{subValue}</p>}
    </div>
  </Card>
);

const NavItem = ({ active, label, icon, onClick, count }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center justify-between px-6 py-4 transition-all duration-500 relative group
      ${active ? 'text-white bg-sky-500/10' : 'text-slate-500 hover:text-slate-300'}`}
  >
    <div className="flex items-center gap-4">
      <span className={`text-xl transition-transform duration-500 ${active ? 'scale-110 text-sky-400' : 'group-hover:scale-110'}`}>{icon}</span>
      <span className="text-xs font-black tracking-widest uppercase">{label}</span>
    </div>
    {count && <span className="text-[9px] bg-slate-800 px-2 py-0.5 rounded-full font-bold">{count}</span>}
    {active && <div className="absolute right-0 top-2 bottom-2 w-1 bg-sky-400 rounded-l-full shadow-[0_0_15px_rgba(56,189,248,0.8)]" />}
  </button>
);



// ─── MAIN DASHBOARD ──────────────────────────────────────────
export default function SelfHealDashboard() {
  const [telemetry, setTelemetry] = useState([]);
  const [prediction, setPrediction] = useState({ 
    prob: 0, 
    confidence: 0, 
    type: "NONE", 
    hint: "Monitoring...",
    meshHealth: [],
    systemMetadata: { node_id: "BOOTING...", region: "N/A", cpu_status: "NOMINAL", memory_status: "OPTIMIZED", latency_status: "STABLE" }
  });
  const [errors, setErrors] = useState([]);
  const [patches, setPatches] = useState([]);
  const [activeTab, setActiveTab] = useState("target");
  const [simRunning, setSimRunning] = useState(true);
  const [chaosMode, setChaosMode] = useState(false);
  const [aiServiceHealthy, setAiServiceHealthy] = useState(false);
  const [rca, setRca] = useState({ rootCause: 'none', confidence: 0 });

  useEffect(() => {
    const checkAiHealth = async () => {
      try {
        const res = await fetch('http://localhost:5000/health');
        if (res.ok) setAiServiceHealthy(true);
        else setAiServiceHealthy(false);
      } catch (err) {
        setAiServiceHealthy(false);
      }
    };
    checkAiHealth();

    const fetchChaos = async () => {
      try {
        const res = await fetch(`${API_BASE}/telemetry/chaos`);
        const data = await res.json();
        setChaosMode(data.enabled);
      } catch (err) {}
    };
    fetchChaos();

    const interval = setInterval(checkAiHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!simRunning) return;
    const fetchData = async () => {
      try {
        const [hist, pred, patch, errs, rcaRes] = await Promise.all([
          fetch(`${API_BASE}/telemetry/history?limit=60`).then(r => r.json()),
          fetch(`${API_BASE}/predict/latest`).then(r => r.json()),
          fetch(`${API_BASE}/patches/history`).then(r => r.json()),
          fetch(`${API_BASE}/telemetry/errors?limit=20`).then(r => r.json()),
          fetch(`${API_BASE}/telemetry/rca`).then(r => r.json())
        ]);

        if (hist && hist.samples) {
          // Sort samples by timestamp (chronological) to support both real Mongo and Mock DB
          const sorted = [...hist.samples].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

          setTelemetry(sorted.map(s => ({
            t: new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            cpu: Number(s.cpuPercent || 0),
            mem: parseFloat(s.memory?.heapUsedMB || 0),
            lat: Number(s.latencyMs || 0),
            err: Number(s.errorCount || 0)
          })));
        }

        if (pred) {
          setPrediction({
            prob: Number(pred.failureProbability || 0),
            confidence: Number(pred.confidence || 0),
            type: pred.predictedFailureType || "NONE",
            hint: pred.rootCauseHint || "Monitoring...",
            meshHealth: pred.workflow_metadata?.mesh_health || [],
            systemMetadata: pred.workflow_metadata?.system_metadata || { node_id: "NODE_UNKNOWN", region: "N/A", cpu_status: "NOMINAL", memory_status: "OPTIMIZED", latency_status: "STABLE" }
          });
        }

        setPatches(patch?.patches || []);
        setErrors(errs?.errors || []);
        setRca(rcaRes || { rootCause: 'none', confidence: 0 });
      } catch (err) {
        console.error("Dashboard Sync Error:", err);
      }
    };
    fetchData();
    const iv = setInterval(fetchData, 2000);
    return () => clearInterval(iv);
  }, [simRunning]);

  // Always use the last (newest) sample from our sorted array
  const latest = telemetry[telemetry.length - 1] || { cpu: 0, mem: 0, lat: 0, err: 0 };
  const currentStatus = Number(prediction.prob) > 0.7 ? "CRITICAL" : Number(prediction.prob) > 0.15 ? "AT RISK" : "OPTIMIZED";

  return (
    <div className={`flex min-h-screen ${C.bg} font-['Inter'] selection:bg-sky-500/30 overflow-hidden`}>
      {/* ── SIDEBAR ────────────────────────────────────── */}
      <aside className={`w-80 ${C.sidebar} border-r border-slate-800/50 flex flex-col z-50 backdrop-blur-3xl`}>
        <div className="p-10 flex items-center gap-5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 via-blue-600 to-indigo-700 p-3 shadow-2xl shadow-sky-500/40 transform -rotate-3 hover:rotate-0 transition-transform duration-500">
            <div className="w-full h-full border-2 border-white/50 rounded-lg flex items-center justify-center font-black text-white text-xs">AI</div>
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-white leading-none uppercase">Self Healing Software</h1>
          </div>
        </div>

        <nav className="mt-10 flex-1 space-y-1">
          <NavItem active={activeTab === 'target'} label="WebGuard Demo" icon="🌐" onClick={() => setActiveTab('target')} />
          <NavItem active={activeTab === 'overview'} label="Control Center" icon="⌘" onClick={() => setActiveTab('overview')} />
          <NavItem active={activeTab === 'telemetry'} label="Telemetry Labs" icon="⚡" onClick={() => setActiveTab('telemetry')} count={telemetry.length} />
          <NavItem active={activeTab === 'remediation'} label="Auto-Healing" icon="🩹" onClick={() => setActiveTab('remediation')} count={patches.length} />
        </nav>

        <div className="p-10 space-y-4">
          <div className={`p-5 rounded-2xl ${C.card} border-slate-700/50 shadow-inner`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-2.5 h-2.5 rounded-full ${simRunning ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-rose-500'}`} />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Core Engine</span>
            </div>
            <button
              onClick={() => setSimRunning(!simRunning)}
              className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300
                  ${simRunning ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20' :
                  'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20'}`}
            >
              {simRunning ? 'Kill Daemon' : 'Wake Engine'}
            </button>
            <button
              onClick={async () => {
                const next = !chaosMode;
                setChaosMode(next);
                await fetch(`${API_BASE}/telemetry/chaos`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ enabled: next })
                });
              }}
              className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 mt-2
                  ${chaosMode ? 'bg-sky-500/20 text-sky-400 border border-sky-400/40' :
                  'bg-slate-800/40 text-slate-500 border border-slate-700'}`}
            >
              {chaosMode ? 'Chaos: ACTIVE' : 'Enable Chaos'}
            </button>
          </div>
          <div className={`p-5 rounded-2xl ${C.card} border-slate-700/50 shadow-inner`}>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${aiServiceHealthy ? 'bg-sky-500 shadow-[0_0_10px_#0ea5e9]' : 'bg-rose-500'} animate-pulse`} />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AI Intelligence</span>
                </div>
                <button 
                  className="text-[9px] font-black text-sky-400 uppercase hover:underline"
                  onClick={() => {
                    setAiServiceHealthy(false);
                  }}
                >
                  Retry
                </button>
              </div>
              {!aiServiceHealthy && (
                <p className="text-[9px] text-rose-400 font-bold uppercase tracking-tight">
                  Status: Unreachable (ERR_CONN_REFUSED or CORS)
                </p>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto relative px-16 py-12 scroll-smooth">
        <div className="max-w-7xl mx-auto">
          {/* Global Header */}
          <header className="flex justify-between items-end mb-12">
            <div>
              <div className="flex items-center gap-4 mb-3">
                <span className="bg-slate-800 text-slate-400 text-[10px] font-black tracking-[2px] px-3 py-1 rounded-md border border-slate-700">{prediction.systemMetadata.node_id}</span>
                <span className={`text-[10px] font-black tracking-[2px] px-3 py-1 rounded-md border
                  ${currentStatus === 'OPTIMIZED' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                    currentStatus === 'AT RISK' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                      'bg-rose-500/10 text-rose-500 border-rose-500/20 animate-pulse'}`}>
                  {currentStatus}
                </span>
              </div>
              <h1 className="text-5xl font-black text-white tracking-tighter italic">Nerve Center</h1>
              <p className="text-slate-500 mt-4 font-bold text-sm uppercase tracking-wide">Real-time predictive infrastructure monitoring</p>
            </div>
            <div className="flex gap-4">
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Global Health</p>
                <p className="text-2xl font-black text-white tracking-tighter">{(100 - (prediction.prob * 80)).toFixed(1)}%</p>
              </div>
            </div>
          </header>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-4 gap-6 mb-10">
            <Stat label="CPU Instructions" value={latest.cpu} unit="%" color={C.accent} icon="◈" trend={+2} subValue={`Status: ${prediction.systemMetadata.cpu_status}`} />
            <Stat label="Heap Allocation" value={latest.mem} unit="MB" color={C.purple} icon="⚙" trend={-1} subValue={`GC: ${prediction.systemMetadata.memory_status}`} />
            <Stat label="Network Latency" value={latest.lat?.toFixed(2)} unit="ms" color={C.warning} icon="⏱" trend={latest.lat > 500 ? +45 : -5} subValue={`Region: ${prediction.systemMetadata.region}`} />
            <Stat label="Neural Drift" value={(prediction.prob * 100).toFixed(0)} unit="%" color={C.danger} icon="▲" trend={0} subValue={`Status: ${prediction.type}`} />
          </div>

          {/* Conditional Tab Rendering */}
          {activeTab === 'overview' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-700">
              <div className="grid grid-cols-12 gap-8">
                <div className="col-span-8 space-y-8">
                  <Card title="Signal Intelligence" subtitle="Live CPU vs Cluster Average" icon="📊">
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={telemetry}>
                          <defs>
                            <linearGradient id="primaryGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={C.accent} stopOpacity={0.3} />
                              <stop offset="95%" stopColor={C.accent} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                          <XAxis dataKey="t" tick={{ fontSize: 9, fill: '#64748b', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 9, fill: '#64748b', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                          <Tooltip
                            contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '15px', color: '#f8fafc', fontWeight: '800' }}
                          />
                          <Area type="monotone" dataKey="cpu" stroke={C.accent} fill="url(#primaryGrad)" strokeWidth={4} activeDot={{ r: 6, strokeWidth: 0 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  <div className="grid grid-cols-2 gap-8">
                    <Card title="Remediation History" icon="🩹">
                      <div className="space-y-4">
                        {patches.slice(0, 3).map((p, i) => (
                          <div key={i} className="flex justify-between items-center p-4 rounded-2xl bg-slate-800/30 border border-slate-700/30 group hover:border-sky-500/30 transition-all duration-300">
                            <div className="flex items-center gap-4">
                              <div className="bg-sky-500/10 p-2 rounded-lg text-sky-400 font-black text-[10px] uppercase">R-{p.patchId.slice(-3)}</div>
                              <div>
                                <p className="text-[10px] font-black text-white uppercase tracking-wider">{p.targetModule}</p>
                                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{p.strategy}</p>
                              </div>
                            </div>
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                          </div>
                        ))}
                        {patches.length === 0 && <p className="text-center text-slate-600 py-10 font-black text-xs uppercase tracking-widest">No Active Remedies</p>}
                      </div>
                    </Card>
                    <Card title="Diagnostic Stream" icon="📋">
                      <div className="h-44 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                        {errors.map((e, i) => (
                          <div key={i} className="text-[10px] border-l-2 border-slate-800 pl-3 py-1">
                            <span className={e.level === 'ERROR' ? 'text-rose-500 font-black' : e.level === 'INFO' ? 'text-emerald-500 font-black' : 'text-amber-500 font-black'}>[{e.level}]</span>
                            <span className="text-slate-400 ml-2 font-bold">{e.message}</span>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </div>
                </div>

                <div className="col-span-4 space-y-8">
                  {rca.rootCause !== 'none' && rca.rootCause !== 'unknown' && (
                    <Card title="Causal Root Cause" icon="🧠" subtitle="Targeted AI Extraction" className="border-rose-500/50 bg-rose-500/5">
                      <div className="flex flex-col items-center py-4">
                        <div className="w-16 h-16 rounded-full bg-rose-500/20 flex items-center justify-center text-3xl mb-4 animate-pulse">💥</div>
                        <h2 className="text-xl font-black text-rose-500 uppercase tracking-tighter">{rca.rootCause}</h2>
                        <p className="text-[10px] text-slate-500 font-bold mt-2 uppercase">Confidence: {(rca.confidence * 100).toFixed(0)}%</p>
                        <div className="mt-4 px-4 py-2 bg-rose-500 text-white text-[9px] font-black rounded-md uppercase tracking-widest">Resolving...</div>
                      </div>
                    </Card>
                  )}

                  <Card title="Signal Entropy" subtitle="Chaos Predictive Index" icon="▲">
                    <div className="relative h-64 flex flex-col items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[{ value: prediction.prob * 100 }, { value: 100 - (prediction.prob * 100) }]}
                            innerRadius={70} outerRadius={90} startAngle={90} endAngle={450} paddingAngle={0} dataKey="value"
                          >
                            <Cell fill={prediction.prob > 0.6 ? C.danger : C.accent} strokeWidth={0} />
                            <Cell fill="#1e293b" strokeWidth={0} />
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-5xl font-black text-white tracking-tighter">{(prediction.prob * 100).toFixed(0)}</span>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2 px-3 py-1 bg-slate-800 rounded-full border border-slate-700">INDEX SCORE</span>
                      </div>
                    </div>
                  </Card>

                  <Card title="Service Mesh Health" icon="🌐">
                    <div className="space-y-5 py-2">
                      {(prediction.meshHealth.length > 0 ? prediction.meshHealth : [
                        { name: 'GATEWAY', health: 100 },
                        { name: 'AUTH_SRV', health: 100 },
                        { name: 'DB_CLUSTER', health: 100 },
                        { name: 'CACHING', health: 100 }
                      ]).map((s, i) => (
                        <div key={s.name} className="space-y-2">
                          <div className="flex justify-between text-[9px] font-black tracking-widest text-slate-500 uppercase">
                            <span>{s.name}</span>
                            <span className={s.health > 90 ? "text-emerald-500" : s.health > 70 ? "text-amber-500" : "text-rose-500"}>
                              {s.health > 90 ? "OPTIMAL" : s.health > 70 ? "DEGRADED" : "CRITICAL"}
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800/50 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-1000 ${s.health > 90 ? "bg-emerald-500" : s.health > 70 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${s.health}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'telemetry' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-5 duration-700">
              <div className="grid grid-cols-2 gap-8">
                <Card title="Latency Dispersion" subtitle="P99 Network Response Map" icon="⚡">
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={telemetry}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                        <XAxis dataKey="t" hide />
                        <YAxis tick={{ fontSize: 9, fill: '#64748b', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '10px' }} />
                        <Line type="step" dataKey="lat" stroke={C.warning} strokeWidth={3} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
                <Card title="Traffic Error Density" subtitle="Failed vs Successful Requests" icon="☄">
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={telemetry.map(t => ({ ...t, v: t.err > 0 ? 1 : (t.lat > 400 ? 0.4 : 0.05) }))} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                        <XAxis dataKey="t" hide />
                        <Tooltip 
                          contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }}
                          cursor={{ fill: 'rgba(56, 189, 248, 0.05)' }} 
                        />
                        <Bar dataKey="v" radius={[4, 4, 0, 0]}>
                          {telemetry.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={entry.err > 0 ? C.danger : (entry.lat > 400 ? C.warning : 'rgba(16, 185, 129, 0.2)')} 
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>
              <Card title="Full Spectrum History" subtitle="Synchronized Log Analysis">
                <div className="h-64 overflow-x-auto space-y-4 pr-2 custom-scrollbar">
                  {telemetry.slice().reverse().map((t, i) => (
                    <div key={i} className="flex gap-10 py-3 border-b border-slate-800/50 text-[10px] font-bold group hover:bg-white/5 px-4 rounded-xl transition-colors">
                      <span className="text-sky-400 font-black tabular-nums transition-transform group-hover:scale-105">{t.t}</span>
                      <span className="w-24 uppercase tracking-widest text-slate-500">CPU: <span className="text-white">{t.cpu}%</span></span>
                      <span className="w-24 uppercase tracking-widest text-slate-500">MEM: <span className="text-white">{t.mem}MB</span></span>
                      <span className="w-24 uppercase tracking-widest text-slate-500">LAT: <span className={t.lat > 400 ? 'text-rose-500' : 'text-emerald-500'}>{t.lat}ms</span></span>
                      <span className="flex-1 uppercase tracking-widest text-slate-500 text-right">STATUS: <span className={(t.err > 0 || t.lat > 400 || t.cpu > 85) ? 'text-rose-500' : 'text-emerald-500'}>{(t.err > 0 || t.lat > 400 || t.cpu > 85) ? 'WARNING' : 'HEALTHY'}</span></span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'remediation' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-5 duration-700">
              <div className="grid grid-cols-12 gap-8">
                <div className="col-span-4 gap-8 flex flex-col">
                  <Card title="Auto-Healing Status" icon="🧬">
                    <div className="flex flex-col items-center py-6 text-center">
                      <div className="w-24 h-24 rounded-full border-4 border-emerald-500/20 flex items-center justify-center mb-6 relative">
                        <div className="absolute inset-0 border-4 border-emerald-500 rounded-full border-t-transparent animate-spin duration-[3s]" />
                        <span className="text-2xl font-black text-emerald-500">AI</span>
                      </div>
                      <h4 className="text-white font-black uppercase tracking-widest text-xs mb-2">Agent Running</h4>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider line-clamp-2">AutonomousHot-patching active for 4 core modules.</p>
                    </div>
                  </Card>
                  <Card title="Safety Thresholds" icon="⚙">
                    <div className="space-y-5">
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                        <span className="text-slate-500">Min Confidence</span>
                        <span className="text-white">75%</span>
                      </div>
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                        <span className="text-slate-500">Rollback Velocity</span>
                        <span className="text-emerald-500">INSTANT</span>
                      </div>
                    </div>
                  </Card>
                </div>
                <div className="col-span-8">
                  <Card
                    title="Remediation Ledger"
                    subtitle="Immutable patching history log"
                    action={
                      <button
                        onClick={async () => {
                          if (window.confirm('Clear all remediation history?')) {
                            await fetch(`${API_BASE}/patches/clear`, { method: 'POST' });
                            setPatches([]);
                          }
                        }}
                        className="text-[9px] font-black text-rose-500/60 uppercase hover:text-rose-500 transition-colors"
                      >
                        Clear History
                      </button>
                    }
                  >
                    <div className="space-y-4">
                      {patches.map((p, i) => (
                        <div key={i} className="bg-slate-800/20 border border-slate-700/50 p-6 rounded-2xl flex justify-between items-start group hover:border-sky-500/40 transition-all duration-500">
                          <div className="space-y-4">
                            <div className="flex gap-4 items-center">
                              <div className="bg-sky-500 shadow-[0_0_15px_rgba(56,189,248,0.4)] text-white px-3 py-1 rounded-md text-[10px] font-black tracking-[2px]">{p.patchId}</div>
                              <h5 className="text-white font-black uppercase tracking-widest text-xs">{p.targetModule}</h5>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Strategy Applied: <span className="text-white">{p.strategy}</span></p>
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{p.failureType} Mitigation at {new Date(p.timestamp).toLocaleTimeString()}</p>
                            </div>
                          </div>
                          <div className="text-right flex flex-col items-end gap-3">
                            <div className="px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-full text-[9px] font-black tracking-widest border border-emerald-500/20 uppercase">Status: LIVE</div>
                            <div className="text-[10px] font-black text-slate-500 uppercase">CONFIDENCE: <span className="text-white italic">{(p.confidence * 100).toFixed(0)}%</span></div>
                          </div>
                        </div>
                      ))}
                      {patches.length === 0 && <p className="text-center py-20 text-slate-500 font-black uppercase tracking-[3px] opacity-30">Ledgy Empty</p>}
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'target' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-5 duration-700">
              <div className="grid grid-cols-12 gap-8">
                <div className="col-span-12">
                  <Card
                    title="Live Target WebGuard System"
                    subtitle="Autonomous Hot-Patching & Fault Injection Console"
                    icon="🌐"
                    action={
                      <a
                        href="http://localhost:4000"
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2 bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 text-[10px] font-black rounded-xl border border-sky-500/40 uppercase tracking-widest transition-all"
                      >
                        ↗ Open Target Site (Port 4000)
                      </a>
                    }
                  >
                    <div className="space-y-6">
                      <div className="grid grid-cols-3 gap-4">
                        <button
                          onClick={() => fetch(`${API_BASE}/telemetry/inject`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ type: 'LATENCY_DEGRADATION' }) })}
                          className="p-4 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                        >
                          <span>🐢</span> Inject Latency Spike
                        </button>
                        <button
                          onClick={() => fetch(`${API_BASE}/telemetry/inject`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ type: 'MEMORY_LEAK' }) })}
                          className="p-4 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-xl text-purple-400 text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                        >
                          <span>💧</span> Inject Memory Leak
                        </button>
                        <button
                          onClick={() => fetch(`${API_BASE}/telemetry/inject`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ type: 'CPU_SPIKE' }) })}
                          className="p-4 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl text-amber-400 text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                        >
                          <span>🔥</span> Inject CPU Saturation
                        </button>
                      </div>

                      <div className="w-full h-[650px] rounded-xl overflow-hidden border border-slate-700/50 shadow-2xl bg-slate-900 relative">
                        <iframe
                          src="http://localhost:4000"
                          title="Live WebGuard Target Site"
                          className="w-full h-full border-0"
                          allow="geolocation; microphone; camera; midi; encrypted-media;"
                        />
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Backdrop Static Noise */}
        <div className="fixed inset-0 pointer-events-none opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] z-0" />
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        .selection\:bg-sky-500\/30 *::selection { background-color: rgba(14, 165, 233, 0.3); }
      `}</style>
    </div>
  );
}

