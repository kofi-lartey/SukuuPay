import React from 'react';
import { renderToString } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../src/context/AuthContext.jsx';
import { ToastProvider } from '../src/context/ToastContext.jsx';
import FinanceOverview from '../src/pages/admin/finance/FinanceOverview.jsx';
import LedgerList from '../src/pages/admin/finance/LedgerList.jsx';
import DisbursementsList from '../src/pages/admin/finance/DisbursementsList.jsx';
import DisbursementDetail from '../src/pages/admin/finance/DisbursementDetail.jsx';
import Reconciliation from '../src/pages/admin/finance/Reconciliation.jsx';
import InvoicesList from '../src/pages/admin/finance/InvoicesList.jsx';
import ApproveBatchModal from '../src/components/admin/finance/ApproveBatchModal.jsx';
import RetryBatchModal from '../src/components/admin/finance/RetryBatchModal.jsx';
import CreateBatchModal from '../src/components/admin/finance/CreateBatchModal.jsx';
import SchoolSelect, {
  SchoolPicker,
  SchoolSummary,
} from '../src/components/admin/finance/SchoolSelect.jsx';
import { CediValue } from '../src/components/dashboard/ui/Tile.jsx';
import * as vocab from '../src/components/admin/finance/financeVocabulary.js';

const wrap = (element, path = '/admin/finance') => (
  <MemoryRouter initialEntries={[path]}>
    <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route path="/admin/finance" element={element} />
          <Route path="/admin/finance/ledger" element={element} />
          <Route path="/admin/finance/disbursements" element={element} />
          <Route path="/admin/finance/disbursements/:batchId" element={element} />
          <Route path="/admin/finance/reconciliation" element={element} />
          <Route path="/admin/finance/invoices" element={element} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  </MemoryRouter>
);

const has = (html, needle) => html.includes(needle);
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

/**
 * A source file with its comments stripped.
 *
 * Needed for the copy that only renders in a state SSR cannot reach — the lists
 * sit on their skeletons because the request never resolves, exactly as
 * `admin-render.jsx:350-361` documents for the users page. Stripping comments
 * matters: asserting that a phrase appears *somewhere* in a file whose header
 * explains the decision in prose would pass without the interface ever saying it.
 */
const stripped = (path) => readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

let pass = 0;
let fail = 0;
const check = (name, fn) => {
  try {
    const detail = fn();
    pass += 1;
    console.log(`  OK   ${name}${detail ? ` — ${detail}` : ''}`);
  } catch (error) {
    fail += 1;
    console.log(`  FAIL ${name}: ${error.message}`);
  }
};

console.log('\nfinance console');

check('every finance page mounts inside the shell wrappers', () => {
  const pages = [
    ['overview', <FinanceOverview />],
    ['ledger', <LedgerList />],
    ['disbursements', <DisbursementsList />],
    ['detail', <DisbursementDetail />],
    ['reconciliation', <Reconciliation />],
    ['invoices', <InvoicesList />],
  ];
  pages.forEach(([name, element]) => {
    renderToString(wrap(element));
    void name;
  });
  return `${pages.length} pages rendered`;
});

check('every money-moving dialog guards its target and names the blast radius', () => {
  // `Modal` portals to `document.body` and `react-dom/server` cannot render a
  // portal at all — which is exactly why the pre-existing `admin-render.jsx`
  // harness never opens a dialog and asserts the copy from source instead. The
  // dialogs are read here with their comments stripped, so a phrase that only
  // appears in a header comment cannot pass the check.
  const approve = stripped('src/components/admin/finance/ApproveBatchModal.jsx');
  for (const needle of [
    'No payout provider is wired, so no money moves',
    'is refused by the server with a 409',
    'formatCedi(netTotal)',
    'disabled={busy',
  ]) {
    assert(approve.includes(needle), `ApproveBatchModal is missing "${needle}"`);
  }
  assert(
    approve.includes('result?.ok'),
    'ApproveBatchModal must branch on { ok } rather than closing unconditionally'
  );
  assert(
    !approve.includes('window.confirm'),
    'ApproveBatchModal must not use window.confirm'
  );

  const retry = stripped('src/components/admin/finance/RetryBatchModal.jsx');
  for (const needle of [
    'The provider&rsquo;s words, as recorded',
    'disabled={busy || permanent}',
    'failureReason',
  ]) {
    assert(retry.includes(needle), `RetryBatchModal is missing "${needle}"`);
  }
  assert(!retry.includes('window.confirm'), 'RetryBatchModal must not use window.confirm');

  const create = stripped('src/components/admin/finance/CreateBatchModal.jsx');
  assert(
    create.includes('periodEnd < periodStart'),
    'CreateBatchModal must catch an inverted window client-side'
  );
  assert(
    create.includes('window is already covered by') || create.includes('window that already has a batch'),
    'CreateBatchModal must state the duplicate-window refusal'
  );
  return 'approve, retry and create each name what they do and refuse the impossible';
});

check('the shared school control and its two variants mount', () => {
  const html = renderToString(
    wrap(
      <>
        <SchoolSelect value="" onChange={() => {}} />
        <SchoolPicker value="" onChange={() => {}} />
        <SchoolSummary school={{ schoolName: 'Big Step', schoolCode: 'BS-01' }} />
      </>
    )
  );
  assert(has(html, 'Every school on the platform'), 'the scope statement is missing');
  assert(has(html, 'Big Step'), 'the school summary did not render');
  assert(has(html, 'BS-01'), 'the school code did not render');
  return 'selector, picker and summary all render';
});

check('pesewas are rendered as cedis, never as pesewas', () => {
  // Rendered directly rather than through a dialog: `CediValue` is the boundary
  // that decides whether a figure is 100x wrong, and it needs no portal and no
  // fetched data to be exercised.
  const html = renderToString(
    wrap(
      <>
        <CediValue pesewas={317050000} />
        <CediValue pesewas={4130000} />
      </>
    )
  );
  assert(has(html, '3,170,500'), '317,050,000 pesewas did not render as cedis');
  assert(has(html, '41,300'), '4,130,000 pesewas did not render as cedis');
  assert(!has(html, '317,050,000'), 'a figure is rendering 100x too large');
  return '317,050,000 pesewa -> GH 3,170,500';
});


check('the reconciliation page states that it writes nothing', () => {
  const html = renderToString(wrap(<Reconciliation />, '/admin/finance/reconciliation'));
  assert(has(html, 'This is a report, and it writes nothing'), 'the read-only statement is missing');
  // The delta card only exists once the day's report has arrived, which SSR cannot
  // reach — so it is asserted against the source. See the note on `stripped`.
  const source = stripped('src/pages/admin/finance/Reconciliation.jsx');
  assert(source.includes('not a discrepancy'), 'the delta is not defused');
  assert(source.includes('deltaCount'), 'the actionable per-school figure is not named');
  return 'read-only stated, delta not labelled a discrepancy';
});

check('the invoices page carries both standing notes and offers no download', () => {
  const html = renderToString(wrap(<InvoicesList />, '/admin/finance/invoices'));
  assert(has(html, 'empty by design'), 'the empty-list note is missing');
  assert(has(html, 'no row at all'), 'the absent-row fact is missing');
  assert(!/Download invoice/i.test(html), 'the screen offers an invoice download');
  return 'both notes present, no document button';
});

check('the ledger page offers a tri-state settlement filter, not a checkbox', () => {
  const html = renderToString(wrap(<LedgerList />, '/admin/finance/ledger'));
  for (const needle of ['All entries', 'Settled only', 'Unsettled only']) {
    assert(has(html, needle), `missing the "${needle}" option`);
  }
  assert(!has(html, 'type="checkbox"'), 'the settled filter is a checkbox');
  return 'All / Settled / Unsettled';
});

check('the disbursements list shows actions only where they apply', () => {
  const html = renderToString(wrap(<DisbursementsList />, '/admin/finance/disbursements'));
  assert(has(html, 'Built from'), 'the creation-date filter is missing');
  // The caveat line and the action cell live under the rows, so source-level.
  const source = stripped('src/pages/admin/finance/DisbursementsList.jsx');
  assert(source.includes('Actions follow status'), 'the status-reflecting note is missing');
  assert(source.includes('canApprove(batch.status)'), 'Approve is not gated on status');
  assert(source.includes('canRetry(batch.status)'), 'Retry is not gated on status');
  return 'both actions gated by status, caveat present';
});

check('the overview keeps four separate figures and says so', () => {
  const html = renderToString(wrap(<FinanceOverview />));
  for (const needle of ['Cash held', 'Owed to schools', 'Disbursed this month']) {
    assert(has(html, needle), `missing "${needle}"`);
  }
  assert(!has(html, 'Collected'), 'a collapsed "collected" figure crept in');
  // The tiles are behind the loaded state, so the fourth tile's label and the
  // non-summable note are asserted against the source with comments stripped.
  const source = stripped('src/pages/admin/finance/FinanceOverview.jsx');
  assert(source.includes('Platform revenue this month'), 'the revenue tile is missing');
  assert(source.includes('not one number'), 'the non-summable note is missing');
  return 'four tiles, and the non-summable note';
});

check('the shared vocabulary exports the shapes the pages depend on', () => {
  const expected = [
    'canApprove',
    'canRetry',
    'weeklyDisbursementSeries',
    'LEDGER_TYPE_IS_CREDIT',
    'DISBURSEMENT_LABEL',
    'periodLabel',
    'todayIsoDay',
    'shiftIsoDay',
    'currentMonthKey',
    'shiftMonthKey',
    'MONEY_MOVED_STATUSES',
  ];
  expected.forEach((name) => assert(vocab[name] !== undefined, `missing export ${name}`));
  assert(vocab.canApprove('pending_approval') === true, 'pending_approval must be approvable');
  assert(vocab.canApprove('paid') === false, 'paid must not be approvable');
  assert(vocab.canRetry('failed') === true, 'failed must be retryable');
  assert(vocab.canRetry('paid') === false, 'paid must not be retryable');

  // An empty week must be an explicit zero, not an omitted point.
  const series = vocab.weeklyDisbursementSeries([], 3);
  assert(series.length === 3, 'the series must always emit every week');
  assert(series.every((point) => point.value === 0), 'empty weeks must be zero');
  return 'helpers agree with the server enum, empty weeks are explicit zeros';
});

check('a paid batch lands in the week it was processed, not the week it was built', () => {
  const processed = '2026-09-30T10:00:00.000Z';
  const series = vocab.weeklyDisbursementSeries(
    [{ status: 'paid', processedAt: processed, netAmount: 250000 }],
    2
  );
  const last = series[series.length - 1];
  assert(last.value === 250000, `the paid batch was not counted (got ${last.value})`);
  assert(series[0].value === 0, 'the earlier week should be empty');
  return 'bucketed on processedAt';
});

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail) process.exitCode = 1;
