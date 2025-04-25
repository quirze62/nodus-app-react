import { useContext } from 'react';
import { UserContext } from '../contexts/NDKProvider';

// Custom hook to access the user context
export function useNodusUser() {
  return useContext(UserContext);
}