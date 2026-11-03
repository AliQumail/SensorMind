import { Vector3, type Camera } from 'three'

/**
 * Screen-space labels for 3D anchors, rendered as ordinary DOM in the main React tree.
 * drei's <Html> creates a React root per label, which misbehaves on unmount under React 19
 * StrictMode; projecting anchors ourselves is simpler and keeps labels in normal React.
 *
 * Label elements register here with a world position; a projector inside the Canvas moves them
 * every frame. Elements are positioned with transforms only, so there is no layout thrash.
 */
export class SceneLabelRegistry {
  private readonly anchors = new Map<string, { element: HTMLElement; position: Vector3 }>()
  private readonly scratch = new Vector3()

  register(id: string, element: HTMLElement | null, position: Vector3) {
    if (element) this.anchors.set(id, { element, position })
    else this.anchors.delete(id)
  }

  project(camera: Camera, width: number, height: number) {
    for (const { element, position } of this.anchors.values()) {
      const p = this.scratch.copy(position).project(camera)
      const visible = p.z < 1 && Math.abs(p.x) <= 1.2 && Math.abs(p.y) <= 1.2
      element.style.visibility = visible ? 'visible' : 'hidden'
      if (visible) {
        const x = ((p.x + 1) / 2) * width
        const y = ((1 - p.y) / 2) * height
        element.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`
      }
    }
  }
}
