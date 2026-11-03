import React from "react";
import { ArrowLeft, Clock, FileText, CheckCircle2, Play } from "lucide-react";

export default function AssessmentPreview({ assessment, onStart, onBack }) {
  const questions = assessment?.questions || [];
  const mcqCount = questions.filter((q) => q.type === "multiple_choice").length;
  const essayCount = questions.filter((q) => q.type === "essay").length;

  return (
    <div className="min-h-screen bg-[#F8F9FA] p-4 md:p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900"><ArrowLeft className="w-4 h-4" /><span>Back</span></button>
          <h1 className="text-xl font-bold text-gray-900">Assessment Preview</h1>
          <div></div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 bg-gradient-to-r from-emerald-50 to-white border-b border-gray-100">
            <h2 className="text-2xl font-extrabold text-gray-900">{assessment?.title}</h2>
            <p className="text-sm text-gray-600 mt-1">{assessment?.instructions || "Read all instructions carefully before starting."}</p>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 rounded-xl text-center">
              <p className="text-2xl font-bold text-gray-900">{questions.length}</p>
              <p className="text-xs text-gray-500">Total Questions</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl text-center">
              <p className="text-2xl font-bold text-gray-900">{mcqCount}</p>
              <p className="text-xs text-gray-500">Multiple Choice</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl text-center">
              <p className="text-2xl font-bold text-gray-900">{essayCount}</p>
              <p className="text-xs text-gray-500">Essay</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl text-center">
              <p className="text-2xl font-bold text-gray-900">{assessment?.durationMinutes ? `${assessment.durationMinutes}m` : "∞"}</p>
              <p className="text-xs text-gray-500">Time Limit</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h3 className="font-bold text-gray-900 flex items-center space-x-2"><FileText className="w-5 h-5 text-emerald-700" /><span>Assessment Details</span></h3>
          <p className="text-sm text-gray-600">This assessment contains {questions.length} questions. Click "Start Assessment" to begin. Questions will be shown one at a time.</p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start space-x-3">
          <Clock className="w-5 h-5 text-amber-700 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900">Important Notes</p>
            <p className="text-xs text-amber-800 mt-1">Ensure stable internet connection. You cannot go back after submitting. Auto-saved answers may apply.</p>
          </div>
        </div>

        <div className="flex items-center justify-center">
          <button onClick={() => onStart && onStart(assessment)} className="px-8 py-3 bg-[#006837] text-white rounded-xl font-semibold hover:bg-emerald-900 flex items-center space-x-2 shadow-lg shadow-emerald-900/10">
            <Play className="w-5 h-5" />
            <span>Start Assessment</span>
          </button>
        </div>
      </div>
    </div>
  );
}