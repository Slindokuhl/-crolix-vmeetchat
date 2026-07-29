# CrolixMeet (Crolix VmeetChat)

> Instant video meetings — Agora RTC + Firebase Firestore + vanilla JS.

## Structure
```
src/config/config.js          ← All API keys
src/controllers/VideoCall.js  ← Main app logic
src/ui/icons.js               ← SVG icons
src/ui/templates.js           ← HTML builders
src/utils/avatar.js           ← Avatar colours
src/utils/logoAnimation.js    ← Logo animation
src/utils/screenZoom.js       ← Screen share zoom
styles/base.css               ← Variables & reset
styles/join.css               ← Join screen
styles/meeting.css            ← Meeting screen
styles/modal.css              ← Schedule modal
styles/participants.css       ← Participants panel
styles/zoom.css               ← Screen zoom overlay
styles/responsive.css         ← All media queries
index.html                    ← Entry point
main.js                       ← Bootstrap
```

## Setup
```bash
cp .env.example .env    # fill in your keys
npx serve . --listen 3000
```

## Branch Strategy
```
main      ← production
develop   ← integration
feature/* ← new features (branch from develop)
fix/*     ← bug fixes
```

## Commit Format
```
feat: new feature
fix:  bug fix
chore: maintenance
docs: documentation
style: CSS only
```
