import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, MapPin } from 'lucide-react';
import { COMPANY_ADDRESS, HELPDESK_PHONE, ROUTES } from '../utils/constants';

/**
 * The privacy policy and the terms of service.
 *
 * ### These were one document, which made the privacy policy a lie
 *
 * Both pages rendered the same `SECTIONS` array under different headings, so
 * `/privacy` served the terms of service verbatim under a "Privacy Policy"
 * title. It looked finished and it was linked from the footer and the signup
 * form, and Google's consent screen requires a real privacy policy at a real
 * URL — so the one thing the copy most needed to be was the thing it could not
 * be. The two documents are now separate and each says only what it can.
 *
 * ### Everything below is drawn from what this codebase actually does
 *
 * Data processing is described by reference to the real data flows — the payment
 * gateways in `Backend/src/config/constants.js` (`SMS_PROVIDERS`,
 * `WEBHOOK_PROVIDERS`), the per-school Hubtel credentials on `school.payment`,
 * the columns in `STUDENT_IMPORT_COLUMNS`, the audit log, and the Google sign-in
 * added in `googleIdentity.js`. A policy that describes a processing activity the
 * service does not perform is worse than none: it is a claim somebody else can
 * hold you to. Where a fact is the company's rather than the code's — a retention
 * period, a registration number, a named data protection contact — it is left out
 * rather than invented, because a plausible guess in a legal document is a
 * liability someone else can quote back.
 *
 * ### What is deliberately not claimed
 *
 * No regulatory status is asserted anywhere. "Compliant" is a claim about a
 * relationship with a regulator that only the company can make, and the contact
 * page's "Bank of Ghana / GhIPSS compliant" badge is not repeated here for that
 * reason. Nor is a data residency claim: see the hosting section, which states
 * what is actually true — that records live on infrastructure we operate or
 * contract — rather than asserting a country the Atlas cluster's region should
 * be checked against before it is committed to.
 */

/**
 * The date both documents carry.
 *
 * One constant, because a "last updated" date that differs between the privacy
 * policy and the terms it is cross-linked from is the kind of small inconsistency
 * that undermines both. **Bump this whenever the text below changes** — it is the
 * only edit a substantive revision requires here.
 */
export const LEGAL_LAST_UPDATED = '3 October 2026';

const TERMS_SECTIONS = [
  {
    heading: 'Scope of service',
    body: [
      'SukuuPay provides school fee collection infrastructure for educational institutions in Ghana. That includes mobile money payment processing, receipts, SMS reminders, installment planning, roster and reporting, and the activity log that records who did what.',
      'Access is granted per school and to authorised staff only. SukuuPay is a software provider: it operates the system that records and processes fee payments on your instruction. It is not a bank, and it does not hold funds on deposit.',
    ],
  },
  {
    heading: 'Acceptance of these terms',
    body: [
      'By creating a school account or using the service you accept these terms. If you do not accept them you must not use the service.',
      'These terms may change. The date above is the date of the current version. Material changes will be notified to account administrators before they take effect, and continued use after that date constitutes acceptance.',
    ],
  },
  {
    heading: 'Your account',
    body: [
      'You confirm that you are authorised to represent the institution named in this application and that you may bind it to these terms.',
      'Credentials are personal. Sharing a password or an API key with an unauthorised party may allow transactions to be initiated in your school’s name. You are responsible for every action performed through your account, including by someone you gave access to.',
      'Tell us promptly if you believe an account has been compromised, if a member of staff leaves, or if you suspect unauthorised payments. Sessions opened by the platform owner into your school are recorded and are visible to your administrators in the impersonation history.',
    ],
  },
  {
    heading: 'Fees, payment and settlement',
    body: [
      'SukuuPay charges the fees set out in your subscription plan. Billing is handled by us; the terms of your subscription are confirmed in writing with your account.',
      'Parents pay through the mobile money networks your school has enabled. SukuuPay does not apply a surcharge to the payer. Where a school has configured its own payment gateway account, funds are settled by that gateway directly to the settlement account on your school record; where SukuuPay processes the payment, funds are swept to that same nominated settlement account.',
      'A payment is recorded once the payment gateway confirms it. A record created manually by your staff is an assertion by that staff member, not a settlement.',
      'Refunds and reversals are made against the original payment and are recorded in the payment ledger rather than as a new payment, so a refund is always traceable to the charge it cancels.',
      'Collection charges, taxes or duties imposed by your bank or mobile money operator are outside our control and outside these terms.',
    ],
  },
  {
    heading: 'Student and guardian information',
    body: [
      'Your school is the controller of its own student and guardian records. SukuuPay processes that data on your school’s instructions to provide the service.',
      'You are responsible for having a lawful basis for collecting and using student and guardian data under the Data Protection Act, 2012 (Act 843) — including any notice or consent a guardian requires — and for the accuracy of what your staff enter.',
      'Students are minors. You must not create a student login for the purpose of bypassing a school’s own authorisation process, and you must not use the service to collect data about a child from anyone other than the child’s guardian or the school.',
    ],
  },
  {
    heading: 'Acceptable use',
    body: [
      'You must not use the platform to collect payments for anything other than genuine institutional fees, use payment credentials belonging to another party, attempt to circumvent the fee collection controls applied to your school, or misrepresent a payment or a receipt.',
      'You must not attempt to gain access to another school’s records, probe the service for vulnerabilities without written authorisation, or use the service to send unsolicited bulk messages to numbers that have not been entered as guardians or pupils of your school.',
      'Automated bulk messaging is rate limited by our SMS providers. Sending patterns that breach those limits will result in delivery being suspended rather than in messages being silently dropped.',
    ],
  },
  {
    heading: 'Third-party services',
    body: [
      'The service depends on third parties we do not control, including mobile money networks, payment gateways, SMS gateways, our hosting and image storage providers, and Google for sign-in. Their availability, accuracy and terms are their own.',
      'A payment gateway or SMS provider may be changed by its operator without notice to us. Where that affects a payment in flight, the transaction resolves according to the gateway’s own rules and is reconciled in your ledger.',
    ],
  },
  {
    heading: 'Your content',
    body: [
      'You keep ownership of the student, guardian and payment data you enter. You grant SukuuPay the licence needed to host, process, back up and display that data to you and to the people you authorise, and to send the receipts and reminders your school configures.',
      'We claim no ownership of it. On termination you export your student and payment records, and we then retain or delete them as set out in the privacy policy.',
    ],
  },
  {
    heading: 'Availability and changes',
    body: [
      'We work to keep the service available but do not guarantee uninterrupted operation. Maintenance, provider outages and third-party failures are outside our control.',
      'We may add, change or remove features. Where a change removes a capability your school depends on materially, we will tell you before removing it.',
    ],
  },
  {
    heading: 'Suspension and termination',
    body: [
      'Either party may terminate this arrangement on thirty days’ written notice.',
      'We may suspend or terminate an account immediately where it is used to breach these terms, to act unlawfully, or where continued operation would breach a payment provider’s rules or a regulator’s requirement.',
      'On termination you export your student and payment records. Records are then retained or deleted as described in the privacy policy, including any retention period required of us by law.',
    ],
  },
  {
    heading: 'Disclaimers and liability',
    body: [
      'The service is provided on an as-available basis. To the extent permitted by law we disclaim implied warranties of merchantability, fitness for a particular purpose and non-infringement. We do not warrant that the service will be uninterrupted, error-free, or free of harmful components.',
      'We are not liable for indirect or consequential loss, or for loss of profit, revenue or anticipated savings, arising from the service or from a payment gateway or SMS provider’s failure, whether or not we were told the possibility existed.',
      'Nothing in these terms excludes liability that cannot lawfully be excluded, including for death or personal injury caused by negligence, for fraud, or for any liability that arises from a payment we have collected.',
    ],
  },
  {
    heading: 'Governing law',
    body: [
      'These terms are governed by the laws of the Republic of Ghana and are subject to the exclusive jurisdiction of the courts of Ghana.',
      'Any dispute arising out of a payment made through a mobile money network is first subject to the dispute process of that network.',
    ],
  },
];

const PRIVACY_SECTIONS = [
  {
    heading: 'Who we are',
    body: [
      `SukuuPay Financial Technologies Ltd. is the data controller for the personal data described in this policy. We are located at ${COMPANY_ADDRESS.office}, ${COMPANY_ADDRESS.street}, and can be reached at ${COMPANY_ADDRESS.email}.`,
      'This policy covers this website, the school management console, the parent payment pages, and the support and reminder messages we send for a school.',
    ],
  },
  {
    heading: 'What we collect',
    body: ['We collect only what the service needs, and we collect it from three places:'],
    list: [
      'Account data you give us — your name, email address, phone number, the role and job title you select at signup, and your password. Passwords are stored as salted hashes and are never readable by us or anyone else.',
      'Student and guardian records entered by your school — student name, class, gender, date of birth, parent or guardian name, phone number, email address, relationship to the student, amounts owed and payment deadlines, and any photograph or ID card image your school uploads. This is the school’s data, entered by its staff; we do not collect it from students directly.',
      'Payment records — the amount, the time, the mobile money network, the transaction reference returned by the gateway, the receipt number, and the staff member who recorded the payment. We never see or store a payer’s mobile money PIN, and we do not store full payment card numbers.',
      'Sign-in data — if you sign in with Google, Google tells us your email address and display name at the moment you sign in. We never receive your Google password, and we cannot read anything else from your Google account.',
      'Technical and security data — your IP address, browser and device, session identifiers, and an audit log of who changed which record and when. The audit log is retained deliberately: it is the evidence a school is entitled to when it asks who accessed its records.',
    ],
  },
  {
    heading: 'Why we process it',
    body: [
      'We process personal data to provide the service your school pays for: to collect and record fee payments, to issue receipts, to send the reminders and notifications your school configures, to plan installments, to produce the reports you see, to administer accounts and permissions, and to keep the audit trail.',
      'We also process it to comply with legal obligations that apply to us, including record-keeping and tax requirements under Ghanaian law, and to investigate disputes about a payment.',
      'Where we rely on consent — for example a marketing message that is not a fee reminder — you may withdraw it at any time, and we will stop that processing.',
    ],
  },
  {
    heading: 'Who we share it with',
    body: [
      'We do not sell personal data. We do not share it for advertising, and we do not share it with data brokers.',
      'We share it only with the parties who must process it to deliver the service, and only for that purpose:',
    ],
    list: [
      'Payment gateways, to initiate and confirm a payment and to settle funds — including MTN Mobile Money where your school uses our platform gateway, and Hubtel where your school has configured its own Hubtel account.',
      'SMS gateways, to deliver the messages your school sends — currently Arkesel, mnotify and Hubtel. These providers receive the message content and the destination number.',
      'Our hosting, database and image storage providers, which store the service’s data on our behalf under contract.',
      'A law enforcement, regulatory or court authority, where we are legally required to disclose it, and only the data specifically required.',
    ],
  },
  {
    heading: 'Children’s data',
    body: [
      'Most of the personal data we hold describes children: the students on a school’s roster and their guardians. We process it as a processor on the school’s instructions, not as an independent decision of our own.',
      'We do not create student accounts and we have no direct relationship with students. Guardian contact details are held so that a school can send fee reminders and receipts to the person responsible for a child’s fees.',
      'If you believe a child’s data has been entered without a lawful basis, contact your school first — the school is the controller and can correct its own record — or contact us and we will raise it with them.',
    ],
  },
  {
    heading: 'Where we store it',
    body: [
      'Records are held on infrastructure we operate or contract, with access restricted to staff and to your school’s own authorised users. Data in transit is protected by TLS.',
      'Where a cross-border transfer is necessary to deliver the service — for example to a provider operating outside Ghana — it is made under the lawful basis and safeguards required by the Data Protection Act, 2012 (Act 843). Contact us and we will tell you which providers sit outside Ghana.',
    ],
  },
  {
    heading: 'How long we keep it',
    body: [
      'Student, guardian and payment records are kept for as long as your school’s account is active, and afterwards for the retention period required of us by Ghanaian law, after which they are deleted or irreversibly anonymised.',
      'Account and authentication records are kept while the account is active and for a short period afterwards so that a deleted account cannot be immediately recreated.',
      'Audit logs are kept for the period required to investigate a dispute or an incident, and then reduced.',
      'SMS delivery records are kept as long as the relevant school’s account, because they are the evidence that a reminder was actually sent and delivered.',
    ],
  },
  {
    heading: 'How we protect it',
    body: [
      'Access to records is granted per school and per role, and is enforced on the server rather than in the browser. Passwords are hashed. Administrative actions, including any session opened by the platform owner into a school, are logged and are visible to that school’s own administrators.',
      'Inbound payment callbacks are signature-verified before a payment is marked as settled, so a forged callback cannot create a payment record.',
      'No system is perfectly secure. If a breach affects your data we will notify you and the Data Protection Commission of Ghana as the Act requires.',
    ],
  },
  {
    heading: 'Your rights',
    body: [
      'Under the Data Protection Act, 2012 (Act 843) you have the right to:',
    ],
    list: [
      'be told whether we hold data about you, and see a copy of it (access)',
      'have inaccurate data corrected (rectification)',
      'have data erased where the Act allows it (erasure)',
      'object to processing based on legitimate interests, and to direct processing to absolute marketing suppression (objection and restriction)',
      'withdraw consent where processing relies on it',
      'receive your data in a portable, machine-readable form (data portability)',
    ],
    body2: [
      'Send requests to the email address below. We may ask you to confirm your identity before we disclose anything, and we will respond within the period the Act allows. If a request concerns a record your school controls rather than your own account data, we will direct you to the school, because they are the controller and hold the record.',
      'You also have the right to complain to the Data Protection Commission of Ghana.',
    ],
  },
  {
    heading: 'Cookies and local storage',
    body: [
      'We store your authentication token and a small number of interface preferences, such as how far through the setup wizard you have got, in your browser’s local storage. These are needed for the service to work and are not used to track you across other sites.',
      'We set no advertising cookies and run no cross-site tracking. If analytics are enabled in future, this section will be updated before they are switched on.',
    ],
  },
  {
    heading: 'Changes to this policy',
    body: [
      'We will update the date at the top when this policy changes. If a change materially affects how we use your data, we will notify account administrators by email before it takes effect.',
    ],
  },
];

const TERMS_CROSS_REF = ROUTES.PRIVACY;
const PRIVACY_CROSS_REF = ROUTES.TERMS;

/**
 * The contact block both documents close with.
 *
 * A legal document that names no way to reach the organisation is not much use to
 * anyone exercising a right under it, and the privacy policy in particular has to
 * give a route to the Data Protection Act requests it describes.
 *
 * The phone line is rendered only when `HELPDESK_PHONE` is set, following the same
 * rule as the footer and contact page: a blank that collapses is honest, a
 * published number nobody answers is not.
 */
const LegalContact = ({ mailSubject }) => (
  <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
    <h2 className="text-sm font-extrabold text-ink">How to reach us</h2>
    <div className="mt-4 space-y-3 text-sm text-slate-600">
      <p className="flex items-start gap-2">
        <Mail size={16} className="mt-0.5 shrink-0 text-brand-700" aria-hidden="true" />
        <a
          href={`mailto:${COMPANY_ADDRESS.email}?subject=${encodeURIComponent(mailSubject)}`}
          className="font-semibold text-brand-700 hover:underline"
        >
          {COMPANY_ADDRESS.email}
        </a>
      </p>
      <p className="flex items-start gap-2">
        <MapPin size={16} className="mt-0.5 shrink-0 text-brand-700" aria-hidden="true" />
        <span>
          {COMPANY_ADDRESS.office}, {COMPANY_ADDRESS.street}
        </span>
      </p>
      {HELPDESK_PHONE && <p className="text-slate-500">Support line: {HELPDESK_PHONE}</p>}
    </div>
  </div>
);

/**
 * Renders one legal document.
 *
 * Section numbers are generated rather than typed into the heading strings, which
 * is what the previous version did — so inserting a section silently renumbered
 * nothing and left "1, 2, 4" on the page. Numbering is derived from the array
 * index, so the heading and the position cannot disagree.
 *
 * `body` is an array of paragraphs rather than the single string it used to be
 * because neither of these documents can be written honestly in one string per
 * section. `body2` is the optional closing group of paragraphs, used where a
 * section opens with a list and then needs to say what happens after it.
 *
 * `crossRef` is the **route of the other document**, passed in whole rather than
 * named. It was previously a short string compared against a constant to pick a
 * route, and the comparison was inverted — so each document linked to itself and
 * the "see also" line pointed nowhere useful. Handing over the route removes the
 * only step that could be got backwards.
 */
const LegalPage = ({ title, updated, sections, crossRef, crossLabel, mailSubject }) => (
  <div className="bg-slate-50">
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <Link
        to={ROUTES.HOME}
        className="inline-flex items-center gap-2 text-sm font-bold text-brand-700 hover:underline"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Back to home
      </Link>

      <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
        {title}
      </h1>
      <p className="mt-2 text-sm font-medium text-slate-500">Last updated {updated}</p>

      <div className="mt-8 space-y-8 rounded-3xl border border-slate-100 bg-white p-8 shadow-soft">
        {sections.map((section, index) => (
          <section key={section.heading}>
            <h2 className="text-base font-extrabold text-ink">
              {index + 1}. {section.heading}
            </h2>

            {section.body?.map((paragraph) => (
              <p key={paragraph} className="mt-2 text-sm leading-relaxed text-slate-600">
                {paragraph}
              </p>
            ))}

            {section.list && (
              <ul className="mt-3 space-y-2 pl-5 text-sm leading-relaxed text-slate-600">
                {section.list.map((item) => (
                  <li key={item} className="list-disc marker:text-brand-700">
                    {item}
                  </li>
                ))}
              </ul>
            )}

            {section.body2?.map((paragraph) => (
              <p key={paragraph} className="mt-3 text-sm leading-relaxed text-slate-600">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>

      <LegalContact mailSubject={mailSubject} />

      <p className="mt-6 text-sm text-slate-600">
        See also our{' '}
        <Link to={crossRef} className="font-semibold text-brand-700 hover:underline">
          {crossLabel}
        </Link>
        .
      </p>
    </div>
  </div>
);

export const Terms = () => (
  <LegalPage
    title="Terms of Service"
    updated={LEGAL_LAST_UPDATED}
    sections={TERMS_SECTIONS}
    crossRef={TERMS_CROSS_REF}
    crossLabel="Privacy Policy"
    mailSubject="SukuuPay — Terms of Service"
  />
);

export const Privacy = () => (
  <LegalPage
    title="Privacy Policy"
    updated={LEGAL_LAST_UPDATED}
    sections={PRIVACY_SECTIONS}
    crossRef={PRIVACY_CROSS_REF}
    crossLabel="Terms of Service"
    mailSubject="SukuuPay — Privacy request"
  />
);

export default Terms;