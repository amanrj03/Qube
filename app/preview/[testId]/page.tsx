'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { testAPI } from '../../../services/api';

export default function PreviewTest() {
  const { testId } = useParams<{ testId: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [test, setTest] = useState<any>(null);
  const [currentSection, setCurrentSection] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== 'org') { router.push('/login'); return; }

    testAPI.getTestById(testId).then((res) => {
      const t = res.data;
      // Ownership check — test must belong to this org
      if (t.organizationId && t.organizationId !== user.id) {
        setForbidden(true);
      } else {
        setTest(t);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [testId, user, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentQ = test?.sections?.[currentSection]?.questions?.[currentQuestion];
  const currentSectionObj = test?.sections?.[currentSection];

  const navigate = (si: number, qi: number) => { setCurrentSection(si); setCurrentQuestion(qi); };
  const next = () => {
    if (!test) return;
    if (currentQuestion < currentSectionObj.questions.length - 1) setCurrentQuestion(currentQuestion + 1);
    else if (currentSection < test.sections.length - 1) { setCurrentSection(currentSection + 1); setCurrentQuestion(0); }
  };
  const prev = () => {
    if (currentQuestion > 0) setCurrentQuestion(currentQuestion - 1);
    else if (currentSection > 0) { setCurrentSection(currentSection - 1); setCurrentQuestion(test.sections[currentSection - 1].questions.length - 1); }
  };

  if (loading) return <div className="min-h-screen bg-gray-100 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
  if (forbidden) return <div className="min-h-screen bg-gray-100 flex items-center justify-center"><p className="text-red-600 font-medium">You don't have access to preview this test.</p></div>;
  if (!test) return <div className="min-h-screen bg-gray-100 flex items-center justify-center"><p className="text-red-600">Test not found</p></div>;

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <div className="bg-blue-900 text-white px-6 py-3 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <img src="/examizLogo.png" alt="Examiz" className="h-10" />
          <div>
            <h1 className="text-xl font-bold">Test Preview: {test.name}</h1>
            <p className="text-sm opacity-90">Duration: {Math.floor(test.duration / 60)}h {test.duration % 60}m | Total Marks: {test.totalMarks}</p>
          </div>
        </div>
        <div className="text-right"><div className="text-lg font-bold text-yellow-300">PREVIEW MODE</div><div className="text-sm">Correct answers are shown</div></div>
      </div>

      <div className="bg-gray-100 px-6 py-2 border-b flex gap-2">
        {test.sections.map((s: any, i: number) => (
          <button key={s.id} onClick={() => navigate(i, 0)} className={`px-4 py-2 rounded-t-lg font-medium ${currentSection === i ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
            {s.name} ({s.questions.length})
          </button>
        ))}
      </div>

      <div className="flex">
        <div className="flex-1 p-6">
          {currentQ && (
            <div className="max-w-4xl">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Question {currentQuestion + 1} of {currentSectionObj.questions.length}</h2>
                <div className="text-sm text-gray-600">{currentSectionObj.name} - {currentSectionObj.questionType}</div>
              </div>
              {currentQ.questionImage ? (
                <div className="mb-6">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={currentQ.questionImage} alt={`Question ${currentQuestion + 1}`} className="max-w-full h-auto border border-gray-300 rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
              ) : (
                <div className="mb-6 p-4 bg-gray-100 rounded text-center text-gray-500">Question image not available</div>
              )}
              {currentSectionObj.questionType === 'INTEGER' ? (
                <div className="mb-6 p-4 bg-green-50 border-2 border-green-500 rounded-lg">
                  <div className="text-sm text-green-700 mb-2">Correct Answer:</div>
                  <div className="text-2xl font-bold text-green-800">{currentQ.correctInteger}</div>
                </div>
              ) : (
                <div className="space-y-3 mb-6">
                  {['A', 'B', 'C', 'D'].map((opt) => {
                    const isCorrect = currentSectionObj.questionType === 'MULTIPLE_CORRECT'
                      ? (currentQ.correctOptions || []).includes(opt)
                      : currentQ.correctOption === opt;
                    return (
                      <div key={opt} className={`flex items-center p-4 border-2 rounded-lg ${isCorrect ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}>
                        <div className={`w-4 h-4 rounded-full border-2 mr-3 ${isCorrect ? 'bg-green-500 border-green-500' : 'border-gray-300'}`} />
                        <span className="text-lg font-medium mr-4">{opt}</span>
                        <span className="text-gray-600">Option {opt}</span>
                        {isCorrect && <span className="ml-auto text-green-600 font-bold">✓ Correct</span>}
                      </div>
                    );
                  })}
                </div>
              )}
              {currentQ.solutionImage && (
                <div className="mb-6">
                  <h3 className="text-lg font-medium mb-3">Solution:</h3>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={currentQ.solutionImage} alt={`Solution ${currentQuestion + 1}`} className="max-w-full h-auto border border-gray-300 rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="w-80 bg-gray-50 border-l p-4">
          <h3 className="text-lg font-semibold mb-4">Question Navigation</h3>
          <div className="mb-6">
            <h4 className="text-sm font-medium mb-3">{currentSectionObj?.name}</h4>
            <div className="grid grid-cols-5 gap-2">
              {currentSectionObj?.questions.map((_: any, qi: number) => (
                <button key={qi} onClick={() => navigate(currentSection, qi)} className={`w-8 h-8 flex items-center justify-center text-sm font-medium border-2 rounded ${currentQuestion === qi ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'}`}>{qi + 1}</button>
              ))}
            </div>
          </div>
          <div className="mt-6 p-3 bg-blue-50 rounded text-sm">
            <h4 className="font-medium mb-2">Test Summary</h4>
            <div className="space-y-1">
              <div>Total Questions: {test.sections.reduce((s: number, sec: any) => s + sec.questions.length, 0)}</div>
              <div>Total Marks: {test.totalMarks}</div>
              <div>Duration: {Math.floor(test.duration / 60)}h {test.duration % 60}m</div>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-300 shadow-lg z-50">
        <div className="flex justify-between items-center px-6 py-4">
          <button onClick={prev} disabled={currentSection === 0 && currentQuestion === 0} className="px-6 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 disabled:opacity-50 font-medium">Previous</button>
          <div className="text-center text-lg font-semibold text-gray-800">Question {currentQuestion + 1} of {currentSectionObj?.questions.length} in {currentSectionObj?.name}</div>
          <button onClick={next} disabled={currentSection === test.sections.length - 1 && currentQuestion === currentSectionObj?.questions.length - 1} className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 font-medium">Next</button>
        </div>
      </div>
    </div>
  );
}
