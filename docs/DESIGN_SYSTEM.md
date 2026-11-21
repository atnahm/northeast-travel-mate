# NE Mate — Design Rationale, Design System & Developer Handoff `[FIXED: removed "(Part C)" from title]`

> **Revision Summary** `[ADDED]`
> - `[FIXED]` Enforced WCAG 2.2 AA contrast across all light/dark pairings: restricted `#D9A441` gold to fills with charcoal text, darkened light alert/SOS to `#C8401C` (`4.99:1` with white), switched dark primary (`#35A17E`) & dark alert (`#F06A42`) buttons to dark text, and added a full verified contrast-ratio matrix.
> - `[FIXED]` Split **Verified** (staff-checked data, seal icon, river blue) from **Approved** (traveler permit status, green check), gave **Rejected / Expired** its own deep-red token (`#A31C24`), and visually differentiated **Applied** vs **Needs check**.
> - `[FIXED]` Removed all third-party vendor names from screen descriptions in favor of vendor-neutral wording.
> - `[FIXED]` Updated SOS interaction to **press-and-hold → countdown with Cancel → direct call to 112**.
> - `[FIXED]` Set `1.6–1.7` line-height rules for Assamese, Bengali, and Devanagari scripts.
> - `[ADDED]` Spacing, elevation, motion, z-index, and focus-ring tokens; full component library state matrix; map pin/cluster & offline style specs; system state patterns; 390 / 768 / 1280 px responsive layouts; 30–50% Indic string expansion rules; iconography rules; five clickable flows; and developer handoff & asset list.

---

## 1. Design Rationale
NE Mate is designed as a **calm, earthy, trustworthy, offline-first travel companion** for the eight states of North-East India.
- **Traditional Interface First, AI Behind It**: Tabs, maps, cards, and structured forms remain the primary surface. The AI assistant ("Ask Mate") sits behind a persistent floating button and invokes the exact same backend modules and verified permit records.
- **Clarity Over Decoration on Critical Flows**: Permits and Safety/SOS screens prioritize WCAG 2.2 AA contrast, unmistakable status cues (icon + text + distinct border/fill), official portal deep links, and explicit `Last verified` timestamps.
- **Rooted in the Landscape**: `[FIXED]` Inspired by tea gardens (`#1F5E4B`), the Brahmaputra river (`#2A6F97`), warm tea gold fills (`#D9A441` with `#22262A` charcoal text), deep sunrise alert red-orange (`#C8401C`), and handloom off-white paper (`#FAF7F2`). Subtle geometric woven-border accents are purely abstract—never copying sacred or community-specific motifs.
- **Built for Real Connectivity Conditions**: `[FIXED]` Low-data mode strips remote imagery to instant typography + icons; skeleton loaders prevent layout shift; offline banners show exact cache age; body text starts at `16px` with `1.5` line-height for Latin and **`1.6–1.7` line-height for Assamese, Bengali, and Devanagari** scripts, with `>= 48px` touch targets for bumpy shared-Sumo rides.

---

## 2. Design Tokens

### 2.1 Color Tokens `[FIXED]`

| Token | Light Mode | Dark Mode | Usage & Guardrails |
| :--- | :--- | :--- | :--- |
| `--bg-canvas` | `#FAF7F2` | `#111715` | Page canvas |
| `--bg-surface` | `#FFFFFF` | `#1A2320` | Cards, bottom sheets, nav rails |
| `--bg-muted` | `#F0ECE3` | `#24302C` | Chips, subtle surfaces, skeletons |
| `--text-primary` | `#22262A` | `#F2EFE9` | Headings & primary copy |
| `--text-secondary` | `#525B63` | `#B5C0BA` | Metadata & captions |
| `--brand-primary` | `#1F5E4B` | `#35A17E` | Primary CTAs, active tabs |
| `--on-brand-primary` `[ADDED]` | `#FFFFFF` | `#0B1F18` | Text/icon on primary button (**dark ink in dark mode**) |
| `--brand-river` | `#2A6F97` | `#5BA8D6` | Links, map routes, **Verified** staff-checked seal |
| `--on-brand-river` `[ADDED]` | `#FFFFFF` | `#0B1922` | Text/icon on solid river-blue badges |
| `--brand-gold` `[FIXED]` | `#D9A441` | `#E3B452` | **Fills only** (highlights, badges) — never text on light canvas |
| `--on-brand-gold` `[ADDED]` | `#22262A` | `#1A160B` | Mandatory charcoal/dark ink on gold fills |
| `--brand-alert` `[FIXED]` | `#C8401C` | `#F06A42` | Warnings, road alerts, SOS button (replaces `#E4572E` for AA contrast) |
| `--on-brand-alert` `[ADDED]` | `#FFFFFF` | `#1A0B06` | Text/icon on SOS/alert button (**dark ink in dark mode**) |
| `--status-approved-bg` `[ADDED]` | `#DCFCE7` | `#123524` | Traveler permit **Approved** pill fill |
| `--status-approved-fg` `[ADDED]` | `#14532D` | `#BBF7D0` | Traveler permit **Approved** text & icon |
| `--status-verified-bg` `[ADDED]` | `#E0F2FE` | `#0E2E42` | Curated data **Verified** pill fill (river tint) |
| `--status-verified-fg` `[ADDED]` | `#164663` | `#BAE6FD` | Curated data **Verified** text & seal icon |
| `--status-applied-bg` `[ADDED]` | `#FEF3C7` | `#3D2B05` | Traveler permit **Applied** pill fill (gold tint) |
| `--status-applied-fg` `[ADDED]` | `#5C3D00` | `#FDE68A` | Traveler permit **Applied** text & clock icon |
| `--status-check-bg` `[ADDED]` | `#FFEDD5` | `#431908` | Data **Needs check (>90d)** pill fill (amber-orange tint) |
| `--status-check-fg` `[ADDED]` | `#7C2D12` | `#FDBA74` | Data **Needs check** text & warning icon |
| `--status-rejected` `[ADDED]` | `#A31C24` | `#5C141A` | Deep-red token for **Rejected / Expired** (separate from SOS) |
| `--status-rejected-bg` `[ADDED]` | `#FEE2E2` | `#5C141A` | Soft rose fill for Rejected/Expired badges & error fields |
| `--status-rejected-fg` `[ADDED]` | `#7F1D1D` | `#FECACA` | Text/icon on Rejected/Expired pill; `#F87171` on dark surface |
| `--border-subtle` | `#E2DDD3` | `#2D3B36` | Card outlines & dividers |
| `--focus-ring` `[ADDED]` | `#2A6F97` | `#5BA8D6` | Keyboard focus indicator (`3px solid`, `2px` offset) |

### 2.2 Verified WCAG 2.2 AA Contrast Ratio Table `[ADDED]`

Every text/background pairing below has been verified against WCAG 2.2 relative luminance (`>= 4.50:1` for normal text AA, `>= 7.00:1` for AAA):

| Mode | Pairing | Foreground | Background | Ratio | WCAG Grade |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Light | Primary text on canvas | `#22262A` | `#FAF7F2` | **14.25:1** | AAA |
| Light | Primary text on surface | `#22262A` | `#FFFFFF` | **15.23:1** | AAA |
| Light | Secondary text on canvas | `#525B63` | `#FAF7F2` | **6.47:1** | AA |
| Light | Secondary text on surface | `#525B63` | `#FFFFFF` | **6.92:1** | AA |
| Light | Secondary text on muted | `#525B63` | `#F0ECE3` | **5.87:1** | AA |
| Light | Primary CTA button label | `#FFFFFF` | `#1F5E4B` | **7.61:1** | AAA |
| Light | Primary link/heading on surface | `#1F5E4B` | `#FFFFFF` | **7.61:1** | AAA |
| Light | River blue link on surface | `#2A6F97` | `#FFFFFF` | **5.50:1** | AA |
| Light | River blue link on canvas | `#2A6F97` | `#FAF7F2` | **5.15:1** | AA |
| Light | Solid Verified badge text | `#FFFFFF` | `#2A6F97` | **5.50:1** | AA |
| Light | Charcoal text on Tea Gold fill | `#22262A` | `#D9A441` | **6.77:1** | AA |
| Light | SOS / Alert button label | `#FFFFFF` | `#C8401C` | **4.99:1** | AA |
| Light | Alert text on surface | `#C8401C` | `#FFFFFF` | **4.99:1** | AA |
| Light | Alert text on canvas | `#C8401C` | `#FAF7F2` | **4.67:1** | AA |
| Light | Solid Rejected/Error badge | `#FFFFFF` | `#A31C24` | **7.64:1** | AAA |
| Light | Rejected/Error text on surface | `#A31C24` | `#FFFFFF` | **7.64:1** | AAA |
| Light | Approved badge pill | `#14532D` | `#DCFCE7` | **8.30:1** | AAA |
| Light | Verified badge pill | `#164663` | `#E0F2FE` | **8.76:1** | AAA |
| Light | Applied badge pill | `#5C3D00` | `#FEF3C7` | **8.89:1** | AAA |
| Light | Needs check badge pill | `#7C2D12` | `#FFEDD5` | **8.18:1** | AAA |
| Light | Rejected / Expired badge pill | `#7F1D1D` | `#FEE2E2` | **8.20:1** | AAA |
| Dark | Primary text on canvas | `#F2EFE9` | `#111715` | **15.81:1** | AAA |
| Dark | Primary text on surface | `#F2EFE9` | `#1A2320` | **14.02:1** | AAA |
| Dark | Secondary text on canvas | `#B5C0BA` | `#111715` | **9.69:1** | AAA |
| Dark | Secondary text on surface | `#B5C0BA` | `#1A2320` | **8.59:1** | AAA |
| Dark | Secondary text on muted | `#B5C0BA` | `#24302C` | **7.31:1** | AAA |
| Dark | Primary CTA button label (dark ink) | `#0B1F18` | `#35A17E` | **5.35:1** | AA |
| Dark | Primary accent text on surface | `#35A17E` | `#1A2320` | **5.02:1** | AA |
| Dark | River blue link on surface | `#5BA8D6` | `#1A2320` | **6.14:1** | AA |
| Dark | Solid Verified badge (dark ink) | `#0B1922` | `#5BA8D6` | **6.81:1** | AA |
| Dark | Dark ink on Tea Gold fill | `#1A160B` | `#E3B452` | **9.38:1** | AAA |
| Dark | SOS / Alert button label (dark ink) | `#1A0B06` | `#F06A42` | **6.25:1** | AA |
| Dark | Alert accent text on surface | `#F06A42` | `#1A2320` | **5.24:1** | AA |
| Dark | Rejected/Error text on surface | `#F87171` | `#1A2320` | **5.82:1** | AA |
| Dark | Rejected / Expired badge pill | `#FECACA` | `#5C141A` | **9.25:1** | AAA |
| Dark | Approved badge pill | `#BBF7D0` | `#123524` | **11.10:1** | AAA |
| Dark | Verified badge pill | `#BAE6FD` | `#0E2E42` | **10.63:1** | AAA |
| Dark | Applied badge pill | `#FDE68A` | `#3D2B05` | **10.91:1** | AAA |
| Dark | Needs check badge pill | `#FDBA74` | `#431908` | **9.02:1** | AAA |

### 2.3 Typography & Script Line-Height Rules `[FIXED]`
- **Font Stack**: `Inter` (Latin), `Noto Sans Bengali` (Assamese & Bengali), `Noto Sans Devanagari` (Hindi).
- **Latin Scale**:
  - Body: `16px / 1.5` (`1rem`), Small/Meta: `14px / 1.45` (`0.875rem`), Badge/Chip: `12px–13px / 1.35`, Card Title: `18px / 1.35`, Section Heading: `22px / 1.3`, Hero: `28px–32px / 1.2`.
- **Indic Script Line-Height (`[FIXED]`)**:
  - All Assamese (`:lang(as)`), Bengali (`:lang(bn)`), and Hindi/Devanagari (`:lang(hi)`) copy MUST use **`line-height: 1.65`** (`1.6` for headings/cards, `1.7` for body paragraphs and checklists) so upper matras, chandrabindu, and stacked conjunct glyphs never clip against borders or adjacent lines.
- **Text Scaling**: Layout must remain readable without horizontal overflow up to **200% browser text zoom**.

### 2.4 Spacing, Radius, Elevation, Motion, Z-Index & Focus Tokens `[ADDED]`

| Category | Token | Value | Usage |
| :--- | :--- | :--- | :--- |
| **Spacing** | `--space-1` .. `--space-12` | `4, 8, 12, 16, 20, 24, 32, 40, 48 px` | `4px` base grid; card padding `16px–20px`; section gap `20px–24px` |
| **Touch Target** | `--touch-min` | `48px × 48px` | Minimum clickable area for all buttons, tabs, map controls, and checkboxes |
| **Radius** | `--radius-sm / md / card / sheet / pill` | `8px / 12px / 16px / 20px / 9999px` | Inputs & buttons `12px`, cards `16px`, bottom sheet top `20px`, chips/badges `9999px` |
| **Elevation** | `--shadow-flat` | `none` | Muted panels, nested list items |
| **Elevation** | `--shadow-card` | `0 4px 20px -4px rgba(31, 94, 75, 0.08)` | Standard cards (paired with `1px solid --border-subtle`) |
| **Elevation** | `--shadow-sheet` | `0 -8px 28px -6px rgba(0, 0, 0, 0.16)` | Draggable map bottom sheet, modals |
| **Elevation** | `--shadow-fab` | `0 10px 24px -6px rgba(17, 23, 21, 0.32)` | Global `Ask Mate` FAB, SOS button |
| **Motion** | `--dur-fast / base / sheet` | `150ms / 200ms / 250ms` | Press/hover `150ms`, tab/chip switch `200ms`, bottom-sheet snap `250ms` |
| **Motion** | `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Disabled automatically under `@media (prefers-reduced-motion: reduce)` |
| **Z-Index** | `--z-base / map / sticky / sheet / nav / fab / modal / toast` | `0 / 10 / 20 / 25 / 30 / 35 / 50 / 60` | Prevents Ask Mate FAB or bottom nav from occluding modals or SOS countdowns |
| **Focus Ring** | `--focus-ring-style` | `3px solid var(--focus-ring); outline-offset: 2px` | Visible on `:focus-visible` across all interactive elements (never `outline: none` without replacement) |

---

## 3. Status Semantics (Never Color Alone) `[FIXED]`

Every status pairs **distinct hue + distinct icon + text label + distinct border style** so colorblind users and low-contrast outdoor screens never confuse staff verification with traveler progress:

| Status | Domain | Light Fill / Text | Dark Fill / Text | Border Style | Icon (Outline, 16px) | Label Pattern |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Verified** `[FIXED]` | Curated data trust (staff checked) | `#E0F2FE` / `#164663` | `#0E2E42` / `#BAE6FD` | `1px solid #2A6F97` | `BadgeCheck` (official seal) | `"Verified · DD MMM YYYY"` |
| **Approved** `[FIXED]` | Traveler permit status | `#DCFCE7` / `#14532D` | `#123524` / `#BBF7D0` | `1px solid #1F5E4B` | `CheckCircle2` | `"Approved"` |
| **Applied** `[FIXED]` | Traveler permit status (pending) | `#FEF3C7` / `#5C3D00` | `#3D2B05` / `#FDE68A` | `1px solid #D9A441` | `Clock` | `"Applied"` |
| **Needs check** `[FIXED]` | Curated data >90d stale | `#FFEDD5` / `#7C2D12` | `#431908` / `#FDBA74` | `1.5px dashed #C8401C` | `AlertTriangle` | `"Needs check (>90d)"` |
| **Not started** | Traveler permit status | `#F0ECE3` / `#525B63` | `#24302C` / `#B5C0BA` | `1px solid #E2DDD3` | `CircleDashed` | `"Not started"` |
| **Rejected / Expired** `[FIXED]` | Traveler permit failure/expiry | `#FEE2E2` / `#7F1D1D` | `#5C141A` / `#FECACA` | `1.5px solid #A31C24` | `XCircle` | `"Rejected"` / `"Expired"` |

---

## 4. Screen Inventory (13 Core Screens + Admin) `[FIXED: vendor names removed; SOS updated]`
1. `/welcome` — Splash & script-native language picker (`English`, `हिन्दी`, `অসমীয়া`, `বাংলা`, plus `"More languages"` link to regional phrasebook).
2. `/onboarding` — Profile stepper: name, date of birth (+ under-18 guardian consent gate), searchable nationality, citizen type with plain-language permit explanation, email or federated social sign-in `[FIXED]`, granular privacy/location/notification consent toggles, skippable location permission.
3. `/` — Home dashboard: `"Welcome to NORTH-EAST INDIA, {name}"` hero (omits remote photo in low-data mode), active road/weather alert strip, five shortcut cards, `"Best this month"` carousel, `"Continue your trip"` card.
4. `/explore` & `/explore/[id]` — Interactive online/offline map `[FIXED]`, draggable snap bottom sheet of place cards, filter chips (`Food`, `Culture`, `Nature`, `Trek`, `Wildlife`, `Stay`), `"Local specialities"` horizontal row, Local (GPS) vs Browse-by-State mode, Place Detail page (gallery/low-data placeholder, hours, how to reach, permit badge, Save, Add to Trip).
5. `/travel` — From/To inputs with `"Pick on map"`, multi-mode comparison cards (`Self-drive`, `Shared Sumo/Taxi`, `Bus`, `Train`, `Flight`, `Ferry`) with time, distance, INR fare range, `"Verified · DD MMM YYYY"` seal badge, permit checkpoints, fuel/ATM/connectivity warnings, Add to Trip.
6. `/permits` — Destination selector, `"Based on your profile: {nationality}, {citizen type}"` header, personalized permit cards (`Required for you` / `Not required`, documents checklist, placeholder fee notice `₹ ---`, processing time, prominent **Apply on official portal** external button, **Verified** seal or **Needs check** dashed badge, traveler status tracker), persistent official-portal notice, Document Vault link.
7. `/trips` & `/trips/[id]` — Trip list, `"Plan my trip"` generator form, 5-tab Trip Detail (`Timeline` with drag-to-reorder & inline Train Tracker card, `Map`, `Permits`, `Budget` + expense split, `Packing`), Share/Invite co-travelers, Download for Offline.
8. `/trips/[id]` (Train Tracker card) — Train name & number, live status, delay badge, next station progress bar, platform, opt-in `"Track my position"` toggle with clear privacy note.
9. `/chat` — Dedicated full-screen streaming AI conversation rendering tappable Place, Route, Permit (with source seal + verified date), Train, and Trip Draft (`Save as trip` / `Open in Trip Planner`) cards, suggested prompts, microphone voice input, language indicator, offline fallback quick-actions.
10. `/safety` — `[FIXED]` **Press-and-hold SOS control (2s hold → 3s countdown with large Cancel button → dials `112` directly)**, trek/road check-in countdown timer, one-tap state emergency helplines, nearest hospital & police map finder, live-location sharing link.
11. `/settings` — Language switcher, Light/Dark theme, traveler profile editor, notifications, offline state packs (download/delete per state with exact MB size), low-data mode toggle, privacy/consent log, Delete Account.
12. `/vault` — Lockable encrypted local & cloud document vault `[FIXED]` for permit PDFs, ID copies, and tickets, with expiry reminders.
13. `/phrasebook` — Offline-first regional phrasebook (Assamese, Bengali, Hindi, Mizo, Nagamese, Nepali) with native script, romanization, categories, and audio playback.
14. `/admin` — Internal Editor/Admin curation console: permit draft/verify workflow (writes immutable `permit_versions` snapshots & refreshes search index), overdue verification queue, alert publisher, and database/mapping/AI service health status `[FIXED]`.

---

## 5. Component Library & Interactive States `[ADDED]`

All interactive components meet `min-h-[48px]` (chips `min-h-[40px]` with `48px` hit padding), use logical properties (`ps`/`pe`/`ms`/`me`) for future RTL safety, and implement all five states:

| Component | Default | Pressed (`:active`) | Focused (`:focus-visible`) | Disabled | Error / Invalid |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Primary Button** | `--brand-primary` bg, `--on-brand-primary` text, `12px` radius | Darken 10%, `scale(0.98)` (`150ms`) | `3px` `--focus-ring`, `2px` offset | `opacity: 0.45`, `cursor: not-allowed` | Replaced by inline alert + retry action |
| **Secondary Button** | `--bg-surface`, `1px` `--border-subtle`, `--text-primary` | `--bg-muted` fill | `3px` `--focus-ring`, `2px` offset | `opacity: 0.45` | `1.5px solid --status-rejected` border |
| **Ghost Button** | Transparent bg, `--text-primary` | `--bg-muted` fill | `3px` `--focus-ring` | `opacity: 0.4` | `--status-rejected-fg` text |
| **Danger / SOS Button** | `--brand-alert` (`#C8401C` / `#F06A42`), `--on-brand-alert` text; SOS uses 2s hold progress ring | Progress arc fills `0→100%`, subtle haptic pulse | `3px` high-contrast ring (`#22262A` light / `#F2EFE9` dark) | `opacity: 0.45` | Shows fallback `tel:112` plain link |
| **Filter / Select Chip** | Pill `9999px`, `--bg-surface`, `1px` border | `--bg-muted` fill; selected switches to `--brand-primary` | `3px` `--focus-ring` | `opacity: 0.4` | Red outline + helper text if required filter missing |
| **Place Card** | `16px` radius, state tag, title, 2-line note, permit badge, Save/Add actions | `border-color: --brand-primary`, subtle press shadow | Full-card focus ring when linked | Dimmed card when closed/archived | Shows `"Cached data"` or retry strip |
| **Speciality Card** | `260px` horizontal card, type pill (`#D9A441` fill + `#22262A` text), where-to-find | `--bg-muted` tint | `3px` `--focus-ring` | N/A | Hides photo cleanly in low-data mode |
| **Permit Card** | Official header, `Required`/`Not required` + `Verified` seal, docs list, `₹ ---` notice, portal CTA, status bar | Portal CTA darkens; status segment highlights | Focus ring per interactive control | Portal link disabled only if URL missing | Dashed `Needs check` border when >90d stale |
| **Transport Option Card** | Mode icon + operator, 3-col strip (Time / km / INR), `Verified` seal, checkpoints, warnings | Highlighted selected border | `3px` `--focus-ring` | Greyed out if route suspended | Alert tint (`--brand-alert`) for closed/landslide corridor |
| **Trip Item Card** | Drag handle (`48px`), time & type tag, title, Up/Down keyboard reorder buttons | Elevated `--shadow-sheet`, `2px` `--brand-primary` outline while dragging | `3px` `--focus-ring` on handle & buttons | Locked icon for viewer-only co-travelers | Sync conflict banner (`"Edited on another device"`) |
| **Alert Card** | `1.5px` `--brand-alert` border, severity badge, state code, source + timestamp | Tint intensifies on tap | `3px` `--focus-ring` | Archived opacity `0.6` | Fallback `"Verify locally — source unreachable"` |
| **Bottom Sheet** | `20px` top radius, `--shadow-sheet`, drag handle + `Peek / Half / Full` buttons | Smooth `250ms` snap between `150px`, `48vh`, `80vh` | Focus ring on snap controls | Locks at `peek` if empty | Shows inline `ErrorState` inside sheet |
| **Tabs / Segmented Control** | Horizontal scroll container, active tab filled `--brand-primary` | Subtle press tint | `3px` `--focus-ring` | `opacity: 0.4` | Error dot + count badge (e.g., `Permits · 1 overdue`) |
| **Text / Select Input** | `48px` height, `--bg-canvas`, `1px` `--border-subtle`, visible `<label>` | Active border `--brand-river` | `2px` `--brand-river` border + outer focus ring | `--bg-muted`, muted text | `1.5px` `--status-rejected` border + icon + plain error message below |
| **Date Picker** | Native/accessible calendar trigger (`48px`), ISO display + localized format | Selected date circle `--brand-primary` | `3px` `--focus-ring` on day cells | Past/invalid dates struck through | Inline message if `end_date < start_date` |
| **Toast** | Floating pill (`--z-toast: 60`), charcoal/surface inverse, icon + concise action (`Undo`) | Dismiss on swipe/tap | Focusable close/undo button | Auto-dismiss `4s` (never for errors) | Deep-red `--status-rejected` accent for failed saves |
| **Banners (Offline / Alert / Notice)** | Full-width strip above content; Offline shows cache age (`"Cached 18m ago"`) + outbox count | Tap `"Sync now"` or `"View alerts"` | Focus ring on banner CTA | Non-dismissible for Offline & Permit Portal Notice | Retry CTA if sync fails |
| **Progress Stepper** | Numbered circles (`Step 1 of 3`), completed = green check, active = forest fill | Completed steps tappable to go back | `3px` `--focus-ring` | Future locked steps muted | Red circle + exclamation on step with validation error |
| **Status Badges** | Pill (`9999px`), icon + text + distinct border (see Section 3) | Interactive only when used as filter | `3px` `--focus-ring` if button | N/A | `Needs check` dashed border or `Rejected` deep-red |
| **Skeleton Loaders** | `--bg-muted` pulse matching exact card height/aspect ratio | Non-interactive (`aria-hidden="true"`) | Not focusable | Static fill when `prefers-reduced-motion` is on | Replaced immediately by `ErrorState` on timeout |

---

## 6. Map Design (Online & Offline Parity) `[ADDED]`

### 6.1 Category Pins & Clusters
All map pins use a `32px` circular badge with a `2.5px` white halo (`#FFFFFF` light / `#1A2320` dark), an inner 16px vector icon, and scale to `40px` when selected:

| Category | Fill Token | Inner Icon | Cluster Badge Rule |
| :--- | :--- | :--- | :--- |
| **Nature / Trek / Wildlife** | `#1F5E4B` (Forest) | `Trees` / `Footprints` / `Binoculars` | Forest circle (`36–48px`) with white count (`4.5:1+`) |
| **Culture / Heritage** | `#7A4E2D` (Earthy Terracotta) | `Landmark` | Matches dominant category or neutral `#1F5E4B` |
| **Food / Specialities** | `#D9A441` (Tea Gold fill) | `Utensils` (charcoal `#22262A` icon) | Gold pill with charcoal `#22262A` count |
| **Stay / Homestay** | `#3B5998` / `#2A6F97` (River) | `BedDouble` | River circle with white count |
| **Transport Hub / Route** | `#2A6F97` (River Blue) | `Bus` / `TrainFront` / `Ship` | Dashed `#2A6F97` route polyline (`4px`) |
| **Permit Checkpoint** | `#C8401C` (Deep Alert) | `ShieldAlert` | Always unclustered at zoom `>= 8` |
| **Hospital / Police (Safety)** | `#A31C24` (Deep Red) / `#2A6F97` | `Cross` / `Shield` | Never clustered on `/safety` screen |

### 6.2 Offline Map Visual Style Parity
- Offline vector/coordinate maps share the exact same color language as the styled online map:
  - **Land / Valley base**: `#E7EFEA` (light) / `#14201C` (dark)
  - **Brahmaputra & major rivers**: `#2A6F97` at `35–45%` opacity (light) / `#5BA8D6` at `35%` (dark)
  - **Protected forests & hills**: `#1F5E4B` subtle contour tint (`10–15%`)
  - **Highways & hill corridors**: Warm stone `#FFFFFF` with `#CFC9BC` casing (light) / `#2D3B36` (dark)
- Identical pin geometry, zoom buttons (`48px × 48px` top-right), and selected-pin highlight (`#C8401C` ring) operate online and offline.

### 6.3 Reserved Map Attribution Space
- Reserve a permanent **`28px` high safe bar** along the bottom edge of every map viewport (`bottom-2`, positioned **above** the bottom-sheet `peek` overlap) so online map provider marks and offline `"Offline map data © OpenStreetMap contributors"` attribution are never obscured by floating buttons or cards.

---

## 7. System & Edge-Case State Patterns `[ADDED]`

| State | Visual Structure | Mandatory Copy & Recovery Action |
| :--- | :--- | :--- |
| **Loading** | Geometry-matched `Skeleton` blocks (never a bare spinner on full screens) | Announces `aria-busy="true"`; respects reduced motion |
| **Empty** | Centered muted icon badge (`56px`), clear title, 1–2 line guidance, 1 primary CTA | Example: `"No trips planned yet"` + **`Plan my trip`** & **`Ask Mate`** |
| **Error** | Soft alert-bordered card (`--brand-alert/40`), `AlertTriangle` icon, plain reason | Always provides **`Retry`** button (`48px`) and shows cached data below if available |
| **Offline (with cache age)** | Persistent amber/surface top banner + per-card badge `"Saved · 2h ago"` + queued outbox count | Disables live-only actions with tooltip; allows saving/editing into outbox for auto-sync |
| **Permission Denied** | Non-blocking card explaining *why* permission helps (never traps user) | **Location denied**: instant State/City dropdown. **Notifications denied**: in-app alert banner + browser settings tip |
| **Low-Data Mode** | Header badge `Low-Data ON`; **zero remote photos**; category icons + compact cards only | Defers secondary carousels; shrinks payload & avoids background polling |

---

## 8. Responsive Layouts (`390 px`, `768 px`, `1280 px`) `[ADDED]`

| Screen | Mobile (`390 px`) | Tablet (`768 px`) | Desktop (`1280 px`) |
| :--- | :--- | :--- | :--- |
| **Navigation Shell** | Top utility bar (`56px`) + 5-tab bottom bar (`56px`) + floating `Ask Mate` FAB (`bottom: 76px`) | Collapsible left rail (`72px` icons+labels) or `240px` rail + top bar + bottom-right FAB | Persistent left rail (`256px`: 5 primary + 5 utility links + pinned `Ask Mate` CTA) + `max-w-6xl` workspace |
| **Home (`/`)** | Single-column stack: Greeting hero → Alert strip → 2-col shortcut grid → Horizontal swipe `"Best this month"` → Continue trip | Hero with inline CTA → 3-col shortcuts → 2-col `"Best this month"` grid → Full-width Continue trip | Wide hero + right CTA → 5-col single-row shortcuts → 3-col `"Best this month"` grid + 3-col toolkit row |
| **Explore (`/explore`)** | Search + State select stacked → Filter chip scroller → Full-width map (`300px`) → Draggable bottom sheet (`peek/half/full`) → Specialities horizontal row | Side-by-side search/state bar → Split view or tall map (`380px`) + 2-col place grid in sheet → Horizontal specialities | Split workspace (`45%` scrollable place list & filters on left, `55%` sticky interactive map on right) + full-width specialities shelf below |
| **Permits (`/permits`)** | Profile summary + persistent notice → Stacked State & Citizen dropdowns → Full-width permit cards with stacked Official Portal CTA | 2-col selector card → Permit cards with right-aligned Official Portal CTA + 3-col Fee/Time/Validity summary strip | Max-width `1024px` focused reading layout: sticky left state/profile summary (`300px`) + detailed permit cards (`680px`) with status tracker |
| **Trips (`/trips` & `/trips/[id]`)** | Single-col trip list; Detail shows scrollable 5-tab bar (`Timeline / Map / Permits / Budget / Packing`) + stacked day cards | 2-col trip list; Detail shows 5-tab bar + side-by-side budget summary tiles + wide timeline cards with drag handles | 2–3 col trip grid; Detail supports split view on Timeline (`65%` day-by-day draggable items + `35%` sticky route map & permit checklist) |

---

## 9. Multilingual & Long-String Expansion Rules (`+30% to +50%`) `[ADDED]`

Assamese (`as`), Bengali (`bn`), and Hindi (`hi`) strings routinely expand **30% to 50%** horizontally and vertically compared to English:
1. **No Fixed Widths on Text Containers**: Never hardcode `w-[...]` on buttons, tabs, badges, or chips; use `min-w-0`, `flex-wrap`, and `px-4` padding so longer labels grow gracefully.
2. **Line-Height & Vertical Breathing Room**: Apply `line-height: 1.6–1.7` for `:lang(as)`, `:lang(bn)`, and `:lang(hi)` globally; allow card titles up to `2–3` lines (`line-clamp-2` / `line-clamp-3` only on previews, never on permit rules or SOS instructions).
3. **Bottom Navigation Tabs**: Keep mobile tab labels to 1–2 concise localized words (`11px`, `truncate` with `aria-label` full text), and guarantee `min-h-[56px]` so tall Indic diacritics never touch the top border.
4. **Form Controls & Badges**: Stack label above input (never inline left-label forms); allow status badge rows to wrap (`flex-wrap gap-2`) so `"আপোনাৰ বাবে প্ৰয়োজনীয়"` never collides with `"সত্যাপিত তাৰিখ"`.
5. **Logical CSS Properties**: Use `ps-*`, `pe-*`, `ms-*`, `me-*`, and `text-start` so future RTL languages require zero structural rework.

---

## 10. Iconography Rules & Five Clickable Prototype Flows `[ADDED]`

### 10.1 Iconography Rules
- **Single Family**: `Lucide` outline icons (`1.75px` stroke width, rounded caps/joins).
- **Sizes**: `16px` inside badges/meta, `20px` in buttons & nav tabs, `24px` in section headers & shortcut tiles.
- **Always Paired with Words**: Every primary navigation tab, permit action, safety helpline, and card CTA pairs its icon with a visible text label (`aria-hidden="true"` on decorative icons; explicit `aria-label` on icon-only map zoom controls).
- **Cultural Guardrail**: Abstract geometric woven-divider accents only; never embed sacred, religious, or tribe-specific symbols as generic icons.

### 10.2 Five Core Clickable Prototype Flows
1. **Onboarding → Home**: `/welcome` (select script-native language) → `/onboarding` Step 1 (Name, DOB + under-18 check, Nationality, Citizen type) → Step 2 (Email / social sign-in) → Step 3 (Privacy/Location toggles) → `/` personalized Home greeting.
2. **Permits Checklist → Official Portal**: `/` Shortcut (`Permits`) → `/permits` (select Arunachal Pradesh, shows `Based on your profile`) → inspect `Required for you` + `Verified` seal + documents list → tap **Apply on official portal** (external link) → toggle status to `Applied` → open `/vault` to store approved PDF.
3. **Explore → Add to Trip → Timeline**: `/explore` (filter chip `Nature` or tap map pin) → `/explore/[id]` (inspect curated notes & permit badge) → tap **Add to Trip** → auto-navigates to `/trips/[id]` Timeline showing new stop ready to drag/reorder.
4. **Chat Plan → Open in Trip Planner**: Tap floating **Ask Mate** FAB → `/chat` → tap suggested prompt (`"6 days in Meghalaya from Guwahati in December, budget 25000"`) → streaming reply renders verified permit citation card + `Draft Trip Saved` card → tap **Open in Trip Planner** → `/trips/[id]`.
5. **SOS Press-and-Hold → 112**: Top header **SOS & Alerts** pill → `/safety` → press and hold **SOS Call 112** for `2s` → `3s` visual countdown modal with prominent **Cancel** button → if not cancelled, invokes `tel:112` directly; alternatively tap **Share Live Location** or start a 30/60-min check-in timer.

---

## 11. Developer Handoff & Asset List `[ADDED]`

### 11.1 Core Component Map (`apps/web/src/components/`)
- `layout/AppShell.tsx` — Responsive rail/bottom-bar shell, offline banner, low-data pill, theme toggle, Ask Mate FAB.
- `layout/Providers.tsx` — Theme sync, Service Worker registration, online/offline outbox sync, session hydration.
- `ui/Primitives.tsx` — `Button`, `Card`, `Chip`, `StatusBadge`, `Skeleton`, `EmptyState`, `ErrorState`, `BottomSheet`.
- `maps/NEMap.tsx` — Online/offline dual-mode interactive map, category pins, route polyline, click-to-pick mode, reserved attribution bar.

### 11.2 Asset Inventory (`apps/web/public/`)
- `icon.svg` — Maskable PWA app icon (forest mountain + tea gold sun + Brahmaputra wave).
- `manifest.webmanifest` — Installable PWA metadata (`theme_color: #1F5E4B`, `background_color: #FAF7F2`).
- `sw.js` — App-shell cache-first & API stale-while-revalidate service worker.
- `images/hero-ne-landscape.webp` *(optional photography slot, `<= 120 KB`, suppressed automatically in Low-Data Mode)*.
- `images/states/{as,ml,ar,nl,mn,mz,sk,tr}.webp` *(optional `16:9` WebP/AVIF cards, lazy-loaded, suppressed in Low-Data Mode)*.

### 11.3 Implementation Notes
- **Spacing & Breakpoints**: Tailwind `sm` (`640px`), `md` (`768px` tablet), `lg` (`1024px`), `xl` (`1280px` desktop); page container `max-w-6xl mx-auto px-4`.
- **SOS Guardrail**: Implement pointer-down + keyboard (`Space`/`Enter` hold or explicit confirmation dialog for screen-reader users) with a `2000ms` hold timer followed by a `3000ms` cancellable countdown before triggering `window.location.href = "tel:112"`.
- **Token Parity**: Keep CSS custom properties in `src/app/globals.css` synchronized 1:1 with Section 2.1 tokens and verify contrast whenever adding a new semantic tint.
