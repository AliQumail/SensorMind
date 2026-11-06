import { Grid } from '@react-three/drei'
import type { Floor } from '../../api/types'
import { assetStatus } from '../../lib/status'
import { usePlant } from '../../state/plantContext'
import { useReadings } from '../../state/readingsStore'
import { getThemeColors } from '../../theme/themeColors'
import { AssetModel } from './AssetModel'

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

  const selectAsset = (id: string) => select({ kind: 'asset', id })

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

      {floor.assets.map((asset) => (
        <AssetModel
          key={asset.id}
          asset={asset}
          status={assetStatus(asset, readings)}
          selected={selection?.kind === 'asset' && selection.id === asset.id}
          hovered={hoveredId === asset.id}
          onSelect={selectAsset}
          onHover={onHover}
        />
      ))}
    </group>
  )
}
