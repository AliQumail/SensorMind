import { useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Edges, useCursor } from '@react-three/drei'
import { AdditiveBlending, BackSide, Color, type MeshBasicMaterial, type MeshStandardMaterial } from 'three'
import type { Asset, TagStatus } from '../../api/types'
import { isFlagged, prefersReducedMotion, pulseHz, useReducedMotion } from '../../theme/pulse'
import { getThemeColors, type ThemeColors } from '../../theme/themeColors'

interface Props {
  asset: Asset
  status: TagStatus | undefined
  selected: boolean
  hovered: boolean
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
}

// Per status, the pulse swings between low and high: emissive intensity, how far the body colour moves
// towards the status colour (0..1) and the glow shell opacity. Reduced motion holds the STILL values.
const PULSE = {
  warning: { intensity: [0.05, 0.8], tint: [0, 0.7], glow: [0.05, 0.4] },
  alarm: { intensity: [0.1, 1.6], tint: [0, 0.85], glow: [0.1, 0.65] },
} as const
const STILL = { intensity: 0.8, tint: 0.7, glow: 0.35 }
const GLOW_SCALE = 1.06

export function AssetModel({ asset, status, selected, hovered, onSelect, onHover }: Props) {
  const colors = getThemeColors()
  const material = useRef<MeshStandardMaterial>(null)
  const glow = useRef<MeshBasicMaterial>(null)
  useCursor(hovered)
  const reduced = useReducedMotion()

  const { position, size, rotationDeg, shape } = asset.placement
  const baseColor = useMemo(() => new Color(bodyColor(asset.type, colors)), [asset.type, colors])
  const emissive = useMemo(
    () => new Color(status === 'alarm' ? colors.alarm : status === 'warning' ? colors.warning : '#000000'),
    [status, colors],
  )

  // The body material is keyed by status so a unit back to normal gets a fresh, unmutated colour.
  // Only warning/alarm meshes animate: one sine drives the body colour, emissive and glow, written straight to the materials.
  useFrame(({ clock }) => {
    if (!material.current || !glow.current || !isFlagged(status)) return
    const p = PULSE[status]
    const still = prefersReducedMotion()
    const t = 0.5 - 0.5 * Math.cos(2 * Math.PI * pulseHz(status) * clock.elapsedTime)
    const mix = (range: readonly [number, number], fixed: number) => (still ? fixed : range[0] + (range[1] - range[0]) * t)
    material.current.color.copy(baseColor).lerp(emissive, mix(p.tint, STILL.tint))
    material.current.emissiveIntensity = mix(p.intensity, STILL.intensity)
    glow.current.opacity = mix(p.glow, STILL.glow)
  })

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    onSelect(asset.id)
  }

  const isHorizontal = shape === 'horizontal-cylinder'
  const skidHeight = isHorizontal ? Math.min(0.12, size.y * 0.15) : 0
  const bodyHeight = size.y - skidHeight

  return (
    <group position={[position.x, position.y, position.z]} rotation={[0, (rotationDeg * Math.PI) / 180, 0]}>
      {isHorizontal && (
        <mesh position={[0, skidHeight / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[size.x, skidHeight, size.z]} />
          <meshStandardMaterial color={colors.borderStrong} roughness={0.9} />
        </mesh>
      )}

      <mesh
        position={[0, skidHeight + bodyHeight / 2, 0]}
        rotation={isHorizontal ? [0, 0, Math.PI / 2] : [0, 0, 0]}
        castShadow
        receiveShadow
        onClick={handleClick}
        onPointerOver={(e) => {
          e.stopPropagation()
          onHover(asset.id)
        }}
        onPointerOut={() => onHover(null)}
      >
        <Geometry shape={shape} size={size} bodyHeight={bodyHeight} />
        <meshStandardMaterial key={status} ref={material} color={baseColor} emissive={emissive} roughness={0.65} metalness={0.15} />
        {(selected || hovered || (reduced && isFlagged(status))) && (
          <Edges
            threshold={20}
            lineWidth={selected ? 2.5 : 1.5}
            color={selected ? colors.accent : hovered ? colors.borderStrong : emissive}
          />
        )}
      </mesh>

      {isFlagged(status) && (
        // Glow shell: a slightly larger additive copy in the status colour, so the unit halos even when selected.
        <mesh
          position={[0, skidHeight + bodyHeight / 2, 0]}
          rotation={isHorizontal ? [0, 0, Math.PI / 2] : [0, 0, 0]}
          scale={GLOW_SCALE}
          raycast={() => null}
        >
          <Geometry shape={shape} size={size} bodyHeight={bodyHeight} />
          <meshBasicMaterial
            ref={glow}
            color={emissive}
            transparent
            opacity={0}
            side={BackSide}
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}

      {selected && (
        // Footprint pad: reads as "this one" from any camera angle, even when edges are occluded.
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
          <planeGeometry args={[size.x + 0.6, size.z + 0.6]} />
          <meshBasicMaterial color={colors.accent} transparent opacity={0.35} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}

function Geometry({
  shape,
  size,
  bodyHeight,
}: {
  shape: Asset['placement']['shape']
  size: Asset['placement']['size']
  bodyHeight: number
}) {
  switch (shape) {
    case 'cylinder':
      return <cylinderGeometry args={[Math.min(size.x, size.z) / 2, Math.min(size.x, size.z) / 2, bodyHeight, 40]} />
    case 'horizontal-cylinder': {
      // Rotated onto the X axis by the parent mesh: "height" runs along size.x.
      const radius = Math.min(bodyHeight, size.z) / 2
      return <cylinderGeometry args={[radius, radius, size.x, 40]} />
    }
    case 'sphere':
      return <sphereGeometry args={[Math.min(size.x, size.y, size.z) / 2, 32, 16]} />
    default:
      return <boxGeometry args={[size.x, bodyHeight, size.z]} />
  }
}

function bodyColor(type: Asset['type'], colors: ThemeColors) {
  switch (type) {
    case 'refrigerator':
      return colors.refrigerator
    case 'pump':
      return colors.pump
    case 'compressor':
      return colors.compressor
    case 'motor':
      return colors.motor
    case 'tank':
      return colors.tank
    default:
      return colors.other
  }
}
