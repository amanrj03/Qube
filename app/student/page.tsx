'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { testAPI } from '../../services/api';
import axios from 'axios';

const fmt = (d: Date) =>
  d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });

function Avatar({ name, pic, size = 'md' }: { name: string; pic?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'lg' ? 'w-16 h-16 text-2xl' : size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';
  if (pic) return <img src={pic} alt={name} className={`${sz} rounded-full object-cover border-2 border-white shadow`} />;
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white font-bold border-2 border-white shadow`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function StudentDashboard() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [liveTests, setLiveTests] = useState<any[]>([]);
  const [attemptedTests, setAttemptedTests] = useState<any[]>([]);
  const [testsLoading, setTestsLoading] = useState(true);
  const [showProfileCard, setShowProfileCard] = useState(false);
  const [activeTab, setActiveTab] = useState<'live' | 'results'>('live');
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && (!user || user.role !== 'student')) router.push('/login/student');
  }, [user, loading, router]);

  useEffect(() => {
    if (user?.role === 'student') {
      fetchTests();
      // Refresh every 30s so tests appear as soon as startTime is reached
      const interval = setInterval(fetchTests, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfileCard(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchTests = async () => {
    try {
      const [liveRes, attRes] = await Promise.all([testAPI.getLiveTests(), axios.get('/api/attempts/user/me')]);
      const completedIds = attRes.data.filter((a: any) => a.isCompleted).map((a: any) => a.testId);
      setLiveTests(liveRes.data.filter((t: any) => !completedIds.includes(t.id)));
      setAttemptedTests(attRes.data.filter((a: any) => a.isCompleted));
    } catch {} finally {
      setTestsLoading(false);
    }
  };

  const calcAccuracy = (attempt: any) => {
    if (!attempt.answers?.length) return 0;
    let correct = 0, total = 0;
    attempt.answers.forEach((a: any) => { if (a.isCorrect !== null) { total++; if (a.isCorrect) correct++; } });
    return total === 0 ? 0 : Math.round((correct / total) * 100);
  };

  if (loading || !user || user.role !== 'student') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }

  const s = user;
  const bestScore = attemptedTests.length
    ? Math.max(...attemptedTests.map((a) => a.totalMarks))
    : null;
  const avgAccuracy = attemptedTests.length
    ? Math.round(attemptedTests.reduce((sum, a) => sum + calcAccuracy(a), 0) / attemptedTests.length)
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top navbar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/examizLogo.png" alt="Examiz" className="h-9" />
            <span className="text-gray-300">|</span>
            <span className="text-sm font-medium text-gray-600">{s.class.name}</span>
          </div>

          <div ref={profileRef} className="relative">
            <button onClick={() => setShowProfileCard(!showProfileCard)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-gray-100 transition">
              <Avatar name={s.name} pic={s.profilePic} size="sm" />
              <div className="text-left hidden sm:block">
                <p className="text-sm font-semibold text-gray-800 leading-tight">{s.name}</p>
                <p className="text-xs text-gray-400">{s.registrationNo}</p>
              </div>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showProfileCard && (
              <div className="absolute right-0 top-12 bg-white border border-gray-200 rounded-2xl shadow-xl p-4 w-72 z-50">
                <div className="flex items-center gap-3 pb-3 border-b border-gray-100 mb-3">
                  <Avatar name={s.name} pic={s.profilePic} size="md" />
                  <div>
                    <p className="font-semibold text-gray-800">{s.name}</p>
                    <p className="text-xs text-gray-500">{s.class.name}</p>
                  </div>
                </div>
                <div className="space-y-1.5 text-xs mb-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Registration No</span>
                    <span className="font-medium text-gray-700">{s.registrationNo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Username</span>
                    <span className="font-medium text-gray-700">{s.username}</span>
                  </div>
                  {s.phone && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Phone</span>
                      <span className="font-medium text-gray-700">{s.phone}</span>
                    </div>
                  )}
                </div>
                <button onClick={() => { setShowProfileCard(false); router.push('/student/profile'); }}
                  className="w-full bg-emerald-600 text-white py-2 rounded-xl text-xs font-medium hover:bg-emerald-700 transition mb-2">
                  View Profile
                </button>
                <button onClick={async () => { await logout(); router.push('/login/student'); }}
                  className="w-full border border-red-200 text-red-500 py-2 rounded-xl text-xs font-medium hover:bg-red-50 transition">
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Welcome + stats row */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-1">Welcome back, {s.name.split(' ')[0]} 👋</h1>
          <p className="text-gray-500 text-sm">Here's your test activity overview.</p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Tests Attempted', value: attemptedTests.length, icon: '📝', color: 'bg-blue-50 text-blue-700' },
            { label: 'Live Tests', value: liveTests.length, icon: '🟢', color: 'bg-emerald-50 text-emerald-700' },
            { label: 'Best Score', value: bestScore !== null ? bestScore : '—', icon: '🏆', color: 'bg-amber-50 text-amber-700' },
            { label: 'Avg Accuracy', value: avgAccuracy !== null ? `${avgAccuracy}%` : '—', icon: '🎯', color: 'bg-purple-50 text-purple-700' },
          ].map((stat) => (
            <div key={stat.label} className={`${stat.color} rounded-2xl p-4`}>
              <div className="text-2xl mb-1">{stat.icon}</div>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-xs font-medium mt-0.5 opacity-80">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6">
          {(['live', 'results'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition ${activeTab === tab ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {tab === 'live' ? `Live Tests ${liveTests.length > 0 ? `(${liveTests.length})` : ''}` : `My Results ${attemptedTests.length > 0 ? `(${attemptedTests.length})` : ''}`}
            </button>
          ))}
        </div>

        {/* Live Tests tab */}
        {activeTab === 'live' && (
          <div>
            {testsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2].map((i) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    <div className="h-1.5 w-full bg-gray-100 animate-pulse" />
                    <div className="p-5 space-y-3">
                      <div className="h-5 w-2/3 bg-gray-200 rounded-lg animate-pulse" />
                      <div className="flex gap-2">
                        <div className="h-4 w-20 bg-gray-100 rounded-full animate-pulse" />
                        <div className="h-4 w-20 bg-gray-100 rounded-full animate-pulse" />
                        <div className="h-4 w-20 bg-gray-100 rounded-full animate-pulse" />
                      </div>
                      <div className="h-4 w-1/2 bg-gray-100 rounded-lg animate-pulse" />
                      <div className="h-10 w-full bg-gray-100 rounded-xl animate-pulse mt-2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : liveTests.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                <p className="text-4xl mb-3">📭</p>
                <p className="font-medium text-gray-600">No live tests right now</p>
                <p className="text-sm text-gray-400 mt-1">Your institution will activate tests here</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {liveTests.map((test) => {
                  const now = new Date();
                  const startTime = test.startTime ? new Date(test.startTime) : null;
                  const endTime   = test.endTime   ? new Date(test.endTime)   : null;
                  const notStarted = startTime && now < startTime;
                  const questions = test.sections?.reduce((t: number, s: any) => t + s.questions.length, 0) ?? 0;

                  return (
                    <div key={test.id} className={`bg-white rounded-2xl border overflow-hidden transition hover:shadow-md ${notStarted ? 'border-amber-200' : 'border-emerald-200'}`}>
                      {/* Colored top strip */}
                      <div className={`h-1.5 w-full ${notStarted ? 'bg-amber-400' : 'bg-emerald-500'}`} />
                      <div className="p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-800 truncate text-base">{test.name}</h3>
                            <div className="flex flex-wrap gap-2 mt-1.5">
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">⏱ {Math.floor(test.duration / 60)}h {test.duration % 60}m</span>
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">📊 {test.totalMarks} marks</span>
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">❓ {questions} questions</span>
                            </div>
                          </div>
                          <span className={`ml-2 flex-shrink-0 text-xs px-2.5 py-1 rounded-full font-medium ${notStarted ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {notStarted ? 'Upcoming' : '● Live'}
                          </span>
                        </div>

                        {/* Schedule */}
                        {(startTime || endTime) && (
                          <div className="bg-gray-50 rounded-xl px-3 py-2 mb-3 text-xs text-gray-600 space-y-1">
                            {startTime && <div className="flex justify-between"><span className="text-gray-400">Starts</span><span className="font-medium">{fmt(startTime)}</span></div>}
                            {endTime   && <div className="flex justify-between"><span className="text-gray-400">Last entry</span><span className="font-medium">{fmt(endTime)}</span></div>}
                          </div>
                        )}

                        <button
                          onClick={() => router.push(`/instructions/${test.id}`)}
                          disabled={!!notStarted}
                          className={`w-full py-2.5 rounded-xl text-sm font-semibold transition ${notStarted ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                        >
                          {notStarted ? `Opens at ${fmt(startTime!)}` : 'Start Test →'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Results tab */}
        {activeTab === 'results' && (
          <div>
            {attemptedTests.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                <p className="text-4xl mb-3">📋</p>
                <p className="font-medium text-gray-600">No results yet</p>
                <p className="text-sm text-gray-400 mt-1">Completed tests will appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {attemptedTests.map((attempt) => {
                  const accuracy = calcAccuracy(attempt);
                  const pct = attempt.test.totalMarks > 0 ? Math.round((attempt.totalMarks / attempt.test.totalMarks) * 100) : 0;
                  return (
                    <div key={attempt.id} className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4 hover:shadow-sm transition">
                      {/* Score ring */}
                      <div className="flex-shrink-0 w-14 h-14 rounded-full border-4 border-blue-100 flex flex-col items-center justify-center">
                        <span className="text-sm font-bold text-blue-700 leading-none">{pct}%</span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-800 truncate">{attempt.test.name}</h3>
                        <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                          <span>Score: <span className="font-semibold text-gray-700">{attempt.totalMarks}/{attempt.test.totalMarks}</span></span>
                          <span>Accuracy: <span className="font-semibold text-gray-700">{accuracy}%</span></span>
                          <span>{new Date(attempt.endTime).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        </div>
                        {/* Score bar */}
                        <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>

                      <button
                        onClick={() => window.open(`/analyse/${attempt.id}`, '_blank')}
                        className="flex-shrink-0 bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-blue-700 transition"
                      >
                        Analyse
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Instructions footer */}
        <div className="mt-10 bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-700 mb-4 text-sm">📌 Test Guidelines</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-500">
            <div className="space-y-1.5">
              <p className="font-medium text-gray-600 mb-1">Before starting</p>
              <p>• Ensure a stable internet connection</p>
              <p>• Close all other browser tabs</p>
              <p>• Use Chrome or Firefox</p>
            </div>
            <div className="space-y-1.5">
              <p className="font-medium text-gray-600 mb-1">During the test</p>
              <p>• Do not exit fullscreen mode</p>
              <p>• Answers auto-save every 15 seconds</p>
              <p>• 5 warnings = auto-submit</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
