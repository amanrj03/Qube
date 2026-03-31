'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { testAPI } from '../../../../services/api';
import { detectMultipleSubjects } from '../../../../utils/subjectUtils';
import Modal from '../../../../components/Modal';
import BulkSelectionErrorModal from '../../../../components/BulkSelectionErrorModal';

interface Question { id: string; questionImage: File | string | null; solutionImage: File | string | null; correctOption: string; correctOptions: string[]; correctInteger: string }
interface Section { name: string; questionType: string; marks: number; negativeMarks: number; questions: Question[]; isExpanded: boolean }

let lastActiveImageInput: ((file: File) => void) | null = null;

function ImageInput({ value, onChange, label }: { value: File | string | null; onChange: (v: File | null) => void; label: string }) {
  const [preview, setPreview] = useState<string | null>(() => typeof value === 'string' ? value : null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const currentFileRef = useRef<File | null>(value instanceof File ? value : null);

  useEffect(() => {
    if (!value) { setPreview(null); currentFileRef.current = null; }
    else if (typeof value === 'string') { setPreview(value); currentFileRef.current = null; }
    else if (value instanceof File && value !== currentFileRef.current) { currentFileRef.current = value; setPreview(URL.createObjectURL(value)); }
  }, [value]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (lastActiveImageInput !== pickRef.current) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) { const file = item.getAsFile(); if (file) { e.preventDefault(); pickRef.current(file); break; } }
      }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    currentFileRef.current = file; setPreview(URL.createObjectURL(file)); onChange(file);
  };
  const pickRef = useRef(pick); pickRef.current = pick;
  const clear = () => { setPreview(null); currentFileRef.current = null; onChange(null); if (inputRef.current) inputRef.current.value = ''; };

  return (
    <div onMouseEnter={() => { lastActiveImageInput = pickRef.current; }}>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {preview ? (
        <div className="relative">
          <img src={preview} alt={label} className="w-full h-28 object-contain border border-gray-200 rounded-lg bg-gray-50" />
          <button type="button" onClick={clear} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600">×</button>
        </div>
      ) : (
        <div
          className={`border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition ${drag ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-gray-50'}`}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) pick(f); }}
          onClick={() => inputRef.current?.click()}
        >
          <svg className="mx-auto h-5 w-5 text-gray-300 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          <p className="text-xs text-gray-400">Click, drag or Ctrl+V</p>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); }} />
        </div>
      )}
    </div>
  );
}

function CreateTestForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');

  const [testName, setTestName] = useState('');
  const [duration, setDuration] = useState({ hours: 3, minutes: 0 });
  const [enableGraphicalAnalysis, setEnableGraphicalAnalysis] = useState(true);
  const [sections, setSections] = useState<Section[]>([{ name: 'Physics', questionType: 'SINGLE_CORRECT', marks: 4, negativeMarks: -1, questions: [], isExpanded: false }]);
  const [loading, setLoading] = useState(false);
  const [saveDraftLoading, setSaveDraftLoading] = useState(false);
  const [createTestLoading, setCreateTestLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [editingTest, setEditingTest] = useState<any>(null);
  const [modal, setModal] = useState({ show: false, title: '', message: '', type: 'info' });
  const [bulkErrorModal, setBulkErrorModal] = useState<{ show: boolean; error: any }>({ show: false, error: null });
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    if (editId) loadTestForEdit(editId);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'd') { e.preventDefault(); const btn = document.querySelector<HTMLButtonElement>('[data-save-draft]'); if (btn && !btn.disabled) btn.click(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => { isMountedRef.current = false; document.removeEventListener('keydown', handleKeyDown); };
  }, [editId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setEnableGraphicalAnalysis(detectMultipleSubjects(sections)); }, [sections]);

  const loadTestForEdit = async (id: string) => {
    try {
      const res = await testAPI.getTestById(id);
      const t = res.data;
      setEditingTest(t);
      setTestName(t.name);
      setDuration({ hours: Math.floor(t.duration / 60), minutes: t.duration % 60 });
      setEnableGraphicalAnalysis(t.enableGraphicalAnalysis ?? true);
      setSections(t.sections.map((s: any) => ({
        name: s.name, questionType: s.questionType,
        marks: s.questions[0]?.marks ?? 4, negativeMarks: s.questions[0]?.negativeMarks ?? -1,
        isExpanded: false,
        questions: s.questions.map((q: any, i: number) => ({
          id: q.id || `q-${Date.now()}-${i}`,
          questionImage: q.questionImage, solutionImage: q.solutionImage,
          correctOption: q.correctOption || 'A',
          correctOptions: q.correctOptions ? (typeof q.correctOptions === 'string' ? q.correctOptions.split(',') : q.correctOptions) : [],
          correctInteger: q.correctInteger?.toString() || '',
        })),
      })));
    } catch { setModal({ show: true, title: 'Error', message: 'Failed to load test for editing.', type: 'error' }); }
  };

  const addSection = () => setSections([...sections, { name: `Section ${sections.length + 1}`, questionType: 'SINGLE_CORRECT', marks: 4, negativeMarks: -1, questions: [], isExpanded: false }]);
  const updateSection = (i: number, field: string, value: any) => { const s = [...sections]; (s[i] as any)[field] = value; setSections(s); };
  const toggleExpanded = (i: number) => setSections(sections.map((s, idx) => ({ ...s, isExpanded: idx === i ? !s.isExpanded : false })));
  const deleteSection = (i: number) => {
    if (sections.length <= 1) { setModal({ show: true, title: 'Cannot Delete', message: 'At least one section is required.', type: 'warning' }); return; }
    setSections(sections.filter((_, idx) => idx !== i));
  };
  const addQuestion = (si: number) => { const s = [...sections]; s[si].questions.push({ id: `q-${Date.now()}-${Math.random()}`, questionImage: null, solutionImage: null, correctOption: 'A', correctOptions: [], correctInteger: '' }); setSections(s); };
  const updateQuestion = (si: number, qi: number, field: string, value: any) => setSections(sections.map((s, sIdx) => sIdx !== si ? s : { ...s, questions: s.questions.map((q, qIdx) => qIdx !== qi ? q : { ...q, [field]: value }) }));
  const deleteQuestion = (si: number, qi: number) => { const s = [...sections]; s[si].questions = s[si].questions.filter((_, i) => i !== qi); setSections(s); };

  const validateBulkSelection = (files: File[], expected: number) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const invalid = files.filter((f) => !allowed.includes(f.type));
    if (files.length !== expected && invalid.length > 0) return { type: 'mixedErrors', expectedCount: expected, actualCount: files.length, invalidFiles: invalid.map((f) => f.name) };
    if (files.length !== expected) return { type: 'wrongCount', expectedCount: expected, actualCount: files.length };
    if (invalid.length > 0) return { type: 'invalidFileType', invalidFiles: invalid.map((f) => f.name) };
    return null;
  };

  const handleBulkSection = (si: number, field: 'questionImage' | 'solutionImage') => {
    const input = document.createElement('input'); input.type = 'file'; input.multiple = true; input.accept = 'image/*';
    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      const err = validateBulkSelection(files, sections[si].questions.length);
      if (err) { setBulkErrorModal({ show: true, error: err }); return; }
      const s = [...sections]; files.forEach((f, i) => { if (i < s[si].questions.length) (s[si].questions[i] as any)[field] = f; }); setSections(s);
    };
    input.click();
  };

  const handleBulkAll = (field: 'questionImage' | 'solutionImage') => {
    const total = sections.reduce((sum, s) => sum + s.questions.length, 0);
    if (total === 0) { setModal({ show: true, title: 'No Questions', message: 'Add questions first.', type: 'warning' }); return; }
    const input = document.createElement('input'); input.type = 'file'; input.multiple = true; input.accept = 'image/*';
    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      const err = validateBulkSelection(files, total);
      if (err) { setBulkErrorModal({ show: true, error: err }); return; }
      const s = sections.map((sec) => ({ ...sec, questions: sec.questions.map((q) => ({ ...q })) }));
      let fi = 0;
      for (let si = 0; si < s.length; si++) for (let qi = 0; qi < s[si].questions.length; qi++) (s[si].questions[qi] as any)[field] = files[fi++];
      setSections(s);
    };
    input.click();
  };

  const uploadImagesQueue = async (currentSections: Section[]): Promise<Section[]> => {
    const result = currentSections.map((s) => ({ ...s, questions: s.questions.map((q) => ({ ...q })) }));
    type UploadItem = { si: number; qi: number; field: 'questionImage' | 'solutionImage'; file: File };
    const items: UploadItem[] = [];
    result.forEach((s, si) => s.questions.forEach((q, qi) => {
      if (q.questionImage instanceof File) items.push({ si, qi, field: 'questionImage', file: q.questionImage });
      if (q.solutionImage instanceof File) items.push({ si, qi, field: 'solutionImage', file: q.solutionImage });
    }));
    if (items.length === 0) return result;
    const MAX = 4 * 1024 * 1024;
    const batches: UploadItem[][] = [];
    let cur: UploadItem[] = [], curSize = 0;
    for (const item of items) {
      if (cur.length > 0 && curSize + item.file.size > MAX) { batches.push(cur); cur = []; curSize = 0; }
      cur.push(item); curSize += item.file.size;
    }
    if (cur.length > 0) batches.push(cur);
    let uploaded = 0;
    for (const batch of batches) {
      const fd = new FormData();
      fd.append('imageType', batch[0].field === 'questionImage' ? 'question' : 'solution');
      batch.forEach((item, idx) => fd.append(`images[${idx}]`, item.file));
      const res = await fetch('/api/upload/image', { method: 'POST', body: fd });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Image upload failed'); }
      const { urls } = await res.json();
      batch.forEach((item, idx) => { (result[item.si].questions[item.qi] as any)[item.field] = urls[idx]; });
      uploaded += batch.length;
      setUploadProgress(Math.round((uploaded / items.length) * 100));
    }
    setSections(result); return result;
  };

  const buildFormData = (isDraft: boolean, resolved: Section[]) => {
    const fd = new FormData();
    fd.append('name', testName);
    fd.append('duration', String(duration.hours * 60 + duration.minutes));
    fd.append('isDraft', String(isDraft));
    fd.append('enableGraphicalAnalysis', String(enableGraphicalAnalysis));
    const clean = resolved.map((s) => ({ name: s.name, questionType: s.questionType, marks: s.marks ?? 4, negativeMarks: s.negativeMarks ?? -1, questions: s.questions.map(({ id, ...q }) => ({ ...q, correctOptions: q.correctOptions || null, questionImage: typeof q.questionImage === 'string' ? q.questionImage : null, solutionImage: typeof q.solutionImage === 'string' ? q.solutionImage : null })) }));
    fd.append('sections', JSON.stringify(clean));
    return fd;
  };

  const onProgress = (e: import('axios').AxiosProgressEvent) => setUploadProgress(Math.round(((e.loaded ?? 0) * 100) / (e.total ?? 1)));

  const saveDraft = async () => {
    if (!testName.trim()) { setModal({ show: true, title: 'Validation Error', message: 'Please enter a test name.', type: 'warning' }); return; }
    setSaveDraftLoading(true); setLoading(true);
    try {
      const resolved = await uploadImagesQueue(sections);
      const fd = buildFormData(true, resolved);
      if (editingTest) { await testAPI.updateTest(editingTest.id, fd, onProgress); }
      else { await testAPI.saveDraft(fd, onProgress); }
      setModal({ show: true, title: 'Saved', message: 'Draft saved successfully!', type: 'success' });
    } catch (error: any) { setModal({ show: true, title: 'Error', message: error.message || 'Failed to save draft.', type: 'error' }); }
    finally { setSaveDraftLoading(false); setLoading(false); setUploadProgress(0); }
  };

  const createTest = async () => {
    if (!testName.trim()) { setModal({ show: true, title: 'Validation Error', message: 'Please enter a test name.', type: 'warning' }); return; }
    if (sections.some((s) => s.questions.length === 0)) { setModal({ show: true, title: 'Validation Error', message: 'Each section must have at least one question.', type: 'warning' }); return; }
    for (let si = 0; si < sections.length; si++) {
      const s = sections[si];
      for (let qi = 0; qi < s.questions.length; qi++) {
        const q = s.questions[qi];
        if (!q.questionImage) { setModal({ show: true, title: 'Validation Error', message: `Q${qi + 1} in ${s.name} is missing a question image.`, type: 'warning' }); return; }
        if (!q.solutionImage) { setModal({ show: true, title: 'Validation Error', message: `Q${qi + 1} in ${s.name} is missing a solution image.`, type: 'warning' }); return; }
        if ((s.questionType === 'SINGLE_CORRECT' || s.questionType === 'MATRIX_MATCH') && !q.correctOption) { setModal({ show: true, title: 'Validation Error', message: `Q${qi + 1} in ${s.name} is missing the correct option.`, type: 'warning' }); return; }
        if (s.questionType === 'MULTIPLE_CORRECT' && (!q.correctOptions || q.correctOptions.length === 0)) { setModal({ show: true, title: 'Validation Error', message: `Q${qi + 1} in ${s.name} is missing correct options.`, type: 'warning' }); return; }
        if (s.questionType === 'INTEGER' && !q.correctInteger && q.correctInteger !== '0') { setModal({ show: true, title: 'Validation Error', message: `Q${qi + 1} in ${s.name} is missing the integer answer.`, type: 'warning' }); return; }
      }
    }
    setCreateTestLoading(true); setLoading(true);
    try {
      const resolved = await uploadImagesQueue(sections);
      const fd = buildFormData(false, resolved);
      if (editingTest) { await testAPI.updateTest(editingTest.id, fd, onProgress); setModal({ show: true, title: 'Updated', message: 'Test updated successfully!', type: 'success' }); }
      else { await testAPI.createTest(fd, onProgress); setModal({ show: true, title: 'Created', message: 'Test created successfully!', type: 'success' }); }
      setTimeout(() => router.push('/dashboard/tests?tab=new'), 1500);
    } catch (error: any) { setModal({ show: true, title: 'Error', message: error.message || 'Failed to save test.', type: 'error' }); }
    finally { setCreateTestLoading(false); setLoading(false); setUploadProgress(0); }
  };

  return (
    <>
    <div className="p-8 max-w-5xl">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
            <button onClick={() => router.push('/dashboard/tests?tab=new')} className="hover:text-blue-600">Tests</button>
            <span>/</span>
            <span className="text-gray-700">{editingTest ? 'Edit Test' : 'Create Test'}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">{editingTest ? `Edit: ${editingTest.name}` : 'Create New Test'}</h1>
        </div>
        <button onClick={() => router.push('/dashboard/tests?tab=new')} className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">
          ← Back
        </button>
      </div>

      {/* Upload progress */}
      {loading && uploadProgress > 0 && (
        <div className="mb-6 bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>{uploadProgress < 100 ? 'Uploading images...' : 'Saving test...'}</span>
            <span className="font-medium">{uploadProgress}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      )}

      {/* Test settings card */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Test Settings</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Test Name</label>
            <input type="text" value={testName} onChange={(e) => setTestName(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="e.g. JEE Mains Mock Test 1" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <input type="number" min="0" max="9" value={duration.hours}
                  onChange={(e) => setDuration({ ...duration, hours: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <p className="text-xs text-gray-400 text-center mt-0.5">Hours</p>
              </div>
              <span className="text-gray-400 font-bold text-lg pb-4">:</span>
              <div className="flex-1">
                <input type="number" min="0" max="59" value={duration.minutes}
                  onChange={(e) => setDuration({ ...duration, minutes: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <p className="text-xs text-gray-400 text-center mt-0.5">Minutes</p>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Graphical Analysis</label>
            <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
              <input type="checkbox" checked={enableGraphicalAnalysis} onChange={(e) => setEnableGraphicalAnalysis(e.target.checked)} className="w-4 h-4 accent-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-700">Enable charts</p>
                <p className="text-xs text-gray-400">{detectMultipleSubjects(sections) ? 'Multiple subjects detected' : 'Single subject'}</p>
              </div>
              <span className="ml-auto text-xl">{enableGraphicalAnalysis ? '📊' : '📋'}</span>
            </label>
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Sections</h2>
          <div className="flex gap-2">
            {sections.some((s) => s.questions.length > 0) && (
              <>
                <button onClick={() => handleBulkAll('questionImage')} className="text-xs px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition">📁 Bulk Questions</button>
                <button onClick={() => handleBulkAll('solutionImage')} className="text-xs px-3 py-1.5 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-lg hover:bg-cyan-100 transition">📁 Bulk Solutions</button>
              </>
            )}
            <button onClick={addSection} className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">+ Add Section</button>
          </div>
        </div>

        <div className="space-y-3">
          {sections.map((section, si) => (
            <div key={si} className="border border-gray-200 rounded-xl overflow-hidden">
              {/* Section header */}
              <div className="bg-gray-50 px-4 py-3 flex items-center justify-between gap-3">
                <button onClick={() => toggleExpanded(si)} className="flex items-center gap-2 flex-1 text-left">
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${section.isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  <span className="font-medium text-gray-800 text-sm">Section {si + 1}: {section.name}</span>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{section.questions.length}q</span>
                </button>
                <button onClick={() => deleteSection(si)} className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition">Remove</button>
              </div>

              {/* Section config */}
              <div className="px-4 py-3 border-b border-gray-100 grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Section Name</label>
                  <input type="text" value={section.name} onChange={(e) => updateSection(si, 'name', e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Question Type</label>
                  <select value={section.questionType} onChange={(e) => updateSection(si, 'questionType', e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                    <option value="SINGLE_CORRECT">Single Correct</option>
                    <option value="INTEGER">Integer Type</option>
                    <option value="MULTIPLE_CORRECT">Multiple Correct</option>
                    <option value="MATRIX_MATCH">Matrix Match</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Marks (Correct)</label>
                  <input type="number" value={section.marks ?? 4} onChange={(e) => updateSection(si, 'marks', parseInt(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Negative Marks</label>
                  <input type="number" value={section.negativeMarks ?? -1} onChange={(e) => updateSection(si, 'negativeMarks', parseInt(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
              </div>

              {/* Questions */}
              {section.isExpanded && (
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">Questions</span>
                    <div className="flex gap-2">
                      {section.questions.length > 0 && (
                        <>
                          <button onClick={() => handleBulkSection(si, 'questionImage')} className="text-xs px-2 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100">📁 Questions</button>
                          <button onClick={() => handleBulkSection(si, 'solutionImage')} className="text-xs px-2 py-1 bg-teal-50 text-teal-700 border border-teal-200 rounded-lg hover:bg-teal-100">📁 Solutions</button>
                        </>
                      )}
                      <button onClick={() => addQuestion(si)} className="text-xs px-2 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700">+ Question</button>
                    </div>
                  </div>

                  {section.questions.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl">
                      <p className="text-gray-400 text-sm">No questions yet</p>
                      <button onClick={() => addQuestion(si)} className="mt-2 text-xs text-blue-600 hover:underline">Add first question</button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      {section.questions.map((q, qi) => (
                        <div key={q.id} className="border border-gray-200 rounded-xl p-3 bg-gray-50">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                              <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs">{qi + 1}</span>
                              Question {qi + 1}
                            </span>
                            <button onClick={() => deleteQuestion(si, qi)} className="text-xs text-red-400 hover:text-red-600 px-1.5 py-0.5 rounded hover:bg-red-50">✕</button>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mb-2">
                            <ImageInput value={q.questionImage} onChange={(v) => updateQuestion(si, qi, 'questionImage', v)} label="Question Image" />
                            <ImageInput value={q.solutionImage} onChange={(v) => updateQuestion(si, qi, 'solutionImage', v)} label="Solution Image" />
                          </div>
                          {(section.questionType === 'SINGLE_CORRECT' || section.questionType === 'MATRIX_MATCH') && (
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Correct Option</label>
                              <div className="flex gap-1.5">
                                {['A','B','C','D'].map((o) => (
                                  <label key={o} className={`flex items-center justify-center w-9 h-9 border rounded-lg cursor-pointer text-xs font-semibold transition ${q.correctOption === o ? 'bg-blue-100 border-blue-400 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                                    <input type="radio" name={`correct-${q.id}`} checked={q.correctOption === o} onChange={() => updateQuestion(si, qi, 'correctOption', o)} className="hidden" />{o}
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                          {section.questionType === 'MULTIPLE_CORRECT' && (
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Correct Options</label>
                              <div className="flex gap-1.5">
                                {['A','B','C','D'].map((o) => (
                                  <label key={o} className={`flex items-center gap-1 px-2 py-1 border rounded-lg cursor-pointer text-xs transition ${q.correctOptions.includes(o) ? 'bg-blue-100 border-blue-400 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                                    <input type="checkbox" checked={q.correctOptions.includes(o)} onChange={() => { const opts = q.correctOptions.includes(o) ? q.correctOptions.filter((x) => x !== o) : [...q.correctOptions, o]; updateQuestion(si, qi, 'correctOptions', opts); }} className="w-3 h-3" />{o}
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                          {section.questionType === 'INTEGER' && (
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Correct Integer</label>
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="-?[0-9]*"
                                value={q.correctInteger}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === '' || val === '-' || /^-?\d+$/.test(val)) {
                                    updateQuestion(si, qi, 'correctInteger', val);
                                  }
                                }}
                                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                placeholder="e.g. 42"
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-6 py-4">
        <p className="text-xs text-gray-400">Ctrl+D to save draft</p>
        <div className="flex gap-3">
          <button data-save-draft onClick={saveDraft} disabled={saveDraftLoading || createTestLoading}
            className="px-5 py-2.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 transition">
            {saveDraftLoading ? 'Saving...' : 'Save Draft'}
          </button>
          <button onClick={createTest} disabled={saveDraftLoading || createTestLoading}
            className="px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition">
            {createTestLoading ? 'Saving...' : editingTest ? 'Update Test' : 'Create Test'}
          </button>
        </div>
      </div>
    </div>

    <Modal isOpen={modal.show} onClose={() => setModal({ ...modal, show: false })} title={modal.title}>
      <div className="text-center">
        <p className="text-gray-700 mb-4">{modal.message}</p>
        <button onClick={() => setModal({ ...modal, show: false })} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">OK</button>
      </div>
    </Modal>
    <BulkSelectionErrorModal isOpen={bulkErrorModal.show} onClose={() => setBulkErrorModal({ show: false, error: null })} error={bulkErrorModal.error} />
    </>
  );
}

export default function CreateTestPage() {
  return <Suspense><CreateTestForm /></Suspense>;
}
