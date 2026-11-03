import { useMemo } from 'react'
import { Grid, Line } from '@react-three/drei'
import type { EquipmentGroup, Floor } from '../../api/types'
import { groupBounds } from '../../lib/sceneGeometry'
import { equipmentStatus } from '../../lib/status'
import { usePlant } from '../../state/plantContext'
import { useReadings } from '../../state/readingsStore'
import { getThemeColors } from '../../theme/themeColors'
import { EquipmentModel } from './EquipmentModel'

interface Props {
  floor: Floor
  hoveredId: string | null
  onHover: (id: string | null) => void
}

/** One floor in local coordinates (origin at the floor corner), centred on the world origin. */
export function FloorModel({ floor, hoveredId, onHover }: Props) {
  const colors = getThemeColors()
  const readings = useReadings()
  const { selection, select } = usePlant()
  const { width, depth } = floor.size

  const selectEquipment = (id: string) => select({ kind: 'equipment', id })

  return (
    <group position={[-width / 2, 0, -depth / 2]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[width / 2, 0, depth / 2]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color={colors.floor} roughness={1} />
      </mesh>

      <Grid
        position={[width / 2, 0.002, depth / 2]}
        args={[width, depth]}
        cellSize={1}
        cellThickness={0.6}
        cellColor={colors.grid}
        sectionSize={5}
        sectionThickness={1}
        sectionColor={colors.borderStrong}
        fadeDistance={0}
      />

      {floor.groups.map((group) => (
        <GroupZone key={group.id} group={group} floor={floor} selected={selection?.kind === 'group' && selection.id === group.id} />
      ))}

      {floor.groups.flatMap((group) =>
        group.equipment.map((equipment) => (
          <EquipmentModel
            key={equipment.id}
            equipment={equipment}
            status={equipmentStatus(equipment, readings)}
            selected={selection?.kind === 'equipment' && selection.id === equipment.id}
            highlighted={selection?.kind === 'group' && selection.id === group.id}
            hovered={hoveredId === equipment.id}
            onSelect={selectEquipment}
            onHover={onHover}
          />
        )),
      )}
    </group>
  )
}

/** A soft rectangle around a group's equipment, so groups read as areas of the plant. Its label lives in the overlay. */
function GroupZone({ group, floor, selected }: { group: EquipmentGroup; floor: Floor; selected: boolean }) {
  const colors = getThemeColors()
  const bounds = useMemo(() => groupBounds(group, floor), [group, floor])
  if (!bounds) return null

  const { minX, maxX, minZ, maxZ } = bounds
  const outline: [number, number, number][] = [
    [minX, 0.01, minZ],
    [maxX, 0.01, minZ],
    [maxX, 0.01, maxZ],
    [minX, 0.01, maxZ],
    [minX, 0.01, minZ],
  ]

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(minX + maxX) / 2, 0.006, (minZ + maxZ) / 2]}>
        <planeGeometry args={[maxX - minX, maxZ - minZ]} />
        <meshStandardMaterial color={selected ? colors.accent : colors.zone} transparent opacity={selected ? 0.18 : 0.7} />
      </mesh>
      <Line
        points={outline}
        color={selected ? colors.accent : colors.borderStrong}
        lineWidth={selected ? 2 : 1}
        dashed={!selected}
        dashSize={0.4}
        gapSize={0.25}
      />
    </group>
  )
}
