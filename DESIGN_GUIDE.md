# UnfoldYou — Design Guide

## Components

### Partner Profile Modal

- **Behavior:** Progressive Reveal
- **Visual State: Locked**
  - Content hidden or blurred (`filter: blur(4px)`).
  - Overlay text: "Unlocks at [Stage]".
  - Icon: 🔒 Lock.
- **Visual State: Unlocked**
  - Standard rendering.
  - No blur.

### Fields

- **Voice Note:** Audio player component.
- **Habits:** Tag cloud style.
- **Personal Details:** Grid layout (Location, Age, Height).

### Connections & Requests

- **ConnectionsList (Profile Tab):**
  - List of active connections with a secondary tab interface on the profile page.
  - Action buttons (Chat, Disconnect, Block) use a row layout.
  - Avatar and Shadow Name as the primary focus.
- **RequestsList (New Page):**
  - Clean card-based design for pending requests.
  - "Chat Request" cards highlight the stranger flow message with a subtle background (`var(--brand-faint)`).
  - Primary "Accept" button uses the main brand color.
- **Badge Indicators**:
  - "New" indicators for fresh requests in the chat list.
  - Request counts on the 'Requests' button.
  - **Notification Bell**: Header-based icon with a circular badge for unread counts.
- **Chat Response Bar**:
  - Slide-up CTA bar for pending recipients.
  - Fixed at the bottom of the chat view.
  - Features three clear buttons: Decline, View Profile, and Accept.
