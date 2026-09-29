import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export const useRequireAuth = (redirectPath = '/login') => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  if (!loading && !user) {
    navigate(redirectPath);
  }

  return { user, loading };
};