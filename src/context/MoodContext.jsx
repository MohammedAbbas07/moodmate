import { createContext, useState, useEffect } from 'react';
import { createMoodProfile } from '../utils/moodProfile';
import { getItemById } from '../data/recommendationsData';

export const MoodContext = createContext(null);
const API_BASE_URL = 'http://localhost:8000';

function readLocalSavedItems() {
  try {
    const saved = localStorage.getItem('newMoodMate_saved');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function MoodProvider({ children }) {
  // 1. Mood Profile state with localStorage persistence
  // A profile is absent until the eight-question conversation is complete.
  // Persisted profiles are normalized through the shared completion contract.
  // Empty or legacy default data is removed instead of becoming a visible mood.
  const [moodProfile, setMoodProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('newMoodMate_profile');
      return saved ? createMoodProfile(JSON.parse(saved)) : null;
    } catch {
      return null;
    }
  });

  // 2. Saved Items (Watchlist / Favorites) state with localStorage
  const [savedItems, setSavedItems] = useState(readLocalSavedItems);
  const [watchlistError, setWatchlistError] = useState('');

  // 3. User authenticated session state (for guest or sign-in)
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('newMoodMate_user');
      return saved ? JSON.parse(saved) : { name: 'Guest Explorer', isGuest: true };
    } catch {
      return { name: 'Guest Explorer', isGuest: true };
    }
  });

  // Save to localStorage when updated
  useEffect(() => {
    try {
      if (moodProfile) {
        localStorage.setItem('newMoodMate_profile', JSON.stringify(moodProfile));
      } else {
        localStorage.removeItem('newMoodMate_profile');
      }
    } catch (e) {
      console.warn('LocalStorage error saving mood profile:', e);
    }
  }, [moodProfile]);

  useEffect(() => {
    try {
      localStorage.setItem('newMoodMate_saved', JSON.stringify(savedItems));
    } catch (e) {
      console.warn('LocalStorage error saving favorites:', e);
    }
  }, [savedItems]);

  useEffect(() => {
    try {
      localStorage.setItem('newMoodMate_user', JSON.stringify(user));
    } catch (e) {
      console.warn('LocalStorage error saving user:', e);
    }
  }, [user]);

  useEffect(() => {
    const token = localStorage.getItem('moodmate_token');

    if (!token) {
      // Guests use the existing localStorage watchlist as their fallback.
      setSavedItems(readLocalSavedItems());
      return;
    }

    const loadSavedItems = async () => {
      try {
        // Load saved item IDs from the backend using the user's Bearer token.
        const response = await fetch(`${API_BASE_URL}/api/user/saved-items`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.status === 401) {
          localStorage.removeItem('moodmate_token');
          // Fall back to the guest/local watchlist when the token is unauthorized.
          setSavedItems(readLocalSavedItems());
          return;
        }

        if (!response.ok) {
          throw new Error(`Saved items request failed with status ${response.status}`);
        }

        const data = await response.json();
        const localItemsById = new Map(readLocalSavedItems().map((item) => [String(item.id), item]));
        const databaseItems = (data.saved_items || []).map(({ item_id }) => {
          const itemId = String(item_id);
          return localItemsById.get(itemId) || getItemById(itemId) || { id: itemId, title: itemId };
        });
        setSavedItems(databaseItems);
      } catch (error) {
        console.error('Unable to load saved items:', error);
        setWatchlistError('Unable to load your watchlist. Showing saved items from this device.');
        setSavedItems(readLocalSavedItems());
      }
    };

    loadSavedItems();
  }, [user]);

  // Methods
  const updateMoodProfile = (profile) => {
    setMoodProfile(createMoodProfile(profile));
  };

  const toggleSaveItem = (item) => {
    setWatchlistError('');
    const token = localStorage.getItem('moodmate_token');
    const exists = savedItems.some((savedItem) => savedItem.id === item.id);
    const nextItems = exists
      ? savedItems.filter((savedItem) => savedItem.id !== item.id)
      : [item, ...savedItems];

    // Update immediately so the heart responds before the backend request finishes.
    setSavedItems(nextItems);

    if (!token) {
      // Guests keep watchlist changes in localStorage without making an API call.
      return;
    }

    const syncUrl = `${API_BASE_URL}/api/user/saved-items/${encodeURIComponent(item.id)}`;
    const syncOptions = exists
      ? {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      : {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ item_id: String(item.id) }),
        };

    const syncSavedItem = async () => {
      try {
        // Save or delete the item in the backend with the user's Bearer token.
        const response = await fetch(syncUrl, syncOptions);
        if (response.status === 401) {
          localStorage.removeItem('moodmate_token');
          setWatchlistError('Your session expired. Your watchlist is saved on this device.');
          return;
        }
        if (!response.ok) {
          throw new Error(`Saved item request failed with status ${response.status}`);
        }
      } catch (error) {
        console.error('Unable to sync saved item:', error);
        setWatchlistError(
          exists
            ? 'Unable to remove this item from your account. It was removed from this device.'
            : 'Unable to save this item to your account. It was saved on this device.'
        );
      }
    };

    syncSavedItem();
  };

  const isItemSaved = (itemId) => {
    return savedItems.some((i) => i.id === itemId);
  };

  const loginUser = (userData) => {
    setUser(userData);
  };

  const logoutUser = () => {
    localStorage.removeItem('moodmate_token');
    localStorage.removeItem('moodmate_user_id');
    setUser({ name: 'Guest Explorer', isGuest: true });
  };

  return (
    <MoodContext.Provider
      value={{
        moodProfile,
        updateMoodProfile,
        savedItems,
        toggleSaveItem,
        isItemSaved,
        watchlistError,
        user,
        loginUser,
        logoutUser,
      }}
    >
      {watchlistError && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm rounded-xl border border-red-400/30 bg-[#180d14] px-4 py-3 text-sm text-red-200 shadow-xl" role="alert">
          {watchlistError}
          <button
            type="button"
            onClick={() => setWatchlistError('')}
            className="ml-3 text-red-300/70 hover:text-red-200"
            aria-label="Dismiss watchlist error"
          >
            Dismiss
          </button>
        </div>
      )}
      {children}
    </MoodContext.Provider>
  );
}

export { useMood } from '../hooks/useMood';
export default MoodContext;


