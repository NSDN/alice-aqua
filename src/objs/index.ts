import { ObjectBase } from '../game/objbase'

import Sprite from './sprite'
import Slope from './slope'
import Gate from './gate'
import Trigger from './trigger'
import Jump from './jump'
import Block from './block'
import Box, { BoxGenerator } from './box'
import Player, { PlayerGenerator } from './player'
import { StageEntry, StageLoader } from './stage'

const images: { [id: string]: string } = {
  imAssetTile1: 'assets/rpg_maker_vx_rtp_tileset_by_telles0808.png',
  imAssetTile2: 'assets/tileset_pokemon_rpgmaker_xp_by_kutoal-d59p9c9.png',
}

const tiles: [number, keyof typeof images, number, number, number, string][] = [
  [ 2, 'imAssetTile1',    0,  576, 32, 'h4x6'],
  [ 3, 'imAssetTile1',    0,  480, 32, 'h4x6'],
  [ 4, 'imAssetTile1',   64,  480, 32, 'h4x6'],
  [ 5, 'imAssetTile1',   64,  576, 32, 'h4x6'],
  [ 6, 'imAssetTile1',  256, 1088, 32, 'h4x6'],
  [ 7, 'imAssetTile1',  384, 1088, 32, 'h4x6'],
  [ 8, 'imAssetTile1',  256, 1184, 32, 'h4x6'],
  [ 9, 'imAssetTile1',  384, 1184, 32, 'h4x6'],
  [10, 'imAssetTile1',  512,    0, 32, 'h4x6'],
  [11, 'imAssetTile1',  576,    0, 32, 'h4x6'],
  [12, 'imAssetTile1',  640,    0, 32, 'h4x6'],
  [13, 'imAssetTile1',  704,    0, 32, 'h4x6'],
  [14, 'imAssetTile1',  768,    0, 32, 'h4x6'],
  [15, 'imAssetTile1',  832,    0, 32, 'h4x6'],
  [16, 'imAssetTile1',  896,    0, 32, 'h4x6'],
  [17, 'imAssetTile1',  960,    0, 32, 'h4x6'],
  [18, 'imAssetTile1',  512,  160, 32, 'h4x6'],
  [19, 'imAssetTile1',  576,  160, 32, 'h4x6'],
  [20, 'imAssetTile1',  640,  160, 32, 'h4x6'],
  [21, 'imAssetTile1',  704,  160, 32, 'h4x6'],
  [22, 'imAssetTile1',  768,  160, 32, 'h4x6'],
  [23, 'imAssetTile1',  832,  160, 32, 'h4x6'],
  [24, 'imAssetTile1',  896,  160, 32, 'h4x6'],
  [25, 'imAssetTile1',  960,  160, 32, 'h4x6'],
  [26, 'imAssetTile1',  512,  320, 32, 'h4x6'],
  [27, 'imAssetTile1',  576,  320, 32, 'h4x6'],
  [28, 'imAssetTile1',  640,  320, 32, 'h4x6'],
  [29, 'imAssetTile1',  704,  320, 32, 'h4x6'],
  [30, 'imAssetTile1',  768,  320, 32, 'h4x6'],
  [31, 'imAssetTile1',  832,  320, 32, 'h4x6'],
  [32, 'imAssetTile1',  896,  320, 32, 'h4x6'],
  [33, 'imAssetTile1',  960,  320, 32, 'h4x6'],
  [56, 'imAssetTile2',  208,  720, 32, ''],
  [34, 'imAssetTile2',    0,  704, 32, 'h5x3'],
  [36, 'imAssetTile2',    0,  800, 32, 'h5x3'],
  [40, 'imAssetTile2',    0,  656, 32, 'h5x3'],
  [41, 'imAssetTile2',    0,  752, 32, 'h5x3'],
  [54, 'imAssetTile2',  128,  656, 32, 'h5x3'],
  [46, 'imAssetTile2',  128,    0, 32, 'h5x3'],
  [35, 'imAssetTile2',  128,   48, 32, 'h5x3'],
  [47, 'imAssetTile2',  128,   96, 32, 'h5x3'],
  [48, 'imAssetTile2',  128,  144, 32, 'h5x3'],
  [50, 'imAssetTile2',  128,  240, 32, 'h5x3'],
  /*
  [57, 'imAssetTile2',  112,  624, 32, ''],
  [43, 'imAssetTile2',    0,  896, 32, 'h5x3'],
  [55, 'imAssetTile2',  128,  704, 32, 'h5x3'],
  */
  [58, 'imAssetTile2',  176,  992, 32, ''],
  [59, 'imAssetTile2',  208,  800, 32, ''],
  [52, 'imAssetTile2',  128,  800, 32, 'h5x3'],
  [53, 'imAssetTile2',  128,  944, 32, 'h5x3'],
  /*
  [51, 'imAssetTile2',  128,  288, 32, 'h5x3'],
  [37, 'imAssetTile2',    0,  384, 32, 'h5x3'],
  [38, 'imAssetTile2',    0,  432, 32, 'h5x3'],
  [39, 'imAssetTile2',    0,  480, 32, 'h5x3'],
  [44, 'imAssetTile2',    0,  944, 32, 'h5x3'],
  */
]

const classes: [number, keyof typeof images, number, number, number, number, typeof ObjectBase, any, any][] = [
  [ 0, 'imAssetTile1',   96, 1632, 64, 96, Sprite,       { spriteHeight: 4 }, { }],
  [ 1, 'imAssetTile1',    0, 1440, 64, 64, Sprite,       { spriteHeight: 4 }, { }],
  [ 2, 'imAssetTile1',    0, 1504, 64, 64, Sprite,       { spriteHeight: 4 }, { }],
  [ 3, 'imAssetTile1',  192, 1344, 64, 64, Sprite,       { spriteHeight: 4 }, { }],
  [ 4, 'imAssetTile1',  512,  256, 64, 64, BoxGenerator, { spriteHeight: 2, boxMass: 5 }, { }],
  [33, 'imAssetTile1',  768,   32, 64, 64, BoxGenerator, { spriteHeight: 2, boxMass: 20, velocityThreshold: 0.5 }, { }],
  [ 5, 'imAssetTile1',  160, 1024, 32, 64, Sprite,       { spriteHeight: 4 }, { }],
  [ 6, 'imAssetTile1',  128, 1120, 32, 64, Sprite,       { spriteHeight: 4 }, { }],
  [ 7, 'imAssetTile1',    0, 1120, 32, 64, Sprite,       { spriteHeight: 4 }, { }],
  [ 8, 'imAssetTile1',  160, 1408, 32, 64, Sprite,       { spriteHeight: 4 }, { }],
  [ 9, 'imAssetTile1',   64, 1408, 32, 64, Sprite,       { spriteHeight: 4 }, { }],
  [10, 'imAssetTile1',    0, 1376, 32, 32, Sprite,       { }, { }],
  [11, 'imAssetTile1',   32, 1376, 32, 32, Sprite,       { }, { }],
  [12, 'imAssetTile1',    0, 1408, 32, 32, Sprite,       { }, { }],
  [13, 'imAssetTile1',    0,  992, 32, 32, Sprite,       { }, { }],
  [14, 'imAssetTile1',   32,  992, 32, 32, Sprite,       { }, { }],
  [15, 'imAssetTile1',  288,  992, 32, 32, Sprite,       { }, { }],
  [16, 'imAssetTile1',  320,  992, 32, 32, Sprite,       { }, { }],
  [17, 'imAssetTile1',    0, 1344, 32, 32, Sprite,       { }, { }],
  [18, 'imAssetTile1',   32, 1344, 32, 32, Sprite,       { }, { }],
  [19, 'imAssetTile1',   64, 1344, 32, 32, Sprite,       { }, { }],
  [20, 'imAssetTile1',   96, 1344, 32, 32, Sprite,       { }, { }],
  [21, 'imAssetTile1',  128, 1344, 32, 32, Sprite,       { }, { }],
  [22, 'imAssetTile1',  160, 1344, 32, 32, Sprite,       { }, { }],
  [23, 'imAssetTile1',  160, 1632, 32, 32, Sprite,       { }, { }],
  [24, 'imAssetTile1',  192, 1632, 32, 32, Sprite,       { }, { }],
  [25, 'imAssetTile1',  224, 1632, 32, 32, Sprite,       { }, { }],
  [26, 'imAssetTile1',  160, 1664, 32, 32, Sprite,       { }, { }],
  [27, 'imAssetTile1',  160, 1696, 32, 32, Sprite,       { }, { }],
  [28, 'imAssetTile1', 1024,    0, 32, 32, Gate,         { }, { title: '可触发的门' }],
  [29, 'imAssetTile1', 1056,    0, 32, 32, Slope,        { }, { title: '两个 slope 相连形成斜坡' }],
  [36, 'imAssetTile1', 1088,    0, 32, 32, Block,        { }, { title: '可触发移动的方块' }],
  [34, 'imAssetTile1', 1120,    0, 32, 32, Jump,         { listenTags: [Player.PLAYER_TAG] }, { title: '跳！' }],
  [30, 'imAssetTile1', 1152,    0, 32, 32, Trigger,      { listenTags: [Player.PLAYER_TAG, Box.BOX_TAG] }, { title: '触发器' }],
  [35, 'imAssetTile1', 1248,    0, 32, 32, StageLoader,  { editorSingletonId: 'stage/loader' }, { title: '在此载入新关卡' }],
  [37, 'imAssetTile1', 1280,    0, 32, 32, StageEntry,   { editorSingletonId: 'stage/entry'  }, { title: '关卡载入时使用的原点' }],
  [31, 'imAssetTile1', 1184,    0, 32, 32, PlayerGenerator,  { editorSingletonId: 'player/remilia', playerName: 'remilia' }, { }],
  [32, 'imAssetTile1', 1216,    0, 32, 32, PlayerGenerator,  { editorSingletonId: 'player/flandre', playerName: 'flandre' }, { }],
]


export { images, tiles, classes }