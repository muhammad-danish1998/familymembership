import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

export function FamilyGuard({ children }) {
  const [hasToken, setHasToken] = useState(null);
  const location = useLocation();

  useEffect(() => {
    const token = sessionStorage.getItem('ff_family_token');
    setHasToken(!!token);
  }, [location.pathname]);

  if (hasToken === null) return null;

  if (!hasToken) {
    return <Navigate to="/family" replace />;
  }

  return children;
}
