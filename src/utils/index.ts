const { VertexData } = BABYLON

export const KEY_MAP = {
  ['W'.charCodeAt(0)]: 'forward',
  ['S'.charCodeAt(0)]: 'back',
  ['A'.charCodeAt(0)]: 'left',
  ['D'.charCodeAt(0)]: 'right',
  ['Q'.charCodeAt(0)]: 'exchange',
  [' '.charCodeAt(0)]: 'jump',
}

export const VERTEX_BOX      = VertexData.CreateBox({ })
export const VERTEX_SPHERE   = VertexData.CreateSphere({ })
export const VERTEX_PLANE    = VertexData.CreatePlane({ })
export const VERTEX_GROUND   = VertexData.CreateGround({ })
export const VERTEX_CYLINDER = VertexData.CreateCylinder({ height: 1, diameter: 1 })
