import React from 'react';
import { Banknote, Receipt, RotateCcw, Search } from 'lucide-react';
import ModuleScaffold from '../../components/dashboard/ModuleScaffold';

/**
 * The Payments module.
 *
 * Read-heavy with three write actions, so the eventual shape is a filterable
 * transaction table with a detail drawer rather than a set of cards: a bursar
 * answering "did this parent pay?" needs a searchable list, and a card grid
 * cannot be scanned for one row.
 *
 * The refunds here are admin-only server-side (`authorize('super_admin',
 * 'school_admin')` in payment.routes.js), which is why the entry is called out
 * rather than assumed available to every role.
 */
const Payments = () => (
  <ModuleScaffold
    title="Payments"
    description="Every Mobile Money payment your school has received, with its receipt."
    action={
      <>
        <Search className="h-4 w-4" />
        Find a payment
      </>
    }
    sections={[
      {
        title: 'Transaction list',
        description: 'Filter by student, class, method, date range or status.',
        endpoint: 'GET /payments',
        icon: Banknote,
      },
      {
        title: 'Payment detail',
        description: 'One payment in full, including the MoMo transaction reference.',
        endpoint: 'GET /payments/:paymentId',
        icon: Receipt,
      },
      {
        title: 'Receipts',
        description: 'Download or share the PDF a parent already paid against.',
        endpoint: 'GET /payments/:paymentId/receipt',
        icon: Receipt,
      },
      {
        title: 'Refunds',
        description: 'Reverse a payment against the student’s balance. Admins only.',
        endpoint: 'POST /payments/:paymentId/refund',
        icon: RotateCcw,
      },
    ]}
    notes={[
      'The parent-facing payment page (/pay/:token) is deliberately outside this module: it is a public, unauthenticated surface, and a bursar never needs to see it while reconciling.',
      'Payment status is driven by the Hubtel webhook, so a row can sit unconfirmed for a moment after the parent paid. That state needs its own visible badge, not a blank value.',
    ]}
  />
);

export default Payments;
