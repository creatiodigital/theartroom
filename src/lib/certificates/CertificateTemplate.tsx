import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'

// Brand red used for wordmark + monogram. Tweak here once; it updates both.
const BRAND_RED = '#BF2E2E'

type Props = {
  artworkTitle: string
  artistName: string
  purchaseDate: string // e.g. "18 April 2026"
  /** Optional transparent-PNG signature image URL. Falls back to a typed line if absent. */
  signatureImageUrl?: string | null
}

// A5 portrait at 72 DPI ≈ 420×595 pt. @react-pdf uses its own internal units
// but "A5" as a built-in size maps to the right physical dimensions.
const styles = StyleSheet.create({
  page: {
    padding: 36,
    paddingVertical: 44,
    fontFamily: 'Helvetica',
    color: '#111',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  topBlock: {
    alignItems: 'center',
  },
  wordmark: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: BRAND_RED,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  hairline: {
    marginTop: 8,
    marginBottom: 28,
    width: 56,
    height: 1,
    backgroundColor: '#111',
  },
  title: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 4,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 24,
  },
  body: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 1.6,
    color: '#222',
    marginBottom: 8,
  },
  strong: {
    fontFamily: 'Helvetica-Bold',
  },
  infoBox: {
    marginTop: 24,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderTop: '0.5pt solid #ddd',
    borderBottom: '0.5pt solid #ddd',
    alignItems: 'center',
  },
  artworkTitleLabel: {
    fontSize: 8,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#888',
    marginBottom: 4,
  },
  artworkTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    fontStyle: 'italic',
    marginBottom: 10,
  },
  artistLabel: {
    fontSize: 8,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#888',
    marginBottom: 4,
  },
  artistName: {
    fontSize: 12,
  },
  dateRow: {
    marginTop: 18,
    fontSize: 9,
    color: '#555',
  },
  signatureBlock: {
    alignItems: 'center',
    marginTop: 28,
  },
  signatureImage: {
    width: 160,
    height: 60,
    objectFit: 'contain',
    marginBottom: 4,
  },
  signatureLine: {
    width: 160,
    height: 0.5,
    backgroundColor: '#111',
    marginBottom: 4,
  },
  signatureCaption: {
    fontSize: 8,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#888',
  },
  bottomBlock: {
    alignItems: 'center',
  },
  monogram: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: BRAND_RED,
    letterSpacing: 2,
  },
  footer: {
    fontSize: 7,
    color: '#999',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 6,
  },
})

export const CertificateTemplate = ({
  artworkTitle,
  artistName,
  purchaseDate,
  signatureImageUrl,
}: Props) => (
  <Document
    title={`Certificate of Authenticity — ${artworkTitle}`}
    author="The Art Room"
    subject="Certificate of Authenticity"
  >
    <Page size="A5" style={styles.page}>
      <View style={styles.topBlock}>
        <Text style={styles.wordmark}>The Art Room</Text>
        <View style={styles.hairline} />
        <Text style={styles.title}>Certificate of Authenticity</Text>

        <Text style={styles.body}>This is to certify that the artwork entitled</Text>

        <View style={styles.infoBox}>
          <Text style={styles.artworkTitleLabel}>Artwork</Text>
          <Text style={styles.artworkTitle}>{artworkTitle}</Text>
          <Text style={styles.artistLabel}>By</Text>
          <Text style={styles.artistName}>{artistName}</Text>
          <Text style={styles.dateRow}>Produced on {purchaseDate}</Text>
        </View>

        <Text style={[styles.body, { marginTop: 18 }]}>
          is an authentic fine-art reproduction,{'\n'}
          produced for <Text style={styles.strong}>The Art Room</Text>.
        </Text>

        <View style={styles.signatureBlock}>
          {signatureImageUrl ? (
            <Image src={signatureImageUrl} style={styles.signatureImage} />
          ) : (
            <View style={{ height: 60 }} />
          )}
          <View style={styles.signatureLine} />
          <Text style={styles.signatureCaption}>{artistName}</Text>
        </View>
      </View>

      <View style={styles.bottomBlock}>
        <Text style={styles.monogram}>M</Text>
        <Text style={styles.footer}>The Art Room · theartroom.gallery</Text>
      </View>
    </Page>
  </Document>
)
