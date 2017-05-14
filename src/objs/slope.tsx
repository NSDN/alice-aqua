import {
  h
} from 'preact'

import {
  Mesh,
  Vector3,
  Tags,
  VertexData,
  Scene,
  PhysicsImpostor,
} from '../babylon'

import {
  Vector3Map,
  StaticBoxImpostor,
  CommonMaterial,
} from '../utils/babylon'

import {
  debounce,
} from '../utils'

import {
  ObjectOptions,
  IPlayStartStopListener,
} from '../game/objbase'

import Sprite from './sprite'

export default class Slope extends Sprite implements IPlayStartStopListener {
  static readonly TARGET_TAG = 'slope-target'

  private _direction: 'x' | 'z' = 'x'
  get direction() {
    return this._direction
  }
  set direction(val) {
    if (this._direction !== val) {
      this._direction = val
      this.updateSlopeMesh()
    }
  }

  private _targetName = ''
  get targetName() {
    return this._targetName
  }
  set targetName(newTarget) {
    if (this._targetName !== newTarget) {
      const oldTarget = this._targetName
      this._targetName = newTarget
      this.updateSlopeMesh()
      setImmediate(_ => {
        const oldMesh = this.getScene().getMeshByName(oldTarget)
        oldMesh && oldMesh.unregisterAfterWorldMatrixUpdate(this.updateSlopeMesh)
        const newMesh = this.getScene().getMeshByName(newTarget)
        newMesh && newMesh.registerAfterWorldMatrixUpdate(this.updateSlopeMesh)
      })
    }
  }

  private updateSlopeMesh = () => Slope.updateSlopeMeshes(this.getScene())

  static updateSlopeMeshes = debounce((scene: Scene) => {
    const gvd = {
      positions: [ ] as number[],
      indices: [ ] as number[],
      normals: [ ] as number[],
      uvs: [ ] as number[]
    }
    const svd = {
      positions: [ ] as number[],
      indices: [ ] as number[],
      normals: [ ] as number[],
      uvs: [ ] as number[]
    }
    scene.getMeshesByTags(Slope.TARGET_TAG).forEach(mesh => {
      const slope = mesh as any as Slope,
        target = slope.getScene().getMeshByName(slope._targetName)
      if (!target) {
        return
      }

      const p0 = Vector3Map(slope.position, Math.floor),
        p1 = Vector3Map(target.position, Math.floor),
        min = Vector3.Minimize(p0, p1).add(new Vector3(1, 0, 1)),
        max = Vector3.Maximize(p0, p1)
      for (const i of [0, 2, 1, 1, 2, 3]) {
        gvd.indices.push(i + gvd.positions.length / 3)
      }
      for (const i of [0, 2, 1, 1, 2, 3, 4, 5, 6, 6, 5, 7]) {
        svd.indices.push(i + svd.positions.length / 3)
      }
      if (slope._direction === 'x') {
        min.z -= 0.99
        min.y = min.x === p0.x + 1 ? p0.y : p1.y
        max.z += 0.99
        max.y = max.x === p0.x ? p0.y : p1.y
        gvd.positions.push(
          min.x, min.y, min.z,
          min.x, min.y, max.z,
          max.x, max.y, min.z,
          max.x, max.y, max.z,
        )
        gvd.normals.push(
          0, 1, 0,
          0, 1, 0,
          0, 1, 0,
          0, 1, 0,
        )
        svd.positions.push(
          min.x, min.y, max.z,
          min.x, min.y - 1, max.z,
          max.x, max.y, max.z,
          max.x, max.y - 1, max.z,
          min.x, min.y, min.z,
          min.x, min.y - 1, min.z,
          max.x, max.y, min.z,
          max.x, max.y - 1, min.z,
        )
        svd.normals.push(
          1, 0, 0,
          1, 0, 0,
          1, 0, 0,
          1, 0, 0,
          -1, 0, 0,
          -1, 0, 0,
          -1, 0, 0,
          -1, 0, 0,
        )
        svd.uvs.push(
          min.x, 1,
          min.x, 0,
          max.x, 1,
          max.x, 0,
          min.x, 1,
          min.x, 0,
          max.x, 1,
          max.x, 0,
        )
      }
      else {
        min.x -= 0.99
        min.y = min.z === p0.z + 1 ? p0.y : p1.y
        max.x += 0.99
        max.y = max.z === p0.z ? p0.y : p1.y
        gvd.positions.push(
          min.x, min.y, min.z,
          min.x, max.y, max.z,
          max.x, min.y, min.z,
          max.x, max.y, max.z,
        )
        gvd.normals.push(
          0, 1, 0,
          0, 1, 0,
          0, 1, 0,
          0, 1, 0,
        )
        svd.positions.push(
          min.x, min.y, min.z,
          min.x, min.y - 1, min.z,
          min.x, max.y, max.z,
          min.x, max.y - 1, max.z,
          max.x, min.y, min.z,
          max.x, min.y - 1, min.z,
          max.x, max.y, max.z,
          max.x, max.y - 1, max.z,
        )
        svd.normals.push(
          0, 0, 1,
          0, 0, 1,
          0, 0, 1,
          0, 0, 1,
          0, 0, -1,
          0, 0, -1,
          0, 0, -1,
          0, 0, -1,
        )
        svd.uvs.push(
          min.z, 1,
          min.z, 0,
          max.z, 1,
          max.z, 0,
          min.z, 1,
          min.z, 0,
          max.z, 1,
          max.z, 0,
        )
      }
      gvd.uvs.push(
        min.x, min.z,
        min.x, max.z,
        max.x, min.z,
        max.x, max.z,
      )
    })

    let groundMeshes = scene.getMeshByName('slope-ground') as Mesh
    if (!groundMeshes) {
      const mesh = groundMeshes = new Mesh('slope-ground', scene),
        material = mesh.material = new CommonMaterial(mesh.name + '-mat', scene)
      material.diffuseTexture = new BABYLON.Texture('assets/slope-ground.png', scene)
      groundMeshes.receiveShadows = true
    }
    Object.assign(new VertexData(), gvd).applyToMesh(groundMeshes)

    let sideMeshes = scene.getMeshByName('slope-side') as Mesh
    if (!sideMeshes) {
      const mesh = sideMeshes = new Mesh('slope-side', scene),
        material = mesh.material = new CommonMaterial(mesh.name + '-mat', scene)
      material.diffuseTexture = new BABYLON.Texture('assets/slope-side.png', scene)
    }
    Object.assign(new VertexData(), svd).applyToMesh(sideMeshes)
  }, 50)

  constructor(name: string, opts: ObjectOptions) {
    super(name, opts)

    Tags.AddTagsTo(this, Slope.TARGET_TAG)
    this.registerAfterWorldMatrixUpdate(this.updateSlopeMesh)
    this.onDisposeObservable.add(this.updateSlopeMesh)
  }

  renderConfig(save: (args: Partial<Slope>) => void) {
    return [
      <div>
        <label>target: </label>
        <select value={ this.targetName }
          onChange={ ({ target }) => save({ targetName: (target as HTMLSelectElement).value }) }>
          <option value="">--</option>
          {
            this.getScene().getMeshesByTags(Slope.TARGET_TAG)
              .map(mesh => mesh as any as Slope)
              .filter(mesh => mesh !== this && mesh.targetName !== this.name)
              .map(mesh => <option>{ mesh.name }</option>)
          }
        </select>
      </div>,
      <div>
        <label>target: </label>
        <select value={ this._direction }
          onChange={ ({ target }) => save({ direction: (target as HTMLSelectElement).value as any }) }>
          <option>x</option>
          <option>z</option>
        </select>
      </div>,
    ]
  }

  private groundImpostor: PhysicsImpostor
  onPlayStart() {
    this.spriteBody.isVisible = false

    const target = this.getScene().getMeshByName(this._targetName),
      p0 = Vector3Map(this.position, Math.floor),
      p1 = Vector3Map((target || this).position, Math.floor),
      min = Vector3.Minimize(p0, p1),
      max = Vector3.Maximize(p0, p1).add(new Vector3(1, 0, 1)),
      delta = max.subtract(min),
      center = max.add(min).scale(0.5),
      dir = this._direction,
      axis = dir === 'z' ? 'x' : 'z',
      position = Vector3.Zero(),
      rotation = Vector3.Zero(),
      scaling = Vector3.Zero()
    if (delta[dir] > 2) {
      const length = delta[dir] - 2,
        angle = Math.atan2(delta.y, length),
        thickness = Math.cos(angle)
      position.copyFrom(center)
      position.y -= 0.5 * thickness / Math.cos(angle)
      rotation[dir] = 0
      rotation[axis] = Math.PI / 2 - angle * Math.sign((p0.y - p1.y) * (p0[dir] - p1[dir])) * (dir === 'x' ? -1 : 1)
      scaling[dir] = thickness
      scaling[axis] = delta[axis] * 0.99
      scaling.y = Math.sqrt(length * length + delta.y * delta.y)
      scaling.y += thickness * delta.y / length
    }

    this.groundImpostor && this.groundImpostor.dispose()
    this.groundImpostor = new StaticBoxImpostor({ position, scaling, rotation }, this.getScene())
  }
  onPlayStop() {
    this.spriteBody.isVisible = true

    this.groundImpostor && this.groundImpostor.dispose()
    this.groundImpostor = null
  }
}
