import React from 'react';
import { Link } from 'react-router-dom';

const LogoMark = ({ className = 'w-10 h-10', markClassName = 'text-lg' }) => (
  <div
    className={`${className} rounded-xl bg-brand-700 flex items-center justify-center text-white shadow-lift shrink-0`}
    aria-hidden="true"
  >
    <span className={`font-extrabold tracking-tight ${markClassName}`}>S</span>
  </div>
);

const Logo = ({ className = '', markClassName = 'text-lg', to = '/' }) => (
  <Link to={to} className={`flex items-center gap-2.5 ${className}`} aria-label="SukuuPay home">
    <LogoMark markClassName={markClassName} />
    <span className="text-xl sm:text-2xl font-extrabold tracking-tight text-ink">
      Sukuu<span className="text-brand-700">Pay</span>
    </span>
  </Link>
);

export default Logo;
export { LogoMark };
