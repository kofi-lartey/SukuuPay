import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const SECTIONS = [
  {
    heading: '1. Scope of service',
    body: 'SukuuPay provides school fee collection infrastructure for educational institutions in Ghana, including mobile money payment processing, automated receipts, SMS reminders and installment planning. Access is granted per school, to authorised staff only.',
  },
  {
    heading: '2. Accounts and authorisation',
    body: 'You confirm you are authorised to represent the institution named in this application. Credentials are personal: sharing a password or API key with an unauthorised party may allow transactions to be initiated in the school’s name.',
  },
  {
    heading: '3. Fees and settlement',
    body: 'SukuuPay charges the fees set out in your subscription plan. No parent surcharge is applied to mobile money payments. Funds are swept to the settlement account you nominate on your school record.',
  },
  {
    heading: '4. Data protection',
    body: 'Personal data is processed in line with the Data Protection Act, 2012 (Act 843). Student and guardian records are stored within Ghana and are not shared with third parties outside the delivery of the service.',
  },
  {
    heading: '5. Acceptable use',
    body: 'You must not use the platform to collect payments for anything other than genuine institutional fees, or attempt to circumvent the fee collection controls applied to your school.',
  },
  {
    heading: '6. Termination',
    body: 'Either party may terminate the arrangement with thirty days written notice. On termination you export your student and payment records, after which SukuuPay retains them for the period required by law.',
  },
];

const LegalPage = ({ title, updated }) => (
  <div className="bg-slate-50">
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm font-bold text-brand-700 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to home
      </Link>

      <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
        {title}
      </h1>
      <p className="mt-2 text-sm font-medium text-slate-500">Last updated {updated}</p>

      <div className="mt-8 space-y-6 rounded-3xl border border-slate-100 bg-white p-8 shadow-soft">
        {SECTIONS.map((section) => (
          <section key={section.heading}>
            <h2 className="text-base font-extrabold text-ink">{section.heading}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{section.body}</p>
          </section>
        ))}
      </div>
    </div>
  </div>
);

export const Terms = () => (
  <LegalPage title="Terms of Service" updated="1 January 2026" />
);

export const Privacy = () => (
  <LegalPage title="Privacy Policy" updated="1 January 2026" />
);

export default Terms;
