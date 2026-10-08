import React from 'react';
import { QrCode, User, Stamp, Phone, Users, School, CreditCard } from 'lucide-react';
import { TEMPLATE_FIELDS } from '../../utils/constants';

const FIELD_ICON_MAP = {
  showPhoto: User,
  showQr: QrCode,
  showStamp: Stamp,
  showEmergency: Phone,
  showGuardian: Users,
  showClass: School,
  showStudentId: CreditCard,
};

/**
 * TemplateFieldToggles — checkbox grid for toggling card field visibility.
 * Used in the template editor modal.
 */
const TemplateFieldToggles = ({ fields, onChange, audience }) => {
  const getValue = (key) => {
    const field = fields[key];
    if (field === undefined) {
      return TEMPLATE_FIELDS_DEFAULTS[key];
    }
    return field;
  };

  const handleToggle = (key) => {
    onChange(key, !getValue(key));
  };

  return (
    <div className="space-y-2">
      {TEMPLATE_FIELDS.map((field) => {
        const Icon = FIELD_ICON_MAP[field.key];
        const isOn = getValue(field.key);

        return (
          <label
            key={field.key}
            className="flex items-center justify-between rounded-lg border border-slate-200 p-2 cursor-pointer hover:bg-slate-50"
          >
            <div className="flex items-center gap-2">
              {Icon && <Icon className="h-4 w-4 text-slate-500" />}
              <span className="text-sm text-slate-700">{field.label}</span>
            </div>
            <input
              type="checkbox"
              checked={isOn}
              onChange={() => handleToggle(field.key)}
              className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-700/30"
            />
          </label>
        );
      })}
    </div>
  );
};

const TEMPLATE_FIELDS_DEFAULTS = {
  showPhoto: true,
  showQr: true,
  showStamp: true,
  showEmergency: true,
  showGuardian: true,
  showClass: true,
  showStudentId: true,
};

export default TemplateFieldToggles;
