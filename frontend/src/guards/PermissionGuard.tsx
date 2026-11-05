import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserLike } from '@shared/utils/permissions';

interface PermissionGuardProps {
  check: (user: UserLike | null | undefined) => boolean;
  redirectTo?: string;
  children?: React.ReactNode;
}

export function PermissionGuard({ check, redirectTo = '/dashboard', children }: PermissionGuardProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!check(user)) {
    return <Navigate to={redirectTo} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
