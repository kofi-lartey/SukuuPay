import React, { useState } from "react";
import LmsBulkToolbar from "./LmsBulkToolbar";

export default function BulkLmsManager({ onBack }) {
  const [kind, setKind] = useState("studyplans");
  return (
    <div className="min-h-screen bg-[#F8F9FA] p-4 md:p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900"><span>← Back</span></button>
          <h1 className="text-xl font-bold text-gray-900">Bulk Import / Export</h1>
          <div></div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase">Content Type</label>
            <select value={kind} onChange={(e) => setKind(e.target.value)} className="w-full mt-1 p-3 border border-gray-200 rounded-xl text-sm">
              <option value="studyplans">Study Plans</option>
              <option value="assessments">Assessments</option>
              <option value="lessons">Lessons (embedded)</option>
            </select>
          </div>
          <LmsBulkToolbar kind={kind} />
        </div>
      </div>
    </div>
  );
}