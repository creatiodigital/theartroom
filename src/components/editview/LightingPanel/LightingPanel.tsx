'use client'

import { useState, type ReactNode } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  CircleHalf,
  LampPendant,
  Lightbulb,
  Mountains,
  Sun,
  SunHorizon,
} from '@phosphor-icons/react'

import { AdminSelect } from '@/components/admin/ui/AdminSelect'
import {
  InfoLine,
  PanelCard,
  PanelSection,
  SliderRow,
  SwitchRow,
  ToolPanel,
  metres,
  useSaveTracking,
} from '@/components/editorChrome'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { isTrackLampVisible } from '@/components/scene/spaces/objects/TrackLamp/trackLampVisibility'
import { getSpaceFeatures } from '@/config/spaceConfig'
import { isBakedSpace } from '@/lib/bake/bakedSpaces'
import {
  DIMMER_MIN,
  DIMMER_STANDARD,
  DIMMER_STEP,
  wholePercentStep,
  dimmerLevel,
  dimmerPercent,
  lightShare,
  fillShare,
  FILL_MAX,
} from '@/lib/bake/dimmer'
import {
  TRACK_THROW_MIN,
  TRACK_THROW_SLIDER_MAX,
  TRACK_THROW_STEP,
  sliderToThrow,
  throwLabel,
  throwToSlider,
} from '@/lib/bake/trackThrow'
import { hideLightingPanel } from '@/redux/slices/dashboardSlice'
import {
  setExhibitionField,
  setTrackLampRotation,
  setTrackLampEnabled,
  setTrackLampOffset,
} from '@/redux/slices/exhibitionSlice'
import type { TExhibition } from '@/types/exhibition'
import type { RootState } from '@/redux/store'

import { LampPicker, roomNumberOf } from './LampPicker'
import styles from './LightingPanel.module.scss'

// Default values
const DEFAULT_AMBIENT_COLOR = '#e4e8f2'
const DEFAULT_AMBIENT_INTENSITY = 1.0
const DEFAULT_SKYLIGHT_COLOR = '#ffffff'
const DEFAULT_SKYLIGHT_INTENSITY = 4.0
const DEFAULT_LAMP_COLOR = '#ffffff'
const DEFAULT_LAMP_INTENSITY = 4.0
const DEFAULT_TRACK_LAMP_COLOR = '#ffffff'
const DEFAULT_TRACK_LAMP_INTENSITY = 4.0
const DEFAULT_RECESSED_LAMP_COLOR = '#ffffff'
const DEFAULT_RECESSED_LAMP_INTENSITY = 4.0
const DEFAULT_RECESSED_LAMP_ANGLE = 0.45
const DEFAULT_RECESSED_LAMP_DISTANCE = 15.0
const DEFAULT_TRACK_LAMP_MATERIAL_COLOR = '#ffffff'
const DEFAULT_TRACK_LAMP_ANGLE = 0.45
const DEFAULT_TRACK_LAMP_DISTANCE = 5.0
const DEFAULT_WINDOW_COLOR = '#ffffff'
const DEFAULT_WINDOW_INTENSITY = 4.0
/**
 * AR-170 (Eduardo 2026-11-01): "no more tinted glasses… all windows will now show a building
 * behind, so hide the glass color option for now. Do not destroy that picked in case, in the
 * future, an artist does not want to show the building behind." Hidden only: each exhibition's
 * stored glass color stays as it is.
 */
const SHOW_GLASS_COLOR = false
const DEFAULT_HDRI_ROTATION = 128
const DEFAULT_SHADOW_BLUR = 0.025
const DEFAULT_SHADOW_SPREAD = 1.2
const DEFAULT_SHADOW_OPACITY = 0.25
const DEFAULT_SHADOW_DIRECTION = 0.2

const HDRI_OPTIONS = [{ value: 'soil', label: 'Soil' }] as const

const CEILING_LIGHT_OPTIONS = [
  { value: 'track', label: 'Track lamps' },
  { value: 'plafond', label: 'Plafond lamps' },
  { value: 'track-plafond', label: 'Track lamps + plafond lamps' },
] as const

/**
 * The throw's chip: `throwLabel`'s words with a space before the unit ("4.5 m", editor3d.md);
 * "No limit" as it is. Display only: `throwLabel` itself stays (e2e bake-dimmer pins it).
 */
const throwChip = (stored: number) => throwLabel(stored).replace(/(\d)m$/, '$1 m')

const LightingPanel = () => {
  const dispatch = useDispatch()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  // NEW lamp picker (editor3d.md): which lamp's controls show. UI state only: never dispatched
  // or saved, and nothing in the room follows it. Null: the first lamp.
  const [pickedLamp, setPickedLamp] = useState<number | null>(null)

  const exhibitionId = useSelector((state: RootState) => state.exhibition.id)
  // Display only (questions.md Q131, Q139 b): the Save area's "Unsaved changes" / "Not saved".
  const saveTrack = useSaveTracking(exhibitionId ? `${exhibitionId}:lighting` : null)

  const set = (field: keyof TExhibition, value: TExhibition[keyof TExhibition]) => {
    dispatch(setExhibitionField({ field, value }))
    setSaved(false)
    saveTrack.edited()
  }

  const storedSpaceId = useSelector((state: RootState) => state.exhibition.spaceId)
  const spaceId = storedSpaceId || 'paris'
  // AR-161 (spec rule 7): in a baked space the space owns the look. Artists keep what physically
  // changes the light — a dimmer per lamp type, the track lamps' beam angle and throw (Eduardo
  // 2026-10-20) and each track lamp's place, aim and on/off; the sky, ambient, window light,
  // shadows, lamp colors and the lighting set are the space's. Other spaces keep today's panel.
  const bakedSpace = isBakedSpace(storedSpaceId)

  const ambientColor = useSelector(
    (state: RootState) => state.exhibition.ambientLightColor ?? DEFAULT_AMBIENT_COLOR,
  )
  const ambientIntensity = useSelector(
    (state: RootState) => state.exhibition.ambientLightIntensity ?? DEFAULT_AMBIENT_INTENSITY,
  )
  const skylightColor = useSelector(
    (state: RootState) => state.exhibition.skylightColor ?? DEFAULT_SKYLIGHT_COLOR,
  )
  const skylightIntensity = useSelector(
    (state: RootState) => state.exhibition.skylightIntensity ?? DEFAULT_SKYLIGHT_INTENSITY,
  )
  const lampColor = useSelector(
    (state: RootState) => state.exhibition.ceilingLampColor ?? DEFAULT_LAMP_COLOR,
  )
  const lampIntensity = useSelector(
    (state: RootState) => state.exhibition.ceilingLampIntensity ?? DEFAULT_LAMP_INTENSITY,
  )
  const trackLampColor = useSelector(
    (state: RootState) => state.exhibition.trackLampColor ?? DEFAULT_TRACK_LAMP_COLOR,
  )
  const trackLampIntensity = useSelector(
    (state: RootState) => state.exhibition.trackLampIntensity ?? DEFAULT_TRACK_LAMP_INTENSITY,
  )
  const recessedLampColor = useSelector(
    (state: RootState) => state.exhibition.recessedLampColor ?? DEFAULT_RECESSED_LAMP_COLOR,
  )
  const recessedLampIntensity = useSelector(
    (state: RootState) => state.exhibition.recessedLampIntensity ?? DEFAULT_RECESSED_LAMP_INTENSITY,
  )
  const recessedLampAngle = useSelector(
    (state: RootState) => state.exhibition.recessedLampAngle ?? DEFAULT_RECESSED_LAMP_ANGLE,
  )
  const recessedLampDistance = useSelector(
    (state: RootState) => state.exhibition.recessedLampDistance ?? DEFAULT_RECESSED_LAMP_DISTANCE,
  )
  const trackLampMaterialColor = useSelector(
    (state: RootState) =>
      state.exhibition.trackLampMaterialColor ?? DEFAULT_TRACK_LAMP_MATERIAL_COLOR,
  )
  const trackLampAngle = useSelector(
    (state: RootState) => state.exhibition.trackLampAngle ?? DEFAULT_TRACK_LAMP_ANGLE,
  )
  const trackLampDistance = useSelector(
    (state: RootState) => state.exhibition.trackLampDistance ?? DEFAULT_TRACK_LAMP_DISTANCE,
  )
  const trackLampSettings = useSelector((state: RootState) => state.exhibition.trackLampSettings)

  // How many track lamps exist comes from the loaded GLB, not a constant here.
  // A space with more lamps than the old hard-coded 14 used to show controls for
  // only the first 14, with the rest silently unreachable.
  // Kept GROUPED rather than flattened. Vienna authors 28 track lamps across two
  // rooms, and a flat list of 28 lamp blocks is unusable to scroll; each room
  // collapses instead. A space with no room grouping (Paris, Madrid) comes back
  // as a single anonymous group and still renders inline, so nothing that is
  // visible there today ends up behind a click.
  const trackLampGroups = useSelector((state: RootState) => state.scene.trackLampGroups)
  const ceilingLightMode = useSelector(
    (state: RootState) => state.exhibition.ceilingLightMode ?? 'track-plafond',
  )
  const windowColor = useSelector(
    (state: RootState) => state.exhibition.windowLightColor ?? DEFAULT_WINDOW_COLOR,
  )
  const windowIntensity = useSelector(
    (state: RootState) => state.exhibition.windowLightIntensity ?? DEFAULT_WINDOW_INTENSITY,
  )
  const windowTransparency = useSelector(
    (state: RootState) => state.exhibition.windowTransparency ?? false,
  )
  // AR-169, baked spaces: the artist's shares of the space's daylight (blinds) and soft fill.
  const daylightLevel = lightShare(
    useSelector((state: RootState) => state.exhibition.daylightLevel),
  )
  const fillLightLevel = fillShare(
    useSelector((state: RootState) => state.exhibition.fillLightLevel),
  )
  const hdriEnvironment = useSelector(
    (state: RootState) => state.exhibition.hdriEnvironment ?? 'soil',
  )
  const hdriRotation = useSelector(
    (state: RootState) => state.exhibition.hdriRotation ?? DEFAULT_HDRI_ROTATION,
  )
  const shadowBlur = useSelector(
    (state: RootState) => state.exhibition.shadowBlur ?? DEFAULT_SHADOW_BLUR,
  )
  const shadowSpread = useSelector(
    (state: RootState) => state.exhibition.shadowSpread ?? DEFAULT_SHADOW_SPREAD,
  )
  const shadowOpacity = useSelector(
    (state: RootState) => state.exhibition.shadowOpacity ?? DEFAULT_SHADOW_OPACITY,
  )
  const shadowDirection = useSelector(
    (state: RootState) => state.exhibition.shadowDirection ?? DEFAULT_SHADOW_DIRECTION,
  )

  // Get features from space config
  const spaceFeatures = getSpaceFeatures(spaceId)
  const hasSkylight = spaceFeatures.hasSkylight
  const hasLamps = spaceFeatures.hasLamps
  const hasTrackLamps = spaceFeatures.hasTrackLamps
  const hasRecessedLamps = spaceFeatures.hasRecessedLamps
  const hasWindows = spaceFeatures.hasWindows

  // Filter ceiling light options based on space features
  const availableCeilingLightOptions = CEILING_LIGHT_OPTIONS.filter((option) => {
    if (!hasTrackLamps) return option.value === 'plafond'
    return true
  })

  // If current mode is not available, fall back to the first available option
  const effectiveCeilingLightMode = availableCeilingLightOptions.some(
    (o) => o.value === ceilingLightMode,
  )
    ? ceilingLightMode
    : (availableCeilingLightOptions[0]?.value ?? 'plafond')

  const showPlafond =
    hasRecessedLamps &&
    (effectiveCeilingLightMode === 'plafond' || effectiveCeilingLightMode === 'track-plafond')
  const showTrackLamps =
    hasTrackLamps &&
    (effectiveCeilingLightMode === 'track' || effectiveCeilingLightMode === 'track-plafond')

  const handleSave = async () => {
    if (!exhibitionId) return

    setSaving(true)
    const sentAt = saveTrack.started()
    try {
      const response = await fetch(`/api/exhibitions/${exhibitionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        // A baked space's panel saves only what it shows.
        body: JSON.stringify(
          bakedSpace
            ? {
                trackLampIntensity,
                trackLampAngle,
                trackLampDistance,
                trackLampSettings: trackLampSettings ?? null,
                recessedLampIntensity,
                trackLampMaterialColor,
                windowLightColor: windowColor,
                daylightLevel,
                fillLightLevel,
              }
            : {
                ambientLightColor: ambientColor,
                ambientLightIntensity: ambientIntensity,
                skylightColor,
                skylightIntensity,
                ceilingLampColor: lampColor,
                ceilingLampIntensity: lampIntensity,
                trackLampColor,
                trackLampIntensity,
                trackLampAngle,
                trackLampDistance,
                trackLampSettings: trackLampSettings ?? null,
                recessedLampColor,
                recessedLampIntensity,
                recessedLampAngle,
                recessedLampDistance,
                trackLampMaterialColor,
                windowLightColor: windowColor,
                windowLightIntensity: windowIntensity,
                windowTransparency,
                hdriEnvironment,
                hdriRotation,
                ceilingLightMode,
                shadowBlur,
                shadowSpread,
                shadowOpacity,
                shadowDirection,
              },
        ),
      })

      if (response.ok) {
        setSaved(true)
      }
      saveTrack.finished(sentAt, response.ok)
    } catch (error) {
      console.error('Failed to save lighting settings:', error)
      saveTrack.finished(sentAt, false)
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    dispatch(hideLightingPanel())
  }

  // Each lamp (NEW lamp picker, editor3d.md): the space's track lamps as one grid per room
  // (`groupNodesByRoom` normalises the Blender naming, so `room0` becomes "Room 1"; a space with
  // no room grouping is a single grid), then only the picked lamp's switch and sliders. How many
  // lamps exist comes from the loaded GLB, not a constant. Default: the first lamp.
  const allLamps = trackLampGroups.flatMap((group) => group.indices)
  const lampIsOn = (index: number) => isTrackLampVisible(trackLampSettings?.[String(index)])
  const pickedIndex =
    pickedLamp !== null && allLamps.includes(pickedLamp) ? pickedLamp : allLamps[0]

  let eachLamp: ReactNode = null
  if (pickedIndex !== undefined) {
    const i = pickedIndex
    const group =
      trackLampGroups.find((candidate) => candidate.indices.includes(i)) ?? trackLampGroups[0]
    const position = group.indices.indexOf(i)
    const settings = trackLampSettings?.[String(i)]
    // A hidden lamp is gone from the scene, so there is nothing for
    // its rotation and offset to aim — the sliders go with it.
    const isEnabled = isTrackLampVisible(settings)
    const rotation = settings?.rotation ?? 0
    const offset = settings?.offset ?? 0
    // Numbering restarts inside each room, because the room's caption
    // already says which room these belong to. Every label
    // below uses this same number: the sliders used to announce the
    // raw GLB node index, so a screen reader named a different lamp
    // than the one on screen.
    const label = `Lamp ${position + 1}`
    const title = group.room ? `Room ${roomNumberOf(group.room)} · ${label}` : label

    eachLamp = (
      <PanelCard
        level="group"
        title="Each lamp"
        aside={`${allLamps.filter(lampIsOn).length} on · pick one to adjust`}
      >
        <LampPicker
          groups={trackLampGroups}
          isOn={lampIsOn}
          selected={i}
          onSelect={setPickedLamp}
        />
        <div className={styles.lamp}>
          <SwitchRow
            title={title}
            stateText
            checked={isEnabled}
            onChange={() => {
              dispatch(setTrackLampEnabled({ index: i, enabled: !isEnabled }))
              setSaved(false)
              saveTrack.edited()
            }}
          />
          <SliderRow
            label="Turn"
            aria-label={`${title} turn`}
            value={`${rotation}°`}
            sliderValue={rotation}
            min={-180}
            max={180}
            step={1}
            onChange={(v) => {
              dispatch(setTrackLampRotation({ index: i, rotation: v }))
              setSaved(false)
              saveTrack.edited()
            }}
            disabled={!isEnabled}
          />
          <SliderRow
            label="Position along the track"
            aria-label={`${title} position along the track`}
            value={metres(offset, 2)}
            sliderValue={offset}
            min={-2}
            max={2}
            step={0.01}
            onChange={(v) => {
              dispatch(setTrackLampOffset({ index: i, offset: v }))
              setSaved(false)
              saveTrack.edited()
            }}
            disabled={!isEnabled}
          />
        </div>
      </PanelCard>
    )
  }

  // Beam angle and throw, in every space. The throw's top position is no cut-off (stored 0): the
  // light falls off by the inverse square alone, as every approved baked look was made.
  const trackBeamControls = (
    <>
      <SliderRow
        label="Angle"
        aria-label="Track lamps angle"
        value={`${(trackLampAngle * (180 / Math.PI)).toFixed(0)}°`}
        sliderValue={trackLampAngle}
        min={0.1}
        max={1.2}
        step={0.05}
        onChange={(v) => set('trackLampAngle', v)}
      />
      {/* The light's reach (three's SpotLight distance): it fades toward it and reaches nothing
          beyond; the top is "No limit" (questions.md Q134). */}
      <SliderRow
        label="Light reach"
        value={throwChip(trackLampDistance)}
        sliderValue={throwToSlider(trackLampDistance)}
        min={TRACK_THROW_MIN}
        max={TRACK_THROW_SLIDER_MAX}
        step={TRACK_THROW_STEP}
        onChange={(v) => set('trackLampDistance', sliderToThrow(v))}
      />
    </>
  )

  const panel = {
    title: 'Lighting',
    description: 'How light falls on the walls and the works.',
    icon: Lightbulb,
    tint: 'lighting',
    onClose: handleClose,
    save: { saving, saved, onSave: handleSave, status: saveTrack.status },
  } as const

  if (bakedSpace) {
    // Dimmers: 10–100% of the space's calibrated lamps (slider 0.4–4, 4 = 100%, never above).
    // A level stored before the rollout outside that range shows, and bakes, clamped.
    // AR-169: the soft light (on screen at once) 0–200%, the daylight (blinds, baked) 0–100%.
    const softLight = `${Math.round(fillLightLevel * 100)}%`
    const ceilingLights = `${dimmerPercent(recessedLampIntensity)}%`
    const trackLamps = `${dimmerPercent(trackLampIntensity)}%`
    const daylight = `${Math.round(daylightLevel * 100)}%`

    return (
      <ToolPanel {...panel}>
        {/* AR-169: the room's soft light (the even environment, `softFill.ts`) — first, and up to
            twice the space's own (Eduardo 2026-10-31: "add a knob… the sphere we created"). On
            screen at once, never baked. */}
        <PanelSection
          title="Soft light"
          sub="Even light across the whole room"
          icon={Sun}
          summary={softLight}
          storageKey="section-soft-light"
        >
          <SliderRow
            label="Brightness"
            aria-label="Soft light brightness"
            value={softLight}
            sliderValue={fillLightLevel}
            min={0}
            max={FILL_MAX}
            step={0.01}
            onChange={(v) => set('fillLightLevel', wholePercentStep(v))}
          />
        </PanelSection>

        {showPlafond && (
          <PanelSection
            title="Ceiling lights"
            sub="The round lights in the ceiling"
            icon={Lightbulb}
            summary={ceilingLights}
            storageKey="section-ceiling"
          >
            <SliderRow
              label="Brightness"
              aria-label="Ceiling lights brightness"
              value={ceilingLights}
              sliderValue={dimmerLevel(recessedLampIntensity)}
              min={DIMMER_MIN}
              max={DIMMER_STANDARD}
              step={DIMMER_STEP}
              onChange={(v) => set('recessedLampIntensity', wholePercentStep(v))}
            />
          </PanelSection>
        )}

        {showTrackLamps && (
          <PanelSection
            title="Track lamps"
            sub="Spotlights on the ceiling tracks"
            icon={LampPendant}
            summary={trackLamps}
            storageKey="section-track-lamps"
          >
            <PanelCard level="group" title="All lamps">
              <SliderRow
                label="Brightness"
                aria-label="Track lamps brightness"
                value={trackLamps}
                sliderValue={dimmerLevel(trackLampIntensity)}
                min={DIMMER_MIN}
                max={DIMMER_STANDARD}
                step={DIMMER_STEP}
                onChange={(v) => set('trackLampIntensity', wholePercentStep(v))}
              />

              {trackBeamControls}

              {/* AR-169: the fixture's body color is the artist's again (it is not in the bake). */}
              <ColorPicker
                variant="inline"
                name="Lamp color"
                textColor={trackLampMaterialColor}
                onColorSelect={(color) => set('trackLampMaterialColor', color)}
              />
            </PanelCard>

            {eachLamp}
          </PanelSection>
        )}

        {/* AR-169: the glass color is the artist's — the daylight's color in the bake too. AR-170:
            hidden while every window shows the street behind clear glass (`SHOW_GLASS_COLOR`). */}
        {hasWindows && (
          <PanelSection
            title="Window"
            sub="Daylight through the windows"
            icon={SunHorizon}
            summary={daylight}
            storageKey="section-window"
          >
            {SHOW_GLASS_COLOR && (
              <ColorPicker
                variant="inline"
                name="Glass color"
                textColor={windowColor}
                onColorSelect={(color) => set('windowLightColor', color)}
              />
            )}
            <SliderRow
              label="Daylight"
              value={daylight}
              sliderValue={daylightLevel}
              min={0}
              max={1}
              step={0.01}
              onChange={(v) => set('daylightLevel', wholePercentStep(v))}
            />
          </PanelSection>
        )}
      </ToolPanel>
    )
  }

  return (
    <ToolPanel {...panel}>
      <PanelSection title="Environment" icon={Mountains} storageKey="section-environment">
        <AdminSelect
          label="Sky type"
          size="form"
          value={hdriEnvironment}
          onChange={(value) => set('hdriEnvironment', value)}
        >
          {HDRI_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </AdminSelect>

        <SliderRow
          label="Sky rotation"
          value={`${hdriRotation.toFixed(0)}°`}
          sliderValue={hdriRotation}
          min={0}
          max={360}
          step={1}
          onChange={(v) => set('hdriRotation', v)}
        />

        <ColorPicker
          variant="inline"
          name="Ambient color"
          textColor={ambientColor}
          onColorSelect={(color) => set('ambientLightColor', color)}
        />

        <SliderRow
          label="Ambient intensity"
          value={ambientIntensity.toFixed(2)}
          sliderValue={ambientIntensity}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => set('ambientLightIntensity', v)}
        />
      </PanelSection>

      {(hasSkylight || hasLamps || hasTrackLamps || hasRecessedLamps) && (
        <PanelSection title="Ceiling" icon={Lightbulb} storageKey="section-ceiling">
          {hasSkylight && (
            <>
              <ColorPicker
                variant="inline"
                name="Ceiling light color"
                textColor={skylightColor}
                onColorSelect={(color) => set('skylightColor', color)}
              />

              <SliderRow
                label="Ceiling light intensity"
                value={skylightIntensity.toFixed(2)}
                sliderValue={skylightIntensity}
                min={0}
                max={10}
                step={0.1}
                onChange={(v) => set('skylightIntensity', v)}
              />
            </>
          )}

          {hasLamps && (
            <>
              <ColorPicker
                variant="inline"
                name="Lamp color"
                textColor={lampColor}
                onColorSelect={(color) => set('ceilingLampColor', color)}
              />

              <SliderRow
                label="Lamp intensity"
                value={lampIntensity.toFixed(2)}
                sliderValue={lampIntensity}
                min={0}
                max={10}
                step={0.1}
                onChange={(v) => set('ceilingLampIntensity', v)}
              />
            </>
          )}

          {availableCeilingLightOptions.length > 0 && (
            <AdminSelect
              label="Ceiling light type"
              size="form"
              value={effectiveCeilingLightMode}
              onChange={(value) => set('ceilingLightMode', value)}
            >
              {availableCeilingLightOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </AdminSelect>
          )}

          {hasRecessedLamps &&
            (effectiveCeilingLightMode === 'plafond' ||
              effectiveCeilingLightMode === 'track-plafond') && (
              <>
                <ColorPicker
                  variant="inline"
                  name="Plafond color"
                  textColor={recessedLampColor}
                  onColorSelect={(color) => set('recessedLampColor', color)}
                />

                <SliderRow
                  label="Plafond intensity"
                  value={recessedLampIntensity.toFixed(2)}
                  sliderValue={recessedLampIntensity}
                  min={0}
                  max={10}
                  step={0.1}
                  onChange={(v) => set('recessedLampIntensity', v)}
                />

                <SliderRow
                  label="Plafond angle"
                  value={`${(recessedLampAngle * (180 / Math.PI)).toFixed(0)}°`}
                  sliderValue={recessedLampAngle}
                  min={0.1}
                  max={1.2}
                  step={0.05}
                  onChange={(v) => set('recessedLampAngle', v)}
                />

                <SliderRow
                  label="Plafond distance"
                  value={metres(recessedLampDistance, 1)}
                  sliderValue={recessedLampDistance}
                  min={1}
                  max={20}
                  step={0.5}
                  onChange={(v) => set('recessedLampDistance', v)}
                />
              </>
            )}
        </PanelSection>
      )}

      {hasTrackLamps &&
        (effectiveCeilingLightMode === 'track' ||
          effectiveCeilingLightMode === 'track-plafond') && (
          <PanelSection title="Track lamps" icon={LampPendant} storageKey="section-track-lamps">
            <PanelCard level="group" title="All lamps">
              <ColorPicker
                variant="inline"
                name="Light color"
                textColor={trackLampColor}
                onColorSelect={(color) => set('trackLampColor', color)}
              />

              <SliderRow
                label="Intensity"
                aria-label="Track lamps intensity"
                value={trackLampIntensity.toFixed(2)}
                sliderValue={trackLampIntensity}
                min={0}
                max={10}
                step={0.1}
                onChange={(v) => set('trackLampIntensity', v)}
              />

              {trackBeamControls}

              <ColorPicker
                variant="inline"
                name="Lamp color"
                textColor={trackLampMaterialColor}
                onColorSelect={(color) => set('trackLampMaterialColor', color)}
              />
            </PanelCard>

            {eachLamp}
          </PanelSection>
        )}

      {hasWindows && (
        <PanelSection title="Window" icon={SunHorizon} storageKey="section-window">
          <SwitchRow
            title="Transparent"
            checked={windowTransparency}
            onChange={() => set('windowTransparency', !windowTransparency)}
          />

          {windowTransparency ? (
            <InfoLine>Window is transparent — HDRI visible</InfoLine>
          ) : (
            <>
              <ColorPicker
                variant="inline"
                name="Color"
                textColor={windowColor}
                onColorSelect={(color) => set('windowLightColor', color)}
              />

              <SliderRow
                label="Intensity"
                aria-label="Window intensity"
                value={windowIntensity.toFixed(2)}
                sliderValue={windowIntensity}
                min={0}
                max={10}
                step={0.1}
                onChange={(v) => set('windowLightIntensity', v)}
              />
            </>
          )}
        </PanelSection>
      )}

      <PanelSection title="Shadows" icon={CircleHalf} storageKey="section-shadows">
        <SliderRow
          label="Blur"
          aria-label="Shadow blur"
          value={shadowBlur.toFixed(3)}
          sliderValue={shadowBlur}
          min={0.01}
          max={0.08}
          step={0.005}
          onChange={(v) => set('shadowBlur', v)}
        />

        <SliderRow
          label="Spread"
          aria-label="Shadow spread"
          value={shadowSpread.toFixed(1)}
          sliderValue={shadowSpread}
          min={0.5}
          max={3.0}
          step={0.1}
          onChange={(v) => set('shadowSpread', v)}
        />

        <SliderRow
          label="Tightness"
          aria-label="Shadow tightness"
          value={shadowOpacity.toFixed(2)}
          sliderValue={shadowOpacity}
          min={0.05}
          max={0.8}
          step={0.01}
          onChange={(v) => set('shadowOpacity', v)}
        />

        <SliderRow
          label="Direction"
          aria-label="Shadow direction"
          value={shadowDirection.toFixed(2)}
          sliderValue={shadowDirection}
          min={0.0}
          max={1.0}
          step={0.05}
          onChange={(v) => set('shadowDirection', v)}
        />
      </PanelSection>
    </ToolPanel>
  )
}

export default LightingPanel
