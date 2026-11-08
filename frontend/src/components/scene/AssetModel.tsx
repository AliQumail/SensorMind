import { useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Edges, useCursor } from '@react-three/drei'
import { Color, type MeshStandardMaterial } from 'three'
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

// Emissive intensity range per status; the alarm swings wider. Reduced motion holds a fixed bright tint.
const INTENSITY = { warning: [0.05, 0.5], alarm: [0.1, 1.3] } as const
const STILL_INTENSITY = 0.8

export function AssetModel({ asset, status, selected, hovered, onSelect, onHover }: Props) {
  const colors = getThemeColors()
  const material = useRef<MeshStandardMaterial>(null)
  useCursor(hovered)
  const reduced = useReducedMotion()

  const { position, size, rotationDeg, shape } = asset.placement
  const baseColor = useMemo(() => new Color(bodyColor(asset.type, colors)), [asset.type, colors])
  const emissive = useMemo(
    () => new Color(status === 'alarm' ? colors.alarm : status === 'warning' ? colors.warning : '#000000'),
    [status, colors],
  )

  // Only warning/alarm meshes animate: a sine pulse of the emissive tint, written straight to the material.
  useFrame(({ clock }) => {
    if (!material.current || !isFlagged(status)) return
    const [low, high] = INTENSITY[status]
    material.current.emissiveIntensity = prefersReducedMotion()
      ? STILL_INTENSITY
      : low + (high - low) * (0.5 - 0.5 * Math.cos(2 * Math.PI * pulseHz(status) * clock.elapsedTime))
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
        <meshStandardMaterial ref={material} color={baseColor} emissive={emissive} roughness={0.65} metalness={0.15} />
        {(selected || hovered || (reduced && isFlagged(status))) && (
          <Edges
            threshold={20}
            lineWidth={selected ? 2.5 : 1.5}
            color={selected ? colors.accent : hovered ? colors.borderStrong : emissive}
          />
        )}
      </mesh>

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
