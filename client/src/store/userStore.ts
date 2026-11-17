import { useState, useEffect, useCallback } from 'react';
import type { User, UserRole } from '@shared/api.interface';

const STORAGE_KEY = 'shunshou_user';
const ADMIN_KEY = 'shunshou_admin';
const LAST_ROLE_KEY = 'shunshou_last_role';

function loadFromStorage<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch (e) {
    // ignore
  }
  return null;
}

function saveToStorage<T>(key: string, value: T | null) {
  try {
    if (value) {
      localStorage.setItem(key, JSON.stringify(value));
    } else {
      localStorage.removeItem(key);
    }
  } catch (e) {
    // ignore
  }
}

export function useUser() {
  const [user, setUserState] = useState<User | null>(() => loadFromStorage<User>(STORAGE_KEY));

  const setUser = useCallback((u: User | null) => {
    saveToStorage(STORAGE_KEY, u);
    setUserState(u);
  }, []);

  const clearUser = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUserState(null);
  }, []);

  return { user, setUser, clearUser };
}

export function useAdmin() {
  const [admin, setAdminState] = useState<{ adminId: string; username: string; name: string; token: string } | null>(
    () => loadFromStorage<{ adminId: string; username: string; name: string; token: string }>(ADMIN_KEY),
  );

  const setAdmin = useCallback((a: { adminId: string; username: string; name: string; token: string } | null) => {
    saveToStorage(ADMIN_KEY, a);
    setAdminState(a);
  }, []);

  const clearAdmin = useCallback(() => {
    localStorage.removeItem(ADMIN_KEY);
    setAdminState(null);
  }, []);

  return { admin, setAdmin, clearAdmin };
}

export function getCurrentUserId(): string | null {
  const user = loadFromStorage<User>(STORAGE_KEY);
  return user?.id ?? null;
}

export function getCurrentUserRole(): UserRole {
  const user = loadFromStorage<User>(STORAGE_KEY);
  return user?.userRole ?? 'buyer';
}

export function getLastRole(): 'buyer' | 'runner' {
  try {
    const raw = localStorage.getItem(LAST_ROLE_KEY);
    if (raw === 'runner' || raw === 'buyer') return raw;
  } catch {
    // ignore
  }
  return 'buyer';
}

export function setLastRole(role: 'buyer' | 'runner'): void {
  try {
    localStorage.setItem(LAST_ROLE_KEY, role);
  } catch {
    // ignore
  }
}
