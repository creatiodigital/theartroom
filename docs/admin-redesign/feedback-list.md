# Admin · Gallery › Feedback (the list)

Owner 2026-11-14: "a new menu, and a new page with all feedbacks… I can delete each of them individually… a table
will suffice." Designs on the canvas: "Admin · Gallery › Feedback: the list" (`AdminFeedbackList.dc.html`) and
"Admin · Feedback: delete asks first, after deleting, empty" (`AdminFeedbackStates.dc.html`); copies in `designs/`.
The older "Admin — Feedback" board (stats, device, fps) is **superseded**: the `Feedback` table stores nothing about
the visitor's device, so none of that exists.

**No schema change.** Uses the existing `Feedback` model (`id`, `message`, `source` `home|room`, `exhibitionId`,
`createdAt`). No read/unread state (owner: he keeps the ones he finds useful and deletes the rest).

## Menu
`src/components/admin/shell/adminNav.ts`, section **Gallery**, after Users: `{ label: 'Feedback', href:
'/admin/feedback', icon: ChatCircle }` (Phosphor). No badge.

## Page `/admin/feedback` (admins; same guard as the other Gallery pages)
- Header: small caps *Gallery*, h1 **Feedback**, line *"What visitors send from the home page and the 3D rooms, newest
  first. Each message is also emailed to contact@theartroom.gallery."*
- One white card like Users: a filter group **All · Home page · 3D rooms** (`source`), and on the right the count
  (*"5 messages"*).
- Table, newest first (`createdAt desc`), columns:
  - **Received**: relative for today/yesterday (*Today, 09:42*), else *12 Nov, 18:30* (add the year when not this
    year), Europe/Madrid.
  - **From**: a grey chip *Home page*, or a blue-grey chip *3D room* plus the exhibition title linking to its public
    page (`exhibitionId` null on a room message → *3D room* alone).
  - **Message**: the full text, **rendered as plain text** (never HTML), wrapping, line breaks kept.
  - Actions: an outlined red **Delete** button with the trash icon, `aria-label="Delete this feedback"`.
- **Delete asks first**: the admin confirm dialog (same component as other admin deletes) titled *Delete this
  feedback?*, the message quoted, *"It is removed for good. The email you received stays in your inbox."*, **Cancel**
  / red **Delete**. On success the row disappears and the green bar says **Feedback deleted.** On failure, the red
  FeedbackBar with the server's text.
- **Empty**: *No feedback yet* / *Messages from the home page and the 3D rooms will appear here.*
- Paging: 50 per page with the admin's usual pager if there are more (unlikely for now).
- Phone: the table becomes stacked rows (date + chip on top, message, Delete), as the other admin tables do.

## Server
- `GET` list via a server component or an admin API route; `DELETE /api/admin/feedback/[id]` (admin only, CSRF/
  same-origin as the other admin mutations), 404 when already gone.
- Tests: list order and filter, plain-text rendering (a message with `<b>` shows the tags as text), delete with
  confirm, non-admin refused.
