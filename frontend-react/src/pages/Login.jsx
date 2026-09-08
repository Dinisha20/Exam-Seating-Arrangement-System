import React, { useState } from 'react';

const ROLES = [
  {
    id: 'admin',
    name: 'COE Administrator',
    email: 'coe.admin@university.edu',
    roleLabel: 'Full System Access',
    badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  },
  {
    id: 'exam_cell',
    name: 'Exam Cell Officer',
    email: 'examcell@university.edu',
    roleLabel: 'Hall & Session Manager',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  },
  {
    id: 'invigilator',
    name: 'Hall Invigilator',
    email: 'invigilator@university.edu',
    roleLabel: 'Seat Map & Lookup Access',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  },
];

const FEATURES = [
  {
    icon: (
      <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: 'Google OR-Tools CP-SAT Solver',
    description: 'Mathematically guarantees zero same-paper conflicts and global feasibility, outperforming heuristic greedy models.',
    tag: 'Formal CSP Solver',
  },
  {
    icon: (
      <svg className="w-5 h-5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
    title: 'Cross-Department Paper Mapping',
    description: 'Decouples distinct course codes (e.g. CSE-301 & IT-305) to unified paper_id identities for anti-cheating separation.',
    tag: 'Normalization',
  },
  {
    icon: (
      <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
    title: '2D Spatial Adjacency Control',
    description: 'Models room topology as graph G=(V,E) enforcing same-bench, horizontal row, and vertical front/back spacing.',
    tag: 'Physical Topology',
  },
  {
    icon: (
      <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    title: 'COE Excel Hall Plan Integration',
    description: 'Parses institutional multi-sheet workbooks, extracting complex register number ranges automatically in seconds.',
    tag: 'Auto-Parsing',
  },
  {
    icon: (
      <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    title: 'Resource Optimization & Compaction',
    description: 'Packs students into minimal required halls, freeing unused exam rooms to save invigilation and operational costs.',
    tag: 'Cost Reduction',
  },
  {
    icon: (
      <svg className="w-5 h-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: 'Benchmark & Evaluation Suite',
    description: 'Built-in synthetic dataset generator and comparative benchmarking proving superiority over heuristic baselines.',
    tag: 'Reproducible Science',
  },
];

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('coe.admin@university.edu');
  const [password, setPassword] = useState('••••••••••••');
  const [selectedRole, setSelectedRole] = useState(ROLES[0]);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const selectRole = (role) => {
    setSelectedRole(role);
    setEmail(role.email);
    setPassword('admin@12345');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      onLogin({
        name: selectedRole.name,
        email: email || selectedRole.email,
        role: selectedRole.roleLabel,
      });
      setLoading(false);
    }, 600);
  };

  const handleGuestLogin = () => {
    setLoading(true);
    setTimeout(() => {
      onLogin({
        name: 'COE Administrator',
        email: 'coe.admin@university.edu',
        role: 'Full System Access',
      });
      setLoading(false);
    }, 400);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between overflow-x-hidden selection:bg-indigo-500 selection:text-white">
      {/* Background Decorative Gradient Orbs & Grid */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-teal-600/15 rounded-full blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      {/* Top Navigation Bar */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-600 to-teal-400 p-[1px] shadow-lg shadow-indigo-500/20">
            <div className="w-full h-full bg-slate-900 rounded-[11px] flex items-center justify-center font-black text-sm text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-teal-300">
              ES
            </div>
          </div>
          <div>
            <div className="font-bold text-base tracking-tight text-white flex items-center gap-2">
              Exam Seating Arrangement
              <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Phase 1 v1.0
              </span>
            </div>
            <div className="text-xs text-slate-400">Controller of Examinations (COE) Autonomous Portal</div>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-3 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            CP-SAT Solver Ready
          </span>
          <button
            onClick={handleGuestLogin}
            className="text-xs font-semibold px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 transition backdrop-blur-md"
          >
            Quick Guest Access →
          </button>
        </div>
      </header>

      {/* Main Content Area: Split Showcase & Login */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 lg:py-10 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center flex-1">
        {/* Left Side: Product Showcase & Novelty Explanation (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium w-fit">
            <span className="flex h-2 w-2 rounded-full bg-indigo-400" />
            Autonomous Anti-Cheating & Constraint Satisfaction System
          </div>

          <div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Intelligent, Seat-Level{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-teal-300">
                Exam Allocation
              </span>
            </h1>
            <p className="mt-3 text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
              Eliminate examination seating conflicts with formal constraint programming. Automatically normalizes
              multi-department course codes, enforces 2D physical bench adjacency rules, and compacts hall occupancy to
              save university resources.
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-3 gap-3 py-2">
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 backdrop-blur-sm">
              <div className="text-xl sm:text-2xl font-black text-indigo-400">100%</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Constraint Conflict-Free Guarantee</div>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 backdrop-blur-sm">
              <div className="text-xl sm:text-2xl font-black text-teal-400">&lt; 1.5s</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Average Solve Time (500+ students)</div>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 backdrop-blur-sm">
              <div className="text-xl sm:text-2xl font-black text-purple-400">M : 1</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Cross-Dept Paper Normalization</div>
            </div>
          </div>

          {/* Core Feature Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
            {FEATURES.map((feat, idx) => (
              <div
                key={idx}
                className="group p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-indigo-500/40 hover:bg-slate-900/90 transition duration-200 backdrop-blur-sm"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="p-2 rounded-lg bg-slate-800/80 group-hover:scale-110 transition duration-200">
                    {feat.icon}
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    {feat.tag}
                  </span>
                </div>
                <div className="font-semibold text-xs text-white group-hover:text-indigo-300 transition">
                  {feat.title}
                </div>
                <div className="text-[11px] text-slate-400 mt-1 leading-normal line-clamp-2">
                  {feat.description}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side: Creative Floating Login Card (5 cols) */}
        <div className="lg:col-span-5 w-full max-w-md mx-auto">
          <div className="relative rounded-2xl bg-gradient-to-b from-slate-900/95 to-slate-900/90 border border-slate-700/60 shadow-2xl shadow-indigo-950/60 p-6 sm:p-8 backdrop-blur-xl">
            {/* Subtle glow highlight */}
            <div className="absolute -top-px left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-indigo-400 to-transparent" />

            <div className="mb-6">
              <h2 className="text-xl font-bold text-white tracking-tight">Portal Authentication</h2>
              <p className="text-xs text-slate-400 mt-1">
                Select a demonstration role or enter institutional credentials to access the seating engine.
              </p>
            </div>

            {/* Role Quick Selector */}
            <div className="mb-5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2 block">
                Quick Demo Role Presets
              </label>
              <div className="flex flex-col gap-1.5">
                {ROLES.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => selectRole(role)}
                    className={`flex items-center justify-between p-2.5 rounded-lg text-left text-xs transition border ${
                      selectedRole.id === role.id
                        ? 'bg-indigo-950/70 border-indigo-500/60 text-white shadow-sm'
                        : 'bg-slate-800/40 border-slate-700/50 text-slate-300 hover:bg-slate-800/80'
                    }`}
                  >
                    <div>
                      <div className="font-medium">{role.name}</div>
                      <div className="text-[10px] text-slate-400">{role.email}</div>
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${role.badgeColor}`}>
                      {role.roleLabel}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Institutional Email / Username
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950/70 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                    placeholder="user@university.edu"
                  />
                  <div className="absolute right-3 top-3 text-slate-500 pointer-events-none">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">Password</label>
                  <button
                    type="button"
                    onClick={() => setPassword('admin@12345')}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 transition"
                  >
                    Use default demo pass
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950/70 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition pr-10"
                    placeholder="••••••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 transition"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                  />
                  Remember active session
                </label>
                <span className="text-slate-500 text-[11px]">256-bit Encrypted</span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 rounded-lg font-bold text-sm bg-gradient-to-r from-indigo-500 via-purple-600 to-indigo-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-600/30 transition duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Authenticating Session...
                  </>
                ) : (
                  <>
                    Sign In to Seating Engine
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span>Status: <b className="text-emerald-400">Online</b> (PostgreSQL + CP-SAT)</span>
              <button
                type="button"
                onClick={handleGuestLogin}
                className="text-indigo-400 hover:underline font-medium"
              >
                Direct Demo Bypass
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer info */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 py-4 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
        <div>
          Autonomous Examination Seating System &copy; {new Date().getFullYear()} — Built for COE Operations &amp; Academic Benchmarking
        </div>
        <div className="flex items-center gap-4 text-slate-400">
          <span>Google OR-Tools 9.11</span>
          <span>&bull;</span>
          <span>FastAPI 0.115</span>
          <span>&bull;</span>
          <span>React 18 + Tailwind</span>
        </div>
      </footer>
    </div>
  );
}
