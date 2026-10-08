import React from 'react';
import IdCardSheet from '../idCards/IdCardSheet';

export const PLACEHOLDER_CARDS = Array.from({ length: 9 }, (_, i) => ({
  studentId: `PBS-2025-000${i + 1}`,
  studentName: ['Kwame Mensah', 'Akosua Boateng', 'Yaw Owusu', 'Abena Asante', 'Kofi Darko', 'Ama Adjei', 'Kojo Antwi', 'Esi Mensah', 'Kwabena Osei'][i],
  studentClass: `JHS ${(i % 3) + 1}A`,
  guardianName: 'Mrs. Akosua Mensah',
  guardianPhone: '024 412 3456',
  emergencyContact: 'Auntie Ama · 024 455 6677',
  academicYear: '2025/2026',
  schoolName: 'Prampram Basic School',
  schoolMotto: 'Knowledge is Light',
  schoolCode: 'PBS',
}));

/**
 * Live preview of ID card settings.
 * Shows an A4 landscape sheet with the selected layout, using real data
 * if available, or placeholder cards otherwise.
 */
const IdCardLivePreview = ({ settings, school, cards }) => {
  const displayCards = cards && cards.length > 0
    ? cards.map((c) => ({
        ...c,
        showPhoto: c.showPhoto !== false && settings.showPhoto,
        showQr: c.showQr !== undefined ? c.showQr : settings.showQr,
        showStamp: c.showStamp !== undefined ? c.showStamp : settings.showStamp,
      }))
    : PLACEHOLDER_CARDS.slice(0, settings.sheetLayout === '9up_a4_landscape' ? 9 : 6).map((c) => ({
        ...c,
        showPhoto: settings.showPhoto,
        showQr: settings.showQr,
        showStamp: settings.showStamp,
      }));

  const layout = settings.sheetLayout || '6up_a4_landscape';
  const showBacks = settings.sides === 'front_back';

  return (
    <div className="sticky top-6">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
        Live preview — updates as you change settings
      </p>

      <div
        className="overflow-auto rounded-xl bg-white p-4 shadow-lg"
        style={{
          transform: 'scale(0.55)',
          transformOrigin: 'top left',
          width: 'fit-content',
        }}
      >
        <IdCardSheet
          cards={displayCards}
          school={school}
          layout={layout}
          showBacks={showBacks}
          showCutGuides={settings.includeCutGuides}
        />
      </div>
    </div>
  );
};

export default IdCardLivePreview;
