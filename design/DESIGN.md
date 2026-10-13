# Courtly design system: “Clay club”

Warm, quiet private club. Cream paper, clay terracotta, court green, serif headlines. Flat: no shadows, no gradients. Structure comes from 1px lines and spacing. Light theme only.

- `theme.css`: paste into the global stylesheet (Tailwind v4 + shadcn/ui CSS variables).
- `mockups/`: one page per screen, every state shown as a labelled section (`index.html` links them all).
- Mockups use the same Tailwind class names the app should use (`bg-primary`, `text-muted-foreground`, `bg-court`, …).

No frontend existed in this project when this was written, so `theme.css` targets Tailwind v4 / current shadcn. If the app is on Tailwind v3, move the `@theme inline` colours into `tailwind.config` `theme.extend.colors` as `var(--token)` and keep `:root` as is.

## 1. Tokens

| Token | Hex | Tailwind | shadcn var | Use |
|---|---|---|---|---|
| Paper | `#F4EEE2` | `bg-background` | `--background` | Page background |
| Card | `#FBF8F1` | `bg-card` | `--card`, `--popover` | Cards, inputs, dialogs, available slots |
| Sand | `#EAE1CF` | `bg-secondary` / `bg-muted` | `--secondary`, `--muted` | Hover, neutral badges, tab track, skeletons |
| Line | `#DDD3C0` | `border-border` | `--border`, `--input` | All borders |
| Line soft | `#E6DDCB` | `border-line-soft` | `--line-soft` | Row dividers, inner rules |
| Stone | `#6B6457` | `text-muted-foreground` | `--muted-foreground` | Secondary text |
| Ink | `#23201B` | `text-foreground` | `--foreground` | Primary text |
| Court green | `#2F5D46` | `bg-court`, `text-court` | `--ring`, `--accent-foreground` | Selection, active nav, focus ring, success |
| Clay | `#B84A26` | `bg-primary` | `--primary` | The single primary action, wordmark dot |
| Brick | `#8E2A22` | `text-destructive` | `--destructive` | Destructive actions, errors |
| Green tint | `#DCE7DD` | `bg-accent` | `--accent` | Upcoming / Active badge, active nav pill |
| Brick tint | `#F3DCD6` | `bg-brick-tint` | `--brick-tint` | Cancelled badge, error banner, error toast |
| Faded | `#B3A995` | `text-faded` | `--faded` | Text of booked / past slots and past calendar days only |

### Colour roles (strict)

- **Clay fill** = the one positive primary action of a view: Sign in, Book court, Confirm booking, Save court, New court, View my bookings (success dialog), Find a court / Go to courts (empty and error pages). Never two on screen.
- **Brick** = destructive. Never filled. Inline: `dangerGhost` (Brick text + icon). In confirm dialogs: Brick outline + icon. Every destructive action opens an AlertDialog.
- **Court green** = selected, “yours”, “active”, focus, success icon. Never Clay for these.

### Contrast (WCAG AA, checked)

Ink on Paper 15:1 · Stone on Paper 5.0:1 · Stone on Card 5.5:1 · Stone on Sand 4.5:1 · white on Clay 5.2:1 · white on Court green 7.6:1 · Court green on Green tint 6.1:1 · Brick on Brick tint 6.4:1. Faded on Paper is ~2:1 and is allowed only on disabled, non-interactive content that is also struck through and labelled (“Booked”, “Past”).

## 2. Typography

Fonts: **Fraunces 500** (`font-serif font-medium`) and **Inter 400/500/600** (`font-sans`, default). Google Fonts URL is in `theme.css`.

| Role | Classes | Size |
|---|---|---|
| Metric (revenue) | `font-serif font-medium text-5xl sm:text-6xl tabular-nums` | 48 / 60px |
| Page title (h1) | `font-serif font-medium text-3xl sm:text-4xl tracking-tight` | 30 / 36px |
| Section, dialog title, empty state | `font-serif font-medium text-2xl` | 24px |
| Court name in card | `font-serif font-medium text-2xl` | 24px |
| Court name in table / list | `font-serif font-medium text-base` / `text-lg` | 16 / 18px |
| Body | `text-base` | 16px |
| UI text, table cells, buttons | `text-sm` (buttons `font-medium`) | 14px |
| Label | `text-sm font-medium` | 14px |
| Caption, badge, hint | `text-xs` | 12px |
| Slot time | `text-[15px] font-medium tabular-nums` | 15px |

Rules: sentence case everywhere. `tabular-nums` on every time, date number and price (tables get it on `<table>`). Times 24h with an en dash: `16:00–18:00`. Prices `€24` (no decimals unless non-zero: `€28.50`). Dates `Fri 9 Oct` in lists, `Friday 9 October` in headings, `Today, Fri 9 Oct` for today.

## 3. Shape, spacing, layout

- Radius: `--radius` 10px → `rounded-md`/`rounded-lg` (inputs, selects, slots, date tiles, banners). Cards, dialogs, popovers, toasts: `rounded-xl` (16px). Buttons, badges, tabs, nav items: `rounded-full`.
- Borders: 1px `border-border`. Dividers inside cards and tables: `divide-line-soft` / `border-line-soft`. No shadows (removed in `theme.css`).
- Container: `mx-auto max-w-[1100px] px-5 sm:px-8 py-8 sm:py-10`.
- Rhythm: page header → content `mt-8`; between major blocks `mt-10`; card padding `p-6` (dialogs `p-6 sm:p-7`); form field gap `gap-5`; label → control `gap-2`; table cells `px-5 py-4`, header `h-11`.
- Top nav: `h-16`, `border-b`, wordmark “Courtly.” (Fraunces 24px, Clay full stop) left, role links as pills, then (admin badge) name and Sign out right. Below 640px links move to a second row and Sign out becomes an icon button with `aria-label`.
- Breakpoints: desktop-first design at 1280px; must work at 375px. Course grids `sm:grid-cols-2 lg:grid-cols-3`; slot grid `grid-cols-3 sm:grid-cols-5`; tables `hidden md:block` with a stacked card list `md:hidden`.

## 4. Components (shadcn mapping)

**Button**: set base to `rounded-full`, `h-10 px-5` (sm: `h-9 px-3`). Variants:
- `default` → Clay fill, white text.
- `outline` → Card fill, Line border, Ink text, hover Sand.
- `ghost` → Stone text, hover Sand + Ink.
- `destructive` → **override to outline**: `border border-destructive text-destructive bg-transparent hover:bg-brick-tint`. Add a `destructive-ghost` variant (Brick text, no border) for row actions. Always with a lucide icon (`circle-x`, `power`).
- Disabled: `opacity-50 cursor-not-allowed`.

**Focus ring**: replace shadcn's `focus-visible:ring-ring/50 focus-visible:ring-[3px]` with `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background` on Button, Input, Select, Tabs, Calendar day, links. `theme.css` adds an outline fallback for anything else.

**Badge** (`rounded-full h-6 px-2.5 text-xs font-medium`): Upcoming / Active `bg-accent text-accent-foreground`; Completed / Inactive / Admin `bg-secondary text-foreground`; Cancelled `bg-brick-tint text-destructive`; sport `border border-border text-muted-foreground`.

**Card**: `rounded-xl border bg-card p-6`, no shadow.

**Input / Select trigger**: `h-10 rounded-lg border-input bg-card px-3 text-sm`. Error: `aria-invalid` + `border-destructive`, message below as `text-sm text-destructive` with `circle-alert` icon, linked via `aria-describedby`. Error replaces the hint while active. Price input has a Stone `€` prefix (`pl-7`).

**Tabs**: track `rounded-full border bg-secondary p-1`; trigger `rounded-full h-8 px-4`; active trigger `bg-card text-foreground`; count in `text-xs text-muted-foreground`.

**Table**: inside `rounded-xl border bg-card`; header Stone `font-medium`; rows separated by `divide-line-soft`. Cancelled rows: `line-through text-muted-foreground` on time, court and price, plus Cancelled badge.

**Dialog / AlertDialog**: overlay `bg-foreground/45`, content `rounded-xl border bg-card max-w-md` (forms `max-w-lg`). Title Fraunces 24px. Footer `flex-col-reverse sm:flex-row sm:justify-end gap-2`: safe action (outline) first, then the primary or destructive one.

**Calendar + Popover**: popover `rounded-xl border bg-card p-4 w-[300px]`. Days `size-9 rounded-lg`. Today: Line border, semibold. Selected: Court green fill. Past (player view): `disabled`, Faded.

**Sonner**: Success: Card fill, Line border, Court green `circle-check`. Error: Brick tint fill, Brick text and `circle-alert`. `rounded-xl`, no shadow. Bottom-right desktop, bottom-centre mobile. Success auto-dismisses (5s); errors persist until dismissed.

**Error banner (Alert)**: `role="alert" rounded-lg border border-destructive/25 bg-brick-tint text-destructive px-4 py-3` + icon. Used inline near the thing that failed.

**Skeleton**: `bg-secondary animate-pulse`, same geometry as the loaded content.

**Empty state**: `rounded-xl border border-dashed px-6 py-16 text-center`, Sand icon circle, Fraunces title, one Stone sentence, optional single action.

### Slots (core component)

`h-16 rounded-lg border px-3`, two lines: time (`15px font-medium`) and a status word (`text-xs`). Status is never colour-only.

| State | Classes | Status text | Interactive |
|---|---|---|---|
| Available | `bg-card border-border`, hover `border-court bg-accent/40` | Available | yes, `aria-pressed="false"` |
| Selected | `bg-court border-court text-white` | ✓ Selected | yes, `aria-pressed="true"` |
| Extendable (adjacent to a 1-slot selection) | `bg-card border-dashed border-court` | +1 hour (Court green) | yes |
| Booked | `border-transparent text-faded`, time `line-through` | Booked / Just booked | no, `disabled` |
| Past | `border-dashed border-line-soft text-faded`, time `line-through` | Past | no, `disabled` |

Selection rules: click a free slot → 1-hour selection. Click an adjacent free slot → 2 hours. Click the selected slot → clear (if 2 selected, clicking one end shrinks to the other). Click any other free slot → new 1-hour selection. Never more than 2; no error state needed, the summary bar says “2 hours is the maximum. Pick another slot to start over.” Slots carry `aria-label="15:00 to 16:00, available"`.

Summary bar: `sticky bottom-4 rounded-xl border bg-card`, always rendered when the day has free slots. Shows date · court, range, duration, total (Fraunces), and the Book court button (disabled with nothing selected).

## 5. State inventory

**01 Sign in**: default · wrong credentials (banner “Email or password is incorrect.”, keep email, clear password) · submitting (disabled, spinner). Demo accounts box under the card. *Replace the demo credentials with the real seed values.*

**02 Courts (player)**: grid of active courts (sport badge, name, price per hour, opening hours, “View availability”) · loading (3 skeleton cards) · no active courts.

**03 Availability**: day loaded with past + booked + legend · 1 selected with “+1 hour” hints · 2 selected (limit) · date popover open (past days disabled) · fully booked day (card + jump to next day with availability, bar hidden) · confirm booking (AlertDialog opened by Book court; no POST until “Confirm booking”, which shows “Booking…” while pending; “Change time” keeps the selection) · booking confirmed (dialog replaces the confirm dialog) · conflict 409 (selection cleared, grid refetched, slot reads “Just booked”, banner “That slot was just booked. Pick another one.” above the grid) · loading grid.

**04 My bookings**: Upcoming = future, not cancelled, soonest first. Past = completed + all cancelled, newest first. Row: court, date, time range, price, status badge. Cancel booking shown until 2h before start; inside the window a lock + “Can’t cancel anymore. Starts in 40 min. Cancelling closes 2 hours before start.” · cancel AlertDialog · server rejection (dialog stays open with banner, only Close; list refetches) · empty upcoming (with Find a court) · empty past. Success → toast “Booking cancelled”.

**05 Admin courts**: table incl. inactive (Stone name, Inactive badge) with Edit + Deactivate/Reactivate · New court dialog · Edit with errors (“Price must be more than €0.”, “Closing time must be after opening time.”, “Enter a court name.”) · deactivate AlertDialog stating bookings and history are kept · no courts. Save → toast “Court saved”. Reactivate needs no confirmation.

**06 Admin daily bookings**: date control (prev / date button with Calendar popover / next, past dates allowed) · “Expected revenue” metric + booking count + “N cancelled booking (€X) excluded” · table sorted by start time with tfoot total · empty day (€0, 0) · loading.

**07 Shared**: nav per role (desktop + 375px) · toasts · 403 (“You don’t have access to this page”) · 404 · component sheet. Unauthenticated users are redirected to Sign in.

## 6. Copy reference

- Book court · Confirm booking · Change time · View availability · Cancel booking · Keep booking · Deactivate court · Keep active · Reactivate · Save court · New court
- Conflict: “That slot was just booked. Pick another one.”
- Inside window: “Can’t cancel anymore” + “Starts in {x}. Cancelling closes 2 hours before start.”
- Server rejection: “This booking can’t be cancelled anymore. It starts in less than 2 hours.”
- Revenue note: “{n} cancelled booking(s) (€{x}) excluded”
