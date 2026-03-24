'use client';
import { useState, useEffect, useRef } from 'react';
import { testAPI, attemptAPI } from '../../../services/api';

import { detectMultipleSubjects } from '../../../utils/subjectUtils';
import Modal from '../../../components/Modal';
import BulkSelectionErrorModal from '../../../components/BulkSelectionErrorModal';

const ChevronDown = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>;
const ChevronRight = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>;

interface Question { id: string; questionImage: File | string | null; solutionImage: File | string | null; correctOption: string; correctOptions: string[]; correctInteger: string }
interface Section { name: string; questionType: string; marks: number; negativeMarks: number; questions: Question[]; isExpanded: boolean }

// Track which ImageInput is the last one interacted with, for paste targeting
let lastActiveImageInput: ((file: File) => void) | null = null;

// Inline image input - preview is fully local, no parent state sync issues
function ImageInput({ value, onChange, label }: { value: File | string | null; onChange: (v: File | null) => void; label: string }) {
  const [preview, setPreview] = useState<string | null>(() => typeof value === 'string' ? value : null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const currentFileRef = useRef<File | null>(value instanceof File ? value : null);

  // Sync preview when value changes externally (bulk selection, edit load)
  useEffect(() => {
    if (!value) {
      setPreview(null); currentFileRef.current = null;
    } else if (typeof value === 'string') {
      setPreview(value); currentFileRef.current = null;
    } else if (value instanceof File && value !== currentFileRef.current) {
      currentFileRef.current = value;
      setPreview(URL.createObjectURL(value));
    }
  }, [value]);

  // Register global paste listener once
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (lastActiveImageInput !== pickRef.current) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) { e.preventDefault(); pickRef.current(file); break; }
        }
      }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    currentFileRef.current = file;
    setPreview(URL.createObjectURL(file));
    onChange(file);
  };
  const pickRef = useRef(pick);
  pickRef.current = pick;

  const clear = () => { setPreview(null); currentFileRef.current = null; onChange(null); if (inputRef.current) inputRef.current.value = ''; };

  return (
    <div onMouseEnter={() => { lastActiveImageInput = pickRef.current; }}>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      {preview ? (
        <div className="relative">
          <img src={preview} alt={label} className="w-full h-28 object-contain border border-gray-300 rounded bg-white" />
          <button type="button" onClick={clear} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600 leading-none">×</button>
        </div>
      ) : (
        <div
          className={`border-2 border-dashed rounded-lg p-3 text-center ${drag ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) pick(f); }}
        >
          <svg className="mx-auto h-6 w-6 text-gray-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-xs text-gray-500 mb-2">Drag & drop or Ctrl+V to paste</p>
          <button type="button" onClick={() => inputRef.current?.click()} className="bg-blue-500 text-white px-3 py-1 rounded text-xs hover:bg-blue-600">Browse Files</button>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); }} />
        </div>
      )}
    </div>
  );
}

export default function TestCreator() {
  const [testName, setTestName] = useState('');
  const [duration, setDuration] = useState({ hours: 3, minutes: 0 });
  const [enableGraphicalAnalysis, setEnableGraphicalAnalysis] = useState(true);
  const [sections, setSections] = useState<Section[]>([{ name: 'Physics', questionType: 'SINGLE_CORRECT', marks: 4, negativeMarks: -1, questions: [], isExpanded: false }]);
  const [tests, setTests] = useState<any[]>([]);
  const [resumeRequests, setResumeRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saveDraftLoading, setSaveDraftLoading] = useState(false);
  const [createTestLoading, setCreateTestLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [editingTest, setEditingTest] = useState<any>(null);
  const [editMode, setEditMode] = useState<'create' | 'edit' | 'continue'>('create');
  const [modal, setModal] = useState({ show: false, title: '', message: '', type: 'info' });
  const [confirmModal, setConfirmModal] = useState<{ show: boolean; title: string; message: string; onConfirm: (() => void) | null }>({ show: false, title: '', message: '', onConfirm: null });
  const [bulkErrorModal, setBulkErrorModal] = useState<{ show: boolean; error: any }>({ show: false, error: null });
  const [activeTab, setActiveTab] = useState('create');
  const [recalculatingTest, setRecalculatingTest] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    fetchTests(); fetchResumeRequests();
    const interval = setInterval(() => { if (isMountedRef.current) fetchResumeRequests(); }, 10000);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'd') { e.preventDefault(); const btn = document.querySelector<HTMLButtonElement>('[data-save-draft-button]'); if (btn && !btn.disabled) btn.click(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => { isMountedRef.current = false; clearInterval(interval); document.removeEventListener('keydown', handleKeyDown); };
  }, [activeTab]);

  useEffect(() => { setEnableGraphicalAnalysis(detectMultipleSubjects(sections)); }, [sections]);

  const fetchTests = async () => {
    try { if (!isMountedRef.current) return; const res = await testAPI.getAllTests(); if (isMountedRef.current) setTests(res.data); }
    catch (error: any) { if (isMountedRef.current) setModal({ show: true, title: 'Connection Error', message: error.userMessage || 'Failed to load tests.', type: 'error' }); }
  };

  const fetchResumeRequests = async () => {
    try { if (!isMountedRef.current) return; const res = await attemptAPI.getResumeRequests(); if (isMountedRef.current) setResumeRequests(res.data); }
    catch {}
  };

  const handleAllowResume = async (attemptId: string) => {
    try { await attemptAPI.allowResume({ attemptId }); fetchResumeRequests(); fetchTests(); setModal({ show: true, title: 'Success', message: 'Resume permission granted!', type: 'success' }); }
    catch (error: any) { setModal({ show: true, title: 'Error', message: error.userMessage || 'Failed to grant resume permission.', type: 'error' }); }
  };

  const addSection = () => setSections([...sections, { name: `Section ${sections.length + 1}`, questionType: 'SINGLE_CORRECT', marks: 4, negativeMarks: -1, questions: [], isExpanded: false }]);
  const updateSection = (i: number, field: string, value: any) => { const s = [...sections]; (s[i] as any)[field] = value; setSections(s); };
  const toggleSectionExpanded = (i: number) => setSections(sections.map((s, idx) => ({ ...s, isExpanded: idx === i ? !s.isExpanded : false })));
  const deleteSection = (i: number) => {
    if (sections.length <= 1) { setModal({ show: true, title: 'Cannot Delete', message: 'At least one section is required', type: 'warning' }); return; }
    setSections(sections.filter((_, idx) => idx !== i));
  };
  const addQuestion = (si: number) => { const s = [...sections]; s[si].questions.push({ id: `q-${Date.now()}-${Math.random()}`, questionImage: null, solutionImage: null, correctOption: 'A', correctOptions: [], correctInteger: '' }); setSections(s); };
  const updateQuestion = (si: number, qi: number, field: string, value: any) => setSections(sections.map((s, sIdx) => sIdx !== si ? s : { ...s, questions: s.questions.map((q, qIdx) => qIdx !== qi ? q : { ...q, [field]: value }) }));
  const deleteQuestion = (si: number, qi: number) => { const s = [...sections]; s[si].questions = s[si].questions.filter((_, i) => i !== qi); setSections(s); };

  const validateBulkSelection = (files: File[], expectedCount: number) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const invalid = files.filter((f) => !allowed.includes(f.type));
    if (files.length !== expectedCount && invalid.length > 0) return { type: 'mixedErrors', expectedCount, actualCount: files.length, invalidFiles: invalid.map((f) => f.name) };
    if (files.length !== expectedCount) return { type: 'wrongCount', expectedCount, actualCount: files.length };
    if (invalid.length > 0) return { type: 'invalidFileType', invalidFiles: invalid.map((f) => f.name) };
    return null;
  };

  const handleBulkSelection = (si: number, field: 'questionImage' | 'solutionImage') => {
    const input = document.createElement('input'); input.type = 'file'; input.multiple = true; input.accept = 'image/*';
    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      const err = validateBulkSelection(files, sections[si].questions.length);
      if (err) { setBulkErrorModal({ show: true, error: err }); return; }
      const s = [...sections]; files.forEach((f, i) => { if (i < s[si].questions.length) (s[si].questions[i] as any)[field] = f; }); setSections(s);
    };
    input.click();
  };

  const buildFormData = (isDraft: boolean) => {
    const fd = new FormData();
    fd.append('name', testName);
    fd.append('duration', String(duration.hours * 60 + duration.minutes));
    fd.append('isDraft', String(isDraft));
    fd.append('enableGraphicalAnalysis', String(enableGraphicalAnalysis));
    const cleanSections = sections.map((s) => ({ name: s.name, questionType: s.questionType, marks: s.marks ?? 4, negativeMarks: s.negativeMarks ?? -1, questions: s.questions.map(({ id, ...q }) => ({ ...q, correctOptions: q.correctOptions || null, questionImage: typeof q.questionImage === 'string' ? q.questionImage : null, solutionImage: typeof q.solutionImage === 'string' ? q.solutionImage : null })) }));
    fd.append('sections', JSON.stringify(cleanSections));
    sections.forEach((s, si) => s.questions.forEach((q, qi) => {
      if (q.questionImage instanceof File) fd.append(`sections[${si}].questions[${qi}].questionImage`, q.questionImage);
      if (q.solutionImage instanceof File) fd.append(`sections[${si}].questions[${qi}].solutionImage`, q.solutionImage);
    }));
    return fd;
  };

  const onProgress = (e: import('axios').AxiosProgressEvent) => setUploadProgress(Math.round(((e.loaded ?? 0) * 100) / (e.total ?? 1)));

  const saveDraft = async () => {
    if (!testName.trim()) { setModal({ show: true, title: 'Validation Error', message: 'Please enter test name', type: 'warning' }); return; }
    setSaveDraftLoading(true); setLoading(true);
    try {
      const fd = buildFormData(true);
      if (editingTest) {
        const res = await testAPI.updateTest(editingTest.id, fd, onProgress);
        setModal({ show: true, title: 'Success', message: 'Draft saved successfully!', type: 'success' });
        fetchTests();
        if (res.data) {
          const t = res.data; setTestName(t.name); setDuration({ hours: Math.floor(t.duration / 60), minutes: t.duration % 60 });
          setSections(t.sections.map((s: any) => ({ name: s.name, questionType: s.questionType, marks: s.questions[0]?.marks ?? 4, negativeMarks: s.questions[0]?.negativeMarks ?? -1, isExpanded: false, questions: s.questions.map((q: any, i: number) => ({ id: q.id || `q-${Date.now()}-${i}`, questionImage: q.questionImage, solutionImage: q.solutionImage, correctOption: q.correctOption, correctOptions: q.correctOptions ? (typeof q.correctOptions === 'string' ? q.correctOptions.split(',') : q.correctOptions) : [], correctInteger: q.correctInteger?.toString() || '' })) })));
        }
      } else { await testAPI.saveDraft(fd, onProgress); setModal({ show: true, title: 'Success', message: 'Draft saved successfully!', type: 'success' }); resetForm(); fetchTests(); }
    } catch (error: any) { setModal({ show: true, title: 'Error', message: error.userMessage || 'Failed to save draft.', type: 'error' }); }
    finally { setSaveDraftLoading(false); setLoading(false); setUploadProgress(0); }
  };

  const createTest = async () => {
    if (!testName.trim()) { setModal({ show: true, title: 'Validation Error', message: 'Please enter test name', type: 'warning' }); return; }
    if (sections.some((s) => s.questions.length === 0)) { setModal({ show: true, title: 'Validation Error', message: 'Each section must have at least one question', type: 'warning' }); return; }
    for (let si = 0; si < sections.length; si++) {
      const s = sections[si];
      for (let qi = 0; qi < s.questions.length; qi++) {
        const q = s.questions[qi];
        if (!q.questionImage) { setModal({ show: true, title: 'Validation Error', message: `Question ${qi + 1} in ${s.name} is missing a question image`, type: 'warning' }); return; }
        if (!q.solutionImage) { setModal({ show: true, title: 'Validation Error', message: `Question ${qi + 1} in ${s.name} is missing a solution image`, type: 'warning' }); return; }
        if ((s.questionType === 'SINGLE_CORRECT' || s.questionType === 'MATRIX_MATCH') && !q.correctOption) { setModal({ show: true, title: 'Validation Error', message: `Question ${qi + 1} in ${s.name} is missing the correct option`, type: 'warning' }); return; }
        if (s.questionType === 'MULTIPLE_CORRECT' && (!q.correctOptions || q.correctOptions.length === 0)) { setModal({ show: true, title: 'Validation Error', message: `Question ${qi + 1} in ${s.name} is missing correct options`, type: 'warning' }); return; }
        if (s.questionType === 'INTEGER' && !q.correctInteger && q.correctInteger !== '0') { setModal({ show: true, title: 'Validation Error', message: `Question ${qi + 1} in ${s.name} is missing the correct integer answer`, type: 'warning' }); return; }
      }
    }
    setCreateTestLoading(true); setLoading(true);
    try {
      const fd = buildFormData(false);
      if (editingTest) { await testAPI.updateTest(editingTest.id, fd, onProgress); setModal({ show: true, title: 'Success', message: editMode === 'continue' ? 'Test created successfully!' : 'Test updated successfully!', type: 'success' }); }
      else { await testAPI.createTest(fd, onProgress); setModal({ show: true, title: 'Success', message: 'Test created successfully!', type: 'success' }); }
      resetForm(); fetchTests();
    } catch (error: any) { setModal({ show: true, title: 'Error', message: error.userMessage || 'Failed to save test.', type: 'error' }); }
    finally { setCreateTestLoading(false); setLoading(false); setUploadProgress(0); }
  };

  const resetForm = () => { setTestName(''); setDuration({ hours: 3, minutes: 0 }); setEnableGraphicalAnalysis(true); setSections([{ name: 'Physics', questionType: 'SINGLE_CORRECT', marks: 4, negativeMarks: -1, questions: [], isExpanded: false }]); setEditingTest(null); setEditMode('create'); setSaveDraftLoading(false); setCreateTestLoading(false); setLoading(false); setUploadProgress(0); };

  const loadTestIntoForm = (test: any, mode: 'edit' | 'continue') => {
    setEditingTest(test); setEditMode(mode); setTestName(test.name); setDuration({ hours: Math.floor(test.duration / 60), minutes: test.duration % 60 }); setEnableGraphicalAnalysis(test.enableGraphicalAnalysis ?? true);
    setSections(test.sections.map((s: any) => ({ name: s.name, questionType: s.questionType, marks: s.questions[0]?.marks ?? 4, negativeMarks: s.questions[0]?.negativeMarks ?? -1, isExpanded: false, questions: s.questions.map((q: any, i: number) => ({ id: q.id || `q-${Date.now()}-${i}`, questionImage: q.questionImage, solutionImage: q.solutionImage, correctOption: q.correctOption, correctOptions: q.correctOptions ? (typeof q.correctOptions === 'string' ? q.correctOptions.split(',') : q.correctOptions) : [], correctInteger: q.correctInteger?.toString() || '' })) })));
    setActiveTab('create'); setSaveDraftLoading(false); setCreateTestLoading(false); setLoading(false); setUploadProgress(0);
  };

  const toggleTestLive = async (testId: string, current: boolean) => {
    try { await testAPI.toggleTestLive(testId, !current); fetchTests(); }
    catch (error: any) { setModal({ show: true, title: 'Error', message: error.userMessage || 'Failed to update test status.', type: 'error' }); }
  };

  const deleteTest = (testId: string) => {
    setConfirmModal({ show: true, title: 'Delete Test', message: 'Are you sure you want to permanently delete this test and all related data?', onConfirm: async () => {
      try { const res = await testAPI.deleteTest(testId); fetchTests(); setConfirmModal({ show: false, title: '', message: '', onConfirm: null }); const d = res.data.deletedData; setModal({ show: true, title: 'Deleted', message: `Deleted "${d.testName}": ${d.sections} sections, ${d.questions} questions, ${d.studentAttempts} attempts.`, type: 'success' }); }
      catch (error: any) { setConfirmModal({ show: false, title: '', message: '', onConfirm: null }); setModal({ show: true, title: 'Error', message: error.userMessage || 'Failed to delete test.', type: 'error' }); }
    }});
  };

  const handleRecalculate = async (test: any) => {
    const completed = test.attempts?.filter((a: any) => a.isCompleted) || [];
    if (completed.length === 0) { setModal({ show: true, title: 'No Attempts', message: 'No completed attempts to recalculate.', type: 'warning' }); return; }
    if (!window.confirm(`Recalculate marks for ${completed.length} attempt(s) of "${test.name}"?`)) return;
    setRecalculatingTest(test.id);
    try {
      const results = await Promise.all(completed.map((a: any) => attemptAPI.recalculateMarks(a.id).then((r) => ({ candidateName: a.candidateName, ...r.data }))));
      const total = results.reduce((s: number, r: any) => s + r.difference, 0);
      setModal({ show: true, title: 'Recalculation Complete', message: `Recalculated ${results.length} attempt(s). Total change: ${total >= 0 ? '+' : ''}${total} marks`, type: 'success' });
      fetchTests();
    } catch (error: any) { setModal({ show: true, title: 'Error', message: error.response?.data?.error || 'Failed to recalculate.', type: 'error' }); }
    finally { setRecalculatingTest(null); }
  };

  const categorize = () => ({
    pendingTests: tests.filter((t) => t.isDraft),
    newTests: tests.filter((t) => !t.isDraft && !t.isLive && (!t.attempts || t.attempts.length === 0)),
    liveTests: tests.filter((t) => t.isLive),
    attemptedTests: tests.filter((t) => !t.isLive && !t.isDraft && t.attempts?.some((a: any) => a.isCompleted)),
  });
  const { pendingTests, newTests, liveTests, attemptedTests } = categorize();
  const getResumeRequestsForTest = (testId: string) => resumeRequests.filter((r) => r.test.id === testId);

  const renderTestCard = (test: any, actions: React.ReactNode) => {
    const completedAttempts = test.attempts?.filter((a: any) => a.isCompleted) || [];
    return (
    <div key={test.id} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="font-semibold text-gray-800">{test.name}</h3>
          <p className="text-sm text-gray-600">Duration: {Math.floor(test.duration / 60)}h {test.duration % 60}m | Marks: {test.totalMarks}</p>
          <p className="text-sm text-gray-600">Sections: {test.sections.length} | Questions: {test.sections.reduce((s: number, sec: any) => s + sec.questions.length, 0)}</p>
          {completedAttempts.length > 0 && (
            <p className="text-sm text-green-700 font-medium mt-1">✓ {completedAttempts.length} student{completedAttempts.length > 1 ? 's' : ''} submitted</p>
          )}
        </div>
        <div className="flex flex-col gap-2 items-end">{actions}</div>
      </div>
      {completedAttempts.length > 0 && (
        <div className="mt-2 border-t border-gray-100 pt-2 space-y-1">
          {completedAttempts.map((attempt: any) => (
            <div key={attempt.id} className="flex justify-between items-center text-sm">
              <span className="text-gray-700">{attempt.candidateName}</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-blue-700">{attempt.totalMarks}/{test.totalMarks}</span>
                <a href={`/analyse/${attempt.id}`} target="_blank" rel="noreferrer" className="bg-blue-600 text-white px-2 py-0.5 rounded text-xs hover:bg-blue-700">Analyse</a>
              </div>
            </div>
          ))}
        </div>
      )}
      {getResumeRequestsForTest(test.id).length > 0 && (
        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="text-sm font-semibold text-yellow-800 mb-2">Resume Requests:</h4>
          {getResumeRequestsForTest(test.id).map((req: any) => (
            <div key={req.id} className="flex justify-between items-center text-sm">
              <span className="text-gray-700">{req.candidateName}</span>
              <button onClick={() => handleAllowResume(req.id)} className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700">Allow Resume</button>
            </div>
          ))}
        </div>
      )}
    </div>
    );
  };

  return (
    <>
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100">
      <div className="bg-white shadow-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <div><h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">JEE Test Creator</h1><p className="text-gray-600 text-sm mt-1">Create and manage your JEE practice tests</p></div>
            <div className="flex gap-2 flex-wrap">
              {[
                { key: 'create', label: 'Create Test', count: null, color: 'blue' },
                { key: 'pending', label: 'Pending', count: pendingTests.length, color: 'orange' },
                { key: 'new', label: 'New Tests', count: newTests.length, color: 'green' },
                { key: 'live', label: 'Live', count: liveTests.length, color: 'red' },
                { key: 'attempted', label: 'Attempted', count: attemptedTests.length, color: 'purple' },
              ].map((tab) => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${activeTab === tab.key ? `bg-${tab.color}-600 text-white shadow-md` : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                  {tab.label}{tab.count !== null ? ` (${tab.count})` : ''}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4">
        {/* Upload Progress */}
        {loading && uploadProgress > 0 && (
          <div className="mb-4 bg-white rounded-lg p-4 shadow-sm">
            <div className="flex justify-between text-sm mb-1"><span>Uploading...</span><span>{uploadProgress}%</span></div>
            <div className="w-full bg-gray-200 rounded-full h-2"><div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${uploadProgress}%` }}></div></div>
          </div>
        )}

        {/* Create Tab */}
        {activeTab === 'create' && (
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">{editingTest ? (editMode === 'continue' ? 'Continue Creating Test' : 'Edit Test') : 'Create New Test'}</h2>
              {editingTest && <button onClick={resetForm} className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 text-sm">Cancel Edit</button>}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Test Name</label>
              <input type="text" value={testName} onChange={(e) => setTestName(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Enter test name" />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Test Duration</label>
              <div className="flex gap-4">
                <div className="flex-1"><label className="block text-xs text-gray-600 mb-1">Hours</label><input type="number" min="0" max="5" value={duration.hours} onChange={(e) => setDuration({ ...duration, hours: parseInt(e.target.value) || 0 })} className="w-full p-2 border border-gray-300 rounded-lg text-center font-semibold" /></div>
                <div className="flex items-center text-xl font-bold text-gray-400 mt-6">:</div>
                <div className="flex-1"><label className="block text-xs text-gray-600 mb-1">Minutes</label><input type="number" min="0" max="59" value={duration.minutes} onChange={(e) => setDuration({ ...duration, minutes: parseInt(e.target.value) || 0 })} className="w-full p-2 border border-gray-300 rounded-lg text-center font-semibold" /></div>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <input type="checkbox" id="graphical" checked={enableGraphicalAnalysis} onChange={(e) => setEnableGraphicalAnalysis(e.target.checked)} className="w-5 h-5 text-blue-600" />
                <div className="flex-1">
                  <label htmlFor="graphical" className="text-sm font-semibold text-gray-800 cursor-pointer">Enable Graphical Analysis</label>
                  <p className="text-xs text-gray-600 mt-1">{detectMultipleSubjects(sections) ? 'Multiple subjects detected - charts recommended' : 'Single subject detected'}</p>
                </div>
                <div className="text-2xl">{enableGraphicalAnalysis ? '📊' : '📋'}</div>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Test Sections</h3>
                <button onClick={addSection} className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 text-sm flex items-center gap-2">+ Add Section</button>
              </div>

              {sections.map((section, si) => (
                <div key={si} className="bg-white border border-gray-200 rounded-lg shadow-sm mb-4 overflow-hidden">
                  <div className="bg-gray-50 border-b border-gray-200 p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <button onClick={() => toggleSectionExpanded(si)} className="flex items-center gap-2 text-gray-700 hover:text-gray-900">
                          {section.isExpanded ? <ChevronDown /> : <ChevronRight />}
                          <h4 className="text-base font-semibold">Section {si + 1}: {section.name}</h4>
                        </button>
                        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">{section.questions.length} questions</span>
                      </div>
                      <button onClick={() => deleteSection(si)} className="bg-red-500 text-white px-3 py-1 rounded-lg hover:bg-red-600 text-xs">Delete</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                      <div><label className="block text-xs font-medium text-gray-700 mb-1">Section Name</label><input type="text" value={section.name} onChange={(e) => updateSection(si, 'name', e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg text-sm" /></div>
                      <div><label className="block text-xs font-medium text-gray-700 mb-1">Question Type</label>
                        <select value={section.questionType} onChange={(e) => updateSection(si, 'questionType', e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg text-sm">
                          <option value="SINGLE_CORRECT">Single Correct Type</option>
                          <option value="INTEGER">Integer Type</option>
                          <option value="MULTIPLE_CORRECT">One or More Correct Type</option>
                          <option value="MATRIX_MATCH">Matrix Match Type</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div><label className="block text-xs font-medium text-gray-700 mb-1">Marks (Correct)</label><input type="number" value={section.marks ?? 4} onChange={(e) => updateSection(si, 'marks', parseInt(e.target.value) || 0)} className="w-full p-2 border border-gray-300 rounded-lg text-sm" /></div>
                      <div><label className="block text-xs font-medium text-gray-700 mb-1">Negative Marks</label><input type="number" value={section.negativeMarks ?? -1} onChange={(e) => updateSection(si, 'negativeMarks', parseInt(e.target.value) || 0)} className="w-full p-2 border border-gray-300 rounded-lg text-sm" /></div>
                    </div>
                  </div>

                  {section.isExpanded && (
                    <div className="p-4">
                      <div className="flex justify-between items-center mb-3">
                        <h5 className="text-base font-medium text-gray-800">Questions</h5>
                        <div className="flex gap-2">
                          {section.questions.length > 0 && (<>
                            <button onClick={() => handleBulkSelection(si, 'questionImage')} className="bg-purple-500 text-white px-3 py-1 rounded-lg hover:bg-purple-600 text-xs">📁 Bulk Questions</button>
                            <button onClick={() => handleBulkSelection(si, 'solutionImage')} className="bg-teal-500 text-white px-3 py-1 rounded-lg hover:bg-teal-600 text-xs">📁 Bulk Solutions</button>
                          </>)}
                          <button onClick={() => addQuestion(si)} className="bg-green-500 text-white px-3 py-1 rounded-lg hover:bg-green-600 text-xs">+ Add Question</button>
                        </div>
                      </div>
                      {section.questions.length === 0 ? (
                        <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300"><p className="text-gray-500 text-sm">No questions added yet</p></div>
                      ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {section.questions.map((q, qi) => (
                            <div key={q.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                              <div className="flex justify-between items-center mb-3">
                                <h6 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><span className="bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">{qi + 1}</span>Question {qi + 1}</h6>
                                <button onClick={() => deleteQuestion(si, qi)} className="bg-red-500 text-white p-1 rounded hover:bg-red-600"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                              </div>
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                  <ImageInput value={q.questionImage} onChange={(v) => updateQuestion(si, qi, 'questionImage', v)} label="Question Image" />
                                  <ImageInput value={q.solutionImage} onChange={(v) => updateQuestion(si, qi, 'solutionImage', v)} label="Solution Image" />
                                </div>
                                {(section.questionType === 'SINGLE_CORRECT' || section.questionType === 'MATRIX_MATCH') && (
                                  <div><label className="block text-xs font-medium text-gray-700 mb-1">Correct Option</label>
                                    <select value={q.correctOption} onChange={(e) => updateQuestion(si, qi, 'correctOption', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm">
                                      {['A', 'B', 'C', 'D'].map((o) => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                  </div>
                                )}
                                {section.questionType === 'MULTIPLE_CORRECT' && (
                                  <div><label className="block text-xs font-medium text-gray-700 mb-1">Correct Options</label>
                                    <div className="flex gap-2">{['A', 'B', 'C', 'D'].map((o) => (
                                      <label key={o} className={`flex items-center gap-1 px-2 py-1 border rounded cursor-pointer text-xs ${q.correctOptions.includes(o) ? 'bg-blue-100 border-blue-500' : 'border-gray-300'}`}>
                                        <input type="checkbox" checked={q.correctOptions.includes(o)} onChange={() => { const opts = q.correctOptions.includes(o) ? q.correctOptions.filter((x) => x !== o) : [...q.correctOptions, o]; updateQuestion(si, qi, 'correctOptions', opts); }} className="w-3 h-3" />{o}
                                      </label>
                                    ))}</div>
                                  </div>
                                )}
                                {section.questionType === 'INTEGER' && (
                                  <div><label className="block text-xs font-medium text-gray-700 mb-1">Correct Integer</label><input type="number" value={q.correctInteger} onChange={(e) => updateQuestion(si, qi, 'correctInteger', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm" placeholder="Enter integer answer" /></div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-4 justify-end mt-6">
              <button data-save-draft-button onClick={saveDraft} disabled={saveDraftLoading || createTestLoading} className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium disabled:opacity-50">
                {saveDraftLoading ? 'Saving...' : 'Save Draft'}
              </button>
              <button onClick={createTest} disabled={saveDraftLoading || createTestLoading} className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50">
                {createTestLoading ? 'Creating...' : (editingTest ? (editMode === 'continue' ? 'Create Test' : 'Update Test') : 'Create Test')}
              </button>
            </div>
          </div>
        )}

        {/* Pending Tests Tab */}
        {activeTab === 'pending' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-800">Pending (Draft) Tests</h2>
            {pendingTests.length === 0 ? <p className="text-gray-500">No pending tests</p> : pendingTests.map((test) => renderTestCard(test, (
              <div className="flex gap-2">
                <button onClick={() => loadTestIntoForm(test, 'continue')} className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700">Continue</button>
                <button onClick={() => deleteTest(test.id)} className="bg-red-500 text-white px-3 py-1 rounded text-xs hover:bg-red-600">Delete</button>
              </div>
            )))}
          </div>
        )}

        {/* New Tests Tab */}
        {activeTab === 'new' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-800">New Tests (Not Live)</h2>
            {newTests.length === 0 ? <p className="text-gray-500">No new tests</p> : newTests.map((test) => renderTestCard(test, (
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => toggleTestLive(test.id, test.isLive)} className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700">Go Live</button>
                <button onClick={() => loadTestIntoForm(test, 'edit')} className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700">Edit</button>
                <a href={`/preview/${test.id}`} target="_blank" rel="noreferrer" className="bg-purple-600 text-white px-3 py-1 rounded text-xs hover:bg-purple-700">Preview</a>
                <button onClick={() => deleteTest(test.id)} className="bg-red-500 text-white px-3 py-1 rounded text-xs hover:bg-red-600">Delete</button>
              </div>
            )))}
          </div>
        )}

        {/* Live Tests Tab */}
        {activeTab === 'live' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-800">Live Tests</h2>
            {liveTests.length === 0 ? <p className="text-gray-500">No live tests</p> : liveTests.map((test) => renderTestCard(test, (
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => toggleTestLive(test.id, test.isLive)} className="bg-orange-500 text-white px-3 py-1 rounded text-xs hover:bg-orange-600">Stop Live</button>
                <a href={`/preview/${test.id}`} target="_blank" rel="noreferrer" className="bg-purple-600 text-white px-3 py-1 rounded text-xs hover:bg-purple-700">Preview</a>
                <button onClick={() => deleteTest(test.id)} className="bg-red-500 text-white px-3 py-1 rounded text-xs hover:bg-red-600">Delete</button>
              </div>
            )))}
          </div>
        )}

        {/* Attempted Tests Tab */}
        {activeTab === 'attempted' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-800">Attempted Tests</h2>
            {attemptedTests.length === 0 ? <p className="text-gray-500">No attempted tests</p> : attemptedTests.map((test) => (
              <div key={test.id} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-800">{test.name}</h3>
                    <p className="text-sm text-gray-600">Attempts: {test.attempts?.filter((a: any) => a.isCompleted).length || 0} completed</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleRecalculate(test)} disabled={recalculatingTest === test.id} className="bg-yellow-500 text-white px-3 py-1 rounded text-xs hover:bg-yellow-600 disabled:opacity-50">
                      {recalculatingTest === test.id ? 'Recalculating...' : 'Recalculate'}
                    </button>
                    <a href={`/preview/${test.id}`} target="_blank" rel="noreferrer" className="bg-purple-600 text-white px-3 py-1 rounded text-xs hover:bg-purple-700">Preview</a>
                  </div>
                </div>
                {test.attempts?.filter((a: any) => a.isCompleted).map((attempt: any) => (
                  <div key={attempt.id} className="flex justify-between items-center py-2 border-t border-gray-100 text-sm">
                    <span className="text-gray-700">{attempt.candidateName}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-blue-700">{attempt.totalMarks}/{test.totalMarks}</span>
                      <a href={`/analyse/${attempt.id}`} target="_blank" rel="noreferrer" className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700">Analyse</a>
                      <button
                        onClick={() => setConfirmModal({ show: true, title: 'Delete Attempt', message: `Delete attempt by "${attempt.candidateName}"? This cannot be undone.`, onConfirm: async () => {
                          try { await attemptAPI.deleteAttempt(attempt.id); fetchTests(); setConfirmModal({ show: false, title: '', message: '', onConfirm: null }); }
                          catch (error: any) { setConfirmModal({ show: false, title: '', message: '', onConfirm: null }); setModal({ show: true, title: 'Error', message: error.userMessage || 'Failed to delete attempt.', type: 'error' }); }
                        }})}
                        className="bg-red-500 text-white px-3 py-1 rounded text-xs hover:bg-red-600"
                      >Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>

    <Modal isOpen={modal.show} onClose={() => setModal({ ...modal, show: false })} title={modal.title}>
      <div className="text-center"><p className="text-gray-700 mb-4">{modal.message}</p><button onClick={() => setModal({ ...modal, show: false })} className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700">OK</button></div>
    </Modal>

    <Modal isOpen={confirmModal.show} onClose={() => setConfirmModal({ ...confirmModal, show: false })} title={confirmModal.title}>
      <div className="text-center">
        <p className="text-gray-700 mb-4 whitespace-pre-line">{confirmModal.message}</p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => setConfirmModal({ ...confirmModal, show: false })} className="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
          <button onClick={() => confirmModal.onConfirm?.()} className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">Delete</button>
        </div>
      </div>
    </Modal>

    <BulkSelectionErrorModal isOpen={bulkErrorModal.show} onClose={() => setBulkErrorModal({ show: false, error: null })} error={bulkErrorModal.error} />
    </>
  );
}
