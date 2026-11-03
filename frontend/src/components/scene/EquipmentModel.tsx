import { useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Edges, useCursor } from '@react-three/drei'
import { Color, type MeshStandardMaterial } from 'three'
import type { Equipment, TagStatus } from '../../api/types'
import { getThemeColors, type ThemeColors } from '../../theme/themeColors'

interface Props {
  equipment: Equipment
  status: TagStatus | undefined
  selected: boolean
  /** Part of a selected group: marked more subtly than a direct selection. */
  highlighted: boolean
  hovered: boolean
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
}

const WARNING_INTENSITY = 0.35
const ALARM_INTENSITY = [0.2, 0.7] as const

export function EquipmentModel({ equipment, status, selected, highlighted, hovered, onSelect, onHover }: Props) {
  const colors = getThemeColors()
  const material = useRef<MeshStandardMaterial>(null)
  useCursor(hovered)

  const { position, size, rotationDeg, shape } = equipment.placement
  const baseColor = useMemo(() => new Color(bodyColor(equipment.type, colors)), [equipment.type, colors])
  const emissive = useMemo(
    () => new Color(status === 'alarm' ? colors.alarm : status === 'warning' ? colors.warning : '#000000'),
    [status, colors],
  )

  // Alarm pulses; warning holds a steady amber glow; normal has no tint.
  useFrame(({ clock }) => {
    if (!material.current) return
    material.current.emissiveIntensity =
      status === 'alarm'
        ? ALARM_INTENSITY[0] + (ALARM_INTENSITY[1] - ALARM_INTENSITY[0]) * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 4))
        : status === 'warning'
          ? WARNING_INTENSITY
          : 0
  })

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    onSelect(equipment.id)
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
          onHover(equipment.id)
        }}
        onPointerOut={() => onHover(null)}
      >
        <Geometry shape={shape} size={size} bodyHeight={bodyHeight} />
        <meshStandardMaterial ref={material} color={baseColor} emissive={emissive} roughness={0.65} metalness={0.15} />
        {(selected || highlighted || hovered) && (
          <Edges
            threshold={20}
            lineWidth={selected ? 2.5 : 1.5}
            color={selected || highlighted ? colors.accent : colors.borderStrong}
          />
        )}
      </mesh>

      {(selected || highlighted) && (
        // Footprint pad: reads as "this one" from any camera angle, even when edges are occluded.
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
          <planeGeometry args={[size.x + 0.6, size.z + 0.6]} />
          <meshBasicMaterial color={colors.accent} transparent opacity={selected ? 0.35 : 0.2} depthWrite={false} />
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
  shape: Equipment['placement']['shape']
  size: Equipment['placement']['size']
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

function bodyColor(type: Equipment['type'], colors: ThemeColors) {
  switch (type) {
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
