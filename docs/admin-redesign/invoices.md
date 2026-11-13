# Invoices (`/admin/invoices`)

Approved by the owner 2026-11-11, including the parts marked **NEW**. Design: `designs/invoices.dc.html`
(sample data). Same pieces as Orders. Keep all logic: filters, hide-voided behaviour, exports, downloads.

- Header: eyebrow *Sales*, title **Invoices** (was "Invoice Register"), sub *Every invoice and credit note
  the gallery has issued, for the accountant.* Actions in the header, right: **Export CSV** (outline,
  download icon) and **Export PDFs (ZIP)** (dark; "Zipping…" while busy). Both export exactly what they
  export today.
- **NEW totals cards** for the current Year/Month filter (client search and Hide voided do not change
  them, like the exports): **Invoiced** (total, net of credit notes), **Base** ("before VAT"), **VAT**
  ("collected"), **Documents** ("n invoices · n credit notes").
- Toolbar: Year select, Month select (disabled until a year is chosen, as today), client search with
  magnifier (placeholder *Client name or email*), **Hide voided** checkbox, count on the right.
- Table: **Number** (Geist Mono 500) + type badge on the same line (Invoice: grey; Credit note:
  `--color-badge-info-*`). Voided invoice: number struck through and secondary, line 2 in
  `--color-red-70` 600: *Voided by {credit note number}*. Credit note: line 2 in info blue:
  *Cancels {invoice number}* (if known). · **Date** · **Client** (name + email) · **NEW Order** (mono
  link to the order, only if the invoice row already has an order id; otherwise leave the column out) ·
  **Base** / **VAT** / **Total** right-aligned, tabular, Total 600; credit notes show minus amounts ·
  **PDF** link-button (download icon), same URL as today's "View / download".
- **NEW totals row** (`tfoot`) for the rows shown: "Total for {period}", Base, VAT, Total.
- Footnote under the table: *Exports always include voided invoices and their credit notes, which
  cancel each other out.* (today's text, shown always, not only when hiding).
- Empty states keep today's three messages (no invoices / none match / all voided and hidden).
