# UnfoldYou — User Flow

### 1. Onboarding (First App Launch)

- **Step 1: Basic Info** (Real Identity - Private)
  - Name, DOB, Height, Gender, Location (City/Country).
- **Step 2: Real Identity Media** (New)
  - **Profile Picture:** Upload photo for "Unfold" reveal.
  - **Voice Note:** Record 30s audio for "Whisper" reveal.
- **Step 3: Vibe Check**
  - Habits (Drinking, Smoking, etc.) & Intent (Why are you here?).
- **Step 4: Shadow Profile** (Public Identity)
  - Shadow Name, Avatar Selection, Pronouns, Social Energy, Bio.
  - **Sound of the Week:** Spotify/YouTube link.
- **Step 5: Interests**
  - Select 3-15 tags.
- **Step 6: Love Soul** (Psychology)
  - 3 multiple-choice questions about attachment/conflict.
- **Step 7: The Big Question**
  - Open-ended "What is love?" (min 20 chars).
- **Completion:**
  - Creates 2 database entries: `profiles` (Real) and `shadow_profiles` (Shadow).
  - Uploads media to Supabase Storage.
  - Redirects to `/feed` (Shadow Feed).

## Chat & Progressive Reveal

### Stranger Connection

1. **Initial State (Shadow)**
   - Header: Shadow Name + Avatar
   - Profile Modal: Shows Shadow details. "Real Identity" section is visibly present but locked/blurred.
2. **Milestone 1: Whisper (25 msgs)**
   - **Unlock:** Voice Note
   - **Visual:** Voice player appears in modal.

3. **Milestone 2: Glimpse (50 msgs + 3 days)**
   - **Unlock:** Intent & Habits
   - **Visual:** Intent text & Habit tags appear.

4. **Milestone 3: Soul (100 msgs + 7 days)**
   - **Unlock:** Love Soul Q&A
   - **Visual:** Deep Q&A answers appear (Implementation Pending).

5. **Milestone 4: Unfold (Request)**
   - **Unlock:** Full Real Identity
   - **Visual:** Real Name, Photo, Age, Height, Location unlocked. Header updates.

### Known Connection

### Connections Management

1. **Viewing New Requests**
   - **Notifications**: Users are alerted to new connection requests via the global **Notification Bell** in the top header.
   - **Requests Hub**: Accessed via the "Requests" link in the **Chat** tab.
   - Route: `/requests`.
   - **Chat Requests**: Clicking a request in the Requests page opens the **Chat Room** directly in a "pending" state for stranger connections.
   - Recipients see the initial message and a CTA bar to **Accept**, **Decline**, or **View Profile**.

2. **Accepting a Request**
   - Clicking "Accept" (either in `/requests` or the Chat Room) updates the status to 'accepted'.
   - Redirection: If accepted from `/requests`, redirects to the sender's **Shadow Profile**. If accepted from Chat, the chat interface unlocks immediately.

3. **Active Connections**
   - Moved to the **You** (Profile) page under a dedicated "Connections" tab.
   - Displays all currently active connections (both Stranger and Known).
   - Provides quick actions: **Chat**, **Disconnect**, **Block**.
   - Clicking a connection goes to their profile.
