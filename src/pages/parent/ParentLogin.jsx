import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Calendar, Loader2, AlertCircle, CheckCircle2, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../utils/constants';
import { loginWithDob } from '../../services/parent/portal';

/**
 * Parent Portal Login Page
 *
 * Allows parents to access their child's portal by entering the child's
 * name and date of birth (via dropdowns for Day, Month, Year).
 * On success, redirects to the parent portal.
 */
const ParentLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Student name state
  const [studentName, setStudentName] = useState('');
  const [showNameError, setShowNameError] = useState(false);
  
  // Date of birth state - separate dropdowns
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [showDobError, setShowDobError] = useState(false);
  
  // Phone state
  const [phone, setPhone] = useState('');
  const [showPhoneError, setShowPhoneError] = useState(false);
  
  // Form state
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const daySelectRef = useRef(null);
  const monthSelectRef = useRef(null);
  const yearSelectRef = useRef(null);
  const nameInputRef = useRef(null);

  // Generate year options (current year back to 1920)
  const yearOptions = useRef([]);
  if (yearOptions.current.length === 0) {
    const currentYear = new Date().getFullYear();
    for (let y = currentYear; y >= 1920; y--) {
      yearOptions.current.push({ value: String(y), label: String(y) });
    }
  }

  // Month options
  const monthOptions = [
    { value: '', label: 'Month' },
    { value: '01', label: 'January' },
    { value: '02', label: 'February' },
    { value: '03', label: 'March' },
    { value: '04', label: 'April' },
    { value: '05', label: 'May' },
    { value: '06', label: 'June' },
    { value: '07', label: 'July' },
    { value: '08', label: 'August' },
    { value: '09', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ];

  // Generate day options based on selected month/year
  const getDayOptions = (selectedMonth, selectedYear) => {
    const options = [{ value: '', label: 'Day' }];
    // If month/year not selected, show 1-31 as fallback so user can interact
    const maxDay = selectedMonth && selectedYear
      ? new Date(parseInt(selectedYear), parseInt(selectedMonth), 0).getDate()
      : 31;
    for (let d = 1; d <= maxDay; d++) {
      const val = String(d).padStart(2, '0');
      options.push({ value: val, label: val });
    }
    return options;
  };
  
  const dayOptions = getDayOptions(month, year);

  // Focus name input on mount
  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  // Update day options when month or year changes
  useEffect(() => {
    // Reset day if it's no longer valid for the new month/year
    const maxDay = new Date(parseInt(year || '2020'), parseInt(month || '1'), 0).getDate();
    if (day && parseInt(day) > maxDay) {
      setDay('');
    }
  }, [month, year]);

  const validateName = (value) => {
    return value.trim().length >= 2;
  };

  const validateDob = () => {
    if (!day || !month || !year) return false;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return (
      date.getFullYear() === parseInt(year) &&
      date.getMonth() === parseInt(month) - 1 &&
      date.getDate() === parseInt(day) &&
      date <= new Date()
    );
  };

  const validatePhone = (value) => {
    if (!value) return true; // Optional
    const clean = value.replace(/\D/g, '');
    return /^(0|233)[2-9]\d{8}$/.test(clean);
  };

  const handleNameChange = (e) => {
    setStudentName(e.target.value);
    setShowNameError(false);
    setError(null);
  };

  const handleDayChange = (e) => {
    setDay(e.target.value);
    setShowDobError(false);
    setError(null);
  };

  const handleMonthChange = (e) => {
    setMonth(e.target.value);
    setShowDobError(false);
    setError(null);
  };

  const handleYearChange = (e) => {
    setYear(e.target.value);
    setShowDobError(false);
    setError(null);
  };

  const handlePhoneChange = (e) => {
    const clean = e.target.value.replace(/\D/g, '');
    setPhone(clean);
    setShowPhoneError(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setShowNameError(false);
    setShowDobError(false);
    setShowPhoneError(false);

    // Validate student name
    if (!validateName(studentName)) {
      setShowNameError(true);
      setError('Please enter your child\'s name');
      return;
    }

    // Validate DOB
    if (!validateDob()) {
      setShowDobError(true);
      setError('Please select a valid date of birth');
      return;
    }

    // Validate phone if provided
    if (phone && !validatePhone(phone)) {
      setShowPhoneError(true);
      setError('Please enter a valid Ghana phone number');
      return;
    }

    // Construct ISO date string for API
    const dob = `${year}-${month}-${day}`;

    setLoading(true);

    try {
      const data = await loginWithDob(dob, studentName.trim(), phone || undefined);

      // Store token in sessionStorage for the portal
      sessionStorage.setItem('pay_token', data.data.token);

      // Redirect to the portal
      navigate(`/pay/${encodeURIComponent(data.data.token)}`, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    // Allow navigation keys
    if (['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
      return;
    }
    // Only allow digits for phone
    if (e.target.type === 'tel' && !/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  };

  const isFormValid = validateName(studentName) && validateDob();

  return (
    <div className="min-h-dvh flex items-center justify-center bg-[#F7F9F8] px-4 py-10">
      <div className="w-full max-w-md">
        {/* Back to home link */}
        <Link
          to={ROUTES.HOME}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to SukuuPay
        </Link>

        {/* Login Card */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100">
              <svg
                className="h-8 w-8 text-[#0A5C36]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-extrabold text-slate-900">Parent Portal</h1>
            <p className="mt-2 text-sm text-slate-500">
              Enter your child&rsquo;s details to access their records
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div
              className="mb-5 p-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm"
              role="alert"
              aria-live="polite"
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Student Name Field */}
            <div>
              <label
                htmlFor="studentName"
                className="block text-sm font-bold text-slate-700 mb-2"
              >
                Student&rsquo;s Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  ref={nameInputRef}
                  type="text"
                  id="studentName"
                  name="studentName"
                  value={studentName}
                  onChange={handleNameChange}
                  placeholder="Enter child's full name"
                  disabled={loading}
                  className={`
                    w-full pl-10 pr-4 py-3.5 text-base
                    bg-white border-2 rounded-xl
                    placeholder:text-slate-400
                    focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200
                    ${
                      showNameError
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                        : studentName && validateName(studentName)
                        ? 'border-emerald-300 focus:border-emerald-500 focus:ring-emerald-200'
                        : 'border-slate-200 focus:border-emerald-500 focus:ring-emerald-200'
                    }
                    ${loading ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                  aria-label="Student's name"
                  aria-invalid={showNameError}
                  autoComplete="name"
                />
                {studentName && validateName(studentName) && (
                  <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-500" aria-hidden="true" />
                )}
              </div>
              {showNameError && (
                <p className="mt-1.5 text-sm text-red-600" role="alert">
                  Please enter your child's name
                </p>
              )}
            </div>

            {/* Date of Birth Field - Three Dropdowns */}
            <div>
              <label
                className="block text-sm font-bold text-slate-700 mb-2"
              >
                Child&rsquo;s Date of Birth <span className="text-red-500">*</span>
              </label>
              
              <div className="flex gap-3" role="group" aria-label="Date of birth">
                {/* Day Dropdown */}
                <div className="flex-1 relative">
                  <label htmlFor="dobDay" className="sr-only">Day</label>
                  <select
                    ref={daySelectRef}
                    id="dobDay"
                    name="day"
                    value={day}
                    onChange={handleDayChange}
                    disabled={loading}
                    className={`
                      w-full appearance-none px-4 py-3.5 text-base
                      bg-white border-2 rounded-xl
                      focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200
                      ${
                        showDobError
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                          : day && validateDob()
                          ? 'border-emerald-300 focus:border-emerald-500 focus:ring-emerald-200'
                          : 'border-slate-200 focus:border-emerald-500 focus:ring-emerald-200'
                      }
                      ${loading ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                    aria-label="Day"
                    aria-invalid={showDobError}
                  >
                    {dayOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">Day</span>
                </div>

                {/* Month Dropdown */}
                <div className="flex-1 relative">
                  <label htmlFor="dobMonth" className="sr-only">Month</label>
                  <select
                    ref={monthSelectRef}
                    id="dobMonth"
                    name="month"
                    value={month}
                    onChange={handleMonthChange}
                    disabled={loading}
                    className={`
                      w-full appearance-none px-4 py-3.5 text-base
                      bg-white border-2 rounded-xl
                      focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200
                      ${
                        showDobError
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                          : month && validateDob()
                          ? 'border-emerald-300 focus:border-emerald-500 focus:ring-emerald-200'
                          : 'border-slate-200 focus:border-emerald-500 focus:ring-emerald-200'
                      }
                      ${loading ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                    aria-label="Month"
                    aria-invalid={showDobError}
                  >
                    {monthOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">Month</span>
                </div>

                {/* Year Dropdown */}
                <div className="flex-1 relative">
                  <label htmlFor="dobYear" className="sr-only">Year</label>
                  <select
                    ref={yearSelectRef}
                    id="dobYear"
                    name="year"
                    value={year}
                    onChange={handleYearChange}
                    disabled={loading}
                    className={`
                      w-full appearance-none px-4 py-3.5 text-base
                      bg-white border-2 rounded-xl
                      focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200
                      ${
                        showDobError
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                          : year && validateDob()
                          ? 'border-emerald-300 focus:border-emerald-500 focus:ring-emerald-200'
                          : 'border-slate-200 focus:border-emerald-500 focus:ring-emerald-200'
                      }
                      ${loading ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                    aria-label="Year"
                    aria-invalid={showDobError}
                  >
                    {yearOptions.current.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">Year</span>
                </div>
              </div>

              {showDobError && (
                <p className="mt-1.5 text-sm text-red-600" role="alert">
                  Please select a valid date of birth
                </p>
              )}
              <p className="mt-1.5 text-xs text-slate-400">
                Select Day, Month, and Year (e.g., 09 June 2020)
              </p>
            </div>

            {/* Phone Field (Optional) */}
            <div>
              <label
                htmlFor="phone"
                className="block text-sm font-bold text-slate-700 mb-2"
              >
                Your Phone Number <span className="text-slate-400">(optional)</span>
              </label>
              <div className="relative">
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={phone}
                  onChange={handlePhoneChange}
                  onKeyDown={handleKeyDown}
                  placeholder="0244123456"
                  maxLength={10}
                  disabled={loading}
                  className={`
                    w-full px-4 py-3.5 text-base font-mono tabular-nums
                    bg-white border-2 rounded-xl
                    placeholder:text-slate-400
                    focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200
                    ${
                      showPhoneError
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                        : phone && validatePhone(phone)
                        ? 'border-emerald-300 focus:border-emerald-500 focus:ring-emerald-200'
                        : 'border-slate-200 focus:border-emerald-500 focus:ring-emerald-200'
                    }
                    ${loading ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                  aria-label="Your phone number"
                  aria-invalid={showPhoneError}
                  autoComplete="tel"
                />
                {phone && validatePhone(phone) && (
                  <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-500" aria-hidden="true" />
                )}
              </div>
              {showPhoneError && (
                <p className="mt-1.5 text-sm text-red-600" role="alert">
                  Please enter a valid Ghana phone number (e.g., 0244123456)
                </p>
              )}
              <p className="mt-1.5 text-xs text-slate-400">
                Used to verify your identity if multiple children share the same birth date
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !isFormValid}
              className={`
                w-full py-3.5 rounded-xl font-bold text-base transition-colors
                ${loading || !isFormValid
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-[#0A5C36] text-white hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2'
                }
              `}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="animate-spin h-5 w-5" />
                  Verifying...
                </span>
              ) : (
                'Access Portal'
              )}
            </button>
          </form>

          {/* Help Text */}
          <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <svg className="h-5 w-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
              </div>
              <div className="text-sm text-slate-600">
                <p className="font-medium">Can&rsquo;t access the portal?</p>
                <ul className="mt-2 space-y-1 list-disc list-inside">
                  <li>Make sure the name and date of birth match school records</li>
                  <li>Contact the school office for a new payment link</li>
                  <li>Links are reissued each term</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs font-medium text-slate-400">
          Sukuu Sika Mu Nti
        </p>
      </div>
    </div>
  );
};

export default ParentLogin;