# Admin redesign

The admin panel (`/admin/*`) is getting a new frame and look: a dark side menu instead of
"← Back to Admin Dashboard" links, panels instead of plain sections, and real states for
everything that can be loading, empty, failing or urgent.

Only the owner uses the admin. There is no deadline: quality over speed, one page at a time.

## How we work (read this first)

Two Claudes share this folder:

| Who | Where | Owns |
| --- | --- | --- |
| **Design Claude** | claude.ai, with a design canvas | Everything in `docs/admin-redesign/` except the "Built" notes. Never edits `src/`, never commits. |
| **Code Claude** (you, in the IDE) | this repo | All of `src/`, tests and commits. Updates `pages.md` (build status), `components.md` (real props), `questions.md`. |

The loop for each page:

1. Design Claude designs the page, saves its source to `designs/`, marks it **Designed** in `pages.md`.
2. Code Claude builds it from `designs/` + `components.md`, reusing existing components, marks it **Built**
   and writes down any deviation in `pages.md` and any open point in `questions.md`.
   **Ask instead of guessing**: if the design does not answer something, add it to `questions.md`
   and pick the most conservative option.
3. The owner reviews in the browser. Design Claude reads the code + notes, answers questions, adjusts the design.
4. The owner marks it **Approved**.

One page (or one shared piece) per branch / PR. Never mix a page migration with unrelated work.

## The design files

`designs/*.dc.html` are the canvas exports. They are self-contained HTML with inline styles plus a
small `class Component extends DCLogic` script that only produces sample data. Read them as the
visual spec: layout, spacing, colours, sizes, copy, states. **Do not copy their markup or script
into the app**: build with React + SCSS modules like the rest of the repo. They open in a browser
only inside the canvas, so read the source.

| File | What it shows |
| --- | --- |
| `designs/dashboard.dc.html` | Dashboard, desktop. Its `scenario` prop drives four states: `clear`, `busy`, `paused`, `loading` (search for `renderVals`). |
| `designs/dashboard-states.dc.html` | Every component state, side by side, plus the token sheet. |
| `designs/dashboard-phone.dc.html` | Dashboard at 390 px: top bar instead of side menu. |
| `designs/dashboard-phone-menu.dc.html` | Phone menu drawer, open. |

## Look and feel

- **Quiet by default, loud only when needed.** Everything is grey/black. Colour appears only when a
  number is above zero (amber or red), when purchases are paused (red), or for status badges.
- Dense but airy: 8 px cards, 1px `--color-border-default` borders, no shadows except dialogs.
- Same tokens as the public site (`src/styles/variables.scss`); admin-only additions are prefixed `--admin-`.

### Colour

Existing tokens (use the variable, never the hex):

| Use | Token |
| --- | --- |
| Side menu background | `--color-dark-surface` (#1a1a1a) |
| Active menu item, user card | `--color-dark-surface-raised` (#2a2a2a) |
| Menu section labels, muted text on dark | `--color-dark-text-muted` (#999999) |
| Menu borders on dark | `--color-gray-80` (#333333) |
| Page background | `--color-gray-10` (#f9f9f9) |
| Panels | `--color-white` |
| Panel border | `--color-border-default` (#eaeaea) |
| Row divider inside panels | `--color-gray-20` (#f0f0f0) |
| Table header row | `--color-gray-15` (#f6f6f6) |
| Titles, metric numbers | `--color-black` |
| Body text | `--color-text-primary` (#333) |
| Secondary text | `--color-text-secondary` (#666) |
| Danger / pause / red tone | `--color-red-50` (#bd1622), bg `--color-red-30`, border `--color-red-40` |
| Red text on light red | `--color-red-70` (#721c24) |
| Amber badge (menu) | `--color-amber-50` (#f59e0b) |
| Amber text | `--color-yellow-70` (#856404), light bg `--color-yellow-30` |
| Success text / "All clear" | `--color-green-70` on `--color-green-30` |
| Info badge | `--color-badge-info-bg` / `--color-badge-info-text` |

NEW tokens to add to `variables.scss` (admin block):

```scss
--admin-sidebar-width: 248px;
--admin-content-max-width: 1180px;
--admin-nav-hover: #222222;          // menu item hover on dark
--admin-nav-text: #e0e0e0;           // menu item text on dark (= --color-gray-35)
--admin-amber-bg: #fffbeb;           // amber attention card
--admin-amber-border: #f5d68a;
--admin-live: #4cc38a;               // "Purchases open" dot
--admin-paused-surface: #3a1316;     // paused box inside the dark menu
--admin-paused-border: #7a1c22;
--admin-paused-text: #e0b4b7;
--admin-paused-dot: #ff6b6b;
```

### Type

All admin text is `--font-dashboard` (Geist, weights 300/400/600/700, there is no 500). The only
exception is the wordmark "The Art Room" in the menu: `--font-serif` (EB Garamond) 500, 24 px (20 px on phone).

| Role | Spec |
| --- | --- |
| Page title | 700 · 30 px (`--text-2xl`) · letter-spacing -0.02em · black (26 px on phone) |
| Eyebrow (date above title) | 600 · 11 px · uppercase · 0.12em · secondary |
| Panel title | 700 · 13 px · uppercase · 0.08em · black |
| Panel subtitle | 400 · 13 px · secondary |
| Metric number | 700 · 32 px · line-height 1 · `font-variant-numeric: tabular-nums` |
| Body | 400 · 14 px (`--text-sm`) · line-height 1.5 |
| Small / meta | 12 px (`--text-xs`) |
| Menu section label | 600 · 11 px · uppercase · 0.1em · `--color-dark-text-muted` |

### Spacing, radius, layout

- 4 px scale (`--space-*`). Panel padding 24 px (`--space-6`), grid gaps 12–16 px, section gap 24 px.
- Radius: 4 px controls and buttons (`--radius-sm`), 8 px cards, panels and menu items (`--radius-md`), pills `--radius-full`.
- Desktop: side menu 248 px + content. Content padding 36 px top, 40 px sides, max-width 1180 px, centred.
- Below **900 px**: the side menu becomes a 64 px dark top bar (wordmark + menu button) and the
  menu opens as a full-screen drawer. Cards go 2-up, panels stack, padding 16 px.
- Panels in a row use `grid-template-columns: repeat(auto-fit, minmax(420px, 1fr))`.

### Icons

Admin uses **Phosphor** (`@phosphor-icons/react`, already installed). Lucide stays on the public site.

- Menu: size 18, `weight="light"`; the active item uses `weight="fill"`.
- Cards, buttons, banners: size 16, `weight="light"`. Check marks: `weight="bold"`.
- Always `aria-hidden` (the text label carries the meaning). Icon-only buttons need `aria-label`.
- Check that Next tree-shakes the package (`optimizePackageImports`); if not, add it in `next.config.mjs`.

| Where | Phosphor icon |
| --- | --- |
| Dashboard | `SquaresFour` |
| Orders | `ShoppingBag` |
| Edition sales | `ListNumbers` |
| Gift orders | `Gift` |
| Invoices | `Invoice` |
| Payouts | `Wallet` |
| Exhibitions | `Door` |
| Print presentations | `ImageSquare` |
| Content | `Article` |
| Users | `Users` |
| Refund still owed | `ArrowUUpLeft` |
| Needs attention | `Flag` |
| New | `Tray` |
| Awaiting placement at TPS | `PaperPlaneTilt` |
| Delivered, artist not paid | `HandCoins` |
| Pause / Resume | `Pause` / `Play` |
| Log out | `SignOut` |
| Open / close phone menu | `List` / `X` |
| "All orders" link | `CaretRight` |
| All clear | `Check` (bold) |
| Pause confirm dialog | `Warning` |

### Accessibility (non-negotiable)

- Real `<a>` / `<button>` everywhere, `aria-current="page"` on the active menu item.
- `globals.scss` removes every focus outline. **Inside the admin shell, restore a visible
  `:focus-visible` ring** (2 px white ring with a 2 px dark gap on the menu; 2 px black ring with
  2 px gap on light surfaces). Scope it to the admin shell; don't change the public site.
- Text contrast ≥ 4.5:1 (all token pairs above pass). Touch targets ≥ 44 px on phone.
- The paused banner is `role="status"`. Admin dialogs trap focus by making the rest of the page `inert` (the shared `Modal` does not trap Tab on its own; see Q5).
