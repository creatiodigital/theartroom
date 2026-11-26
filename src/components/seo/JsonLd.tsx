/**
 * Structured data for search engines (schema.org JSON-LD), AR-193. `<` is escaped so a title or a
 * note that contains "</script>" can't end the tag early.
 */
export const JsonLd = ({ data }: { data: object }) => (
  <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
  />
)
