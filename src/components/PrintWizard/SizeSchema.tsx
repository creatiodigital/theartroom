'use client'

import type { SizeUnit } from './types'

import styles from './PrintWizard.module.scss'

interface SizeSchemaProps {
  printWidthCm: number
  printHeightCm: number
  moldingWidthCm: number
  moldingColorHex: string
  mattingBorderCm: number
  mattingColorHex: string
  showFrame: boolean
  unit: SizeUnit
}

/**
 * Live SVG diagram that mirrors theprintspace-style "print + mat + frame"
 * measurements panel. All values come in cm; we render mm in the labels
 * because theprintspace shows mm and buyers understand both after scanning.
 */
export const SizeSchema = ({
  printWidthCm,
  printHeightCm,
  moldingWidthCm,
  moldingColorHex,
  mattingBorderCm,
  mattingColorHex,
  showFrame,
  unit,
}: SizeSchemaProps) => {
  const effectiveMatting = showFrame ? mattingBorderCm : 0
  const effectiveFrame = showFrame ? moldingWidthCm : 0

  const matWidthCm = printWidthCm + effectiveMatting * 2
  const matHeightCm = printHeightCm + effectiveMatting * 2
  const overallWidthCm = matWidthCm + effectiveFrame * 2
  const overallHeightCm = matHeightCm + effectiveFrame * 2

  const formatDim = (cm: number) =>
    unit === 'inches' ? `${Math.round(cm / 2.54)} in` : `${cm.toFixed(0)} cm`

  // Square viewBox so portrait and landscape renders get the same visual
  // budget. Scaling by the *longest* side means a 30×20 print looks the
  // same physical size whether hung portrait or landscape — flipping only
  // rotates the rectangle, never shrinks it.
  const VIEWBOX_W = 280
  const VIEWBOX_H = 280
  const PADDING = 32
  const availableW = VIEWBOX_W - PADDING * 2
  const availableH = VIEWBOX_H - PADDING * 2
  const longestCm = Math.max(overallWidthCm, overallHeightCm)
  const scale = Math.min(availableW, availableH) / longestCm

  const outerW = overallWidthCm * scale
  const outerH = overallHeightCm * scale
  const matW = matWidthCm * scale
  const matH = matHeightCm * scale
  const printW = printWidthCm * scale
  const printH = printHeightCm * scale
  const frameW = effectiveFrame * scale

  // Center everything
  const outerX = (VIEWBOX_W - outerW) / 2
  const outerY = (VIEWBOX_H - outerH) / 2
  const matX = outerX + frameW
  const matY = outerY + frameW
  const printX = outerX + frameW + effectiveMatting * scale
  const printY = outerY + frameW + effectiveMatting * scale

  return (
    <div className={styles.schemaWrapper}>
      <svg
        viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
        className={styles.schemaSvg}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Frame — rendered in the selected molding color. */}
        {showFrame && (
          <rect
            x={outerX}
            y={outerY}
            width={outerW}
            height={outerH}
            fill={moldingColorHex}
            rx={1}
          />
        )}

        {/* Mat — rendered in the selected mat color. */}
        {showFrame && effectiveMatting > 0 && (
          <rect x={matX} y={matY} width={matW} height={matH} fill={mattingColorHex} />
        )}

        {/* Print area */}
        <rect
          x={printX}
          y={printY}
          width={printW}
          height={printH}
          fill={showFrame ? '#ffffff' : '#ffffff'}
          stroke={showFrame ? 'none' : '#d0d0d0'}
          strokeWidth={0.5}
        />

        {/* ── Outer width label (top) ─────────────────────────── */}
        {showFrame && (
          <>
            <line
              x1={outerX}
              y1={outerY - 18}
              x2={outerX + outerW}
              y2={outerY - 18}
              stroke="#9a9a9a"
              strokeWidth={0.5}
              markerStart="url(#arrowStart)"
              markerEnd="url(#arrowEnd)"
            />
            <text
              x={outerX + outerW / 2}
              y={outerY - 24}
              textAnchor="middle"
              className={styles.schemaLabel}
            >
              {formatDim(overallWidthCm)}
            </text>
          </>
        )}

        {/* ── Print width label (below the whole frame) ───────── */}
        <line
          x1={printX}
          y1={outerY + outerH + 12}
          x2={printX + printW}
          y2={outerY + outerH + 12}
          stroke="#9a9a9a"
          strokeWidth={0.5}
          markerStart="url(#arrowStart)"
          markerEnd="url(#arrowEnd)"
        />
        <text
          x={printX + printW / 2}
          y={outerY + outerH + 24}
          textAnchor="middle"
          className={styles.schemaLabel}
        >
          {formatDim(printWidthCm)}
        </text>

        {/* ── Outer height label (right) ──────────────────────── */}
        {showFrame && (
          <>
            <line
              x1={outerX + outerW + 22}
              y1={outerY}
              x2={outerX + outerW + 22}
              y2={outerY + outerH}
              stroke="#9a9a9a"
              strokeWidth={0.5}
              markerStart="url(#arrowStart)"
              markerEnd="url(#arrowEnd)"
            />
            <text
              x={outerX + outerW + 28}
              y={outerY + outerH / 2}
              textAnchor="start"
              dominantBaseline="middle"
              className={styles.schemaLabel}
            >
              {formatDim(overallHeightCm)}
            </text>
          </>
        )}

        {/* ── Print height label (left of the whole frame) ────── */}
        <line
          x1={outerX - 12}
          y1={printY}
          x2={outerX - 12}
          y2={printY + printH}
          stroke="#9a9a9a"
          strokeWidth={0.5}
          markerStart="url(#arrowStart)"
          markerEnd="url(#arrowEnd)"
        />
        <text
          x={outerX - 18}
          y={printY + printH / 2}
          textAnchor="end"
          dominantBaseline="middle"
          className={styles.schemaLabel}
        >
          {formatDim(printHeightCm)}
        </text>

        {/* Arrow markers */}
        <defs>
          <marker
            id="arrowStart"
            viewBox="0 0 10 10"
            refX="0"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 10 0 L 0 5 L 10 10 z" fill="#9a9a9a" />
          </marker>
          <marker
            id="arrowEnd"
            viewBox="0 0 10 10"
            refX="10"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#9a9a9a" />
          </marker>
        </defs>
      </svg>
    </div>
  )
}
