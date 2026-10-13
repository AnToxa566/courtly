import { createContext, useContext } from 'react';
import type { LoginResponse, User } from '@courtly/contracts';

export type AuthContextValue = {
  // Undefined when nobody is signed in.
  user: User | undefined;
  signIn: (response: LoginResponse) => void;
  signOut: () => void;
};

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return value;
}
