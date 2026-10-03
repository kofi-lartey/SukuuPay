import React from 'react';
import { GraduationCap } from 'lucide-react';
import { LogoMark } from '../common/Logo';

/**
 * The header on the public pay page.
 *
 * A parent opens this on a phone from an SMS link, having never heard of
 * SukuuPay. The school is the brand here: the school's name is the largest text
 * on the screen and the product mark is small, because the parent is looking for
 * reassurance that this is the right place to enter a phone number.
 *
 * Deliberately not `Navbar`. This page is unauthenticated, has no account, and
 * must not offer "Sign in" or a marketing menu to someone who wants to pay a
 * bill.
 */
const PayHeader = ({ school }) => (
  <header className="border-b border-slate-200 bg-white">
    <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4 sm:px-6">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-white">
        <GraduationCap className="h-6 w-6" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-extrabold leading-tight tracking-tight text-ink sm:text-lg">
          {school?.name || 'School fees'}
        </h1>
        <p className="truncate text-[12px] font-semibold text-slate-500">
          {school?.schoolCode ? `${school.schoolCode} · ` : ''}Secure fee payment
        </p>
      </div>
      <LogoMark className="h-9 w-9 shrink-0" />
    </div>
  </header>
);

export default PayHeader;
