import React from 'react';

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'papers', label: 'Papers & Mapping' },
  { key: 'halls', label: 'Halls & Benches' },
  { key: 'exams', label: 'Exam Sessions' },
  { key: 'upload', label: 'Upload Students' },
  { key: 'generate', label: 'Generate Seating' },
  { key: 'seatmap', label: 'Seat Map' },
  { key: 'lookup', label: 'Student Lookup' },
];

export default function Sidebar({ view, setView, mobileOpen, setMobileOpen, user, onLogout }) {
  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 shrink-0 bg-gradient-to-b from-ink via-[#131620] to-[#0f1118] text-gray-200 flex flex-col p-4 transition-transform duration-200 lg:translate-x-0 border-r border-white/5 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-3 pb-5 mb-3 border-b border-white/10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-600 to-teal-400 p-[1px] shadow-lg shadow-indigo-500/20 shrink-0">
            <div className="w-full h-full bg-slate-900 rounded-[11px] flex items-center justify-center font-black text-xs text-white">
              ES
            </div>
          </div>
          <div>
            <div className="font-bold text-sm text-white tracking-tight">Exam Seating</div>
            <div className="text-[11px] text-indigo-300 font-medium">COE Allocation System</div>
          </div>
        </div>

        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-3 py-1 mb-1">
          Navigation
        </div>

        <nav className="flex flex-col gap-1 flex-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => {
                setView(item.key);
                setMobileOpen(false);
              }}
              className={`nav-item text-left ${view === item.key ? 'nav-item-active' : ''}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${view === item.key ? 'bg-indigo-400' : 'bg-gray-500'}`} />
              {item.label}
            </button>
          ))}
        </nav>

        {/* User Card & Logout in Sidebar footer */}
        <div className="pt-3 mt-2 border-t border-white/10">
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white flex items-center justify-center font-bold text-xs shrink-0">
                {(user?.name || 'A').charAt(0)}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white truncate">{user?.name || 'COE Officer'}</div>
                <div className="text-[10px] text-gray-400 truncate">{user?.email || 'admin@university.edu'}</div>
              </div>
            </div>
            {onLogout && (
              <button
                onClick={onLogout}
                className="text-gray-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-white/10 transition"
                title="Log out"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

export { NAV_ITEMS };
