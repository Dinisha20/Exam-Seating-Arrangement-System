import React, { useEffect, useState } from 'react';
import { apiGet } from '../api.js';

export default function Dashboard({ currentExamId, exams, setView }) {
  const [halls, setHalls] = useState([]);
  const [papers, setPapers] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [studentCount, setStudentCount] = useState(0);
  const [allocatedCount, setAllocatedCount] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const h = await apiGet('/halls');
        setHalls(h || []);
      } catch {}

      const params = currentExamId ? `?exam_id=${currentExamId}` : '';
      try {
        const { papers: p, mappings: m } = await apiGet(`/papers${params}`);
        setPapers(p || []);
        setMappings(m || []);
      } catch {}

      if (currentExamId) {
        try {
          const stats = await apiGet(`/upload/${currentExamId}/stats`);
          setStudentCount(stats.student_count || 0);
        } catch {
          setStudentCount(0);
        }
        try {
          const alloc = await apiGet(`/allocation/${currentExamId}`);
          setAllocatedCount(alloc?.length || 0);
        } catch {
          setAllocatedCount(0);
        }
      } else {
        setStudentCount(0);
        setAllocatedCount(0);
      }
    })();
  }, [currentExamId]);

  const totalCapacity = halls.reduce((s, h) => s + (h.capacity || 0), 0);
  const activeExam = exams.find((e) => String(e.exam_id) === String(currentExamId));

  const STEPS = [
    {
      step: '1',
      title: 'Exam Sessions',
      view: 'exams',
      desc: 'Create or select the active exam session slot',
      status: activeExam ? `${activeExam.exam_name} (${activeExam.session_type})` : 'None active',
      done: !!activeExam,
      icon: '📅',
    },
    {
      step: '2',
      title: 'Halls & Benches',
      view: 'halls',
      desc: 'Configure examination halls, blocks, and seating capacity',
      status: `${halls.length} halls (${totalCapacity} seats)`,
      done: halls.length > 0,
      icon: '🏛️',
    },
    {
      step: '3',
      title: 'Papers & Mapping',
      view: 'papers',
      desc: 'Define subjects & map course codes for this session',
      status: `${papers.length} subjects, ${mappings.length} mappings`,
      done: mappings.length > 0,
      icon: '📚',
    },
    {
      step: '4',
      title: 'Upload Students',
      view: 'upload',
      desc: 'Import student hall plan Excel or review registered students',
      status: `${studentCount} student(s) registered`,
      done: studentCount > 0,
      icon: '👥',
    },
    {
      step: '5',
      title: 'Generate Seating',
      view: 'generate',
      desc: 'Run optimization solver with adjacency conflict avoidance',
      status: allocatedCount > 0 ? `${allocatedCount} seats allocated` : 'Ready to generate',
      done: allocatedCount > 0,
      icon: '⚡',
    },
    {
      step: '6',
      title: 'Seat Map & Export',
      view: 'seatmap',
      desc: 'View visual hall maps and export official attendance sheets',
      status: allocatedCount > 0 ? 'Export ready' : 'Pending generation',
      done: allocatedCount > 0,
      icon: '🖨️',
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── Active Session Overview Banner ─────────────────────── */}
      <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-800 p-6 text-white shadow-xl shadow-indigo-500/10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-indigo-200">
              Exam Seating Automation Portal
            </div>
            <h1 className="text-2xl font-black tracking-tight mt-1">
              {activeExam ? activeExam.exam_name : 'No Active Session Selected'}
            </h1>
            <p className="text-xs text-indigo-100/80 mt-1 max-w-xl">
              {activeExam
                ? `Active Session: ${activeExam.exam_date || 'Date TBD'} • ${activeExam.session_type === 'FN' ? 'Forenoon (09:30 AM)' : 'Afternoon (01:30 PM)'} • ${activeExam.exam_time || ''}`
                : 'Please select or create an exam session from the Exam Sessions tab to begin configuring seating.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {setView && (
              <button
                onClick={() => setView('exams')}
                className="btn bg-white/20 hover:bg-white/30 text-white text-xs px-4 py-2 rounded-xl backdrop-blur-sm border border-white/20 transition font-medium"
              >
                Switch Session
              </button>
            )}
            {activeExam && setView && (
              <button
                onClick={() => setView('generate')}
                className="btn bg-white text-indigo-900 hover:bg-indigo-50 text-xs px-4 py-2 rounded-xl font-bold shadow-lg transition"
              >
                ⚡ Generate Seating
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Stat Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-gray-500">Configured Halls</div>
            <span className="text-lg">🏛️</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{halls.length}</div>
          <div className="text-xs text-indigo-600 font-medium mt-1">{totalCapacity} total seat capacity</div>
        </div>

        <div className="card hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-gray-500">Exam Sessions</div>
            <span className="text-lg">📅</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{exams.length}</div>
          <div className="text-xs text-indigo-600 font-medium mt-1">
            {activeExam ? `${activeExam.exam_name} active` : '0 active'}
          </div>
        </div>

        <div className="card hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-gray-500">Session Subjects</div>
            <span className="text-lg">📚</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{papers.length}</div>
          <div className="text-xs text-indigo-600 font-medium mt-1">{mappings.length} course codes mapped</div>
        </div>

        <div className="card hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-gray-500">Allocated Seats</div>
            <span className="text-lg">🪑</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{allocatedCount}</div>
          <div className="text-xs text-emerald-600 font-medium mt-1">
            {studentCount > 0 ? `${studentCount} registered students` : 'No students uploaded'}
          </div>
        </div>
      </div>

      {/* ── Interactive Seating Workflow Guide ─────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
          <div>
            <div className="font-semibold text-sm text-gray-900">Seating Allocation Workflow</div>
            <p className="text-xs text-gray-500 mt-0.5">
              Click any step below to navigate directly to that section.
            </p>
          </div>
          <span className="badge bg-indigo-50 text-indigo-700 text-xs font-semibold">6-Step Guided Flow</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {STEPS.map((s) => (
            <div
              key={s.step}
              onClick={() => setView && setView(s.view)}
              className="p-4 rounded-xl border border-gray-200/80 bg-white hover:border-indigo-400 hover:shadow-md transition-all duration-150 cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                    Step {s.step}
                  </span>
                  <span className="text-base group-hover:scale-110 transition-transform">{s.icon}</span>
                </div>
                <div className="font-bold text-sm text-gray-900 group-hover:text-indigo-600 transition-colors">
                  {s.title}
                </div>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                  {s.desc}
                </p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-xs">
                <span className="text-gray-600 font-medium truncate max-w-[180px]">
                  {s.status}
                </span>
                <span className="text-indigo-600 font-bold group-hover:translate-x-0.5 transition-transform">
                  →
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
