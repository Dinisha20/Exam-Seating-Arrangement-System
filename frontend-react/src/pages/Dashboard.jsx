import React, { useEffect, useState } from 'react';
import { apiGet } from '../api.js';

export default function Dashboard({ currentExamId, exams }) {
  const [halls, setHalls] = useState([]);
  const [papers, setPapers] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [allocatedCount, setAllocatedCount] = useState(0);

  useEffect(() => {
    (async () => {
      const h = await apiGet('/halls');
      setHalls(h);
      const { papers, mappings } = await apiGet('/papers');
      setPapers(papers);
      setMappings(mappings);
      if (currentExamId) {
        try {
          const alloc = await apiGet(`/allocation/${currentExamId}`);
          setAllocatedCount(alloc.length);
        } catch {
          setAllocatedCount(0);
        }
      }
    })();
  }, [currentExamId]);

  const totalCapacity = halls.reduce((s, h) => s + h.capacity, 0);
  const activeExam = exams.find((e) => String(e.exam_id) === String(currentExamId));

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="text-xs text-gray-500 mb-1.5">Halls configured</div>
          <div className="text-2xl font-bold">{halls.length}</div>
          <div className="text-[11px] text-gray-400 mt-1">{totalCapacity} total seats</div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-gray-500 mb-1.5">Exam sessions</div>
          <div className="text-2xl font-bold">{exams.length}</div>
          <div className="text-[11px] text-gray-400 mt-1">
            {activeExam ? `Active: ${activeExam.exam_name}` : 'None selected'}
          </div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-gray-500 mb-1.5">Papers mapped</div>
          <div className="text-2xl font-bold">{papers.length}</div>
          <div className="text-[11px] text-gray-400 mt-1">{mappings.length} course codes linked</div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-gray-500 mb-1.5">Seats allocated</div>
          <div className="text-2xl font-bold">{allocatedCount}</div>
          <div className="text-[11px] text-gray-400 mt-1">for the active exam session</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        <div className="card">
          <div className="font-semibold text-sm mb-3.5">Getting started</div>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-600">
            <li>Define <b>papers</b> and map course codes to them (Papers &amp; Mapping)</li>
            <li>Set up your <b>halls and benches</b> (Halls &amp; Benches)</li>
            <li>Create an <b>exam session</b> (Exam Sessions)</li>
            <li><b>Upload</b> the Hall Plan Excel for that session</li>
            <li><b>Generate</b> the seating arrangement</li>
            <li>View the <b>seat map</b> or look up a student's seat</li>
          </ol>
        </div>
        <div className="card">
          <div className="font-semibold text-sm mb-3.5">Hall capacity overview</div>
          {halls.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">No halls configured yet</div>
          ) : (
            halls.map((h) => (
              <div key={h.hall_id} className="flex justify-between text-sm mb-3">
                <span>
                  <b>{h.hall_name}</b> <span className="text-gray-400">({h.block})</span>
                </span>
                <span className="text-gray-500">{h.capacity} seats</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
