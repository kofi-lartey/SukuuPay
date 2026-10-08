import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Printer } from 'lucide-react';
import IdCardSheet from '../../components/idCards/IdCardSheet';
import { useToast } from '../../hooks/useToast';
import {
  getIdCardBatchPreviewData,
  downloadIdCardBatchPdf,
  getIdCardBatchStatus,
} from '../../services/idCards';
import '../../styles/print.css';

const LAYOUT_LABELS = {
  '6up_a4_landscape': '6 per sheet (3×2)',
  '9up_a4_landscape': '9 per sheet (3×3)',
};

const IdCardBatchPrint = () => {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const { success, error: errorToast } = useToast();

  const [batch, setBatch] = useState(null);
  const [school, setSchool] = useState(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showBacks, setShowBacks] = useState(true);
  const [showCutGuides, setShowCutGuides] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const loadData = useCallback(async () => {
    if (!batchId) return;
    try {
      setLoading(true);
      setError(null);

      // Check status first
      const status = await getIdCardBatchStatus(batchId);

      if (status.status === 'pending' || status.status === 'generating') {
        // Poll if still generating
        setTimeout(loadData, 3000);
        return;
      }

      if (status.status === 'failed') {
        throw new Error(status.generationError || 'Batch generation failed');
      }

      const data = await getIdCardBatchPreviewData(batchId);
      setBatch(data.batch);
      setSchool(data.school);
      setCards(data.cards);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDownloadPdf = async () => {
    try {
      setDownloading(true);
      const result = await downloadIdCardBatchPdf(batchId);
      if (result?.status === 'pending') {
        setTimeout(handleDownloadPdf, 3000);
        return;
      }
      success(`Downloaded ${result}`);
    } catch (err) {
      errorToast(err.message);
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const layoutLabel = batch?.sheetLayout ? LAYOUT_LABELS[batch.sheetLayout] : '6 per sheet';
  const sidesLabel = batch?.sides === 'front_back' ? 'double-sided' : 'single-sided';

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 rounded bg-slate-200" />
            <div className="h-4 w-96 rounded bg-slate-200" />
            <div className="space-y-4">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="h-64 w-full rounded bg-slate-200" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-900">
            {error.message || 'Failed to load batch'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header bar - hidden when printing */}
        <div className="print-hide mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded-xl bg-white p-2 text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h1 className="text-lg font-extrabold text-ink">
              Print Preview — {batch?.totalCards || cards.length} cards ·{' '}
              {batch?.cardsPerSheet || 6} per sheet · {layoutLabel}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              {downloading ? 'Downloading…' : 'Download PDF'}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-extrabold text-white shadow-sm hover:bg-brand-800"
            >
              Print
            </button>
          </div>
        </div>

        {/* Print controls bar - hidden when printing */}
        <div className="print-hide mb-4 flex items-center gap-5 rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={showBacks}
              onChange={(e) => setShowBacks(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-700/30"
            />
            Show backs
          </label>

          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={showCutGuides}
              onChange={(e) => setShowCutGuides(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-700/30"
            />
            Show cut guides
          </label>

          <span className="text-sm text-slate-500">
            Print at A4 landscape · {batch?.cardsPerSheet || 6} cards per sheet ·{' '}
            {sidesLabel} — flip on short edge
          </span>
        </div>

        {/* Preview area */}
        <div className="space-y-6">
          <IdCardSheet
            cards={cards}
            school={school}
            layout={batch?.sheetLayout || '6up_a4_landscape'}
            showBacks={showBacks}
            showCutGuides={showCutGuides}
          />
        </div>
      </div>
    </div>
  );
};

export default IdCardBatchPrint;
