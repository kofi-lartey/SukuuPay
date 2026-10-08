import React from 'react';
import IdCardSheetItem from './IdCardSheetItem';

/**
 * An A4 landscape sheet containing multiple CR80 cards in a grid.
 *
 * Width: 841.89pt, Height: 595.28pt (A4 landscape)
 * Cards are 242.65pt × 153.01pt (CR80 landscape)
 */
const IdCardSheet = ({
  cards = [],
  school,
  layout = '6up_a4_landscape',
  showBacks = false,
  showCutGuides = false,
  side = 'front',
}) => {
  const cardsPerSheet = layout === '6up_a4_landscape' ? 6 : 9;
  const cols = 3;
  const rows = layout === '6up_a4_landscape' ? 2 : 3;

  // Split cards into pages. Each page has cardsPerSheet slots.
  const pages = [];
  for (let i = 0; i < cards.length; i += cardsPerSheet) {
    pages.push(cards.slice(i, i + cardsPerSheet));
  }

  // If we need backs, create back pages interleaved with fronts.
  const allPages = [];
  if (showBacks && side !== 'front') {
    for (let i = 0; i < pages.length; i++) {
      allPages.push({ cards: pages[i], side: 'front', label: `Page ${i + 1} — Fronts` });
      allPages.push({ cards: pages[i], side: 'back', label: `Page ${i + 1} — Backs` });
    }
  } else {
    for (let i = 0; i < pages.length; i++) {
      allPages.push({ cards: pages[i], side: 'front', label: `Page ${i + 1}` });
    }
  }

  const renderSlot = (index, pageCards) => {
    const card = pageCards[index];
    if (!card) {
      return (
        <div
          key={`empty-${index}`}
          className="border border-slate-200 border-dashed"
          style={{ width: '242.65pt', height: '153.01pt' }}
        />
      );
    }

    return (
      <IdCardSheetItem
        key={card.studentId || index}
        card={card}
        side={page.side}
        school={school}
        showCutGuide={showCutGuides}
      />
    );
  };

  return (
    <div className="flex flex-col items-center gap-8 print:gap-0">
      {allPages.map((page, pageIndex) => (
        <div
          key={pageIndex}
          className="id-card-sheet relative mx-auto flex flex-wrap"
          style={{
            width: '841.89pt',
            height: '595.28pt',
            paddingLeft: '12mm',
            paddingRight: '12mm',
            paddingTop: '12mm',
            paddingBottom: '12mm',
            gap: '6mm',
            display: 'flex',
            flexWrap: 'wrap',
            boxSizing: 'border-box',
          }}
        >
          <div
            className="sheet-label absolute -top-6 left-0 text-xs font-medium text-slate-500 print:hidden"
          >
            {page.label}
          </div>
          <div
            className="grid w-full"
            style={{
              gridTemplateColumns: `repeat(${cols}, 242.65pt)`,
              gridTemplateRows: `repeat(${rows}, 153.01pt)`,
              gap: '6mm',
            }}
          >
            {Array.from({ length: cardsPerSheet }).map((_, i) =>
              renderSlot(i, page)
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default IdCardSheet;
