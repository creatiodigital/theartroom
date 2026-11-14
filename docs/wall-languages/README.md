# A second language for the 3D space ("wall languages")

Owner's decisions, 2026-11-14. Planning agreed with Design Claude. Designs on the canvas: visitor side `WallLanguagesVisitor.dc.html`, editor side `WallLanguagesEditor.dc.html` (copies in `designs/`). Visitor UI follows the square-corners rule (public-redesign README).
**Status: planned, not built.** Dashboard side and visitor side both described here.

## The idea in one line
An exhibition can offer **one second language** (Français, Español, Italiano…) for the texts **inside its 3D
space only**. Visitors switch **English | Français** in the room menu and every text in the room changes. Nothing else on the site
is translated.

## Scope (owner: "This is not a hotel booking site")
- **Translated with the switch:** every text in the 3D room. All of them are text artworks (`artworkType` text,
  drawn live by `scene/spaces/objects/Stencil/Stencil.tsx` with troika text): names, titles, dates, paragraphs
  printed on the wall, cards with a background, small labels next to works.
- **Not translated, English only:** the whole site (pages, menus, buttons, emails, checkout, legal), the room menu
  itself, *About this exhibition*, bios, short descriptions. If an artist wants French there, they write a French
  paragraph inline, as galleries do on their walls.
- **Exit / Continue signs** are images (`WallSign`): stay English for now.
- The lighting bake is not affected: the words are drawn live on top of the baked card; card size never changes.

## Rules
1. **Main language is always English.** Each exhibition may pick **one** second language from a list.
2. **Partial translation is normal** (owner): an artist may translate only some texts. Nothing in the dashboard
   treats untranslated texts as missing or incomplete.
   The visitor switch never depends on how many texts are translated: it shows whenever the editor has switched it
   on, even if only one text has a translation.
3. **Fallback everywhere:** a text with no second-language version shows its English text. The room is never
   broken or half empty. An empty second field means "same in both languages" (names, dates).
4. **Visible only when switched on.** "Show the language switch to visitors" is **off by default**, so texts can be
   translated over days without visitors seeing a half-translated room. It can be switched off again any time;
   nothing is lost.
5. **Who:** anyone who can edit the exhibition (today the artist and the owner; later curators and gallery
   planners). The admin can change it too. Write the permission as "can edit this exhibition", not "is the artist".
6. **Fit:** a translation must never spill out of its text's box on the wall (wall texts have no card edge and could
   run into the photos below). Editor warns before publishing; in the room, a text that is still too long shrinks
   slightly to fit its box.

## Data (small)
- `Exhibition.secondLanguage String?` — a language code (`fr`, `es`, `it`, `de`, `pt`…), null = none.
- `Exhibition.secondLanguageVisible Boolean @default(false)` — the visitor switch.
- `Artwork.textContentSecond String?` — the second-language text of a text artwork.
- `Artwork.textContentSecondLang String?` — the code the second text was written for (taken from the exhibition when
  it is entered; never shown to the artist). Keeps the door open to more languages later and lets the dashboard warn
  when the same text artwork sits in two exhibitions with different second languages.
- The visitor's choice is not stored in the database (per-visit memory in the browser; `?lang=fr` may open the room in that language, e.g. for the editors' preview).

## Dashboard side
1. **Exhibition settings › new "Languages" card** (after *Short description*):
   - *Main language: English* (fixed text).
   - **Second language**: a list, each name in its own language (None, Français, Español, Italiano, Deutsch,
     Português, …). Saves at once.
   - **Show the language switch to visitors**: toggle, off by default.
   - A neutral count, not a progress bar: *"14 texts have a French version · 4 show in English"* + *"Translate only
     the texts you want; the others stay in English."* (owner 2026-11-14: translating only SOME texts is normal and
     never shown as incomplete).
   - Changing or clearing the language keeps every translation (hidden); a short confirmation says so.
2. **Wall editor (3D space editor):** text is **placed on the wall and written in the panel**, no more typing on the
   wall.
   - Dragging the **T** object onto the wall makes an empty text with the placeholder *"Write the text in the panel"*
     and opens the panel's new **Text** tab (first tab, before Layout and Look).
   - Text tab: **English** text area; **Français** text area (only when the exhibition has a second language), labelled
     with the exhibition's language; a **Preview: English | Français** switch that changes the wall preview; a fit
     check per language (*"The French text doesn't fit: 3 lines too long"*, with **Make the box taller** /
     **Use a smaller text size**).
   - Double-clicking a text on the wall focuses its text area in the panel.
3. **Artwork library › text artwork page** (*Text content* section): English text area as today, then a **Second
   language** text area, with a hint naming where it shows (*"Shown as Français in 'Kritzendorf Between Two Floods'"*)
   and the rare conflict warning when the artwork sits in exhibitions with different second languages. Same field
   as the wall panel: edit in either place, it updates in every exhibition, like replacing an image.

## Visitor side (only when the switch is on)
- **Room menu:** first row, a two-part control **English | Français** (not a menu item). Switching changes every
  text in the room at once; the menu stays open.
- **Only inside the 3D space** (owner 2026-11-14): no language choice on the exhibition page or anywhere else on the site.
- **Welcome window** (owner 2026-11-14): when the visitor enters a room whose second language is on, a centred
  window after the loader, **in English only** (the site is English): serif *This exhibition is also available in
  French* (the language's English name), then *Open the menu [menu icon] to switch languages.* Black **OK** (closes;
  shown again on the next visit) and a text button **Don't show again** (closes and never shows again for this
  exhibition in this browser: localStorage per exhibition, in try/catch). It does not switch the language itself.
  Shown before the movement help, never on top of it; Esc and the backdrop close it like OK.
- **Default:** English, unless the visitor's browser language matches the second language; then that language,
  with the switch to go back.
- `lang` attribute / accessible names follow the chosen language for the room's texts only.

## Order of work (suggested)
1. Schema: the four fields (one migration, owner runs it).
2. Visitor side: room renders `textContentSecond` when `lang` matches and the switch is on; fallback to English;
   fit-to-box in the room.
3. Exhibition settings › Languages card (+ preview link).
4. Wall editor: place-then-write, Text tab, preview switch, fit check.
5. Artwork library: second-language field + hints.
6. Room menu switch + welcome window.

## Open (decide during design)
- Exact list of languages offered.

## Answers to Code Claude (Design Claude, 2026-11-14)
1. **Previews for editors (owner 2026-11-14): two, both inside 3D edit mode; no link in the settings card.**
   - **3D view:** the same **English | French** switch as the visitor's, as the first row of the **top-right menu**
     in 3D edit mode. It shows the whole room in the second language (every text, untranslated ones in English).
     It always works for editors, **even while "Show the language switch to visitors" is off**: that is how the
     artist walks the room in French before visitors can.
   - **2D wall view:** while writing, before saving, the Text tab's **Preview on the wall: English | French** switch
     changes every text on that wall, including unsaved edits, so the artist sees the whole composition in French.
   - Both previews are editor-only and are not saved or shown to visitors; leaving edit mode returns to English.
   - Drop "Preview in French" from the settings card (already removed from the design).
2. **Welcome window:** build it exactly as specified above: the sentence, *Open the menu [menu icon] to switch
   languages.*, black **OK**, and **Don't show again** (per exhibition, per browser). Square corners.
3. **Naming:** dashboard and editors are in English, so they name the language in English: *French*, *Spanish*.
   The **visitor's switch in the room menu** uses the language's own name (*Français*, *Español*) so its readers
   recognise it; the welcome window, being English, says "available in French".
   Fields: in the **wall editor** the second field is labelled with the language (*French*); on the **artwork page**
   in the library it is *Second language*, with the hint naming the language and the exhibition
   (*Shown in French in "Kritzendorf Between Two Floods"*). The settings card names it (*French*).
