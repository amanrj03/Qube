'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

interface Test {
  id: string; name: string; duration: number; totalMarks: number;
  isLive: boolean; isDraft: boolean; startTime?: string; endTime?: string;
  sections: { questions: unknown[] }[];
  attempts: { isCompleted: boolean; candidateName: string; totalMarks: number; id: string }[];
  testClasses: { classId: string }[];
}
interface Class { id: string; name: string }

interface Props {
  filter: 'all' | 'drafts' | 'live' | 'results';
  title: string;
  subtitle: string;
}

function GoLiveModal({ test, classes, onClose, onDone, prefill }: {
  test: Test; classes: Class[];
  onClose: () => void; onDone: () => void;
  prefill?: { startTime: string; endTime: string };
}) {
  const [selectedClasses, setSelectedClasses] = useState<string[]>(test.testClasses.map((tc) => tc.classId));
  const toLocal = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const [startTime, setStartTime] = useState(prefill ? toLocal(prefill.startTime) : '');
  const [endTime, setEndTime] = useState(prefill ? toLocal(prefill.endTime) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggle = (id: string) =>
    setSelectedClasses((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]);

  const submit = async () => {
    if (!startTime || !endTime) { setError('Both start and end time are required.'); return; }
    if (new Date(endTime) <= new Date(startTime)) { setError('End time must be after start time.'); return; }
    if (selectedClasses.length === 0) { setError('Select at least one class.'); return; }
    setSaving(true); setError('');
    try {
      await axios.patch(`/api/tests/${test.id}/toggle-live`, {
        isLive: true,
        classIds: selectedClasses,
        startTime,
        endTime,
      });
      onDone();
    } catch (e: unknown) {
      setError(axios.isAxiosError(e) ? e.response?.data?.error : 'Failed to go live');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
        <h2 className="font-bold text-gray-800 mb-1">{prefill ? 'Edit Schedule' : 'Go Live'}</h2>
        <p className="text-sm text-gray-500 mb-4 truncate">{test.name}</p>

        <div className="space-y-4 mb-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Start Time</label>
              <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">End Time</label>
              <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          </div>
          <p className="text-xs text-gray-400">Students can only start the test between these times. The test duration is unaffected.</p>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Assign to Classes</label>
            {classes.length === 0 ? (
              <p className="text-sm text-gray-400">No classes yet.</p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
                {classes.map((cls) => (
                  <label key={cls.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={selectedClasses.includes(cls.id)} onChange={() => toggle(cls.id)} className="w-4 h-4 accent-green-600" />
                    <span className="text-sm text-gray-700">{cls.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

        <div className="flex gap-2">
          <button onClick={submit} disabled={saving}
            className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
            {saving ? 'Going Live...' : '▶ Go Live'}
          </button>
          <button onClick={onClose} className="flex-1 border border-gray-300 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function TestList({ filter, title, subtitle }: Props) {
  const router = useRouter();
  const [allTests, setAllTests] = useState<Test[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [goLiveTarget, setGoLiveTarget] = useState<Test | null>(null);
  const [editScheduleTarget, setEditScheduleTarget] = useState<Test | null>(null);
  const [answerKeyTarget, setAnswerKeyTarget] = useState<Test | null>(null);

  const fetchAll = async () => {
    const [testRes, clsRes] = await Promise.all([axios.get('/api/tests'), axios.get('/api/org/classes')]);
    setAllTests(testRes.data);
    setClasses(clsRes.data);
  };
  useEffect(() => { fetchAll(); }, []);

  const [now, setNow] = useState(() => new Date());

  // Refresh `now` and test data every 30 seconds so expired tests update without page reload
  useEffect(() => {
    const t = setInterval(() => {
      setNow(new Date());
      fetchAll();
    }, 30000);
    return () => clearInterval(t);
  }, []);

  const filtered = (() => {
    if (filter === 'all')     return allTests.filter((t) => !t.isDraft);
    if (filter === 'drafts')  return allTests.filter((t) => t.isDraft);
    if (filter === 'live')    return allTests.filter((t) => t.isLive && (!t.endTime || new Date(t.endTime) > now));
    if (filter === 'results') return allTests.filter((t) => t.endTime && new Date(t.endTime) <= now);
    return [];
  })();

  const takeOffline = async (id: string) => {
    await axios.patch(`/api/tests/${id}/toggle-live`, { isLive: false });
    fetchAll();
  };

  const deleteTest = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await axios.delete(`/api/tests/${id}`);
    fetchAll();
  };

  const getClassNames = (testClasses: { classId: string }[]) => {
    const ids = testClasses.map((tc) => tc.classId);
    const names = classes.filter((c) => ids.includes(c.id)).map((c) => c.name);
    return names.length ? names.join(', ') : 'No classes assigned';
  };

  const fmtTime = (iso?: string) => iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
        <button onClick={() => router.push('/dashboard/tests/create')}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
          + Create Test
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-6">{subtitle}</p>

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-5xl mb-3">📭</p>
          <p className="font-medium text-gray-500">No tests here yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((test) => {
            const questions = test.sections.reduce((t, s) => t + s.questions.length, 0);
            const completedCount = test.attempts.filter((a) => a.isCompleted).length;
            const isExpired = test.endTime && new Date(test.endTime) <= now;

            return (
              <div key={test.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition">
                <div className="p-5">
                  {/* Title + badges */}
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-semibold text-gray-800 truncate">{test.name}</h3>
                    {test.isDraft && <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">Draft</span>}
                    {filter !== 'all' && test.isLive && !isExpired && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse inline-block" />Live</span>}
                    {filter !== 'all' && isExpired && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Ended</span>}
                  </div>

                  {/* Stats */}
                  <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-4">
                    <span>⏱ {Math.floor(test.duration / 60)}h {test.duration % 60}m</span>
                    <span>📊 {test.totalMarks} marks</span>
                    <span>❓ {questions} questions</span>
                    {filter === 'results' && <span className="text-green-700 font-medium">✓ {completedCount} submitted</span>}
                  </div>

                  {/* Schedule — only for live and results, not all */}
                  {filter !== 'all' && (test.startTime || test.endTime) && (
                    <div className="text-xs text-gray-400 mb-2">
                      🕐 {fmtTime(test.startTime)} → {fmtTime(test.endTime)}
                    </div>
                  )}

                  {/* Classes — only for live and results, not all */}
                  {filter !== 'all' && (
                    <p className="text-xs text-gray-400 mb-4">
                      <span className="text-gray-500">Classes: </span>{getClassNames(test.testClasses)}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    {/* ALL TESTS: Go Live, Answer Key, Edit, Delete */}
                    {filter === 'all' && (
                      <>
                        <button
                          onClick={() => { if (!test.isLive || isExpired) setGoLiveTarget(test); }}
                          disabled={!!(test.isLive && !isExpired)}
                          title={test.isLive && !isExpired ? 'Test is currently live' : 'Go Live'}
                          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition border ${
                            test.isLive && !isExpired
                              ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                              : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                          }`}
                        >
                          {test.isLive && !isExpired ? '✓ Already Live' : '▶ Go Live'}
                        </button>
                        <button onClick={() => setAnswerKeyTarget(test)}
                          className="text-xs px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition">
                          🗝 Answer Key
                        </button>
                        <a href={`/preview/${test.id}`} target="_blank" rel="noreferrer"
                          className="text-xs px-3 py-1.5 rounded-lg border border-purple-200 text-purple-600 hover:bg-purple-50 transition">
                          👁 Preview
                        </a>
                        <button onClick={() => router.push(`/dashboard/tests/create?edit=${test.id}`)}
                          className="text-xs px-3 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition">
                          ✏️ Edit
                        </button>
                        <button onClick={() => deleteTest(test.id, test.name)}
                          className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition">
                          🗑 Delete
                        </button>
                      </>
                    )}

                    {/* DRAFTS: Continue Editing, Delete only */}
                    {filter === 'drafts' && (
                      <>
                        <button onClick={() => router.push(`/dashboard/tests/create?edit=${test.id}`)}
                          className="text-xs px-3 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition font-medium">
                          ✏️ Continue Editing
                        </button>
                        <button onClick={() => deleteTest(test.id, test.name)}
                          className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition">
                          🗑 Delete
                        </button>
                      </>
                    )}

                    {/* LIVE: Take Offline, Edit Schedule — NO delete */}
                    {filter === 'live' && (
                      <>
                        <button onClick={() => takeOffline(test.id)}
                          className="text-xs px-3 py-1.5 rounded-lg font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition">
                          ⏹ Take Offline
                        </button>
                        <button onClick={() => setEditScheduleTarget(test)}
                          className="text-xs px-3 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition">
                          🕐 Edit Schedule
                        </button>
                      </>
                    )}

                    {/* RESULTS: View Results only — NO delete */}
                    {filter === 'results' && (
                      <>
                        {completedCount > 0 && (
                          <a href={`/analyse/${test.attempts.find((a) => a.isCompleted)?.id}`} target="_blank" rel="noreferrer"
                            className="text-xs px-3 py-1.5 rounded-lg border border-purple-200 text-purple-600 hover:bg-purple-50 transition">
                            📈 View Results
                          </a>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Submissions — results section */}
                {filter === 'results' && completedCount > 0 && (
                  <div className="border-t border-gray-100 bg-gray-50 px-5 py-3">
                    <p className="text-xs font-medium text-gray-500 mb-2">{completedCount} submission{completedCount > 1 ? 's' : ''}</p>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {test.attempts.filter((a) => a.isCompleted).map((attempt) => (
                        <div key={attempt.id} className="flex items-center justify-between text-sm bg-white rounded-lg px-3 py-2 border border-gray-100">
                          <span className="text-gray-700 truncate">{attempt.candidateName}</span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="font-semibold text-blue-700">{attempt.totalMarks}/{test.totalMarks}</span>
                            <a href={`/analyse/${attempt.id}`} target="_blank" rel="noreferrer"
                              className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded hover:bg-blue-700">Analyse</a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {goLiveTarget && (
        <GoLiveModal
          test={goLiveTarget}
          classes={classes}
          onClose={() => setGoLiveTarget(null)}
          onDone={() => { setGoLiveTarget(null); fetchAll(); }}
        />
      )}

      {editScheduleTarget && (
        <GoLiveModal
          test={editScheduleTarget}
          classes={classes}
          prefill={{ startTime: editScheduleTarget.startTime || '', endTime: editScheduleTarget.endTime || '' }}
          onClose={() => setEditScheduleTarget(null)}
          onDone={() => { setEditScheduleTarget(null); fetchAll(); }}
        />
      )}

      {/* Answer Key Modal */}
      {answerKeyTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-gray-800">Answer Key</h2>
                <p className="text-xs text-gray-500 mt-0.5">{answerKeyTarget.name}</p>
              </div>
              <button onClick={() => setAnswerKeyTarget(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            <div className="overflow-y-auto px-6 py-4 space-y-8">
              {(answerKeyTarget as any).sections?.map((section: any, si: number) => {
                const isInteger = section.questionType === 'INTEGER';
                const isMultiple = section.questionType === 'MULTIPLE_CORRECT';
                return (
                  <div key={section.id}>
                    <h3 className="text-center font-semibold text-indigo-700 uppercase tracking-wide text-sm mb-3">
                      {section.name}
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-sm text-center">
                        <tbody>
                          <tr className="border border-gray-300">
                            <td className="border border-gray-300 px-2 py-1.5 font-semibold bg-gray-50 text-gray-600 text-xs">Q.</td>
                            {section.questions.map((q: any, qi: number) => (
                              <td key={q.id} className="border border-gray-300 px-2 py-1.5 font-medium text-gray-700 min-w-[36px]">
                                {qi + 1}
                              </td>
                            ))}
                          </tr>
                          <tr className="border border-gray-300">
                            <td className="border border-gray-300 px-2 py-1.5 font-semibold bg-gray-50 text-gray-600 text-xs">A.</td>
                            {section.questions.map((q: any) => {
                              let answer = '—';
                              if (isInteger) answer = q.correctInteger?.toString() ?? '—';
                              else if (isMultiple) answer = q.correctOptions ? q.correctOptions.split(',').join(',') : '—';
                              else answer = q.correctOption ?? '—';
                              return (
                                <td key={q.id} className="border border-gray-300 px-2 py-1.5 font-semibold text-gray-800">
                                  {answer}
                                </td>
                              );
                            })}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-6 py-3 border-t border-gray-100 flex justify-end">
              <button onClick={() => setAnswerKeyTarget(null)} className="bg-gray-100 text-gray-700 px-5 py-2 rounded-lg text-sm hover:bg-gray-200 transition">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
