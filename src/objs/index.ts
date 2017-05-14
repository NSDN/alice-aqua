import { ObjectBase } from '../game/objbase'

import Sprite from './sprite'
import Player, { PlayerGenerator } from './player'
import Box, { BoxGenerator } from './box'
import Slope from './slope'
import Trigger from './trigger'
import Jump from './jump'
/*
import Gate from './gate'
import BulltinBoard from './bulletin'
import Block from './block'
import { StageEntry, StageLoader } from './stage'
*/

const imgres = {
  imAssetTile0: 'assets/tileset0.png',
  imAssetSprite0: 'assets/sprites0.png',
  imPlayerFlandre: 'assets/flandre.png',
  imPlayerRemilia: 'assets/remilia.png',
}

const images = imgres as { [id: string]: string }

const tiles: [number, keyof typeof imgres, number, number, number, string, number][] = [
  [ 6, 'imAssetTile0',    0,   96, 32,     '',  3],
  [ 2, 'imAssetTile0',    0,    0, 32, 'h4x6',  3],
  [ 3, 'imAssetTile0',   16,   32, 32, 'edge',  4],
  [ 4, 'imAssetTile0',   16,   48, 32, 'side',  4],
  [ 5, 'imAssetTile0',   64,    0, 32, 'h4x6',  3],
]

const classes: [number, keyof typeof imgres, number, number, number, number, typeof ObjectBase, any, any][] = [
  [ 1, 'imAssetSprite0',    0,    0, 32, 64, Sprite,       { spriteHeight: 4 }, { }],
  [ 2, 'imAssetSprite0',    0,   64, 64, 64, Sprite,       { spriteHeight: 4 }, { }],
  [37, 'imAssetSprite0',   32,    0, 32, 64, Sprite,       { spriteHeight: 4 }, { }],
  [ 5, 'imAssetSprite0',    0,  128, 64, 64, BoxGenerator, { spriteHeight: 2, boxMass: 10 }, { }],
  [ 6, 'imAssetSprite0',   64,  128, 64, 64, BoxGenerator, { spriteHeight: 2, boxMass: 20, velocityThreshold: 0.5 }, { }],
  [ 3, 'imPlayerRemilia',   0,  128, 28, 28, PlayerGenerator,  { editorSingletonId: 'player/remilia', playerName: 'remilia' }, { }],
  [ 4, 'imPlayerFlandre',   0,  128, 28, 28, PlayerGenerator,  { editorSingletonId: 'player/flandre', playerName: 'flandre' }, { }],
  [21, 'imAssetSprite0',    0,  192, 32, 32, Slope,        { }, { title: '两个 slope 相连形成斜坡' }],
  [22, 'imAssetSprite0',   32,  192, 32, 32, Trigger,      { listenTags: [Player.PLAYER_TAG, Box.BOX_TAG] }, { title: '触发器' }],
  [23, 'imAssetSprite0',   64,  192, 32, 32, Jump,         { listenTags: [Player.PLAYER_TAG] }, { title: '跳！' }],
  /*
  [ 2, 'imAssetTile1',    0, 1504, 64, 64, Sprite,       { spriteHeight: 4 }, { }],
  [ 3, 'imAssetTile1',  192, 1344, 64, 64, Sprite,       { spriteHeight: 4 }, { }],
  [ 5, 'imAssetTile1',  160, 1024, 32, 64, Sprite,       { spriteHeight: 4 }, { }],
  [ 6, 'imAssetTile1',  128, 1120, 32, 64, Sprite,       { spriteHeight: 4 }, { }],
  [ 7, 'imAssetTile1',    0, 1120, 32, 64, Sprite,       { spriteHeight: 4 }, { }],
  [ 8, 'imAssetTile1',  160, 1408, 32, 64, Sprite,       { spriteHeight: 4 }, { }],
  [ 9, 'imAssetTile1',   64, 1408, 32, 64, Sprite,       { spriteHeight: 4 }, { }],
  [10, 'imAssetTile1',    0, 1376, 32, 32, Sprite,       { }, { }],
  [11, 'imAssetTile1',   32, 1376, 32, 32, BulltinBoard, { listenTags: [Player.PLAYER_TAG], textContent: 'text to shown' }, { }],
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
  [36, 'imAssetTile1', 1088,    0, 32, 32, Block,        { }, { title: '可触发移动的方块' }],
  [35, 'imAssetTile1', 1248,    0, 32, 32, StageLoader,  { editorSingletonId: 'stage/loader' }, { title: '在此载入新关卡' }],
  [37, 'imAssetTile1', 1280,    0, 32, 32, StageEntry,   { editorSingletonId: 'stage/entry'  }, { title: '关卡载入时使用的原点' }],
  */
]

export { images, tiles, classes }