import {
  Mesh,
  Scene,
  Vector3,
  PhysicsImpostor,
  AbstractMesh,
  ActionManager,
  ExecuteCodeAction,
} from '../babylon'

import {
  VERTEX_PLANE,
  VERTEX_BOX,
  VERTEX_SPHERE,
} from '../utils'

export default class Trigger extends Mesh {
  constructor(name, scene: Scene, meshes: AbstractMesh[], opts?: {
    ext?: any,
    enter?: (count?: number, evt?: BABYLON.ActionEvent) => void,
    exit?: (count?: number, evt?: BABYLON.ActionEvent) => void,
  }) {
    super(name, scene)
    
    VERTEX_SPHERE.applyToMesh(this)

    if (opts.ext) {
      Object.assign(this, opts.ext)
    }
    
    var entered = 0
    function enter(evt) {
      opts.enter && opts.enter(entered, evt)
      entered ++
    }
    function exit(evt) {
      entered --
      opts.exit && opts.exit(entered, evt)
    }

    this.actionManager = new ActionManager(scene)
    meshes.forEach(triggerMesh => {
      this.actionManager.registerAction(new ExecuteCodeAction({
        trigger: ActionManager.OnIntersectionEnterTrigger,
        parameter: triggerMesh,
      }, enter))
      this.actionManager.registerAction(new ExecuteCodeAction({
        trigger: ActionManager.OnIntersectionExitTrigger,
        parameter: triggerMesh,
      }, exit))
    })
  }
}
