import { useCallback, useMemo, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3 } from 'three'
import type { SceneLabelRegistry } from './labelRegistry'

/** Lives inside the Canvas: re-projects every registered label after the camera moves. */
export function LabelProjector({ registry }: { registry: SceneLabelRegistry }) {
  useFrame(({ camera, size }) => registry.project(camera, size.width, size.height))
  return null
}

interface SceneLabelProps {
  registry: SceneLabelRegistry
  id: string
  /** World-space anchor. */
  at: [number, number, number]
  /** How the label sits relative to its anchor. */
  placement?: 'above' | 'below-right'
  children: ReactNode
}

/** Lives in the DOM overlay above the Canvas. Starts hidden until the projector positions it. */
export function SceneLabel({ registry, id, at, placement = 'above', children }: SceneLabelProps) {
  const [x, y, z] = at
  const position = useMemo(() => new Vector3(x, y, z), [x, y, z])
  const ref = useCallback(
    (element: HTMLDivElement | null) => registry.register(id, element, position),
    [registry, id, position],
  )

  return (
    <div ref={ref} className="absolute top-0 left-0" style={{ visibility: 'hidden' }}>
      <div className={placement === 'above' ? '-translate-x-1/2 -translate-y-full' : 'translate-y-1'}>{children}</div>
    </div>
  )
}
