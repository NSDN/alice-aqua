import Player from './objs/player'
import Sprite from './objs/sprite'
import Trigger from './objs/trigger'
import TriggerBoard from './objs/trigger-board'
import Gate from './objs/gate'
import Box from './objs/box'
import Ground from './objs/ground'

import {
  Engine,
  Scene,
  HemisphericLight,
  Mesh,
  PhysicsImpostor,
  ArcRotateCamera,
  Vector3,
  Vector2,
  Quaternion,
  VertexData,
  StandardMaterial,
  Texture,
  Color3,
  Animation,
  Matrix,
  ScreenSpaceCanvas2D,
  DirectionalLight,
  ShadowGenerator,
  SSAORenderingPipeline,
  DynamicTexture,
  Rectangle2D,
  Ray,
  AssetsManager,
} from './babylon'

import {
  KEY_MAP,
  VERTEX_GROUND,
  VERTEX_BOX,
  VERTEX_PLANE,
  VERTEX_SPHERE,
} from './utils'

interface Rect {
  left: number,
  top: number,
  width: number,
  height: number,
}

function appendElement(tag, attrs = { } as any) {
  const elem = Object.assign(document.createElement(tag), attrs)
  Object.assign(elem.style, attrs.style)
  document.body.appendChild(elem)
  return elem
}

function creatClipTexture(name, scene, im, rect: Rect) {
  const { left, top, width, height } = rect,
    cache = creatClipTexture['cache'] || (creatClipTexture['cache'] = [ ])

  var index = cache.indexOf(im)
  if (index < 0) {
    index = cache.length
    cache.push(im)
  }

  const key = 'im-clip-cache-' + [index, left, top, width, height].join('-')
  if (cache[key]) {
    return cache[key]
  }

  const canvas = appendElement('canvas', { width, height }) as HTMLCanvasElement
  canvas.getContext('2d').drawImage(im, left, top, width, height, 0, 0, width, height)
  const base64 = canvas.toDataURL()
  document.body.removeChild(canvas)
  return cache[key] = Texture.CreateFromBase64String(base64, name, scene, false, true, Texture.NEAREST_SAMPLINGMODE)
}

const keys = {
  forward: false,
  back: false,
  left: false,
  right: false,
  jump: false,
  exchange: false,
}

const elem = appendElement('canvas') as HTMLCanvasElement
elem.style.width = elem.style.height = '100%'

const engine = new Engine(elem, true)

const scene = new Scene(engine)
scene.enablePhysics(new Vector3(0, -3, 0))
scene.workerCollisions = true

const canvas = new ScreenSpaceCanvas2D(scene, { id: 'canvas' })

const camera = new ArcRotateCamera('camera', -Math.PI * 3 / 4, -Math.PI / 4, 50, null, scene)
camera.getScene().activeCamera = camera
camera.attachControl(engine.getRenderingCanvas(), true)
camera.lowerRadiusLimit = 10
camera.upperRadiusLimit = 100
camera.lowerBetaLimit = Math.PI * 0.35
camera.upperBetaLimit = Math.PI * 0.45

const light = new DirectionalLight('light', new Vector3(0.5, -1, 0.5), scene)
light.position.copyFromFloats(0, 50, 0)
light.intensity = 1

const shadowGenerator = new ShadowGenerator(1024, light)
shadowGenerator.useVarianceShadowMap = true

const shadowRenderList = shadowGenerator.getShadowMap().renderList

// disabled
//const ssao = new BABYLON.SSAORenderingPipeline('ssaopipeline', scene, 0.75, [camera])

engine.runRenderLoop(() => {
  scene.render()
})

window.addEventListener('resize', () => {
  engine.resize()
})

window.addEventListener('keydown', evt => {
  keys[ KEY_MAP[evt.which] ] = true
})

window.addEventListener('keyup', evt => {
  keys[ KEY_MAP[evt.which] ] = false
})

const config = {
  images: {
    tile1: {
      url :'assets/rpg_maker_vx_rtp_tileset_by_telles0808.png',
      size: 2048,
    }
  },
  textures: {
    wall: {
      src: 'tile1',
      clip: [512, 32, 64, 64],
    },
    ground: {
      src: 'tile1',
      clip: [512, 352, 64, 64],
    },
    sand: {
      src: 'tile1',
      clip: [0, 608, 64, 64],
    },
    solid: {
      src: 'tile1',
      clip: [192, 128, 32, 32],
    },
    floor: {
      src: 'tile1',
      clip: [512, 192, 64, 64],
    },
  },
  player: {
    moveForce: 1.5,
    jumpForce: 2.5,
    // lock x & z rotation
    angularDamping: new Vector3(0, 0.8, 0),
    linearDamping: new Vector3(0.8, 0.99, 0.8),
  },
  crate: {
    // be careful with the throttle so that Remilia can move it while Flandre can not
    velocityThrottle: 0.4,
    angularDamping: new Vector3(0.95, 0.8, 0.95),
    linearDamping: new Vector3(0.9, 0.99, 0.9),
  },
  camera: {
    followDamping: 0.1,
  }
}

const houseSize = 12,
  stHeight = 1,
  st1Size = 6,
  st2aLen = new Vector2(stHeight, houseSize - st1Size).length(),
  wallSize = 0.5,
  wallHeight = 2

const boundarySize = 4,
  borderSize = 0.5,
  totalLeft = -houseSize/2,
  totalRight = houseSize/2 + st1Size,
  totalTop = houseSize/2 + st1Size + houseSize,
  totalBottom = -houseSize/2 - st1Size

const crateSize = Box.defaultSize,
  gateWidth = Gate.defaultWidth,
  gateThickness = Gate.defaultThickness

const stage = {
  players: {
    remilia: {
      position: [0, 2, 2],
      mass: 1,
    },
    flandre: {
      position: [0, 2, -houseSize/2 - st1Size/2],
      mass: 5,
    },
  },
  bulletinBoards: {
    bb1: {
      position: [-4, 1, -7],
      text: 'Durararara!!!'
    }
  },
  sprites: {
    tree1: {
      size: [2, 4],
      position: [4, 2, -7],
      region: [128, 1120, 32, 64],
    },
    tree2: {
      size: [2, 4],
      position: [-houseSize/2 + st1Size - 1, 2, houseSize/2 + st1Size + 9],
      region: [0, 1120, 32, 64],
    },
    tree3: {
      size: [2, 4],
      position: [-houseSize/2 + st1Size - 1, 2, houseSize/2 + st1Size + 5],
      region: [160, 1024, 32, 64],
    },
    cactus1: {
      size: [2, 2],
      position: [houseSize/2 + st1Size - 1, 1, houseSize/2 + st1Size - 1],
      region: [192, 1120, 32, 32],
    },
  },
  blocks: {
    room1: {
      texture: 'floor',
      size: [houseSize, 0, houseSize],
      position: [0, 0, 0],
      receiveShadows: true,
    },
    room1wl: {
      texture: 'wall',
      size: [wallSize, wallHeight, houseSize],
      position: [-houseSize/2 + wallSize/2, wallHeight/2, 0],
      uv: ['y', 'z'],
    },
    room1wr: {
      texture: 'wall',
      size: [wallSize, wallHeight*1.5, houseSize],
      position: [houseSize/2 - wallSize/2, wallHeight*0.5/2, 0],
      uv: ['y', 'z'],
    },
    room1wt1: {
      texture: 'wall',
      size: [(houseSize - gateWidth)/2 - wallSize, wallHeight, wallSize],
      position: [(-gateWidth/2 - houseSize/2 + wallSize)/2, wallHeight/2, houseSize/2 - wallSize/2],
      uv: ['x', 'y'],
    },
    room1wt2: {
      texture: 'wall',
      size: [(houseSize - gateWidth)/2 - wallSize, wallHeight, wallSize],
      position: [-(-gateWidth/2 - houseSize/2 + wallSize)/2, wallHeight/2, houseSize/2 - wallSize/2],
      uv: ['x', 'y'],
    },
    room1wb1: {
      texture: 'wall',
      size: [(houseSize - gateWidth)/2 - wallSize, wallHeight, wallSize],
      position: [(-gateWidth/2 - houseSize/2 + wallSize)/2, wallHeight/2, -houseSize/2 + wallSize/2],
      uv: ['x', 'y'],
    },
    room1wb2: {
      texture: 'wall',
      size: [(houseSize - gateWidth)/2 - wallSize, wallHeight, wallSize],
      position: [-(-gateWidth/2 - houseSize/2 + wallSize)/2, wallHeight/2, -houseSize/2 + wallSize/2],
      uv: ['x', 'y'],
    },
    st1: {
      texture: 'ground',
      size: [houseSize + st1Size, 0, st1Size],
      position: [st1Size/2, 0, -houseSize/2 - st1Size/2],
      receiveShadows: true,
    },
    st2: {
      texture: 'solid',
      size: [st1Size, 0, st1Size],
      position: [houseSize/2 + st1Size/2, -stHeight, houseSize/2 - st1Size/2],
      receiveShadows: true,
    },
    st2s: {
      texture: 'ground',
      size: [st1Size, 0, st2aLen],
      position: [houseSize/2 + st1Size/2, -stHeight/2, -houseSize/2+(houseSize-st1Size)/2],
      rotation: [Math.atan2(stHeight, houseSize-st1Size), 0, 0],
      receiveShadows: true,
    },
    st3: {
      texture: 'ground',
      size: [houseSize + st1Size, stHeight, st1Size],
      position: [st1Size/2, -stHeight/2, houseSize/2 + st1Size/2],
      receiveShadows: true,
      uv: ['z', 'x'],
    },
    brick: {
      texture: 'solid',
      size: [crateSize, stHeight, crateSize],
      position: [-houseSize/2 + st1Size - crateSize/2, stHeight/2, houseSize/2 + st1Size + crateSize/2]
    },
    room2: {
      texture: 'floor',
      size: [houseSize, 0, houseSize],
      position: [st1Size, 0, houseSize + st1Size],
      receiveShadows: true,
    },
    room2wl: {
      texture: 'wall',
      size: [wallSize, wallHeight, houseSize],
      position: [-houseSize/2 + st1Size + wallSize/2, wallHeight/2, houseSize/2 + st1Size + houseSize/2],
      uv: ['y', 'z'],
    },
    room2wr: {
      texture: 'wall',
      size: [wallSize, wallHeight, houseSize],
      position: [houseSize/2 + st1Size - wallSize/2, wallHeight/2, houseSize/2 + st1Size + houseSize/2],
      uv: ['y', 'z'],
    },
    room2wt: {
      texture: 'wall',
      size: [houseSize - wallSize*2, wallHeight, wallSize],
      position: [st1Size, wallHeight/2, houseSize/2 + st1Size + houseSize - wallSize/2],
      uv: ['x', 'y'],
    },
    room2wt1: {
      texture: 'wall',
      size: [houseSize/2 - gateWidth/2 - wallSize, wallHeight, wallSize],
      position: [-houseSize/2 + st1Size + (houseSize/2 - gateWidth/2 + wallSize)/2, wallHeight/2, houseSize/2 + st1Size + wallSize/2],
      uv: ['x', 'y'],
    },
    room2wt2: {
      texture: 'wall',
      size: [houseSize/2 - gateWidth/2 - wallSize, wallHeight, wallSize],
      position: [-houseSize/2 + st1Size + (houseSize/2 + gateWidth/2 + houseSize - wallSize)/2, wallHeight/2, houseSize/2 + st1Size + wallSize/2],
      uv: ['x', 'y'],
    },
    st4: {
      texture: 'ground',
      size: [st1Size, 0, houseSize],
      position: [-houseSize/2 + st1Size/2, 0, houseSize/2 + st1Size + houseSize/2],
      receiveShadows: true,
    },
    boundLeft: {
      isHidden: true,
      size: [boundarySize, boundarySize, totalTop - totalBottom],
      position: [totalLeft - boundarySize/2, boundarySize/2, totalTop/2 + totalBottom/2],
    },
    boundRight: {
      isHidden: true,
      size: [boundarySize, boundarySize, totalTop - totalBottom],
      position: [totalRight + boundarySize/2, boundarySize/2, totalTop/2 + totalBottom/2],
    },
    boundTop: {
      isHidden: true,
      size: [totalRight - totalLeft, boundarySize, boundarySize],
      position: [totalLeft/2 + totalRight/2, boundarySize/2, totalTop + boundarySize/2],
    },
    boundBottom: {
      isHidden: true,
      size: [totalRight - totalLeft, boundarySize, boundarySize],
      position: [totalLeft/2 + totalRight/2, boundarySize/2, totalBottom - boundarySize/2],
    },
    borderLeft: {
      size: [borderSize, borderSize*3, totalTop - totalBottom],
      position: [totalLeft - borderSize/2, -borderSize, totalTop/2 + totalBottom/2],
    },
    borderRight: {
      size: [borderSize, borderSize*3, totalTop - totalBottom],
      position: [totalRight + borderSize/2, -borderSize, totalTop/2 + totalBottom/2],
    },
    borderTop: {
      size: [totalRight - totalLeft + borderSize*2, borderSize*3, borderSize],
      position: [totalLeft/2 + totalRight/2, -borderSize, totalTop + borderSize/2],
    },
    borderBottom: {
      size: [totalRight - totalLeft + borderSize*2, borderSize*3, borderSize],
      position: [totalLeft/2 + totalRight/2, -borderSize, totalBottom - borderSize/2],
    }
  },
  crates: {
    crate1: {
      position: [houseSize/2 - crateSize/2 + st1Size, 2, houseSize/2 - crateSize/2]
    }
  },
  gates: {
    gt1: {
      position: [0, 0, -houseSize/2 + gateThickness/2],
    },
    gt2: {
      position: [0, 0, houseSize/2 - gateThickness/2],
    },
    gt3: {
      position: [st1Size, 0, houseSize/2 + st1Size + gateThickness/2],
    },
  },
  triggerBoards: {
    bd1: {
      target: 'gt1',
      position: [0, 0, 0],
    },
    bd2: {
      target: 'gt2',
      position: [st1Size, 0, houseSize + st1Size],
    },
    bd3: {
      target: 'gt3',
      position: [houseSize/2 + st1Size/2, 0, -houseSize/2 - st1Size/2],
    },
  },
  target: {
    size: [10, 10, 10],
    position: [st1Size, 0, houseSize + st1Size],
  }
}

;(async function() {
  var activePlayer = null as Player

  const imgElems = Object.keys(config.images).map(id => appendElement('img', { src: config.images[id].url, id }))
  for (const el of imgElems) {
    await new Promise((onload, onerror) => Object.assign(el, { onload, onerror }))
  }

  const textureCreators = imgElems.map((el, i) => ({
    el,
    createClipMaterial(name, left, top, width, height, matOpts = null, texOpts = null) {
      const rect = { left, top, width, height }
      const diffuseTexture = Object.assign(creatClipTexture(name, scene, el, rect).clone(), texOpts)
      return Object.assign(new StandardMaterial(name, scene), {
        diffuseTexture,
      }, matOpts)
    },
    createUnitMaterial(name, left, top, width, height, matOpts = null, texOpts = null) {
      const region = { left: 0, top: 0, width: 2048, height: 2048 },
        texture = creatClipTexture(el.src, scene, el, region).clone()
      const diffuseTexture = Object.assign(texture, {
        uScale: width  / region.width,
        vScale: height / region.height,
        uOffset: left  / region.width,
        vOffset: 1 - (top + height) / region.height,
      }, texOpts)
      return Object.assign(new StandardMaterial(name, scene), {
        disableLighting: true,
        emissiveColor: new Color3(1, 1, 1),
        diffuseTexture,
      }, matOpts)
    },
  }))
  const tile1 = textureCreators.filter(c => c.el.id === 'tile1').pop()

  const playerIndicatorPositions = { }
  const players = Object.keys(stage.players).map(id => {
    const data = stage.players[id]
    const player = new Player(id, scene, {
      shadowRenderList,
      mass: data.mass,
      ext: {
        position: Vector3.FromArray(data.position),
      },
    })
    player.physicsImpostor.registerBeforePhysicsStep(impostor => {
      impostor.setAngularVelocity(impostor.getAngularVelocity().multiply(config.player.angularDamping))
      impostor.setLinearVelocity(impostor.getLinearVelocity().multiply(config.player.linearDamping))
    })
    playerIndicatorPositions[id] = Object.assign(new Mesh(id + '-indicator', scene), {
      position: new Vector3(0, 2.5, 0),
      parent: player,
    })
    return player
  })

  const bbMaterials = tile1.createUnitMaterial('board-mat', 32, 1376, 32, 32, null, { hasAlpha: true })
  const bulletBoards = Object.keys(stage.bulletinBoards).map(id => {
    const data = stage.bulletinBoards[id]
    const bulletinBoard = new Sprite(id, scene, new Vector2(2, 2), {
      ext: {
        position: Vector3.FromArray(data.position),
        material: bbMaterials,
      }
    })
    Object.assign(new Trigger(id + '-trigger', scene, players, {
      enter() {
        boardIndicator.trackedNode = bulletinBoard
        boardText.text = data.text
      },
      exit(count) {
        if (count === 0 && boardIndicator.trackedNode === bulletinBoard) {
          boardIndicator.trackedNode = null
          boardIndicator.position = new Vector2(-999, -999)
        }
      },
    }), {
      scaling: new Vector3(1, 1, 1),
      parent: bulletinBoard,
      isVisible: false,
    })
    return bulletinBoard
  })

  const sprites = Object.keys(stage.sprites).map(id => {
    const data = stage.sprites[id],
      [left, top, width, height] = data.region
    const sprite = new Sprite(id, scene, Vector2.FromArray(data.size), {
      ext: {
        position: Vector3.FromArray(data.position),
        material: tile1.createUnitMaterial(id + 'mat', left, top, width, height, null, { hasAlpha: true }),
      }
    })
    return sprite
  })

  const crateMaterial = tile1.createUnitMaterial('box-mat', 512, 256, 64, 64)
  const crates = Object.keys(stage.crates).map(id => {
    const data = stage.crates[id]
    const crate = new Box('box', scene, {
      size: Vector3.FromArray(data.size || [crateSize, crateSize, crateSize]),
      ext: {
        position: Vector3.FromArray(data.position),
        material: tile1.createUnitMaterial('box-mat', 512, 256, 64, 64),
      }
    })
    crate.physicsImpostor.registerBeforePhysicsStep(impostor => {
      const v = impostor.getLinearVelocity(),
        a = impostor.getAngularVelocity()
      if (v.lengthSquared() < config.crate.velocityThrottle * config.crate.velocityThrottle) {
        v.x = v.z = 0
      }
      impostor.setAngularVelocity(a.multiply(config.crate.angularDamping))
      impostor.setLinearVelocity(v.multiply(config.crate.linearDamping))
    })
    return crate
  })

  Object.keys(stage.blocks).map(id => {
    const data = stage.blocks[id],
      size = Vector3.FromArray(data.size)

    const texData = config.textures[data.texture],
      texCreator = texData && textureCreators.filter(c => c.el.id === texData.src).pop(),
      [left, top, width, height] = texData && (texData.clip || texData.region) || [0, 0, 0, 0],
      material = texData && (
        texData.clip ? texCreator.createClipMaterial('mat-' + id, left, top, width, height) :
        texData.region ? texCreator.createUnitMaterial('mat-' + id, left, top, width, height) :
        null)

    if (material) {
      const [u, v] = data.uv || ['x', 'z']
      Object.assign(material.diffuseTexture, {
        uScale: size[u] / 4,
        vScale: size[v] / 4,
      })
    }

    if (size.y === 0) {
      return Object.assign(new Ground(id, scene, new Vector2(size.x, size.z), {
        ext: {
          material,
          position: Vector3.FromArray(data.position),
          rotation: Vector3.FromArray(data.rotation || [0, 0, 0]),
        }
      }), {
        receiveShadows: data.receiveShadows
      })
    }
    else {
      return Object.assign(new Box(id, scene, {
        mass: 0,
        size,
        ext: {
          material,
          position: Vector3.FromArray(data.position),
          rotation: Vector3.FromArray(data.rotation || [0, 0, 0]),
        }
      }), {
        receiveShadows: data.receiveShadows,
        isVisible: !data.isHidden,
      })
    }
  })

  const panelMaterial = Object.assign(new StandardMaterial('panel-material', scene), {
    diffuseColor: new Color3(0.5, 0.5, 0.5)
  })
  Object.keys(stage.gates).map(id => {
    const data = stage.gates[id]
    const gate = new Gate(id, scene, {
      panelMaterial,
      width: data.width || gateWidth,
      ext: {
        position: Vector3.FromArray(data.position)
      }
    })
    return gate
  })

  const triggerMeshes = players.map(player => player.playerBody).concat(crates)
  Object.keys(stage.triggerBoards).forEach(id => {
    const data = stage.triggerBoards[id],
      diffuseColor = new Color3(0.5, 0.5, 1),
      triggerColor = new Color3(1, 0.6, 0.6)
    const material = Object.assign(new StandardMaterial(id + '-material', scene), { diffuseColor })
    const triggerBoard = new TriggerBoard(id, scene, triggerMeshes, {
      enter(count) {
        const gate = scene.getMeshByID(data.target) as Gate
        gate.isOpen = true
        material.diffuseColor = triggerColor
      },
      exit(count) {
        if (count === 0) {
          const gate = scene.getMeshByID(data.target) as Gate
          gate.isOpen = false
          material.diffuseColor = diffuseColor
        }
      },
      ext: {
        position: Vector3.FromArray(data.position),
        material,
      }
    })
    return triggerBoard
  })

  activePlayer = players[0]
  const playerIndicator = new BABYLON.Group2D({
    parent: canvas,
    trackNode: playerIndicatorPositions[activePlayer.id],
    children: [
      new Rectangle2D({
        position: new Vector2(-10, 0),
        fill: '#e0e080ff',
        width: 20,
        height: 20,
        rotation: Math.PI / 4,
      })
    ]
  })

  const boardText = new BABYLON.Text2D('blabla', {
    marginAlignment: 'h: center, v:center'
  })
  const boardIndicator = new BABYLON.Group2D({
    parent: canvas,
    // isVisible seems broken
    position: new Vector2(-999, -999),
    children: [
      new BABYLON.Rectangle2D({
        position: new Vector2(0, 40),
        width: 200,
        height: 40,
        fill: '#333333ff',
        children: [ boardText ]
      })
    ]
  })

  const targetTrigger = new Trigger('target', scene, players, {
    enter(count, evt) {
      targetText.text = count > 0 ? '❤❤❤' : `target here (${count + 1}/${players.length})`
    },
    exit(count, evt) {
      targetText.text = `target here (${count}/${players.length})`
    },
    ext: {
      scaling: Vector3.FromArray(stage.target.size),
      position: Vector3.FromArray(stage.target.position),
      isVisible: false,
    }
  })

  const targetPos = new Mesh('target', scene)
  targetPos.position.copyFrom(Vector3.FromArray(stage.target.position))
  const targetText = new BABYLON.Text2D('target here', {
    marginAlignment: 'h: center, v:center'
  })
  const targetIndicator = new BABYLON.Group2D({
    parent: canvas,
    trackNode: targetPos,
    children: [
      new BABYLON.Rectangle2D({
        position: new Vector2(-10, 30),
        rotation: 40,
        width: 20,
        height: 20,
        fill: '#3333ffff',
      }),
      new BABYLON.Rectangle2D({
        position: new Vector2(-70, 40),
        width: 140,
        height: 30,
        fill: '#3333ffff',
        children: [ targetText ]
      })
    ]
  })

  new BABYLON.Rectangle2D({
    parent: canvas,
    position: new Vector2(10, window.innerHeight - 40),
    children: [
      new BABYLON.Text2D('use W / S / A / D to move, SPACE to jump, Q to switch player')
    ]
  })

  scene.registerBeforeRender(() => {
    if (keys.forward || keys.back || keys.left || keys.right || keys.jump) {
      const dz = keys.forward ? 1 : keys.back ? -1 : 0,
        dx = keys.left ? -1 : keys.right ? 1 : 0,
        vc = camera.target.subtract(camera.position),
        ay = Math.atan2(dx, dz) + Math.atan2(vc.x, vc.z),
        vv = config.player.moveForce * (stage.players[activePlayer.id].mass || 1),
        vx = dx || dz ? vv * Math.sin(ay) : 0,
        vz = dx || dz ? vv * Math.cos(ay) : 0

      var vy = 0
      if (keys.jump) {
        const origin = activePlayer.position.add(new Vector3(0, 1, 0)),
          ray = new Ray(origin, new Vector3(0, -1, 0)),
          filter = mesh => mesh !== activePlayer && mesh.parent !== activePlayer,
          pick = scene.pickWithRay(ray, filter, false)
        if (pick.hit && pick.pickedMesh &&
            pick.getNormal().normalize().y > 0.8 &&
            pick.distance > 0.90 && pick.distance < 1.1) {
          vy = config.player.jumpForce
          keys.jump = false
        }
      }

      activePlayer.applyImpulse(new Vector3(vx, vy, vz), activePlayer.position)

      // rotate to face to the right direction
      if (dx || dz) {
        const qc = Quaternion.RotationAxis(new Vector3(0, 1, 0), ay)
        activePlayer.rotationQuaternion = Quaternion.Slerp(activePlayer.rotationQuaternion, qc, 0.1)
      }
    }

    if (keys.exchange) {
      activePlayer.isAnimating = false
      activePlayer = players[ (players.indexOf(activePlayer) + 1) % players.length ]
      playerIndicator.trackedNode = playerIndicatorPositions[activePlayer.id]
      keys.exchange = false
    }

    activePlayer.isAnimating = keys.forward || keys.back || keys.left || keys.right || keys.jump

    // follow player
    const delta = camera.target.subtract(camera.position)
    camera.setTarget(Vector3.Lerp(camera.target, activePlayer.position, config.camera.followDamping))
    camera.setPosition(camera.target.subtract(delta))

    // adjust light
    const dir = new Vector2(delta.x, delta.z).normalize()
    light.direction.copyFromFloats(dir.x, -2, dir.y)
  })

})()
