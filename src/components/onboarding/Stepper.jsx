import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Check, CreditCard, MessageSquare, Users } from 'lucide-react';
import { ONBOARDING_STEPS } from '../../utils/constants';

const ICONS = { Building2, CreditCard, Users, MessageSquare };

/**
 * Four-step progress rail.
 *
 * A step is clickable only once it has been reached — `highestStep` is the
 * furthest index the admin has unlocked. That keeps the stepper from being a
 * way to skip payment setup, which is a required step.
 *
 * Collapses to a "Step X of 4" pill below `md`; the four-node rail would need
 * either horizontal scroll or unreadable 2-character labels at that width.
 */
const Stepper = ({ currentStep, highestStep }) => {
  const navigate = useNavigate();
  const currentIndex = Math.max(0, ONBOARDING_STEPS.findIndex((s) => s.id === currentStep));
  const percent = Math.round(((currentIndex + 1) / ONBOARDING_STEPS.length) * 100);

  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 lg:px-8">
        {/* Mobile: compact pill + progress bar */}
        <div className="md:hidden">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-extrabold text-ink">
              Step {currentIndex + 1} of {ONBOARDING_STEPS.length}
            </p>
            <p className="text-[12px] font-bold text-brand-700">{ONBOARDING_STEPS[currentIndex].label}</p>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-brand-600 transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {/* Desktop: node rail with connecting lines */}
        <nav aria-label="Onboarding progress" className="hidden md:block">
          <ol className="flex items-center">
            {ONBOARDING_STEPS.map((step, index) => {
              const Icon = ICONS[step.icon] || Building2;
              const isCurrent = index === currentIndex;
              const isComplete = index < currentIndex;
              const isReachable = index <= highestStep;
              const isLast = index === ONBOARDING_STEPS.length - 1;

              return (
                <li key={step.id} className={`flex items-center ${isLast ? '' : 'flex-1'}`}>
                  <div className="flex min-w-0 flex-col items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => isReachable && navigate(`/onboarding/${step.id}`)}
                      disabled={!isReachable}
                      aria-current={isCurrent ? 'step' : undefined}
                      className={`flex h-11 w-11 items-center justify-center rounded-full border-2 transition-colors ${
                        isComplete
                          ? 'border-brand-600 bg-brand-600 text-white'
                          : isCurrent
                            ? 'border-brand-700 bg-brand-50 text-brand-700'
                            : 'border-slate-200 bg-white text-slate-300'
                      } ${isReachable && !isCurrent ? 'hover:border-brand-400 hover:text-brand-600' : ''} ${
                        isReachable ? 'cursor-pointer' : 'cursor-not-allowed'
                      }`}
                    >
                      {isComplete ? (
                        <Check className="h-5 w-5" aria-hidden="true" />
                      ) : (
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      )}
                    </button>
                    <span
                      className={`whitespace-nowrap text-[12px] ${
                        isCurrent
                          ? 'font-extrabold text-brand-800'
                          : isComplete
                            ? 'font-bold text-brand-700'
                            : 'font-semibold text-slate-400'
                      }`}
                    >
                      {step.label}
                    </span>
                    <span className="sr-only">
                      {isComplete ? 'Completed. ' : isCurrent ? 'Current step. ' : ''}
                    </span>
                  </div>

                  {!isLast && (
                    // `self-start` + a 22px offset puts the connector on the
                    // vertical centre of the 44px icon, rather than the centre
                    // of the whole icon+label column.
                    <span
                      aria-hidden="true"
                      className={`mx-3 mt-[22px] h-0.5 flex-1 self-start rounded-full ${
                        isComplete ? 'bg-brand-500' : 'bg-slate-200'
                      }`}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      </div>
    </div>
  );
};

export default Stepper;
