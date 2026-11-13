# Public site · Visitor feedback (step 25)

Owner decisions, 2026-11-12. Designs: `designs/feedback-band-and-window.dc.html`, `designs/feedback-phone.dc.html`,
`designs/feedback-in-room.dc.html`. **Follow the existing artwork-inquiry flow** (`src/app/api/inquire/route.ts`,
`src/lib/inquiry/validateInquiry.ts`, `src/lib/emails/inquiryAdminNotification.ts`): same structure, same safeguards,
same testing approach. Where this spec is stricter, this spec wins.

## What the visitor sees
- The **"We'd love to hear from you"** band (home page, `#f8f8f6`) and **Send feedback** in the 3D room menu (`room-about.md`; it replaces the separate button in `feedback-in-room.dc.html`) open the same
  window: one text box (no name, no email, no other questions), **Send feedback**, then the thank-you state (its single **Close** button is the black primary button, full width, as **Send feedback**: owner 2026-11-12). As
  designed; copy from the designs.
- The visitor never gets an email (there is no address to send to, and the form must never send mail to an address
  someone types: see the inquiry route's open-relay note).

## What happens on submit
1. **Store** the message in a new table (`Feedback`, below).
2. **Email the owner** at `ADMIN_EMAIL_TO` (contact@theartroom.gallery; follow the inquiry notification for CC) on
   every accepted message, via the existing Resend setup and email layout. If the email fails, the message stays
   stored, the error is logged (without the message text), and the visitor still sees the thank-you state.

## Database (the only schema change besides Home page prints)
`Feedback`: `id`, `message` (text), `source` (`home` | `room` | other fixed values the UI sends), `exhibitionId`
(nullable, only when sent from a room; set by the server from a validated slug/id, never trusted blindly),
`createdAt`. **Nothing personal**: no IP, no user agent, no cookies. The admin Feedback page that will list these is
parked (later step); when built, it must show the text as plain text.

## Email
- Subject: a **fixed** string, e.g. "New visitor feedback". No visitor text in any header.
- Body: the message (escaped by the renderer; plain-text part too), where it came from (Home page / the exhibition's
  title from the database), date and time (Europe/Madrid). No reply-to (the sender is anonymous).

## Security (no leaks, no injection)
- New route, e.g. `POST /api/feedback`. Public, no auth. JSON only; reject other content types; **body size cap**
  (e.g. 8 KB) before parsing.
- **Same-origin check**: accept only requests whose `Origin` matches the site (and staging/dev hosts); refuse others
  with 403. Stops other sites posting through visitors' browsers.
- **Validate in a separate, tested function** (`validateFeedback`, like `validateInquiry`): `message` required string;
  `sanitizeMultiline` **before** measuring; minimum 3 characters after trimming; maximum 2,000; `source` from the
  fixed list only; the exhibition reference resolved server-side or dropped.
- Database writes only through Prisma (no raw SQL). Never echo the message back in an error.
- Responses never reveal internals: generic messages, no stack traces, no hint which check failed.
- Logs never contain the message text.

## Bots, without "I am not a robot" (no CAPTCHA, no third-party bot service, no OneTrust)
Silent layers, invisible to people:
1. **Honeypot**: a hidden, tab-skipped `website` field, enforced **on the server**. If filled: answer exactly like a
   success, store nothing, send nothing.
2. **Minimum time**: the window includes a timestamp from when it opened, **signed by the server** (HMAC with a
   server secret) so it can't be forged; a submit less than ~3 seconds after opening, or with a missing / invalid /
   older-than-a-day token, is silently dropped like the honeypot. (Issue the token from the page render or a tiny
   GET; no cookies needed.)
3. **Link spam**: a message with more than 2 links (http, www.) is silently dropped.
4. **Rate limits** with the existing durable `rateLimit` (same table): per IP **3 per minute and 10 per day**
   (trusted client IP via `getClientIp`); a **site-wide daily cap** (env `FEEDBACK_DAILY_CAP`, default 50) spent only
   by a message that is about to be stored and emailed (as the inquiry route explains). Over a limit: 429 with a
   friendly "Too many messages. Please try again later." shown in the window.
5. **Duplicate guard**: the same text again from the same IP within 10 minutes is silently dropped.

## Tests
Unit tests for `validateFeedback` (honeypot, timing token, length limits, link count, sanitising); route tests with
Resend mocked (never send real mail from tests); an e2e for the band → window → thank-you. Check that a rejected or
dropped request writes nothing and sends nothing.
