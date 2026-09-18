import React, { useState, useEffect, useCallback } from 'react';
import Sidebar, { NAV_ITEMS } from './components/Sidebar.jsx';
import Topbar from './components/Topbar.jsx';
import { ToastProvider } from './components/Toast.jsx';
import { apiGet } from './api.js';

import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Papers from './pages/Papers.jsx';
import Halls from './pages/Halls.jsx';
import Exams from './pages/Exams.jsx';
import Upload from './pages/Upload.jsx';
import Generate from './pages/Generate.jsx';
import SeatMap from './pages/SeatMap.jsx';
import Lookup from './pages/Lookup.jsx';

const TITLES = Object.fromEntries(NAV_ITEMS.map((i) => [i.key, i.label]));

function AppInner() {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('esa_auth_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [view, setView] = useState('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [exams, setExams] = useState([]);
  const [currentExamId, setCurrentExamId] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const handleLogin = (userData) => {
    setUser(userData);
    try {
      localStorage.setItem('esa_auth_user', JSON.stringify(userData));
    } catch {}
  };

  const handleLogout = () => {
    setUser(null);
    try {
      localStorage.removeItem('esa_auth_user');
    } catch {}
  };

  const refreshExams = useCallback(async () => {
    if (!user) return;
    try {
      const list = await apiGet('/exams');
      setExams(list);
      if (list.length) {
        if (!currentExamId || !list.some((e) => String(e.exam_id) === String(currentExamId))) {
          setCurrentExamId(String(list[0].exam_id));
        }
      } else {
        setCurrentExamId(null);
      }
    } catch {
      // Ignored if offline
    }
  }, [currentExamId, user]);

  useEffect(() => {
    refreshExams();
  }, [refreshTick, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const bump = () => setRefreshTick((t) => t + 1);

  const pageProps = { currentExamId, setCurrentExamId, exams, onDataChanged: bump, setView, user };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar
        view={view}
        setView={setView}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        user={user}
        onLogout={handleLogout}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          title={TITLES[view]}
          exams={exams}
          currentExamId={currentExamId}
          setCurrentExamId={setCurrentExamId}
          onMenuClick={() => setMobileOpen(true)}
          user={user}
          onLogout={handleLogout}
        />
        <main className="flex-1 p-4 lg:p-7 overflow-y-auto">
          {view === 'dashboard' && <Dashboard {...pageProps} />}
          {view === 'papers' && <Papers {...pageProps} />}
          {view === 'halls' && <Halls {...pageProps} />}
          {view === 'exams' && <Exams {...pageProps} />}
          {view === 'upload' && <Upload {...pageProps} />}
          {view === 'generate' && <Generate {...pageProps} />}
          {view === 'seatmap' && <SeatMap {...pageProps} />}
          {view === 'lookup' && <Lookup {...pageProps} />}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}
