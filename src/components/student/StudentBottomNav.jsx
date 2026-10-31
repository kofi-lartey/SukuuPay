import React from 'react';
import { NavLink } from 'react-router-dom';
import { BookOpen, CreditCard, GraduationCap, LayoutDashboard, MessageSquare } from 'lucide-react';
import { STUDENT_ROUTES } from '../../utils/constants';

const ITEMS = [
  { to: STUDENT_ROUTES.dashboard, icon: LayoutDashboard, label: 'Home' },
  { to: STUDENT_ROUTES.grades, icon: GraduationCap, label: 'Grades' },
  { to: STUDENT_ROUTES.fees, icon: CreditCard, label: 'Fees' },
  { to: STUDENT_ROUTES.messages, icon: MessageSquare, label: 'Messages' },
  { to: STUDENT_ROUTES.lms, icon: BookOpen, label: 'LMS' },
];

const StudentBottomNav = () => (
  <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white lg:hidden">
    <ul className="grid grid-cols-5">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2 text-[10px] font-bold ${isActive ? 'text-brand-700' : 'text-slate-500'}`
              }
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              {item.label}
            </NavLink>
          </li>
        );
      })}
    </ul>
  </nav>
);

export default StudentBottomNav;
