import React from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../utils/constants';

/**
 * The privacy policy and terms of service links, as one reusable pair.
 *
 * ### Why this is a component and not two `<Link>`s per shell
 *
 * `SiteFooter` carried these links and nothing else did, so they were reachable
 * only from the marketing pages and the auth screens. The dashboard, the platform
 * console and the onboarding wizard each have their own shell and none of them
 * rendered a footer, which made the legal documents unreachable from exactly
 * where most people are when they go looking: a signed-in bursar inside the app,
 * and a school admin halfway through setting up their account.
 *
 * Copying the pair into three more files would have reproduced the problem this
 * component removes — the next shell added would not have them either.
 */
const LEGAL_LINKS = [
  { to: ROUTES.PRIVACY, label: 'Privacy' },
  { to: ROUTES.TERMS, label: 'Terms' },
];

/**
 * @param {string} className  applied to the wrapper, so each shell can align the
 *                            pair without this component knowing where it sits
 */
const LegalLinks = ({ className = '' }) => (
  <nav aria-label="Legal" className={`flex items-center gap-4 ${className}`}>
    {LEGAL_LINKS.map((link) => (
      <Link
        key={link.to}
        to={link.to}
        className="text-xs font-semibold text-slate-500 transition-colors hover:text-brand-700"
      >
        {link.label}
      </Link>
    ))}
  </nav>
);

export default LegalLinks;