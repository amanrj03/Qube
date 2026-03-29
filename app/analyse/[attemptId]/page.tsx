'use client';
import { useState, useEffect, useMemo, memo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell, ReferenceArea
} from 'recharts';
import { attemptAPI } from '../../../services/api';
import { formatTime } from '../../../hooks/useTimeTracking';
import { groupSectionsBySubject, generateQuestionWiseData } from '../../../utils/subjectUtils';
import { getDetailedJeeMainsStats } from '../../../data/jeeMainsStats';
import {
  Target, CheckCircle2, XCircle, MinusCircle, TrendingUp, Award, BookOpen,
  ChevronDown, Sparkles, Trophy, Clock, BarChart3,
  TrendingUp as TrendingUpIcon
} from 'lucide-react';

// ─── Image with skeleton loader ──────────────────────────────────────────────

function ImageWithSkeleton({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useCallback((node: HTMLImageElement | null) => {
    if (!node) return;
    // If browser already has it cached, complete fires before onLoad attaches
    if (node.complete) {
      setLoaded(true);
      if (node.naturalWidth === 0) setError(true);
    }
  }, []);

  useEffect(() => { setLoaded(false); setError(false); }, [src]);

  return (
    <div className="relative w-full">
      {!loaded && !error && (
        <div className="w-full rounded animate-pulse bg-gray-200" style={{ minHeight: '180px' }} />
      )}
      {error && (
        <div className="w-full rounded bg-gray-100 flex items-center justify-center text-sm text-gray-400" style={{ minHeight: '80px' }}>
          Image unavailable
        </div>
      )}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        onError={() => { setLoaded(true); setError(true); }}
        className={`max-w-full h-auto rounded transition-opacity duration-200 ${loaded && !error ? 'opacity-100' : 'opacity-0 absolute inset-0 w-0 h-0'}`}
      />
    </div>
  );
}

// ─── Question Carousel ───────────────────────────────────────────────────────

function QuestionCarousel({ questions, currentSection, getAnswerForQuestion }: {
  questions: any[];
  currentSection: any;
  getAnswerForQuestion: (id: string) => any;
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const active = questions[activeIdx];
  const answer = getAnswerForQuestion(active?.id);
  const isCorrect = answer?.isCorrect;
  const marksAwarded = answer?.marksAwarded ?? 0;
  const timeSpent = answer?.timeSpent ?? 0;
  const originalIndex = currentSection.questions.findIndex((q: any) => q.id === active?.id);

  const statusColor = isCorrect === true ? 'green' : isCorrect === false ? 'red' : 'amber';
  const statusLabel = isCorrect === true ? 'Correct' : isCorrect === false ? 'Wrong' : 'Unattempted';
  const statusBg: Record<string, string> = { green: 'bg-green-50 border-green-200', red: 'bg-red-50 border-red-200', amber: 'bg-amber-50 border-amber-200' };
  const statusText: Record<string, string> = { green: 'text-green-700', red: 'text-red-700', amber: 'text-amber-700' };
  const statusBadge: Record<string, string> = { green: 'bg-green-100 text-green-700', red: 'bg-red-100 text-red-700', amber: 'bg-amber-100 text-amber-700' };

  const getBtnColor = (q: any) => {
    const a = getAnswerForQuestion(q.id);
    if (a?.isCorrect === true)  return 'bg-green-500 text-white';
    if (a?.isCorrect === false) return 'bg-red-500 text-white';
    return 'bg-amber-400 text-white';
  };

  const getYourAnswer = () => {
    const qType = currentSection.questionType;
    if (qType === 'SINGLE_CORRECT' || qType === 'MATRIX_MATCH')
      return answer?.selectedOption ? `Option ${answer.selectedOption}` : 'Not attempted';
    if (qType === 'MULTIPLE_CORRECT') {
      if (!answer?.selectedOptions) return 'Not attempted';
      const opts = typeof answer.selectedOptions === 'string'
        ? answer.selectedOptions.split(',').map((o: string) => o.trim())
        : answer.selectedOptions;
      return opts.map((o: string) => `Option ${o}`).join(', ');
    }
    if (qType === 'INTEGER')
      return (answer?.integerAnswer !== null && answer?.integerAnswer !== undefined) ? answer.integerAnswer.toString() : 'Not attempted';
    return 'Not attempted';
  };

  const getCorrectAnswer = () => {
    const qType = currentSection.questionType;
    if (qType === 'SINGLE_CORRECT' || qType === 'MATRIX_MATCH')
      return active?.correctOption ? `Option ${active.correctOption}` : 'N/A';
    if (qType === 'MULTIPLE_CORRECT') {
      if (!active?.correctOptions) return 'N/A';
      const opts = typeof active.correctOptions === 'string'
        ? active.correctOptions.split(',').map((o: string) => o.trim())
        : active.correctOptions;
      return opts.map((o: string) => `Option ${o}`).join(', ');
    }
    if (qType === 'INTEGER')
      return (active?.correctInteger !== null && active?.correctInteger !== undefined) ? active.correctInteger.toString() : 'N/A';
    return 'N/A';
  };

  return (
    <div>
      {/* Question number palette */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {questions.map((q: any, i: number) => {
          const origIdx = currentSection.questions.findIndex((cq: any) => cq.id === q.id);
          return (
            <button key={q.id} onClick={() => setActiveIdx(i)}
              className={`w-8 h-8 rounded-md text-xs font-bold transition-all ${getBtnColor(q)} ${activeIdx === i ? 'ring-2 ring-offset-1 ring-gray-500 scale-110' : 'hover:scale-105 opacity-80 hover:opacity-100'}`}>
              {origIdx + 1}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-500 inline-block" />Correct</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" />Wrong</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" />Unattempted</span>
      </div>

      {/* Question card */}
      {active && (
        <motion.div key={active.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}
          className={`border rounded-xl overflow-hidden ${statusBg[statusColor]}`}>

          {/* ── Navigation bar at top ── */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-white/60 border-b border-current/10">
            <button
              onClick={() => setActiveIdx((i) => Math.max(0, i - 1))}
              disabled={activeIdx === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              ← Prev
            </button>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-foreground">Q {originalIndex + 1}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge[statusColor]}`}>{statusLabel}</span>
              <span className={`text-sm font-bold ${marksAwarded > 0 ? 'text-green-600' : marksAwarded < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                {marksAwarded > 0 ? '+' : ''}{marksAwarded}
              </span>
              {timeSpent > 0 && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />{formatTime(timeSpent)}
                </span>
              )}
              <span className="text-xs text-muted-foreground">{activeIdx + 1}/{questions.length}</span>
            </div>
            <button
              onClick={() => setActiveIdx((i) => Math.min(questions.length - 1, i + 1))}
              disabled={activeIdx === questions.length - 1}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              Next →
            </button>
          </div>

          {/* ── Question image ── */}
          <div className="p-4">
            {active.questionImage ? (
              <div className="mb-4 bg-white rounded-lg border border-gray-200 p-2">
                <ImageWithSkeleton src={active.questionImage} alt={`Q${originalIndex + 1}`} />
              </div>
            ) : (
              <div className="mb-4 bg-white/60 rounded-lg border border-dashed border-gray-300 p-4 text-center text-sm text-muted-foreground">
                No question image
              </div>
            )}

            {/* ── Your answer vs Correct answer ── */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-white rounded-lg border border-gray-200 p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Your Answer</p>
                <p className={`text-base font-bold ${statusText[statusColor]}`}>{getYourAnswer()}</p>
              </div>
              <div className="bg-white rounded-lg border border-green-200 p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Correct Answer</p>
                <p className="text-base font-bold text-green-700">{getCorrectAnswer()}</p>
              </div>
            </div>

            {/* ── Solution image ── */}
            {active.solutionImage && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Solution</p>
                <div className="bg-white rounded-lg border border-gray-200 p-2">
                  <ImageWithSkeleton src={active.solutionImage} alt={`Solution ${originalIndex + 1}`} />
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ─── Memoized Graphical Analysis — never re-renders on section/filter changes ─

const CHART_COLORS_STATIC: Record<string, string> = {
  Physics: '#4F46E5',    // indigo
  Chemistry: '#059669',  // emerald
  Mathematics: '#7C3AED', // violet
  correct: '#059669',
  wrong: '#DC2626',
  unattempted: '#D97706',
  maxMarks: '#E5E7EB',
};
const PIE_COLORS_STATIC = ['#4F46E5', '#059669', '#7C3AED', '#D97706', '#DC2626', '#0EA5E9'];
const REMAINING_TIME_COLOR_STATIC = '#CBD5E1';

const GraphicalAnalysisSection = memo(function GraphicalAnalysisSection({ processedChartData, timeDistributionData, lineChartData, totalMarks }: {
  processedChartData: any[] | null;
  timeDistributionData: any[] | null;
  lineChartData: any[] | null;
  totalMarks: number;
}) {
  const C = CHART_COLORS_STATIC;

  const Tooltip_ = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="glass rounded-xl p-4 border border-border/50 shadow-lg">
        <p className="text-foreground font-medium">{label}</p>
        {payload.map((e: any, i: number) => <p key={i} style={{ color: e.color }} className="text-sm">{`${e.dataKey}: ${e.value}`}</p>)}
      </div>
    );
  };

  const PieTip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="glass rounded-xl p-4 border border-border/50 shadow-lg">
        <p className="text-foreground font-medium">{d.subject}</p>
        <p className="text-sm" style={{ color: payload[0].color }}>
          {payload[0].dataKey === 'accuracy' ? `Accuracy: ${d.accuracy}%` : `Time: ${d.timeMinutes} min`}
        </p>
      </div>
    );
  };

  const subjectAreas = useMemo(() => {
    const data = lineChartData || [];
    if (!data.length) return [];
    const areas: any[] = [];
    let cur: string | null = null, start: number | null = null;
    data.forEach((p, i) => {
      if (cur !== p.subject) {
        if (cur && start !== null) areas.push({ subject: cur, x1: start, x2: data[i - 1].questionNumber, color: C[cur] });
        cur = p.subject; start = p.questionNumber;
      }
    });
    if (cur && start !== null) areas.push({ subject: cur, x1: start, x2: data[data.length - 1].questionNumber, color: C[cur] });
    return areas;
  }, [lineChartData]);

  const makeDot = (dc: string) => (props: any) => {
    const { payload, cx, cy } = props;
    const color = payload?.isCorrect === true ? (C[payload?.subject] || dc) : payload?.isCorrect === false ? '#EF4444' : '#9CA3AF';
    return <circle cx={cx} cy={cy} r={4} fill={color} stroke={color} strokeWidth={2} />;
  };
  const makeActiveDot = (dc: string) => (props: any) => {
    const { payload, cx, cy } = props;
    const color = payload?.isCorrect === true ? (C[payload?.subject] || dc) : payload?.isCorrect === false ? '#EF4444' : '#9CA3AF';
    return <circle cx={cx} cy={cy} r={6} fill={color} stroke={color} strokeWidth={2} />;
  };

  const Legend_ = () => (
    <div className="flex justify-center gap-6 mt-4 pt-4 border-t border-border/20">
      {['Physics', 'Chemistry', 'Mathematics'].map((s) => (
        <div key={s} className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: C[s] }} />
          <span className="text-sm text-muted-foreground">{s}</span>
        </div>
      ))}
    </div>
  );

  return (
    <motion.section initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.6 }}>
      <div className="flex items-center gap-2 mb-6">
        <BarChart3 className="w-6 h-6 text-primary" />
        <h2 className="text-xl font-semibold text-foreground">Graphical Analysis</h2>
      </div>

      <div className="mb-8">
        <h3 className="text-lg font-medium text-foreground mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />Performance Overview
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Subject Performance */}
          <div className="glass rounded-2xl p-6 card-hover">
            <div className="flex items-center gap-2 mb-4"><BarChart3 className="w-5 h-5 text-primary" /><h3 className="text-lg font-semibold text-foreground">Subject Performance</h3></div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={processedChartData || undefined}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="subject" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                <Tooltip content={<Tooltip_ />} /><Legend />
                <Bar dataKey="correct" fill={C.correct} radius={[4,4,0,0]} />
                <Bar dataKey="wrong" fill={C.wrong} radius={[4,4,0,0]} />
                <Bar dataKey="unattempted" fill={C.unattempted} radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Subject Accuracy */}
          <div className="glass rounded-2xl p-6 card-hover">
            <div className="flex items-center gap-2 mb-4"><Target className="w-5 h-5 text-primary" /><h3 className="text-lg font-semibold text-foreground">Subject Accuracy</h3></div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={processedChartData || undefined}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="subject" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" domain={[0,100]} tickFormatter={(v: number) => `${v}%`} />
                <Tooltip content={<Tooltip_ />} /><Legend />
                <Bar dataKey="accuracy" fill="#06B6D4" radius={[4,4,0,0]} name="Accuracy %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Marks Distribution */}
          <div className="glass rounded-2xl p-6 card-hover">
            <div className="flex items-center gap-2 mb-4"><Award className="w-5 h-5 text-primary" /><h3 className="text-lg font-semibold text-foreground">Marks Distribution</h3></div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={processedChartData || undefined}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="subject" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip content={<Tooltip_ />} /><Legend />
                <Bar dataKey="marks" fill="#10B981" radius={[4,4,0,0]} name="Obtained Marks" />
                <Bar dataKey="maxMarks" fill={C.maxMarks} radius={[4,4,0,0]} name="Maximum Marks" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Time Spent */}
          <div className="glass rounded-2xl p-6 card-hover">
            <div className="flex items-center gap-2 mb-4"><Clock className="w-5 h-5 text-primary" /><h3 className="text-lg font-semibold text-foreground">Time Spent Distribution</h3></div>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={timeDistributionData || undefined} cx="50%" cy="50%" labelLine={false} label={({ subject, timeMinutes }: any) => `${subject}: ${timeMinutes}min`} outerRadius={80} dataKey="timeMinutes">
                  {timeDistributionData?.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.isRemainingTime ? REMAINING_TIME_COLOR_STATIC : PIE_COLORS_STATIC[index % PIE_COLORS_STATIC.length]} />
                  ))}
                </Pie>
                <Tooltip content={<PieTip />} />
                <Legend formatter={(_: any, entry: any) => entry.payload.subject} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-lg font-medium text-foreground mb-4 flex items-center gap-2">
          <TrendingUpIcon className="w-5 h-5 text-primary" />Detailed Analysis
        </h3>
        <div className="grid grid-cols-1 gap-6">
          {/* Score vs Question */}
          <div className="glass rounded-2xl p-6 card-hover">
            <div className="flex items-center gap-2 mb-4"><TrendingUpIcon className="w-5 h-5 text-primary" /><h3 className="text-lg font-semibold text-foreground">Score vs Question Number</h3></div>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={lineChartData || undefined}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                {subjectAreas.map((a: any, i: number) => <ReferenceArea key={i} x1={a.x1} x2={a.x2} fill={a.color} fillOpacity={0.1} stroke="none" />)}
                <XAxis dataKey="questionNumber" stroke="hsl(var(--muted-foreground))" domain={[1,'dataMax']} />
                <YAxis stroke="hsl(var(--muted-foreground))" domain={[0, totalMarks]} />
                <Tooltip content={({ active, payload, label }: any) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return <div className="glass rounded-xl p-4 border border-border/50 shadow-lg"><p className="text-foreground font-medium">Question {label}</p><p className="text-sm" style={{ color: C[d.subject] }}>Subject: {d.subject}</p><p className="text-sm">Cumulative Score: {d.cumulativeMarks}</p><p className="text-sm">This Question: {d.marks > 0 ? '+' : ''}{d.marks}</p></div>;
                }} />
                <Line type="monotone" dataKey="cumulativeMarks" stroke="#06B6D4" strokeWidth={3} dot={makeDot('#3B82F6')} activeDot={makeActiveDot('#3B82F6')} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
            <Legend_ />
          </div>
          {/* Accuracy Progression */}
          <div className="glass rounded-2xl p-6 card-hover">
            <div className="flex items-center gap-2 mb-4"><Target className="w-5 h-5 text-primary" /><h3 className="text-lg font-semibold text-foreground">Accuracy Progression During Test</h3></div>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={lineChartData || undefined}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                {subjectAreas.map((a: any, i: number) => <ReferenceArea key={i} x1={a.x1} x2={a.x2} fill={a.color} fillOpacity={0.1} stroke="none" />)}
                <XAxis dataKey="questionNumber" stroke="hsl(var(--muted-foreground))" domain={[1,'dataMax']} />
                <YAxis stroke="hsl(var(--muted-foreground))" domain={[0,100]} tickFormatter={(v: number) => `${v}%`} />
                <Tooltip content={({ active, payload, label }: any) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return <div className="glass rounded-xl p-4 border border-border/50 shadow-lg"><p className="text-foreground font-medium">After Question {label}</p><p className="text-sm" style={{ color: C[d.subject] }}>Subject: {d.subject}</p><p className="text-sm">Overall Accuracy: {d.accuracy}%</p><p className="text-sm">This Question: {d.isCorrect === true ? 'Correct ✅' : d.isCorrect === false ? 'Wrong ❌' : 'Unattempted ⏸️'}</p></div>;
                }} />
                <Line type="monotone" dataKey="accuracy" stroke="#06B6D4" strokeWidth={3} dot={makeDot('#10B981')} activeDot={makeActiveDot('#10B981')} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
            <Legend_ />
          </div>
          {/* Time per Question */}
          <div className="glass rounded-2xl p-6 card-hover">
            <div className="flex items-center gap-2 mb-4"><Clock className="w-5 h-5 text-primary" /><h3 className="text-lg font-semibold text-foreground">Time Spent per Question</h3></div>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={lineChartData || undefined}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                {subjectAreas.map((a: any, i: number) => <ReferenceArea key={i} x1={a.x1} x2={a.x2} fill={a.color} fillOpacity={0.1} stroke="none" />)}
                <XAxis dataKey="questionNumber" stroke="hsl(var(--muted-foreground))" domain={[1,'dataMax']} />
                <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(v: number) => `${v}s`} />
                <Tooltip content={({ active, payload, label }: any) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return <div className="glass rounded-xl p-4 border border-border/50 shadow-lg"><p className="text-foreground font-medium">Question {label}</p><p className="text-sm" style={{ color: C[d.subject] }}>Subject: {d.subject}</p><p className="text-sm">Time Spent: {d.timeSpent} seconds</p><p className="text-sm">Result: {d.isCorrect === true ? 'Correct ✅' : d.isCorrect === false ? 'Wrong ❌' : 'Unattempted ⏸️'}</p></div>;
                }} />
                <Line type="monotone" dataKey="timeSpent" stroke="#06B6D4" strokeWidth={3} dot={makeDot('#8B5CF6')} activeDot={makeActiveDot('#8B5CF6')} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
            <Legend_ />
          </div>
        </div>
      </div>
    </motion.section>
  );
});

export default function AnalysePage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const [attempt, setAttempt] = useState<any>(null);
  const [selectedSection, setSelectedSection] = useState(0);
  const [analysisFilter, setAnalysisFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    attemptAPI.getAttempt(attemptId).then((res: any) => {
      setAttempt(res.data);
      const t = setTimeout(() => setLoading(false), 800);
      return () => clearTimeout(t);
    }).catch(() => setLoading(false));
  }, [attemptId]);

  const getAnswerForQuestion = (questionId: string) =>
    attempt?.answers?.find((a: any) => a.questionId === questionId);

  const getFilteredQuestions = (sectionQuestions: any[]) => {
    if (analysisFilter === 'all') return sectionQuestions;
    return sectionQuestions.filter((question) => {
      const answer = getAnswerForQuestion(question.id);
      const isCorrect = answer?.isCorrect;
      if (analysisFilter === 'wrong') return isCorrect === false;
      if (analysisFilter === 'unattempted') return isCorrect === null;
      return true;
    });
  };

  const getSectionStats = (sectionQuestions: any[]) => {
    const stats = { total: sectionQuestions.length, correct: 0, wrong: 0, unattempted: 0, marks: 0, totalTime: 0 };
    sectionQuestions.forEach((question) => {
      const answer = getAnswerForQuestion(question.id);
      if (answer && answer.isCorrect !== null) {
        if (answer.isCorrect === true) { stats.correct++; stats.marks += answer.marksAwarded; }
        else if (answer.isCorrect === false) { stats.wrong++; stats.marks += answer.marksAwarded; }
      } else { stats.unattempted++; }
      if (answer && answer.timeSpent) stats.totalTime += answer.timeSpent;
    });
    const attemptedQuestions = stats.correct + stats.wrong;
    const accuracy = attemptedQuestions > 0 ? ((stats.correct / attemptedQuestions) * 100).toFixed(1) : '0.0';
    return { ...stats, accuracy };
  };

  const getOverallStats = () => {
    if (!attempt) return null;
    const stats = {
      total: 0, correct: 0, wrong: 0, unattempted: 0,
      totalMarks: attempt.totalMarks, maxMarks: attempt.test.totalMarks,
      percentage: ((attempt.totalMarks / attempt.test.totalMarks) * 100).toFixed(1),
      accuracy: '0.0'
    };
    attempt.test.sections.forEach((section: any) => {
      const ss = getSectionStats(section.questions);
      stats.total += ss.total; stats.correct += ss.correct;
      stats.wrong += ss.wrong; stats.unattempted += ss.unattempted;
    });
    const attempted = stats.correct + stats.wrong;
    stats.accuracy = attempted > 0 ? ((stats.correct / attempted) * 100).toFixed(1) : '0.0';
    return stats;
  };

  const subjectGroups = useMemo(() =>
    attempt?.test?.enableGraphicalAnalysis && attempt?.test?.sections
      ? groupSectionsBySubject(attempt.test.sections, attempt.answers)
      : null,
    [attempt]);

  const processedChartData = useMemo(() =>
    subjectGroups ? Object.values(subjectGroups).map((s: any) => ({
      subject: s.name, correct: s.stats.correct, wrong: s.stats.wrong,
      unattempted: s.stats.unattempted, accuracy: parseFloat(s.stats.accuracy.toFixed(1)),
      marks: s.stats.marks, maxMarks: s.stats.maxMarks,
      timeMinutes: Math.round(s.stats.totalTime / 60)
    })) : null,
    [subjectGroups]);

  const timeDistributionData = useMemo(() => {
    if (!processedChartData || !attempt?.test?.duration) return null;
    const totalUsed = processedChartData.reduce((sum: number, s: any) => sum + s.timeMinutes, 0);
    const remaining = Math.max(0, attempt.test.duration - totalUsed);
    const data: any[] = [...processedChartData];
    if (remaining > 0) data.push({ subject: 'Remaining Time', timeMinutes: remaining, isRemainingTime: true });
    return data;
  }, [processedChartData, attempt]);

  const lineChartData = useMemo(() => {
    if (!attempt?.test?.sections) return null;
    const questionData = generateQuestionWiseData(attempt.test.sections, attempt.answers);
    let cumulativeMarks = 0, cumulativeCorrect = 0, cumulativeAttempted = 0;
    return questionData.map((q: any) => {
      cumulativeMarks += q.marks;
      if (q.isCorrect !== null) { cumulativeAttempted++; if (q.isCorrect === true) cumulativeCorrect++; }
      const accuracy = cumulativeAttempted > 0 ? (cumulativeCorrect / cumulativeAttempted) * 100 : 0;
      return { ...q, cumulativeMarks, accuracy: parseFloat(accuracy.toFixed(1)) };
    });
  }, [attempt]);

  // chart constants and helpers no longer needed inline — moved to GraphicalAnalysisSection above

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-16 h-16 rounded-full border-4 border-gray-200 border-t-blue-600 mx-auto mb-6" />
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <p className="text-xl font-medium text-foreground">Analyzing your performance...</p>
            <p className="text-muted-foreground mt-2">Preparing detailed insights</p>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Failed to load test analysis</p>
          <button onClick={() => window.close()} className="bg-blue-600 text-white px-4 py-2 rounded">Close</button>
        </div>
      </div>
    );
  }

  const overallStats = getOverallStats();
  const currentSection = attempt.test.sections[selectedSection];
  const filteredQuestions = getFilteredQuestions(currentSection.questions);
  const sectionStats = getSectionStats(currentSection.questions);
  const jeeStats = getDetailedJeeMainsStats(overallStats?.totalMarks || 0);

  const statCards = [
    { label: 'Total Questions', value: overallStats?.total || 0, icon: BookOpen, color: 'primary' },
    { label: 'Correct', value: overallStats?.correct || 0, icon: CheckCircle2, color: 'success' },
    { label: 'Wrong', value: overallStats?.wrong || 0, icon: XCircle, color: 'error' },
    { label: 'Unattempted', value: overallStats?.unattempted || 0, icon: MinusCircle, color: 'warning' },
    { label: 'Accuracy', value: `${overallStats?.accuracy}%`, icon: Target, color: 'info' },
  ];

  const getColorClasses = (color: string) => {
    const map: Record<string, { text: string; light: string }> = {
      primary: { text: 'text-primary', light: 'bg-primary/10' },
      success: { text: 'text-success', light: 'bg-success-light' },
      error:   { text: 'text-error',   light: 'bg-error-light' },
      warning: { text: 'text-warning', light: 'bg-warning-light' },
      info:    { text: 'text-info',    light: 'bg-info-light' },
    };
    return map[color] || map.primary;
  };

  return (
    <div className="min-h-screen bg-background analysis-page" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: '400' }}>
      {/* Subtle background pattern */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/4 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple/4 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="relative glass-strong border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-foreground">{attempt.test.name}</h1>
                <p className="text-muted-foreground text-sm">Analysis Report • {attempt.candidateName}</p>
              </div>
            </div>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="flex items-center gap-4">
              <div className="text-right">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                  className="text-3xl sm:text-4xl font-bold gradient-text">
                  {overallStats?.totalMarks}/{overallStats?.maxMarks}
                </motion.div>
                <p className="text-sm text-muted-foreground">{overallStats?.percentage}% Score</p>
              </div>
              <motion.div whileHover={{ rotate: 10 }}
                className="hidden sm:flex w-14 h-14 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 items-center justify-center shadow-lg">
                <Trophy className="w-7 h-7 text-white" />
              </motion.div>
            </motion.div>
          </div>
        </div>
      </motion.header>

      <main className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Overall Performance */}
        <motion.section initial={{ opacity: 1 }} animate={{ opacity: 1 }}>
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">Overall Performance</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {statCards.map((stat, index) => {
              const colorClasses = getColorClasses(stat.color);
              return (
                <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + index * 0.05 }} whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  className="glass rounded-2xl p-5 card-hover cursor-default">
                  <div className={`w-10 h-10 rounded-xl ${colorClasses.light} flex items-center justify-center mb-3`}>
                    <stat.icon className={`w-5 h-5 ${colorClasses.text}`} />
                  </div>
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + index * 0.05 }}
                    className={`text-2xl sm:text-3xl font-bold ${colorClasses.text}`}>
                    {stat.value}
                  </motion.div>
                  <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* JEE Mains Prediction */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="relative overflow-hidden rounded-2xl">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-info/10 to-purple/10" />
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-card/50" />
          <div className="relative glass rounded-2xl p-6 sm:p-8 border-2 border-primary/20">
            <div className="flex items-center gap-2 mb-6">
              <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}>
                <Award className="w-6 h-6 text-primary" />
              </motion.div>
              <h2 className="text-xl font-semibold text-foreground">JEE Mains Expected Performance</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <motion.div whileHover={{ scale: 1.02 }} className="bg-card/80 rounded-xl p-6 text-center shadow-soft">
                <Trophy className="w-8 h-8 text-primary mx-auto mb-3" />
                <div className="text-3xl sm:text-4xl font-bold text-primary mb-1">{overallStats?.totalMarks}</div>
                <p className="text-sm text-muted-foreground font-medium">Your Score</p>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} className="bg-card/80 rounded-xl p-6 text-center shadow-soft">
                <TrendingUp className="w-8 h-8 text-success mx-auto mb-3" />
                <div className="text-2xl sm:text-3xl font-bold text-success mb-1">
                  {(jeeStats as any).estimatedPercentile || (jeeStats as any).percentileRange}
                </div>
                <p className="text-sm text-muted-foreground font-medium">
                  {(jeeStats as any).estimatedPercentile ? 'Estimated Percentile' : 'Expected Percentile'}
                </p>
                {(jeeStats as any).estimatedPercentile && (
                  <p className="text-xs text-muted-foreground mt-1">Range: {(jeeStats as any).percentileRange}</p>
                )}
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} className="bg-card/80 rounded-xl p-6 text-center shadow-soft">
                <Trophy className="w-8 h-8 text-purple mx-auto mb-3" />
                <div className="text-2xl sm:text-3xl font-bold text-purple mb-1">
                  {(jeeStats as any).estimatedRank || (jeeStats as any).rankRange}
                </div>
                <p className="text-sm text-muted-foreground font-medium">
                  {(jeeStats as any).estimatedRank ? 'Estimated AIR' : 'Expected AIR Range'}
                </p>
                {(jeeStats as any).estimatedRank && (
                  <p className="text-xs text-muted-foreground mt-1">Range: {(jeeStats as any).rankRange}</p>
                )}
              </motion.div>
            </div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
              className="mt-6 p-4 bg-warning/10 border border-warning/30 rounded-xl">
              <p className="text-sm text-foreground/80">
                <span className="font-semibold text-warning">Note:</span> These are estimated values based on previous JEE Mains data.
                Actual results may vary depending on exam difficulty and overall performance.
              </p>
            </motion.div>
          </div>
        </motion.section>

        {/* Graphical Analysis — memoized so section/filter changes don't re-render charts */}
        {attempt?.test?.enableGraphicalAnalysis && subjectGroups && Object.keys(subjectGroups).length > 1 && (
          <GraphicalAnalysisSection
            processedChartData={processedChartData}
            timeDistributionData={timeDistributionData}
            lineChartData={lineChartData}
            totalMarks={attempt?.test?.totalMarks || 300}
          />
        )}

        {/* Section Analysis + Questions — unified panel */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">Section Analysis</h2>
          </div>

          <div className="glass rounded-2xl overflow-hidden">
            {/* Section tab bar */}
            <div className="flex overflow-x-auto border-b border-border/30 bg-secondary/30">
              {attempt.test.sections.map((section: any, index: number) => {
                const stats = getSectionStats(section.questions);
                const isSelected = selectedSection === index;
                return (
                  <button
                    key={section.id}
                    onClick={() => { setSelectedSection(index); setAnalysisFilter('all'); }}
                    className={`flex-shrink-0 px-5 py-3.5 text-sm font-medium border-b-2 transition-all ${
                      isSelected
                        ? 'border-primary text-primary bg-background'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                    }`}
                  >
                    {section.name}
                    <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                      {stats.correct}/{stats.total}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="p-6">
              {/* Section stat pills */}
              <div className="flex flex-wrap gap-2 mb-5">
                {[
                  { label: 'Total', value: sectionStats.total, cls: 'bg-blue-50 text-blue-700' },
                  { label: 'Correct', value: sectionStats.correct, cls: 'bg-green-50 text-green-700' },
                  { label: 'Wrong', value: sectionStats.wrong, cls: 'bg-red-50 text-red-700' },
                  { label: 'Unattempted', value: sectionStats.unattempted, cls: 'bg-amber-50 text-amber-700' },
                  { label: 'Marks', value: sectionStats.marks, cls: 'bg-indigo-50 text-indigo-700' },
                  { label: 'Accuracy', value: `${sectionStats.accuracy}%`, cls: 'bg-purple-50 text-purple-700' },
                  { label: 'Time', value: formatTime(sectionStats.totalTime), cls: 'bg-gray-100 text-gray-700' },
                ].map((s) => (
                  <div key={s.label} className={`${s.cls} rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5`}>
                    <span className="opacity-60">{s.label}</span>
                    <span>{s.value}</span>
                  </div>
                ))}
              </div>

              {/* Filter toggle */}
              <div className="flex gap-2 mb-6">
                {[
                  { key: 'all', label: 'All', count: currentSection.questions.length },
                  { key: 'wrong', label: 'Wrong', count: sectionStats.wrong },
                  { key: 'unattempted', label: 'Unattempted', count: sectionStats.unattempted },
                ].map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setAnalysisFilter(f.key)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition border ${
                      analysisFilter === f.key
                        ? f.key === 'wrong'
                          ? 'bg-red-500 text-white border-red-500'
                          : f.key === 'unattempted'
                          ? 'bg-amber-400 text-white border-amber-400'
                          : 'bg-primary text-primary-foreground border-primary'
                        : 'bg-secondary text-muted-foreground border-transparent hover:bg-secondary/80'
                    }`}
                  >
                    {f.label}
                    <span className="ml-1.5 opacity-70 text-xs">({f.count})</span>
                  </button>
                ))}
              </div>

              {/* Question carousel */}
              {filteredQuestions.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-3">{analysisFilter === 'wrong' ? '🎉' : '👍'}</div>
                  <p className="font-medium text-foreground">
                    {analysisFilter === 'wrong' ? 'No wrong answers in this section!' : 'All questions were attempted!'}
                  </p>
                </div>
              ) : (
                <QuestionCarousel
                  key={`${selectedSection}-${analysisFilter}`}
                  questions={filteredQuestions}
                  currentSection={currentSection}
                  getAnswerForQuestion={getAnswerForQuestion}
                />
              )}
            </div>
          </div>
        </section>

        {/* Footer */}
        <motion.footer initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          className="text-center py-8 text-muted-foreground text-sm">
          <p>Keep practicing and improving! 🚀</p>
        </motion.footer>
      </main>
    </div>
  );
}
