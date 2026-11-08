import { useEffect, useMemo, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { PerspectiveCamera, Vector3 } from 'three'
import type { Floor } from '../../api/types'
import { toWorld } from '../../lib/sceneGeometry'
import { STATUS_LABEL, assetStatus } from '../../lib/status'
import { usePlant } from '../../state/plantContext'
import { useReadings } from '../../state/readingsStore'
import { getThemeColors } from '../../theme/themeColors'
import { FloorModel } from './FloorModel'
import { FloorSwitcher } from './FloorSwitcher'
import { SceneLabelRegistry } from './labelRegistry'
import { LabelProjector, SceneLabel } from './SceneLabels'
import { SceneLegend } from './SceneLegend'

/** Camera elevation above the floor plane. */
const VIEW_ANGLE = (52 * Math.PI) / 180

export function PlantScene() {
  const { index, activeFloorId, select } = usePlant()
  const colors = getThemeColors()
  const floor = index.floorById.get(activeFloorId) ?? index.floors[0]
  const span = Math.max(floor.size.width, floor.size.depth)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const labels = useMemo(() => new SceneLabelRegistry(), [])

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface shadow-soft">
      <Canvas
        shadows="percentage"
        dpr={[1, 2]}
        camera={{ fov: 40, near: 0.1, far: 500, position: [0, span, span] }}
        onPointerMissed={() => select(null)}
        aria-label={`3D view of ${floor.name}`}
      >
        <color attach="background" args={[colors.bg]} />

        <hemisphereLight args={[colors.light, colors.surface, 1.1]} />
        <directionalLight
          position={[span * 0.4, span * 0.9, span * 0.3]}
          intensity={1.6}
          color={colors.light}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-span}
          shadow-camera-right={span}
          shadow-camera-top={span}
          shadow-camera-bottom={-span}
          shadow-bias={-0.0002}
          shadow-normalBias={0.03}
        />

        <FloorModel floor={floor} hoveredId={hoveredId} onHover={setHoveredId} />
        <CameraRig floor={floor} />
        <LabelProjector registry={labels} />
        <OrbitControls makeDefault enableDamping maxPolarAngle={Math.PI / 2.15} minDistance={4} maxDistance={span * 2.5} />
      </Canvas>

      <FloorLabels floor={floor} hoveredId={hoveredId} registry={labels} />
      <FloorSwitcher />
      <SceneLegend />
    </div>
  )
}

/** DOM overlay: a name card for the hovered or selected asset. */
function FloorLabels({ floor, hoveredId, registry }: { floor: Floor; hoveredId: string | null; registry: SceneLabelRegistry }) {
  const { index, selection } = usePlant()
  const readings = useReadings()
  const selectedId = selection?.kind === 'asset' ? selection.id : null
  const cardIds = [...new Set([hoveredId, selectedId])].filter((id): id is string => id !== null)

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {cardIds.map((id) => {
        const entry = index.assetById.get(id)
        if (!entry || entry.floor.id !== floor.id) return null
        const { asset } = entry
        const { position, size } = asset.placement
        const status = assetStatus(asset, readings)
        return (
          <SceneLabel key={id} registry={registry} id={`asset:${id}`} at={toWorld(floor, position.x, position.y + size.y + 0.25, position.z)}>
            <div className="rounded-lg border border-border bg-surface-raised/95 px-2.5 py-1.5 text-xs whitespace-nowrap shadow-soft">
              <div className="font-semibold text-text">{asset.name}</div>
              <div className="text-text-muted">
                {asset.manufacturer} {asset.model}
                {status && <> · {STATUS_LABEL[status]}</>}
              </div>
            </div>
          </SceneLabel>
        )
      })}
    </div>
  )
}

/** The bits of drei's OrbitControls the rig needs (registered via makeDefault). */
type Controls = { target: Vector3; update: () => void }

/** Frames the whole floor for the viewport whenever the visible floor or the canvas size changes. */
function CameraRig({ floor }: { floor: Floor }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const controls = useThree((s) => s.controls) as unknown as Controls | null
  const width = useThree((s) => s.size.width)
  const height = useThree((s) => s.size.height)

  useEffect(() => {
    const aspect = width > 0 && height > 0 ? width / height : 1.5
    const halfFov = (camera.fov * Math.PI) / 360

    // Distance at which the floor's width (near edge included) fits horizontally and its (foreshortened) depth vertically.
    const fitWidth = floor.size.width / 2 / (Math.tan(halfFov) * aspect) + (floor.size.depth / 2) * Math.cos(VIEW_ANGLE)
    const fitDepth = ((floor.size.depth / 2) * Math.sin(VIEW_ANGLE) + 1.5) / Math.tan(halfFov)
    const distance = Math.max(fitWidth, fitDepth) * 1.08

    camera.position.set(0, distance * Math.sin(VIEW_ANGLE), distance * Math.cos(VIEW_ANGLE))
    if (controls) {
      controls.target.set(0, 0, 0)
      controls.update()
    } else {
      camera.lookAt(0, 0, 0)
    }
  }, [floor, camera, controls, width, height])

  return null
}
