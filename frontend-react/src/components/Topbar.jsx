import React from 'react';

export default function Topbar({ title, exams, currentExamId, setCurrentExamId, onMenuClick, user, onLogout }) {
  return (
    <header className="h-16 shrink-0 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-7">
      <div className="flex items-center gap-3">
        <button
          className="lg:hidden text-gray-500 hover:text-ink p-1 rounded-md hover:bg-gray-100 transition"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
          </svg>
        </button>
        <div>
          <div className="text-lg font-bold text-gray-900 leading-tight">{title}</div>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        <div className="hidden sm:flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">Active exam session:</label>
          <select
            className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-sm font-medium text-gray-800 min-w-[200px] focus:border-indigo-500 focus:outline-none transition"
            value={currentExamId || ''}
            onChange={(e) => setCurrentExamId(e.target.value)}
          >
            {exams.length === 0 && <option value="">No exam sessions yet</option>}
            {exams.map((e) => (
              <option key={e.exam_id} value={e.exam_id}>
                {e.exam_name} — {e.exam_date || ''} ({e.session_type})
              </option>
            ))}
          </select>
        </div>

        {/* User profile & Logout */}
        <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
          <div className="hidden md:flex flex-col text-right">
            <span className="text-xs font-semibold text-gray-900 leading-tight">{user?.name || 'Administrator'}</span>
            <span className="text-[10px] font-medium text-indigo-600">{user?.role || 'COE Officer'}</span>
          </div>

          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-500 text-white flex items-center justify-center font-bold text-xs shadow-sm">
            {(user?.name || 'A').charAt(0)}
          </div>

          {onLogout && (
            <button
              onClick={onLogout}
              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
              title="Sign out of portal"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
