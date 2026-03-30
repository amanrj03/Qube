'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { attemptAPI } from '../../../services/api';
import { useFullscreen } from '../../../hooks/useFullscreen';
import { useTimer } from '../../../hooks/useTimer';
import { useTimeTracking } from '../../../hooks/useTimeTracking';

import QuestionPalette from '../../../components/QuestionPalette';
import MCQQuestion from '../../../components/MCQQuestion';
import IntegerQuestion from '../../../components/IntegerQuestion';
import MultipleCorrectQuestion from '../../../components/MultipleCorrectQuestion';
import SubmitConfirmationModal from '../../../components/SubmitConfirmationModal';
import Modal from '../../../components/Modal';
import WarningModal from '../../../components/WarningModal';
import SectionInstructionModal from '../../../components/SectionInstructionModal';
import TestStatusBar from '../../../components/TestStatusBar';

export default function TestWindow() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const candidateName = user?.role === 'student' ? user.name : '';
  const candidateImage = user?.role === 'student' ? (user.profilePic || '') : '';
  const [attempt, setAttempt] = useState<any>(null);
  const [currentSection, setCurrentSection] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showTimeUpModal, setShowTimeUpModal] = useState(false);
  const [showInstructionModal, setShowInstructionModal] = useState(false);
  const [errorModal, setErrorModal] = useState({ show: false, title: '', message: '' });
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submittingRef = useRef(false);

  const { startQuestionTimer, stopCurrentTimer, syncTimeData } = useTimeTracking(attemptId);

  const buildAnswersArray = useCallback(() =>
    Object.entries(answers).map(([questionId, answer]) => ({
      questionId,
      selectedOption: answer.selectedOption || null,
      selectedOptions: answer.selectedOptions || null,
      integerAnswer: answer.integerAnswer ?? null,
      status: answer.status || 'NOT_VISITED',
    })), [answers]);

  const doSubmit = useCallback(async (skipConfirmation = false) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      stopCurrentTimer();
      await syncTimeData();
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
      await attemptAPI.submitTest({ attemptId, answers: buildAnswersArray() });
      setShowSubmitModal(false);
      if (skipConfirmation) {
        router.push('/student');
      } else {
        setErrorModal({ show: true, title: 'Test Submitted Successfully!', message: 'Your test has been submitted. Redirecting to dashboard.' });
        setTimeout(() => router.push('/student'), 2000);
      }
    } catch {
      setShowSubmitModal(false);
      setErrorModal({ show: true, title: 'Submission Failed', message: 'Failed to submit test. Please try again.' });
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [attemptId, buildAnswersArray, router, stopCurrentTimer, syncTimeData]);

  const handleAutoSubmit = useCallback(async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
      await attemptAPI.submitTest({ attemptId, answers: buildAnswersArray() });
      setShowTimeUpModal(false);
      router.push('/student');
    } catch {
      router.push('/student');
    }
  }, [attemptId, buildAnswersArray, router]);

  const handleTimeUp = useCallback(() => {
    setShowTimeUpModal(true);
    setTimeout(() => handleAutoSubmit(), 1000);
  }, [handleAutoSubmit]);

  const { timeLeft, formattedTime, start: startTimer, reset: resetTimer } = useTimer(0, handleTimeUp);

  // Declare refs before any effects that use them
  const timeLeftRef = useRef(0);
  const answersRef = useRef(answers);
  const remainingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep timeLeftRef in sync so the 60s interval always saves the current value
  useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);
  // Keep answersRef in sync so the 15s interval never captures a stale closure
  useEffect(() => { answersRef.current = answers; }, [answers]);

  const { enterFullscreen, warningCount, showWarningModal, handleWarningOk, handleWarningTimeout } = useFullscreen(
    async (count) => { try { await attemptAPI.updateWarning({ attemptId }); } catch {} },
    (data) => setErrorModal({ show: true, ...data }),
    handleAutoSubmit
  );

  const updateAnswer = useCallback((questionId: string, answerData: any) => {
    setAnswers((prev) => {
      const current = prev[questionId] || {};
      const next = { ...current, ...answerData };
      if (!answerData.status) {
        const hasAnswer = next.selectedOption != null || (next.selectedOptions?.length > 0) || next.integerAnswer != null;
        next.status = hasAnswer ? 'ANSWERED' : 'NOT_ANSWERED';
      }
      return { ...prev, [questionId]: next };
    });
  }, []);

  const syncAnswers = useCallback(async () => {
    try {
      await attemptAPI.syncAnswers({ attemptId, answers: Object.entries(answers).map(([qId, a]) => ({ questionId: qId, ...a })) });
    } catch {}
  }, [attemptId, answers]);

  const syncAnswersLatest = useCallback(async () => {
    try {
      await attemptAPI.syncAnswers({ attemptId, answers: Object.entries(answersRef.current).map(([qId, a]) => ({ questionId: qId, ...a })) });
    } catch {}
  }, [attemptId]);

  useEffect(() => {
    const fetchAttempt = async () => {
      try {
        const res = await attemptAPI.getAttempt(attemptId);
        const data = res.data;
        setAttempt(data);
        const init: Record<string, any> = {};
        data.answers.forEach((a: any) => { init[a.questionId] = { selectedOption: a.selectedOption, selectedOptions: a.selectedOptions, integerAnswer: a.integerAnswer, status: a.status }; });
        setAnswers(init);
        const firstQ = data.test.sections[0]?.questions[0];
        if (firstQ && (!init[firstQ.id] || init[firstQ.id].status === 'NOT_VISITED')) {
          setTimeout(() => updateAnswer(firstQ.id, { status: 'NOT_ANSWERED' }), 100);
        }

        // Use saved remainingTime if exists (reconnect), else use full duration (first start)
        const totalSeconds = data.test.duration * 60;
        const startSeconds = (data.remainingTime != null) ? data.remainingTime : totalSeconds;
        timeLeftRef.current = startSeconds;
        resetTimer(startSeconds);

        setLoading(false);
        setTimeout(() => { startTimer(); if (firstQ) startQuestionTimer(firstQ.id); }, 1000);

        // Save answers every 15s
        syncIntervalRef.current = setInterval(() => syncAnswersLatest(), 15000);

        // Save remaining time every 60s
        remainingIntervalRef.current = setInterval(() => {
          attemptAPI.syncRemaining({ attemptId, remainingTime: timeLeftRef.current }).catch(() => {});
        }, 60000);
      } catch {
        setErrorModal({ show: true, title: 'Failed to Load Test', message: 'Unable to load the test. Redirecting to dashboard.' });
        setTimeout(() => router.push('/student'), 3000);
      }
    };

    fetchAttempt();
    enterFullscreen();

    const handleBeforeUnload = () => {
      if (attemptId && !submittingRef.current) {
        // Save remaining time immediately on close
        navigator.sendBeacon('/api/attempts/sync-remaining', JSON.stringify({ attemptId, remainingTime: timeLeftRef.current }));
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
      if (remainingIntervalRef.current) clearInterval(remainingIntervalRef.current);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [attemptId]); // eslint-disable-line react-hooks/exhaustive-deps

  const getCurrentQuestion = () => attempt?.test?.sections?.[currentSection]?.questions?.[currentQuestion] || null;
  const getAllQuestions = () => attempt?.test?.sections?.flatMap((s: any) => s.questions) || [];

  const navigateToQuestion = useCallback((sectionIdx: number, questionIdx: number) => {
    const currentQ = getCurrentQuestion();
    const newQId = attempt?.test?.sections?.[sectionIdx]?.questions?.[questionIdx]?.id;
    if (currentQ) {
      stopCurrentTimer();
      if ((answers[currentQ.id]?.status || 'NOT_VISITED') === 'NOT_VISITED') updateAnswer(currentQ.id, { status: 'NOT_ANSWERED' });
    }
    setCurrentSection(sectionIdx);
    setCurrentQuestion(questionIdx);
    setTimeout(() => {
      if (newQId) {
        startQuestionTimer(newQId);
        if ((answers[newQId]?.status || 'NOT_VISITED') === 'NOT_VISITED') updateAnswer(newQId, { status: 'NOT_ANSWERED' });
      }
    }, 10);
  }, [attempt, answers, getCurrentQuestion, startQuestionTimer, stopCurrentTimer, updateAnswer]);

  const getGlobalIndex = () => attempt?.test?.sections?.slice(0, currentSection).reduce((s: number, sec: any) => s + sec.questions.length, 0) + currentQuestion || 0;

  const handleNext = () => {
    const all = getAllQuestions();
    const gi = getGlobalIndex();
    if (gi < all.length - 1) {
      let next = gi + 1, si = 0, qi = next;
      for (let i = 0; i < attempt.test.sections.length; i++) {
        if (qi < attempt.test.sections[i].questions.length) { si = i; break; }
        qi -= attempt.test.sections[i].questions.length; si = i + 1;
      }
      navigateToQuestion(si, qi);
    }
  };

  const handlePrevious = () => {
    const gi = getGlobalIndex();
    if (gi > 0) {
      let prev = gi - 1, si = 0, qi = prev;
      for (let i = 0; i < attempt.test.sections.length; i++) {
        if (qi < attempt.test.sections[i].questions.length) { si = i; break; }
        qi -= attempt.test.sections[i].questions.length; si = i + 1;
      }
      navigateToQuestion(si, qi);
    }
  };

  const handleMarkReviewAndNext = () => {
    const q = getCurrentQuestion();
    if (!q) return;
    updateAnswer(q.id, { status: 'MARKED_FOR_REVIEW' });
    handleNext();
  };

  const handleClearResponse = () => {
    const q = getCurrentQuestion();
    if (!q) return;
    updateAnswer(q.id, { selectedOption: null, selectedOptions: [], integerAnswer: null, status: 'NOT_ANSWERED' });
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div><p>Loading test...</p></div>
    </div>
  );

  if (!attempt) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center"><p className="text-red-600 mb-4">Failed to load test</p><button onClick={() => router.push('/student')} className="bg-blue-600 text-white px-4 py-2 rounded">Back to Dashboard</button></div>
    </div>
  );

  const currentQ = getCurrentQuestion();
  const currentSectionObj = attempt?.test?.sections?.[currentSection];

  return (
    <div className="h-screen bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-blue-900 text-white px-6 py-3 flex justify-between items-center flex-shrink-0">
        <img src="/examizLogo.png" alt="Examiz" className="h-10" />
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            {candidateImage && <img src={candidateImage} alt="Candidate" className="w-10 h-10 object-cover" />}
            <span className="font-medium">{candidateName}</span>
          </div>
          <div className="text-right">
            <div className="text-sm">Remaining Time:</div>
            <div className="text-lg font-bold text-yellow-300">{formattedTime}</div>
          </div>
        </div>
      </div>

      {/* Section Nav */}
      <div className="bg-gray-100 px-6 py-2 border-b flex-shrink-0">
        <div className="flex justify-between items-center gap-4">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <button onClick={() => { const c = document.getElementById('section-slider'); if (c) c.scrollBy({ left: -200, behavior: 'smooth' }); }} className="p-2 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 flex-shrink-0">
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div id="section-slider" className="flex-1 overflow-x-auto scrollbar-thin">
              <div className="flex gap-2 py-1">
                {attempt?.test?.sections?.map((section: any, idx: number) => (
                  <button key={section.id} onClick={() => navigateToQuestion(idx, 0)} className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all flex-shrink-0 ${currentSection === idx ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'}`}>
                    {section.name}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={() => { const c = document.getElementById('section-slider'); if (c) c.scrollBy({ left: 200, behavior: 'smooth' }); }} className="p-2 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 flex-shrink-0">
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
          <button onClick={() => setShowSubmitModal(true)} disabled={submitting} className="bg-red-600 text-white px-6 py-2 rounded-md hover:bg-red-700 font-medium disabled:opacity-50 flex-shrink-0">
            {submitting ? 'Submitting...' : 'Submit Test'}
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            <div className="p-6">
              {currentQ && currentSectionObj && (
                <>
                  {(currentSectionObj.questionType === 'SINGLE_CORRECT' || currentSectionObj.questionType === 'MATRIX_MATCH') ? (
                    <MCQQuestion question={currentQ} answer={answers[currentQ.id]} onAnswerChange={(d) => updateAnswer(currentQ.id, d)} questionNumber={currentQuestion + 1} sectionType={currentSectionObj.questionType} marks={currentQ.marks} negativeMarks={currentQ.negativeMarks} />
                  ) : currentSectionObj.questionType === 'MULTIPLE_CORRECT' ? (
                    <MultipleCorrectQuestion question={currentQ} answer={answers[currentQ.id]} onAnswerChange={(d) => updateAnswer(currentQ.id, d)} questionNumber={currentQuestion + 1} marks={currentQ.marks} negativeMarks={currentQ.negativeMarks} />
                  ) : (
                    <IntegerQuestion question={currentQ} answer={answers[currentQ.id]} onAnswerChange={(d) => updateAnswer(currentQ.id, d)} questionNumber={currentQuestion + 1} marks={currentQ.marks} negativeMarks={currentQ.negativeMarks} />
                  )}
                </>
              )}
            </div>
          </div>
          {currentQ && (
            <div className="bg-white border-t border-gray-200 px-6 py-4 flex-shrink-0">
              <div className="flex gap-4 justify-center flex-wrap">
                <button onClick={handlePrevious} disabled={currentSection === 0 && currentQuestion === 0} className="btn-previous px-4 py-2 bg-gray-600 text-white rounded disabled:opacity-50">Previous</button>
                <button onClick={handleNext} className="btn-next px-4 py-2 bg-green-600 text-white rounded">Next</button>
                <button onClick={handleMarkReviewAndNext} className="btn-mark-review px-4 py-2 bg-blue-500 text-white rounded">Mark for Review & Next</button>
                <button onClick={handleClearResponse} className="btn-clear px-4 py-2 bg-red-500 text-white rounded">Clear Response</button>
              </div>
            </div>
          )}
        </div>

        <div className="w-80 bg-gray-50 border-l flex-shrink-0 overflow-y-auto scrollbar-hide flex flex-col">
          <div className="p-4 flex-1">
            {attempt?.test?.sections && (
              <QuestionPalette sections={attempt.test.sections} currentSection={currentSection} currentQuestion={currentQuestion} answers={answers} onQuestionClick={navigateToQuestion} onShowInstructions={() => setShowInstructionModal(true)} />
            )}
          </div>
          <TestStatusBar />
        </div>
      </div>

      <SubmitConfirmationModal isOpen={showSubmitModal} onClose={() => setShowSubmitModal(false)} onSubmit={() => doSubmit(false)} attempt={attempt} answers={answers} submitting={submitting} />
      <WarningModal isOpen={showWarningModal} onOk={handleWarningOk} onTimeout={handleWarningTimeout} warningCount={warningCount} reason="window switching or Alt+Tab" />
      <Modal isOpen={errorModal.show} onClose={() => setErrorModal({ show: false, title: '', message: '' })} title={errorModal.title} showCloseButton={!submitting}>
        <div className="text-center">
          <p className="text-gray-700 mb-4">{errorModal.message}</p>
          {!submitting && <button onClick={() => setErrorModal({ show: false, title: '', message: '' })} className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700">OK</button>}
        </div>
      </Modal>
      <Modal isOpen={showTimeUpModal} onClose={() => {}} title="Time Completed" showCloseButton={false}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-700 mb-4">Time is completed! Your test is being submitted automatically.</p>
          <p className="text-sm text-red-600 font-medium">Please do not leave this page or close the browser.</p>
        </div>
      </Modal>
      <SectionInstructionModal isOpen={showInstructionModal} onClose={() => setShowInstructionModal(false)} section={attempt?.test?.sections?.[currentSection]} />
    </div>
  );
}
