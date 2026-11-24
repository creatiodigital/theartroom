'use client'

import { useState, type ReactNode } from 'react'
import {
  ArrowCounterClockwise,
  ArrowClockwise,
  LockSimple,
  LockSimpleOpen,
} from '@phosphor-icons/react'
import c from 'classnames'

import { Button } from '@/components/ui/Button'
import type { FloorArtwork } from '@/lib/floor/floorArtworks'
import type { FloorItem, FloorObject, FloorPedestal } from '@/lib/floor/floorLayout'
import {
  detachObject,
  keepObjectsOnTop,
  pedestalTopCm,
  placeAll,
  toPedestalFrame,
} from '@/lib/floor/floorPlacement'
import {
  EDGE_RADIUS,
  PEDESTAL_MATERIALS,
  PEDESTAL_SHAPES,
  pedestalMaterial,
  pedestalOutline,
  pedestalShape,
  type PedestalEdges,
  type PedestalFinish,
} from '@/lib/floor/pedestals'

import type { FloorEditor } from './useFloorEditor'
import type { FloorRoom } from './useFloorRooms'
import styles from './FloorView.module.scss'

/**
 * The picked item's panel (docs/objects O6, objects-floor-view-draft / objects-pedestals): an
 * Object's place, height, turn, size and shadow, or a pedestal's shape, size, edges, material,
 * colour and place. Several picked: align, distribute, group.
 */
const RAD = Math.PI / 180

function NumberField({
  label,
  value,
  unit,
  hint,
  min,
  max,
  step = 1,
  onChange,
  disabled,
}: {
  label: string
  value: number
  unit: string
  hint?: string
  min?: number
  max?: number
  step?: number
  onChange: (v: number) => void
  disabled?: boolean
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? String(Math.round(value * 10) / 10)
  const commit = () => {
    if (draft === null) return
    const n = Number(draft.replace(',', '.'))
    setDraft(null)
    if (!Number.isFinite(n)) return
    onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n)))
  }
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <span className={styles.num}>
        <input
          type="text"
          inputMode="decimal"
          value={shown}
          disabled={disabled}
          step={step}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') setDraft(null)
          }}
        />
        <small>
          {unit}
          {hint ? ` · ${hint}` : ''}
        </small>
      </span>
    </label>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.inspectorSection}>
      <h3 className={styles.cap}>{title}</h3>
      {children}
    </section>
  )
}

function Segments<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { id: T; label: string }[]
  value: T
  onChange: (id: T) => void
}) {
  return (
    <div role="group" aria-label={label} className={styles.segments}>
      {options.map((o) => (
        <Button
          key={o.id}
          variant="bare"
          className={c(styles.segment, o.id === value && styles.segmentOn)}
          aria-pressed={o.id === value}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </Button>
      ))}
    </div>
  )
}

/** A small top view of a shape, for the picker. */
function ShapeIcon({ id }: { id: (typeof PEDESTAL_SHAPES)[number]['id'] }) {
  const s = pedestalShape(id)
  const k = 40 / Math.max(s.defaults.w, s.defaults.d)
  const pts = pedestalOutline(id, s.defaults.w * k, s.defaults.d * k)
    .map(([x, z]) => `${x},${z}`)
    .join(' ')
  return (
    <svg viewBox="-24 -24 48 48" width="32" height="32" aria-hidden>
      <polygon points={pts} />
    </svg>
  )
}

type Props = {
  editor: FloorEditor
  room: FloorRoom
  artworks: Record<string, FloorArtwork>
  selectedIds: string[]
  names: Record<string, string>
  onSelect: (ids: string[]) => void
  onDuplicate: (p: FloorPedestal) => void
}

export function FloorInspector({
  editor,
  room,
  artworks,
  selectedIds,
  names,
  onSelect,
  onDuplicate,
}: Props) {
  const { layout } = editor
  const items = layout.items.filter((i) => selectedIds.includes(i.id))
  const [confirmRemove, setConfirmRemove] = useState<FloorPedestal | null>(null)
  const at = new Map(placeAll(layout).map(({ item, at }) => [item.id, at]))

  if (items.length === 0) {
    return (
      <aside className={styles.inspector} aria-label="Nothing picked">
        <p className={styles.empty}>
          Pick something on the plan, or add an Object from your library or a pedestal from the bar
          below.
        </p>
      </aside>
    )
  }

  if (items.length > 1)
    return <Several editor={editor} items={items} names={names} onSelect={onSelect} />

  const item = items[0]
  const where = at.get(item.id)!
  const lock = (
    <Button
      variant="bare"
      className={styles.iconButton}
      aria-label={item.locked ? `Unlock ${names[item.id]}` : `Lock ${names[item.id]}`}
      aria-pressed={item.locked}
      onClick={() => editor.patchItem(item.id, { locked: !item.locked })}
    >
      {item.locked ? (
        <LockSimple size={16} weight="fill" aria-hidden />
      ) : (
        <LockSimpleOpen size={16} weight="regular" aria-hidden />
      )}
    </Button>
  )

  // Where it stands, from the west and north walls (cm); moving it there.
  const fromWest = (where.x - room.minX) * 100
  const fromNorth = (where.z - room.minZ) * 100
  const moveTo = (westCm: number, northCm: number) => {
    const x = room.minX + westCm / 100
    const z = room.minZ + northCm / 100
    if (item.kind === 'object' && item.pedestalId) {
      const p = layout.items.find((i) => i.id === item.pedestalId) as FloorPedestal | undefined
      if (!p) return
      const [ox, oz] = toPedestalFrame(p, x, z)
      editor.patchItem(item.id, { offsetX: ox, offsetZ: oz })
    } else {
      editor.patchItem(item.id, { x, z })
    }
  }
  const place = (
    <Section title="Position">
      <div className={styles.pair}>
        <NumberField
          label="From west wall"
          unit="cm"
          value={fromWest}
          disabled={item.locked}
          onChange={(v) => moveTo(v, fromNorth)}
        />
        <NumberField
          label="From north wall"
          unit="cm"
          value={fromNorth}
          disabled={item.locked}
          onChange={(v) => moveTo(fromWest, v)}
        />
      </div>
    </Section>
  )

  const rotation = (
    <Section title="Rotation">
      <div className={styles.rotateRow}>
        <NumberField
          label="Turn"
          unit="°"
          value={where.rotY}
          disabled={item.locked}
          onChange={(v) => editor.patchItem(item.id, { rotY: item.rotY + (v - where.rotY) })}
        />
        <Button
          variant="bare"
          className={styles.btn}
          aria-label="Turn 90° left"
          disabled={item.locked}
          onClick={() => editor.patchItem(item.id, { rotY: item.rotY + 90 })}
        >
          <ArrowCounterClockwise size={16} aria-hidden />
        </Button>
        <Button
          variant="bare"
          className={styles.btn}
          aria-label="Turn 90° right"
          disabled={item.locked}
          onClick={() => editor.patchItem(item.id, { rotY: item.rotY - 90 })}
        >
          <ArrowClockwise size={16} aria-hidden />
        </Button>
      </div>
      <span className={styles.hint}>
        Turns around its own vertical axis. On the plan, the handle snaps every 15°; hold Shift to
        turn freely.
      </span>
    </Section>
  )

  if (item.kind === 'object') {
    const artwork = artworks[item.artworkId]
    const b = artwork?.boundsCm
    const real = b ? `${Math.round(b.w)} × ${Math.round(b.d)} × ${Math.round(b.h)} cm` : null
    const now = b
      ? `${Math.round(b.w * item.scale)} × ${Math.round(b.d * item.scale)} × ${Math.round(b.h * item.scale)} cm`
      : ''
    const pedestal = item.pedestalId
      ? (layout.items.find((i) => i.id === item.pedestalId) as FloorPedestal | undefined)
      : undefined
    const heightCm = where.y * 100
    return (
      <aside className={styles.inspector} aria-label={names[item.id]}>
        <div className={styles.inspectorHead}>
          <span className={styles.inspectorTitle}>
            <b>{names[item.id]}</b>
            <span>Object · {now}</span>
          </span>
          {lock}
          {artwork && (
            <Button variant="bare" href={`/artworks/${artwork.slug}`} className={styles.btn}>
              View details
            </Button>
          )}
        </div>
        {pedestal && (
          <div className={styles.onPedestal}>
            <span>
              <b>On {pedestal.name}</b>
              <span>Moves with the pedestal</span>
            </span>
            <Button
              variant="bare"
              className={styles.btn}
              onClick={() =>
                editor.update((all) =>
                  all.map((i) => (i.id === item.id ? detachObject(layout, item) : i)),
                )
              }
            >
              Detach
            </Button>
          </div>
        )}
        {place}
        <Section title="Height">
          <NumberField
            label="Height above the floor"
            unit="cm"
            hint={pedestal ? `top of ${pedestal.name}` : undefined}
            value={heightCm}
            min={0}
            max={1000}
            disabled={item.locked}
            onChange={(v) =>
              editor.patchItem(item.id, {
                lift: pedestal ? Math.max(0, v - pedestalTopCm(pedestal)) : v,
              })
            }
          />
        </Section>
        {rotation}
        <Section title="Size">
          <NumberField
            label="Size"
            unit="%"
            value={item.scale * 100}
            min={5}
            max={2000}
            disabled={item.locked}
            onChange={(v) => editor.patchItem(item.id, { scale: v / 100 })}
          />
          <span className={styles.hint}>
            Always in proportion. 100% is the real size{real ? `: ${real}` : ''}.
          </span>
          {item.scale !== 1 && (
            <Button
              variant="bare"
              className={styles.link}
              onClick={() => editor.patchItem(item.id, { scale: 1 })}
            >
              Back to real size
            </Button>
          )}
        </Section>
        <Section title="Light">
          <label className={styles.switchRow}>
            <span>
              <span>Casts a shadow</span>
              <span className={styles.hint}>On the floor and on what is under it, once baked</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={item.castShadow}
              onChange={(e) => editor.patchItem(item.id, { castShadow: e.target.checked })}
            />
          </label>
        </Section>
        <div className={styles.inspectorFoot}>
          <Button
            variant="bare"
            className={styles.btn}
            onClick={() => {
              editor.update((all) => all.filter((i) => i.id !== item.id))
              onSelect([])
            }}
          >
            Remove from the floor
          </Button>
        </div>
      </aside>
    )
  }

  // ── A pedestal ──
  const p = item
  const shape = pedestalShape(p.shape)
  const material = pedestalMaterial(p.material)
  const onTop = layout.items.filter(
    (i): i is FloorObject => i.kind === 'object' && i.pedestalId === p.id,
  )
  const resize = (patch: Partial<FloorPedestal>) => {
    const next = { ...p, ...patch }
    const keep = keepObjectsOnTop(
      { ...layout, items: layout.items.map((i) => (i.id === p.id ? next : i)) },
      next,
    )
    editor.commit(keep)
  }
  const removePedestal = (alsoObjects: boolean) => {
    editor.update((all) =>
      all
        .filter(
          (i) => i.id !== p.id && !(alsoObjects && i.kind === 'object' && i.pedestalId === p.id),
        )
        .map((i) => (i.kind === 'object' && i.pedestalId === p.id ? detachObject(layout, i) : i)),
    )
    setConfirmRemove(null)
    onSelect([])
  }
  return (
    <aside className={styles.inspector} aria-label={p.name}>
      <div className={styles.inspectorHead}>
        <span className={styles.inspectorTitle}>
          <b>{p.name}</b>
          <span>
            Pedestal · {shape.label} ·{' '}
            {shape.round ? `⌀ ${Math.round(p.w)}` : `${Math.round(p.w)} × ${Math.round(p.d)}`} ×{' '}
            {Math.round(p.h)} cm
          </span>
        </span>
        {lock}
      </div>
      <Section title="Shape">
        <div className={styles.shapeGrid} role="group" aria-label="Shape">
          {PEDESTAL_SHAPES.map((s) => (
            <Button
              key={s.id}
              variant="bare"
              className={c(styles.shapeTile, s.id === p.shape && styles.shapeOn)}
              aria-pressed={s.id === p.shape}
              title={`${s.label}: ${s.sub}`}
              onClick={() => {
                const d = s.round || s.equal ? p.w : p.d
                resize({ shape: s.id, d, h: s.equal ? p.w : p.h })
              }}
            >
              <ShapeIcon id={s.id} />
              <span>{s.label}</span>
            </Button>
          ))}
        </div>
      </Section>
      <Section title="Size">
        <div className={styles.triple}>
          {shape.equal ? (
            <NumberField
              label="Side"
              unit="cm"
              value={p.w}
              min={5}
              max={600}
              disabled={p.locked}
              onChange={(v) => resize({ w: v, d: v, h: v })}
            />
          ) : shape.round ? (
            <>
              <NumberField
                label="Diameter"
                unit="cm"
                value={p.w}
                min={5}
                max={600}
                disabled={p.locked}
                onChange={(v) => resize({ w: v, d: v })}
              />
              <NumberField
                label="Height"
                unit="cm"
                value={p.h}
                min={2}
                max={600}
                disabled={p.locked}
                onChange={(v) => resize({ h: v })}
              />
            </>
          ) : (
            <>
              <NumberField
                label="Width"
                unit="cm"
                value={p.w}
                min={5}
                max={600}
                disabled={p.locked}
                onChange={(v) => resize({ w: v })}
              />
              <NumberField
                label="Depth"
                unit="cm"
                value={p.d}
                min={5}
                max={600}
                disabled={p.locked}
                onChange={(v) => resize({ d: v })}
              />
              <NumberField
                label="Height"
                unit="cm"
                value={p.h}
                min={2}
                max={600}
                disabled={p.locked}
                onChange={(v) => resize({ h: v })}
              />
            </>
          )}
        </div>
      </Section>
      <Section title="Edges">
        <Segments<PedestalEdges>
          label="Edges"
          options={(Object.keys(EDGE_RADIUS) as PedestalEdges[]).map((id) => ({
            id,
            label: id[0].toUpperCase() + id.slice(1),
          }))}
          value={p.edges}
          onChange={(edges) => editor.patchItem(p.id, { edges })}
        />
      </Section>
      <Section title="Material">
        <div className={styles.materialGrid} role="group" aria-label="Material">
          {PEDESTAL_MATERIALS.map((m) => (
            <Button
              key={m.id}
              variant="bare"
              className={c(styles.materialChip, m.id === p.material && styles.shapeOn)}
              aria-pressed={m.id === p.material}
              onClick={() => editor.patchItem(p.id, { material: m.id, colour: m.colours[0].id })}
            >
              <span
                className={styles.materialDot}
                style={{ background: m.colours[0].hex }}
                aria-hidden
              />
              {m.label}
            </Button>
          ))}
        </div>
      </Section>
      <Section title={material.colourTitle}>
        <div className={styles.colourGrid} role="group" aria-label={material.colourTitle}>
          {material.colours.map((col) => (
            <Button
              key={col.id}
              variant="bare"
              className={c(styles.swatch, col.id === p.colour && styles.swatchOn)}
              style={{ background: col.hex }}
              aria-label={col.label}
              aria-pressed={col.id === p.colour}
              title={col.label}
              onClick={() => editor.patchItem(p.id, { colour: col.id })}
            />
          ))}
          {material.anyColour && (
            <label className={styles.anyColour} title="Any colour">
              <input
                type="color"
                value={p.colour.startsWith('#') ? p.colour : '#ffffff'}
                onChange={(e) => editor.patchItem(p.id, { colour: e.target.value })}
                aria-label="Any colour"
              />
            </label>
          )}
        </div>
        {material.finishes && (
          <Segments<PedestalFinish>
            label="Finish"
            options={[
              { id: 'matte', label: 'Matte' },
              { id: 'satin', label: 'Satin' },
              { id: 'gloss', label: 'Gloss' },
            ]}
            value={p.finish}
            onChange={(finish) => editor.patchItem(p.id, { finish })}
          />
        )}
      </Section>
      {place}
      <Section title="Height above the floor">
        <NumberField
          label="Raised"
          unit="cm"
          value={p.lift}
          min={0}
          max={1000}
          disabled={p.locked}
          onChange={(v) => editor.patchItem(p.id, { lift: v })}
        />
      </Section>
      {rotation}
      <Section title="On top">
        {onTop.length ? (
          <ul className={styles.onTopList}>
            {onTop.map((o) => (
              <li key={o.id}>
                <Button variant="bare" className={styles.link} onClick={() => onSelect([o.id])}>
                  {names[o.id]}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <span className={styles.hint}>
            Drag an Object onto its top: it sits there and moves with it.
          </span>
        )}
      </Section>
      <div className={styles.inspectorFoot}>
        <Button variant="bare" className={styles.btn} onClick={() => onDuplicate(p)}>
          Duplicate
        </Button>
        <Button
          variant="bare"
          className={styles.btn}
          onClick={() => (onTop.length ? setConfirmRemove(p) : removePedestal(false))}
        >
          Remove
        </Button>
      </div>
      {confirmRemove && (
        <div role="alertdialog" aria-label="Remove the pedestal" className={styles.confirm}>
          <p>
            Also remove {onTop.map((o) => names[o.id]).join(', ')}, or keep{' '}
            {onTop.length === 1 ? 'it' : 'them'} on the floor?
          </p>
          <div className={styles.confirmActions}>
            <Button variant="bare" className={styles.btn} onClick={() => setConfirmRemove(null)}>
              Cancel
            </Button>
            <Button variant="bare" className={styles.btn} onClick={() => removePedestal(false)}>
              Keep on the floor
            </Button>
            <Button
              variant="bare"
              className={c(styles.btn, styles.danger)}
              onClick={() => removePedestal(true)}
            >
              Remove too
            </Button>
          </div>
        </div>
      )}
    </aside>
  )
}

/** Several picked: align, distribute, group (⌘G), remove. */
function Several({
  editor,
  items,
  names,
  onSelect,
}: {
  editor: FloorEditor
  items: FloorItem[]
  names: Record<string, string>
  onSelect: (ids: string[]) => void
}) {
  const { layout } = editor
  const at = new Map(placeAll(layout).map(({ item, at }) => [item.id, at]))
  // Free items only: an Object on a pedestal moves with it.
  const movable = items.filter((i) => !i.locked && !(i.kind === 'object' && i.pedestalId))
  const ids = new Set(movable.map((i) => i.id))
  const group = layout.groups.find((g) => items.every((i) => g.memberIds.includes(i.id)))

  const align = (axis: 'x' | 'z', where: 'min' | 'mid' | 'max') => {
    const vals = movable.map((i) => at.get(i.id)![axis])
    const target =
      where === 'min'
        ? Math.min(...vals)
        : where === 'max'
          ? Math.max(...vals)
          : (Math.min(...vals) + Math.max(...vals)) / 2
    editor.update((all) => all.map((i) => (ids.has(i.id) ? { ...i, [axis]: target } : i)))
  }
  const distribute = (axis: 'x' | 'z') => {
    const sorted = [...movable].sort((a, b) => at.get(a.id)![axis] - at.get(b.id)![axis])
    if (sorted.length < 3) return
    const first = at.get(sorted[0].id)![axis]
    const last = at.get(sorted[sorted.length - 1].id)![axis]
    const step = (last - first) / (sorted.length - 1)
    const pos = new Map(sorted.map((i, k) => [i.id, first + step * k]))
    editor.update((all) => all.map((i) => (pos.has(i.id) ? { ...i, [axis]: pos.get(i.id)! } : i)))
  }

  return (
    <aside className={styles.inspector} aria-label={`${items.length} items`}>
      <div className={styles.inspectorHead}>
        <span className={styles.inspectorTitle}>
          <b>{group ? group.name : `${items.length} items`}</b>
          <span>{items.map((i) => names[i.id]).join(', ')}</span>
        </span>
      </div>
      <Section title="Align">
        <div className={styles.buttonRow}>
          <Button variant="bare" className={styles.btn} onClick={() => align('x', 'min')}>
            West
          </Button>
          <Button variant="bare" className={styles.btn} onClick={() => align('x', 'mid')}>
            Centre
          </Button>
          <Button variant="bare" className={styles.btn} onClick={() => align('x', 'max')}>
            East
          </Button>
        </div>
        <div className={styles.buttonRow}>
          <Button variant="bare" className={styles.btn} onClick={() => align('z', 'min')}>
            North
          </Button>
          <Button variant="bare" className={styles.btn} onClick={() => align('z', 'mid')}>
            Middle
          </Button>
          <Button variant="bare" className={styles.btn} onClick={() => align('z', 'max')}>
            South
          </Button>
        </div>
      </Section>
      <Section title="Distribute">
        <div className={styles.buttonRow}>
          <Button
            variant="bare"
            className={styles.btn}
            disabled={movable.length < 3}
            onClick={() => distribute('x')}
          >
            West to east
          </Button>
          <Button
            variant="bare"
            className={styles.btn}
            disabled={movable.length < 3}
            onClick={() => distribute('z')}
          >
            North to south
          </Button>
        </div>
        <span className={styles.hint}>Objects on a pedestal move with it; locked items stay.</span>
      </Section>
      <div className={styles.inspectorFoot}>
        {group ? (
          <Button
            variant="bare"
            className={styles.btn}
            onClick={() =>
              editor.commit({ ...layout, groups: layout.groups.filter((g) => g !== group) })
            }
          >
            Ungroup
          </Button>
        ) : (
          <Button
            variant="bare"
            className={styles.btn}
            onClick={() =>
              editor.commit({
                ...layout,
                groups: [
                  ...layout.groups
                    .map((g) => ({
                      ...g,
                      memberIds: g.memberIds.filter((m) => !items.some((i) => i.id === m)),
                    }))
                    .filter((g) => g.memberIds.length >= 2),
                  {
                    id: `g${Date.now().toString(36)}`,
                    name: `Group ${layout.groups.length + 1}`,
                    memberIds: items.map((i) => i.id),
                  },
                ],
              })
            }
          >
            Group
          </Button>
        )}
        <Button
          variant="bare"
          className={styles.btn}
          onClick={() => {
            const gone = new Set(items.map((i) => i.id))
            editor.update((all) =>
              all
                .filter((i) => !gone.has(i.id))
                .map((i) =>
                  i.kind === 'object' && i.pedestalId && gone.has(i.pedestalId)
                    ? detachObject(layout, i)
                    : i,
                ),
            )
            onSelect([])
          }}
        >
          Remove
        </Button>
      </div>
    </aside>
  )
}

export { RAD }
