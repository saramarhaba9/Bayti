# بيتي | Bayti — shared meal planner & smart shopping list

Arabic, RTL, mobile-first web app for two household members: recipes, weekly planner, automatic ingredient aggregation, home inventory, and a real-time shared shopping list. No app store; open the URL and optionally "Add to Home Screen".

**Status:** the core logic has 27 passing unit tests. The Firebase integration, security rules and UI have **not** been run against a real project or the emulator by the author. Run the *Verify* checklist first.

**Runs on Firebase's free Spark plan** (Auth + Firestore only; no Cloud Functions, no billing account).

## Features
Recipes · weekly planner with per-meal servings and ingredient snapshots · unit-safe aggregation · shopping list (checkboxes, manual items, quantity override, breakdown, progress, optional "record purchases to inventory") · inventory · history (archive, copy week, reactivate) · email/password accounts + invites · real-time sync.

## Structure
```
index.html  css/styles.css
js/ app · auth · dates · validation · labels · store · firebase-config · firebase-sdk
js/modules/  unit-conversion · ingredient-aggregation · shopping-sync · shopping-view · week-management  (pure, tested)
js/services/ data-service (Firestore listeners/writes) · household-service (create/invite/join via rules)
js/ui/       dashboard · planner · recipes · shopping · inventory · history · household · auth · helpers
firestore.rules  firestore.indexes.json  firebase.json
tests/ engine · validation · shopping (unit)   tests/emulator/rules.spec.js (security rules)
```

## Data model
- `users/{uid}`: displayName, householdId (null → set once, only if your member document exists), createdAt
- `invites/{lowercase-email}`: householdId, email, invitedBy, createdAt, expiresAt (7 days)
- `households/{hid}`: name, ownerId, defaultWeekStart, createdAt, updatedAt · `members/{uid}`: userId, role (owner|member), displayName, joinedAt
- `ingredients/{i_<name>}`, `inventory/{ingredientId__unitGroup}`, `recipes/{id}` (ingredients[], instructions[])
- `weeks/{YYYY-MM-DD}` (status active|archived) → `meals/{id}` (with `ingredientsSnapshot`, so recipe edits/deletes never alter planned or past meals) and `shoppingItems/{id}` (generated | manual; optional overrideQuantity, recorded, orphaned)
- Dates are `YYYY-MM-DD` strings with UTC arithmetic (no timezone drift).

## Security & invitations (rules only)
Clients cannot edit `households/*` after creation, change member roles, or reassign the owner. A household is created in one atomic batch (household + owner member + profile link). To invite: the owner writes `invites/<email>`. The invitee must sign up with that exact email, **verify it**, then press "انضمام": a batch adds them as `member`, deletes the invite (single use) and links their profile. The rules require a verified email matching an unexpired invite for that household. There is no code or link to leak.
Trade-offs vs a server: rules cannot count, so there is no hard cap on members (the owner controls who is invited), and rules-only logic is covered only by emulator tests that you must run.

## Setup (free plan)
1. Firebase console → create project → add **Web app** → copy config into `js/firebase-config.js`.
2. Authentication → enable **Email/Password**; Settings → **Authorized domains** → add `<username>.github.io`.
3. Firestore Database → create (production mode) → **Rules** tab → paste `firestore.rules` → **Publish**.
4. Upload the files to a GitHub repo → Settings → Pages → `main` / root.

CLI alternative: `npm i && npx firebase deploy --only firestore:rules`. Local run: `npm run serve` → http://localhost:8000.

## Tests
`npm test` (unit) · `npm run test:rules` (emulator; needs Java): cross-household access, role/owner changes, household creation, invite ownership, join (verified/unverified/expired/wrong household/escalation), concurrent edits, field validation.

## Verify
Sign up A → create household → add recipe → plan meal → shopping list fills · invite B's email · B signs up, verifies, presses انضمام · A checks an item → B sees it · B edits inventory → A's quantities change · start new week (copy) → old week intact.

## Known limitations
Offline writes wait for connection · other member's changes re-render the screen (search box may lose focus) · generated shopping items can't be deleted (remove the meal or override qty to 0) · recording purchases to inventory is once per item · no ingredient merge tool, image upload, or password reset screen · no member-count cap.

## Troubleshooting
"لم يتم ضبط Firebase" → fill `firebase-config.js`. "تعذّر الانضمام" → verify email, press "تحققت من بريدي", use the exact invited email, make sure the latest rules are published. Missing-permissions errors → republish rules. Sign-in blocked on GitHub Pages → add the domain to Authorized domains.
