import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { auth } from '../services/index.js';

export function AdminGuard({ children }) {
  const [session, setSession] = useState(undefined);
  const location = useLocation();

  useEffect(() => {
    let active = true;
    auth.getSession().then((sess) => {
      if (active) setSession(sess);
    });
    return () => {
      active = false;
    };
  }, [location.pathname]);

  if (session === undefined) return null;

  if (!session) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  return children;
}
