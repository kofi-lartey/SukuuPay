import React from 'react';
import { MessageSquare, ShieldCheck } from 'lucide-react';
import PhonePreview from './PhonePreview';
import { SMS_SEGMENT_LENGTH } from '../../utils/constants';

/** Renders `{token}` placeholders so the preview never shows a raw merge field. */
const resolveTemplate = (template, values) =>
  Object.entries(values || {}).reduce(
    (out, [key, value]) => out.replaceAll(`{${key}}`, value == null || value === '' ? '—' : String(value)),
    template || ''
  );

/**
 * Mock SMS thread showing the reminder a parent will actually receive.
 *
 * The segment counter is the point of this card: anything past
 * `SMS_SEGMENT_LENGTH` characters bills as multiple SMS, which on a 500-parent
 * roster is a real cost, so the warning appears before the admin sends rather
 * than on the invoice.
 */
const MomoPreviewCard = ({ template, values = {}, sender = 'SukuuPay' }) => {
  const message = resolveTemplate(template, values);
  const segments = Math.max(1, Math.ceil(message.length / SMS_SEGMENT_LENGTH));
  const overBudget = message.length > SMS_SEGMENT_LENGTH;

  return (
    <PhonePreview label="SMS reminder preview" footer="Delivered to the parent's handset">
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-700 text-white">
            <MessageSquare className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[12px] font-extrabold text-ink">{sender}</span>
            <span className="block text-[10px] font-semibold text-slate-400">SMS · now</span>
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-3.5 py-4">
          <div className="max-w-[95%] rounded-2xl rounded-tl-md bg-brand-700 px-3.5 py-2.5 text-[12px] font-medium leading-relaxed text-white shadow-sm">
            {message}
          </div>
          <p className="mt-1.5 pl-1 text-[10px] font-semibold text-slate-400">Delivered</p>

          <div className="mt-5 flex items-center justify-center gap-1.5 text-[10px] font-semibold text-slate-400">
            <ShieldCheck className="h-3 w-3" />
            Never share your payment code
          </div>
        </div>
      </div>

      <div
        className={`border-t px-4 py-2.5 text-center text-[11px] font-bold ${
          overBudget ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-slate-200 bg-white text-slate-500'
        }`}
      >
        {message.length} characters · {segments} SMS {segments === 1 ? 'segment' : 'segments'}
        {overBudget && ' — will be billed as multiple messages'}
      </div>
    </PhonePreview>
  );
};

export default MomoPreviewCard;
