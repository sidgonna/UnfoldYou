// ==================== CARD TEMPLATES ====================
// Shared constants used by both server actions and client components

export const CARD_TEMPLATES = [
    { id: 'midnight', label: 'Midnight', gradient: 'linear-gradient(135deg, #1a1a2e, #16213e)' },
    { id: 'sunset', label: 'Sunset', gradient: 'linear-gradient(135deg, #e65c00, #f9d423)' },
    { id: 'ocean', label: 'Ocean', gradient: 'linear-gradient(135deg, #0f2027, #2c5364)' },
    { id: 'forest', label: 'Forest', gradient: 'linear-gradient(135deg, #134e5e, #71b280)' },
    { id: 'neon', label: 'Neon', gradient: 'linear-gradient(135deg, #f953c6, #b91d73)' },
    { id: 'mono', label: 'Mono', gradient: 'linear-gradient(135deg, #232526, #414345)' },
    { id: 'gold', label: 'Gold', gradient: 'linear-gradient(135deg, #0f0c29, #b8860b)' },
    { id: 'aurora', label: 'Aurora', gradient: 'linear-gradient(135deg, #6b2fa0, #24c6dc)' },
]

export const HABIT_OPTIONS = [
    { key: 'drinking', label: '🍷 Drinking', options: ['Never', 'Socially', 'Regularly'] },
    { key: 'smoking', label: '🚬 Smoking', options: ['Never', 'Sometimes', 'Regularly'] },
    { key: 'fitness', label: '💪 Fitness', options: ['Rarely', 'Sometimes', 'Active', 'Athlete'] },
    { key: 'sleep', label: '😴 Sleep', options: ['Night owl', 'Early bird', 'Flexible'] },
]

export const INTENT_OPTIONS = [
    { value: 'playful_spark', icon: '✨', label: 'Playful Spark', desc: 'Light, fun connections' },
    { value: 'find_my_crowd', icon: '🫂', label: 'Find My Crowd', desc: 'Genuine friendships' },
    { value: 'explore_love', icon: '💜', label: 'Explore Love', desc: 'Different perspectives on love' },
    { value: 'something_real', icon: '🌹', label: 'Something Real', desc: 'Deep, meaningful bond' },
]

export const AVATARS = [
    '🦊', '🐺', '🦉', '🐙', '🦋',
    '🌙', '🔮', '🌊', '🌸', '⭐',
    '🍀', '🎭', '💎', '🌀', '🪐',
    '🦚', '🐉', '🌿', '🫧', '🔥',
]

export const INTEREST_OPTIONS = [
    'Pop', 'Rock', 'Hip-Hop', 'R&B', 'Jazz', 'Classical', 'Electronic', 'Indie',
    'Sci-Fi', 'Romance', 'Thriller', 'Comedy', 'Anime', 'Drama', 'Horror', 'Documentary',
    'Fiction', 'Poetry', 'Self-Help', 'Philosophy',
    'Travel', 'Cooking', 'Gaming', 'Fitness', 'Art', 'Photography', 'Fashion', 'Tech',
    'Nature', 'Astrology', 'Psychology', 'Writing',
]
