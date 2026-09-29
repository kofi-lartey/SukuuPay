import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Hero from '../components/home/Hero';

const Home = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-white">
      <Hero />

      {user && (
        <div className="border-t border-slate-100 bg-slate-50/60">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-6 sm:flex-row sm:px-6 lg:px-8">
            <p className="text-sm font-semibold text-slate-600">
              Welcome back, {user.name || user.email}. Your Term 2 collection is at 87%.
            </p>
            <Link
              to="/dashboard"
              className="group inline-flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-3 text-sm font-bold text-white shadow-lift transition-colors hover:bg-brand-800"
            >
              Go to Dashboard
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
