import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IdCard, Lock, LogIn } from 'lucide-react';
import AuthShell from '../../components/auth/AuthShell';
import { Field } from '../../components/common/FormField';
import { SubmitButton } from '../../components/auth/OnboardingAside';

import { useAuth } from '../../context/AuthContext';

const StudentLogin = () => {
  const { studentLogin } = useAuth();
  const navigate = useNavigate();
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await studentLogin(studentId, password);
      navigate('/student', { replace: true });
    } catch (err) {
      setError(err.message || 'Invalid student ID or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      aside={null}
      eyebrow="Student sign in"
      title="Welcome back"
      description="Sign in with your Student ID. The default password is 1234567890; you will be asked to change it after signing in."
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
        <Field
          label="Student ID"
          icon={IdCard}
          type="text"
          placeholder="e.g. STU-00123"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          required
        />
        <Field
          label="Password"
          icon={Lock}
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <div className="pt-1">
          <SubmitButton pending={loading} pendingLabel="Signing in…" icon={LogIn}>
            Sign in
          </SubmitButton>
        </div>
        <p className="text-center text-xs text-slate-600">
          <Link to="/login" className="font-bold text-emerald-800 hover:underline">
            School staff login
          </Link>
        </p>
      </form>
    </AuthShell>
  );
};

export default StudentLogin;
