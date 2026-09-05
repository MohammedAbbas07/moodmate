import { useContext } from 'react';
import { MoodContext } from '../context/MoodContext';

export function useMood() {
  const context = useContext(MoodContext);
  if (!context) {
    throw new Error('useMood must be used within a MoodProvider');
  }
  return context;
}

export default useMood;
