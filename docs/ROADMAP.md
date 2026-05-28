# Roadmap

## Short-Term Goals

Build the core app experience first.

Priority features:

- Manga-inspired visual design
- Multiple chatrooms
- User login and authentication
- Basic message sending and reading
- Responsive layout
- Clear navigation between rooms
- Strong visual consistency based on curated concept art

The short-term goal is to make the app feel visually distinct and usable before adding advanced AI features.

## Current Implementation Focus

When building the first version, focus on:

1. Authentication flow
2. Chatroom list
3. Individual chatroom view
4. Message input and display
5. Room-specific visual personality
6. Clean component structure
7. Browser-verified UI polish
8. Backend API contracts for rooms, avatars, messages, and later authentication

Do not overbuild backend or AI infrastructure before the core app works.

The backend phase has started with simple Next.js route handlers and a file-backed development store. The frontend now uses the API for account creation, credential login, dev sessions, profile preferences, and message reads/writes. Server-side message creation validates the session, room, avatar, character limit, and presentation. Next steps are session expiration/logout, a SQLite persistence adapter following `docs/DATABASE.md`, and expanding backend coverage beyond the current happy path.

## Medium-Term Goals

After the base chat app is working, improve the experience with:

- Room-specific themes
- Character/world-specific UI language
- Better chatroom organization
- User profiles
- Avatar or character identity options
- Message reactions
- Basic animation and transition polish
- More expressive chat bubble variants
- Saved room style presets

## Long-Term Goals

Long-term, the app may integrate AI-assisted manga-style communication.

Possible future AI features:

- AI message masking so user messages can be rewritten in the voice of an emulated character
- Context classification so the app understands the tone, purpose, and social context of a message
- Character/world-specific phrasing
- AI-assisted room theming
- AI-generated visual effects for important messages
- Image generation for manga-style motion panels
- Keyframe-like animated moments that convey manga-style motion without becoming overly smooth or generic
- AI-generated expressive message presentation based on message emotion or intent

These features should be planned for architecturally, but not implemented until explicitly requested.

## Non-Goals for Early Versions

Do not prioritize these in the first version unless directly asked:

- Full AI character emulation
- Production-scale moderation system
- Complex animation generation
- Image generation pipeline
- Overly complex theme editor
- Microservice architecture
- Premature database optimization
- Large dependency-heavy design system

## Guiding Principle

Build the simplest useful version first, but make sure the visual identity is strong from the beginning.
