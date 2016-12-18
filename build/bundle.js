/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;
/******/
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

	module.exports = __webpack_require__(1);


/***/ },
/* 1 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
	    return new (P || (P = Promise))(function (resolve, reject) {
	        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
	        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
	        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
	        step((generator = generator.apply(thisArg, _arguments)).next());
	    });
	};
	const chunks_1 = __webpack_require__(2);
	const babylon_1 = __webpack_require__(3);
	const ui_1 = __webpack_require__(6);
	const dom_1 = __webpack_require__(7);
	const babylon_2 = __webpack_require__(8);
	const IMG_ASSETS = {
	    imAssetTile1: 'assets/rpg_maker_vx_rtp_tileset_by_telles0808.png'
	};
	const TILE_ASSETS = [
	    ['imAssetTile1', 16, 624, 32, false],
	    ['imAssetTile1', 512, 320, 32, true],
	    ['imAssetTile1', 384, 1088, 32, true],
	    ['imAssetTile1', 768, 992, 32, true],
	    ['imAssetTile1', 512, 0, 32, true],
	    ['imAssetTile1', 576, 0, 32, true],
	    ['imAssetTile1', 0, 480, 32, true],
	    ['imAssetTile1', 0, 576, 32, true],
	    ['imAssetTile1', 64, 480, 32, true],
	    ['imAssetTile1', 64, 576, 32, true],
	];
	const KEY_MAP = {
	    [16]: 'shiftKey',
	    [17]: 'ctrlKey',
	};
	const cssContent = `
	html, body, .full-size {
	  overflow: hidden;
	  width: 100%;
	  height: 100%;
	  padding: 0;
	  margin: 0;
	}
	`;
	const keys = {
	    shiftKey: false,
	    ctrlKey: false,
	};
	function getMousePickTarget(scene, evt, filter) {
	    const ray = scene.createPickingRay(evt.clientX, evt.clientY, null, scene.activeCamera), pick = scene.pickWithRay(ray, filter), pos = pick.pickedPoint || babylon_1.Vector3.Zero(), norm = pick.getNormal() || babylon_1.Vector3.Zero();
	    if (!pick.hit) {
	        const factor = -ray.origin.y / ray.direction.y;
	        pos.copyFrom(ray.origin.add(ray.direction.multiplyByFloats(factor, factor, factor)));
	        norm.copyFromFloats(0, 1, 0);
	    }
	    const position = new babylon_1.Vector3(Math.floor(pos.x + 0.5), Math.floor(pos.y + 0.5), Math.floor(pos.z + 0.5));
	    const normMaxComp = Math.max(Math.abs(norm.x), Math.abs(norm.y), Math.abs(norm.z));
	    const direction = normMaxComp === norm.y ? 'y' : normMaxComp === -norm.y ? '-y' :
	        normMaxComp === norm.z ? 'z' : normMaxComp === -norm.z ? '-z' :
	            normMaxComp === norm.x ? 'x' : '-x';
	    return { position, direction };
	}
	dom_1.appendElement('style', { innerHTML: cssContent }, document.querySelector('head'));
	const elem = dom_1.appendElement('canvas', { className: 'full-size' }), engine = new babylon_1.Engine(elem, true), scene = new babylon_1.Scene(engine), canvas = new babylon_1.ScreenSpaceCanvas2D(scene, { id: 'canvas' });
	//scene.enablePhysics(new Vector3(0, -3, 0))
	//scene.workerCollisions = true
	engine.runRenderLoop(() => {
	    scene.render();
	});
	window.addEventListener('resize', () => {
	    engine.resize();
	});
	window.addEventListener('keydown', evt => {
	    keys[KEY_MAP[evt.which]] = true;
	});
	window.addEventListener('keyup', evt => {
	    keys[KEY_MAP[evt.which]] = false;
	});
	// ...
	const camera = scene.activeCamera = new babylon_1.ArcRotateCamera('camera', 0, 0, 50, null, scene);
	camera.lowerRadiusLimit = 10;
	camera.upperRadiusLimit = 100;
	camera.lowerBetaLimit = Math.PI * 0.15;
	camera.upperBetaLimit = Math.PI * 0.45;
	const light = new babylon_1.DirectionalLight('light', new babylon_1.Vector3(0.5, -1, 0.5), scene);
	light.position.copyFromFloats(0, 50, 0);
	light.intensity = 1;
	const ssao = new babylon_1.SSAORenderingPipeline('ssaopipeline', scene, 1, [camera]);
	(function () {
	    return __awaiter(this, void 0, void 0, function* () {
	        let bottomText = null;
	        new BABYLON.Rectangle2D({
	            parent: canvas,
	            position: new babylon_1.Vector2(10, 10),
	            children: [
	                bottomText = new BABYLON.Text2D('...')
	            ]
	        });
	        const cursorHover = babylon_1.Mesh.CreateBox('cursorHover', 1, scene);
	        cursorHover.material = new babylon_2.WireframeNoLightingMaterial('', scene);
	        const cursorSelect = babylon_1.Mesh.CreateBox('cursorSelect', 1, scene);
	        cursorSelect.material = new babylon_2.WireframeNoLightingMaterial('', scene, new babylon_1.Color3(1, 0.5, 0.5));
	        const pickFilter = mesh => mesh !== cursorHover && mesh !== cursorSelect;
	        const cursor = {
	            hover: babylon_1.Vector3.Zero(),
	            start: babylon_1.Vector3.Zero(),
	            min: babylon_1.Vector3.Zero(),
	            max: babylon_1.Vector3.Zero(),
	            direction: '',
	            shiftKey: false,
	            ctrlKey: false,
	        };
	        window.addEventListener('mousedown', evt => {
	            const { position, direction } = getMousePickTarget(scene, evt, pickFilter);
	            cursor.hover.copyFrom(position);
	            cursor.start.copyFrom(position);
	            cursor.min.copyFrom(position);
	            cursor.max.copyFrom(position.add(new babylon_1.Vector3(1, 1, 1)));
	            cursor.direction = direction;
	            cursor.shiftKey = evt.shiftKey;
	            cursor.ctrlKey = evt.ctrlKey;
	            cursorHover.position.copyFrom(position.add(new babylon_1.Vector3(0.5, 0.5, 0.5)));
	            cursorSelect.position.copyFrom(cursorHover.position);
	            cursorSelect.scaling.copyFromFloats(1, 1, 1);
	        });
	        window.addEventListener('mousemove', evt => {
	            const { position } = getMousePickTarget(scene, evt, pickFilter), limitedDirection = cursor.direction.slice(-1);
	            position[limitedDirection] = cursor.start[limitedDirection];
	            cursor.hover.copyFrom(position);
	            cursor.min = babylon_1.Vector3.Minimize(cursor.start, position);
	            cursor.max = babylon_1.Vector3.Maximize(cursor.start, position).add(new babylon_1.Vector3(1, 1, 1));
	            cursorHover.position.copyFrom(position.add(new babylon_1.Vector3(0.5, 0.5, 0.5)));
	            const { x, y, z } = position, { min, max } = cursor, leftText = !cursorHover.isVisible ? '' : `(${[x, y, z]})`, rightText = !cursorSelect.isVisible ? '' : min.equals(max) ?
	                `(${[min.x, min.y, min.z]})` : `(${[min.x, min.y, min.z]} ~ ${[max.x, max.y, max.z]})`;
	            bottomText.text = [leftText, rightText].join(' ');
	        });
	        let cursorPixel = {};
	        dom_1.attachDragable(elem, evt => {
	            cursorPixel = ui.selectedTile;
	            if (cursorPixel.h !== undefined) {
	                const h = parseInt(cursorPixel.h ? cursorPixel.h + '' : '0');
	                cursorPixel.h = cursor.start.y + h;
	            }
	            if (cursor.shiftKey) {
	            }
	            else {
	                chunks.setPixel(cursor.hover.x, cursor.hover.z, cursorPixel);
	            }
	        }, evt => {
	            if (cursor.shiftKey) {
	                const { min, max } = cursor;
	                cursorSelect.position.copyFrom(min.add(max).scale(0.5));
	                cursorSelect.scaling.copyFrom(max.subtract(min));
	            }
	            else {
	                cursorSelect.position.copyFrom(cursor.hover.add(new babylon_1.Vector3(0.5, 0.5, 0.5)));
	                chunks.setPixel(Math.floor(cursor.hover.x), Math.floor(cursor.hover.z), cursorPixel);
	            }
	        }, evt => {
	            if (cursor.shiftKey) {
	                const { min, max } = cursor;
	                for (let m = min.x; m < max.x; m++) {
	                    for (let n = min.z; n < max.z; n++) {
	                        chunks.setPixel(Math.floor(m), Math.floor(n), cursorPixel);
	                    }
	                }
	                cameraTarget.copyFrom(cursorSelect.position);
	            }
	        }, evt => {
	            return cameraDetached;
	        });
	        // ...
	        for (const id in IMG_ASSETS) {
	            const src = IMG_ASSETS[id];
	            yield new Promise((onload, onerror) => dom_1.appendElement('img', { src, id, onload, onerror }));
	        }
	        const tiles = TILE_ASSETS.map(([srcId, offsetX, offsetY, size, isAutoTile]) => {
	            const src = document.getElementById(srcId);
	            return { src, offsetX, offsetY, size, isAutoTile };
	        });
	        // ...
	        const chunks = new chunks_1.default(scene, tiles), ui = new ui_1.UI(tiles);
	        ui.addEventListener('tile-select', () => {
	            const min = cursorSelect.position.subtract(cursorSelect.scaling.scale(0.5)), max = cursorSelect.position.add(cursorSelect.scaling.scale(0.5));
	            if (keys.ctrlKey || keys.shiftKey) {
	                for (let m = min.x; m < max.x; m++) {
	                    for (let n = min.z; n < max.z; n++) {
	                        chunks.setPixel(Math.floor(m), Math.floor(n), ui.selectedTile);
	                    }
	                }
	            }
	        });
	        const cameraTarget = babylon_1.Vector3.Zero();
	        let cameraDetached = true;
	        scene.registerBeforeRender(() => {
	            if ((keys.ctrlKey || keys.shiftKey) && !cameraDetached && (cameraDetached = true)) {
	                camera.detachControl(elem);
	            }
	            else if (!(keys.ctrlKey || keys.shiftKey) && cameraDetached && !(cameraDetached = false)) {
	                camera.attachControl(elem);
	            }
	            cursorSelect.isVisible = cursorHover.isVisible = cameraDetached;
	            const delta = camera.target.subtract(camera.position);
	            camera.setTarget(babylon_1.Vector3.Lerp(camera.target, cameraTarget, 0.1));
	            camera.setPosition(camera.target.subtract(delta));
	        });
	    });
	})();


/***/ },
/* 2 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	const babylon_1 = __webpack_require__(3);
	const tiles_1 = __webpack_require__(4);
	const _1 = __webpack_require__(5);
	class Chunks {
	    constructor(scene, tiles, gridSize = 1, chunkSize = 16, textureSize = 16 * 32) {
	        this.scene = scene;
	        this.tiles = tiles;
	        this.gridSize = gridSize;
	        this.chunkSize = chunkSize;
	        this.textureSize = textureSize;
	        this.data = {};
	        this.throttleUpdate = _1.throttle(this.batchUpdateChunk.bind(this), 50);
	        this.chunkTextureToUpdate = {};
	        this.chunkHeightToUpdate = {};
	        this.chunkGrids = Math.floor(chunkSize / gridSize);
	        this.texturePixel = Math.floor(textureSize / this.chunkGrids);
	        const WaterMaterial = BABYLON['WaterMaterial'];
	        if (WaterMaterial) {
	            const water = this.waterMaterial = new WaterMaterial('water', scene);
	            water.bumpTexture = new babylon_1.Texture('assets/waterbump.png', scene);
	            water.windForce = -5;
	            water.waveHeight = 0.02;
	            water.bumpHeight = 0.02;
	            water.waterColor = new babylon_1.Color3(0.047, 0.23, 0.015);
	            water.colorBlendFactor = 0.5;
	        }
	        else {
	            console.warn('add babylon.waterMaterial.js to enable water material');
	            const water = this.waterMaterial = new babylon_1.StandardMaterial('water', scene);
	            water.diffuseColor = new babylon_1.Color3(0.047, 0.23, 0.015);
	        }
	    }
	    getChunkData(m, n) {
	        const { chunkSize, chunkGrids, gridSize, scene, textureSize, texturePixel } = this, i = Math.floor(m / chunkGrids), j = Math.floor(n / chunkGrids), k = [i, j].join('/');
	        if (!this.data[k]) {
	            const tiles = Array(chunkGrids * chunkGrids).fill(null), heights = tiles.map(t => null), blockCache = {};
	            const ground = new babylon_1.Mesh(`ground-${k}`, scene);
	            ground.position.copyFromFloats((i + 0.5) * chunkSize, 0, (j + 0.5) * chunkSize);
	            const material = ground.material = new babylon_1.StandardMaterial(`ground-mat-${k}`, scene);
	            material.disableLighting = true;
	            material.alpha = 1;
	            material.emissiveColor = new babylon_1.Color3(1, 1, 1);
	            const texture = material.diffuseTexture =
	                new babylon_1.DynamicTexture(`ground-tex-${k}`, textureSize, scene, true, BABYLON.Texture.NEAREST_SAMPLINGMODE), dc = texture.getContext(), { src, offsetX, offsetY, size } = this.tiles[0];
	            for (let dx = 0; dx < textureSize; dx += texturePixel) {
	                for (let dy = 0; dy < textureSize; dy += texturePixel) {
	                    dc.drawImage(src, offsetX, offsetY, size, size, dx, dy, size, size);
	                }
	            }
	            texture.update();
	            this.data[k] = { ground, blockCache, texture, tiles, heights, i, j, k };
	            this.updateHeight(m, n);
	        }
	        return this.data[k];
	    }
	    updateTexture(m, n, t) {
	        const { texture, i, j } = this.getChunkData(m, n), dc = texture.getContext(), { texturePixel, textureSize } = this, g = this.chunkGrids, u = m - i * g, v = n - j * g, dx = u * texturePixel, dy = textureSize - (v + 1) * texturePixel;
	        const { src, offsetX, offsetY, size, isAutoTile } = this.tiles[0];
	        dc.drawImage(src, offsetX, offsetY, size, size, dx, dy, size, size);
	        if (this.tiles[t]) {
	            const { src, offsetX, offsetY, size, isAutoTile } = this.tiles[t];
	            if (isAutoTile) {
	                const neighbors = tiles_1.AUTO_TILE_NEIGHBORS
	                    .map(([i, j]) => this.getPixel(m + i, n + j))
	                    .reduce((s, p, j) => s + (p.t === t ? 1 << j : 0), 0);
	                const { im, sx, sy } = tiles_1.getAutoTileImage(src, offsetX, offsetY, size, neighbors);
	                dc.drawImage(im, sx, sy, size, size, dx, dy, texturePixel, texturePixel);
	            }
	            else {
	                dc.drawImage(src, offsetX, offsetY, size, size, dx, dy, texturePixel, texturePixel);
	            }
	        }
	        texture.update();
	    }
	    updateHeight(m, n) {
	        const { chunkGrids, gridSize, chunkSize, scene } = this, { heights, ground, blockCache } = this.getChunkData(m, n), blocks = _1.getBlocksFromHeightMap(heights, chunkGrids), offset = new babylon_1.Vector3(chunkSize / 2, 0, chunkSize / 2), added = {};
	        if (Math.min.apply(Math, heights) < 0) {
	            const id = 'water';
	            if (!blockCache[id]) {
	                const mesh = blockCache[id] = babylon_1.Mesh.CreateGround('', chunkSize, chunkSize, 32, scene);
	                mesh.position.y = -0.2;
	                mesh.material = this.waterMaterial;
	                mesh.parent = ground;
	            }
	            added[id] = true;
	        }
	        blocks.forEach(block => {
	            const [u0, u1, v0, v1, h0, h1] = block, p0 = new babylon_1.Vector3(u0, h0, v0), p1 = new babylon_1.Vector3(u1, h1, v1), id = block.join('/');
	            if (!blockCache[id]) {
	                const faceUV = [
	                    babylon_1.Vector4.Zero(),
	                    babylon_1.Vector4.Zero(),
	                    babylon_1.Vector4.Zero(),
	                    babylon_1.Vector4.Zero(),
	                    new babylon_1.Vector4(u0, v0, u1, v1).scaleInPlace(1 / chunkGrids),
	                    babylon_1.Vector4.Zero(),
	                ];
	                const faceColors = [
	                    new babylon_1.Color4(0.1, 0.1, 0.1, 1),
	                    new babylon_1.Color4(0.1, 0.1, 0.1, 1),
	                    new babylon_1.Color4(0.1, 0.1, 0.1, 1),
	                    new babylon_1.Color4(0.1, 0.1, 0.1, 1),
	                    new babylon_1.Color4(1, 1, 1, 0),
	                    new babylon_1.Color4(0.1, 0.1, 0.1, 1),
	                ];
	                const mesh = blockCache[id] = babylon_1.MeshBuilder.CreateBox(id, { faceUV, faceColors }, scene);
	                mesh.position.copyFrom(p1.add(p0).scale(gridSize / 2).subtract(offset));
	                mesh.scaling.copyFrom(p1.subtract(p0).scale(gridSize));
	                mesh.material = ground.material;
	                mesh.parent = ground;
	                // this fixes uv mismatch issue
	                const { x, z } = mesh.scaling;
	                mesh.scaling.x = z;
	                mesh.scaling.z = x;
	                mesh.rotation.y = Math.PI / 2;
	                if (h1 < 0) {
	                    this.waterMaterial.addToRenderList(mesh);
	                }
	            }
	            added[id] = true;
	        });
	        Object.keys(blockCache).filter(id => !added[id]).forEach(id => {
	            blockCache[id].dispose();
	            delete blockCache[id];
	        });
	    }
	    batchUpdateChunk() {
	        Object.keys(this.chunkTextureToUpdate).forEach(index => {
	            const [m, n] = index.split('/').map(parseFloat), v = this.chunkTextureToUpdate[index];
	            this.updateTexture(m, n, v);
	        });
	        this.chunkTextureToUpdate = {};
	        Object.keys(this.chunkHeightToUpdate).forEach(index => {
	            const mn = this.chunkHeightToUpdate[index], [m, n] = mn.split('/').map(parseFloat);
	            this.updateHeight(m, n);
	        });
	        this.chunkHeightToUpdate = {};
	    }
	    setPixel(m, n, p) {
	        const { tiles, heights, i, j, k } = this.getChunkData(m, n), g = this.chunkGrids, u = m - i * g, v = n - j * g, c = u * g + v;
	        if (typeof p.t === 'number' && tiles[c] !== p.t) {
	            const u = tiles[c];
	            tiles[c] = p.t;
	            this.chunkTextureToUpdate[[m, n].join('/')] = p.t;
	            const tileV = this.tiles[p.t], tileU = this.tiles[u];
	            if ((tileV && tileV.isAutoTile) || (tileU && tileU.isAutoTile)) {
	                tiles_1.AUTO_TILE_NEIGHBORS.forEach(([i, j]) => {
	                    const pixel = this.getPixel(m + i, n + j), tile = this.tiles[pixel.t];
	                    if (tile && tile.isAutoTile) {
	                        this.chunkTextureToUpdate[[m + i, n + j].join('/')] = pixel.t;
	                    }
	                });
	            }
	        }
	        if (typeof p.h === 'string') {
	            p.h = (heights[c] || 0) + parseFloat(p.h);
	        }
	        if (typeof p.h === 'number' && heights[c] !== p.h) {
	            heights[c] = p.h;
	            this.chunkHeightToUpdate[k] = [m, n].join('/');
	        }
	        this.throttleUpdate();
	        return { t: tiles[c], h: heights[c] };
	    }
	    getPixel(m, n) {
	        const { tiles, heights, i, j, k } = this.getChunkData(m, n), g = this.chunkGrids, u = m - i * g, v = n - j * g, c = u * g + v;
	        return { t: tiles[c], h: heights[c] };
	    }
	}
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = Chunks;


/***/ },
/* 3 */
/***/ function(module, exports) {

	"use strict";
	module.exports = BABYLON;


/***/ },
/* 4 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	const index_1 = __webpack_require__(5);
	exports.AUTO_TILE_MAP = [
	    {
	        dst: [0, 0],
	        mask: [0, 1, 2],
	        src: [[0, 2], [1, 2], [0, 2], [2, 2], [0, 3], [2, 0], [0, 3], [1, 4]],
	    },
	    {
	        dst: [1, 0],
	        mask: [2, 3, 4],
	        src: [[3, 2], [3, 3], [3, 2], [3, 4], [2, 2], [3, 0], [1, 2], [2, 4]],
	    },
	    {
	        dst: [1, 1],
	        mask: [4, 5, 6],
	        src: [[3, 5], [2, 5], [3, 5], [1, 5], [3, 3], [3, 1], [3, 4], [2, 3]],
	    },
	    {
	        dst: [0, 1],
	        mask: [6, 7, 0],
	        src: [[0, 5], [0, 4], [0, 5], [0, 3], [1, 5], [2, 1], [2, 5], [1, 3]],
	    },
	];
	exports.AUTO_TILE_NEIGHBORS = [
	    [-1, 0],
	    [-1, 1],
	    [0, 1],
	    [1, 1],
	    [1, 0],
	    [1, -1],
	    [0, -1],
	    [-1, -1],
	];
	function getMaskBits(neighbors, mask) {
	    return mask.reduce((s, i, j) => s + (neighbors & (1 << i) ? (1 << j) : 0), 0);
	}
	const tileCaches = new index_1.ArrayHash();
	// the size of autotile should be 2*3 tileSize
	function getAutoTileImage(source, offsetX, offsetY, tileSize, neighbors) {
	    const cache = tileCaches.get(source) || tileCaches.set(source, {}), key = [offsetX, offsetY, tileSize].join('/');
	    if (!cache[key]) {
	        const canvas = document.createElement('canvas');
	        canvas.width = tileSize;
	        canvas.height = 256 * tileSize;
	        const dict = {};
	        cache[key] = { canvas, dict };
	    }
	    const { canvas, dict } = cache[key], hw = tileSize / 2;
	    if (!dict[key + neighbors]) {
	        const dc = canvas.getContext('2d');
	        exports.AUTO_TILE_MAP.forEach(({ dst, mask, src }) => {
	            const b = getMaskBits(neighbors, mask), [i, j] = src[b], sx = offsetX + i * hw, sy = offsetY + j * hw, [m, n] = dst, dx = m * hw, dy = n * hw + neighbors * tileSize;
	            dc.drawImage(source, sx, sy, hw, hw, dx, dy, hw, hw);
	        });
	        dict[key + neighbors] = true;
	    }
	    return { im: canvas, sx: 0, sy: neighbors * tileSize };
	}
	exports.getAutoTileImage = getAutoTileImage;


/***/ },
/* 5 */
/***/ function(module, exports) {

	"use strict";
	class ArrayHash {
	    constructor() {
	        this.data = [];
	    }
	    get(key) {
	        const find = this.data.filter(([k, v]) => k === key).pop();
	        return find && find[1];
	    }
	    del(key) {
	        this.data = this.data.filter(([k, v]) => k !== key);
	    }
	    set(key, val) {
	        const find = this.data.filter(([k, v]) => k === key).pop();
	        if (find) {
	            find[1] = val;
	        }
	        else {
	            this.data.push([key, val]);
	        }
	        return val;
	    }
	}
	exports.ArrayHash = ArrayHash;
	function debounce(fn, delay) {
	    let timeout = 0;
	    return function () {
	        const that = this, args = arguments;
	        if (timeout) {
	            clearTimeout(timeout);
	        }
	        timeout = setTimeout(() => {
	            fn.apply(that, args);
	            timeout = 0;
	        }, delay);
	    };
	}
	exports.debounce = debounce;
	function throttle(fn, delay) {
	    let timeout = 0;
	    return function () {
	        const that = this, args = arguments;
	        if (timeout) {
	            return;
	        }
	        timeout = setTimeout(() => {
	            fn.apply(that, args);
	            timeout = 0;
	        }, delay);
	    };
	}
	exports.throttle = throttle;
	function getBlocksFromHeightMap(heights, n) {
	    const blocks = [], hMin = Math.min.apply(Math, heights) - 2, val = heights.map(h => hMin), find2 = (i0, i1, j0, j1, fn) => {
	        for (let i = i0; i < i1; i++) {
	            for (let j = j0; j < j1; j++) {
	                const c = i * n + j;
	                if (fn(heights[c], val[c], c, i, j)) {
	                    return { i, j };
	                }
	            }
	        }
	    }, each2 = (i0, i1, j0, j1, fn) => {
	        find2(i0, i1, j0, j1, function () { return fn.apply(null, arguments) && false; });
	    };
	    let f = find2(0, n, 0, n, (a, b) => a > b);
	    while (f) {
	        const i0 = f.i, j0 = f.j, h0 = val[i0 * n + j0];
	        let i1 = i0 + 1, j1 = j0 + 1;
	        while (!find2(i1, i1 + 1, j0, j0 + 1, (a, b) => a <= h0 || b !== h0))
	            i1++;
	        while (!find2(i0, i1, j1, j1 + 1, (a, b) => a <= h0 || b !== h0))
	            j1++;
	        let h1 = 1 / 0;
	        each2(i0, i1, j0, j1, (a, b, c) => h1 = Math.min(h1, a));
	        each2(i0, i1, j0, j1, (a, b, c) => val[c] = h1);
	        blocks.push([i0, i1, j0, j1, h0, h1]);
	        f = find2(0, n, 0, n, (a, b) => a > b);
	    }
	    return blocks;
	}
	exports.getBlocksFromHeightMap = getBlocksFromHeightMap;


/***/ },
/* 6 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	const dom_1 = __webpack_require__(7);
	class UI {
	    constructor(tiles, panel = document.querySelector('.ui-panel-selector'), focus = document.querySelector('.ui-focus-cursor')) {
	        this.panel = panel;
	        this.focus = focus;
	        this.callbacks = {};
	        this.panel.addEventListener('change', evt => {
	            for (const elem of document.querySelectorAll('.ui-panel')) {
	                elem.classList.add('hidden');
	            }
	            for (const elem of document.querySelectorAll('.ui-panel.panel-' + this.panel.value)) {
	                elem.classList.remove('hidden');
	            }
	            for (const option of this.panel.childNodes) {
	                document.body.classList.remove('on-panel-' + option.value);
	            }
	            document.body.classList.add('on-panel-' + this.panel.value);
	            if (this.panel['last-value'] !== this.panel.value) {
	                ;
	                (this.callbacks['panel-change'] || []).forEach(cb => cb(this.panel['last-value']));
	                this.panel['last-value'] = this.panel.value;
	            }
	        });
	        setTimeout(_ => this.panel.dispatchEvent(new Event('change')), 100);
	        this.focus.addEventListener('click', evt => {
	            (this.callbacks['focus-cursor']).forEach(cb => cb());
	        });
	        const tilesList = document.querySelector('.ui-paint-tiles');
	        tiles.forEach((tile, index) => {
	            const { src, offsetX, offsetY, size } = tile, attrs = { className: 'ui-paint-tile', attributesToSet: { 'tile-index': index } }, div = dom_1.appendElement('div', attrs, tilesList), [width, height] = [32, 32], canvas = dom_1.appendElement('canvas', { width, height }, div);
	            canvas.getContext('2d').drawImage(src, offsetX, offsetY, size, size, 0, 0, width, height);
	        });
	        for (const elem of document.querySelectorAll('.ui-paint-tile *')) {
	            elem.addEventListener('click', evt => {
	                for (const selected of document.querySelectorAll('.ui-paint-tile.selected')) {
	                    selected.classList.remove('selected');
	                }
	                elem.parentElement.classList.add('selected');
	                (this.callbacks['tile-select'] || []).forEach(cb => cb());
	            });
	        }
	    }
	    get activePanel() {
	        return this.panel.value;
	    }
	    set activePanel(val) {
	        this.panel.value = val;
	        this.panel.dispatchEvent(new Event('change'));
	    }
	    get selectedTile() {
	        const div = document.querySelector('.ui-paint-tile.selected'), tileIndex = div && div.getAttribute('tile-index'), tileHeight = div && div.getAttribute('tile-height');
	        return (tileIndex && { t: parseInt(tileIndex) }) || (tileHeight && { h: tileHeight });
	    }
	    addEventListener(evt, callback) {
	        const cbs = this.callbacks[evt] || (this.callbacks[evt] = []);
	        if (cbs.indexOf(callback) === -1) {
	            cbs.push(callback);
	        }
	    }
	    removeEventListener(evt, callback) {
	        const cbs = this.callbacks[evt];
	        if (cbs) {
	            cbs.splice(cbs.indexOf(callback), 1);
	        }
	    }
	}
	exports.UI = UI;


/***/ },
/* 7 */
/***/ function(module, exports) {

	"use strict";
	function appendElement(tag, attrs = {}, parent = document.body) {
	    const elem = Object.assign(document.createElement(tag), attrs);
	    Object.assign(elem.style, attrs.style);
	    if (attrs.attributesToSet)
	        for (const key in attrs.attributesToSet) {
	            elem.setAttribute(key, attrs.attributesToSet[key]);
	        }
	    parent && parent.appendChild(elem);
	    return elem;
	}
	exports.appendElement = appendElement;
	function attachDragable(elem, onDown, onMove, onUp, filter) {
	    function handleMouseDown(evt) {
	        window.removeEventListener('mousemove', handleMouseMove);
	        window.removeEventListener('mouseup', handleMouseUp);
	        if (!filter || filter(evt)) {
	            onDown(evt);
	            window.addEventListener('mousemove', handleMouseMove);
	            window.addEventListener('mouseup', handleMouseUp);
	        }
	    }
	    function handleMouseMove(evt) {
	        onMove && onMove(evt);
	    }
	    function handleMouseUp(evt) {
	        window.removeEventListener('mousemove', handleMouseMove);
	        window.removeEventListener('mouseup', handleMouseUp);
	        onUp && onUp(evt);
	    }
	    elem.addEventListener('mousedown', handleMouseDown);
	    return () => {
	        elem.removeEventListener('mousedown', handleMouseDown);
	        window.removeEventListener('mousemove', handleMouseMove);
	        window.removeEventListener('mouseup', handleMouseUp);
	    };
	}
	exports.attachDragable = attachDragable;


/***/ },
/* 8 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	const babylon_1 = __webpack_require__(3);
	exports.VERTEX_BOX = babylon_1.VertexData.CreateBox({});
	exports.VERTEX_SPHERE = babylon_1.VertexData.CreateSphere({});
	exports.VERTEX_PLANE = babylon_1.VertexData.CreatePlane({});
	exports.VERTEX_GROUND = babylon_1.VertexData.CreateGround({});
	exports.VERTEX_CYLINDER = babylon_1.VertexData.CreateCylinder({ height: 1, diameter: 1 });
	class WireframeNoLightingMaterial extends babylon_1.StandardMaterial {
	    constructor(name, scene, color) {
	        super(name, scene);
	        this.emissiveColor = color || new babylon_1.Color3(1, 1, 1);
	        this.wireframe = true;
	        this.disableLighting = true;
	    }
	}
	exports.WireframeNoLightingMaterial = WireframeNoLightingMaterial;


/***/ }
/******/ ]);
//# sourceMappingURL=bundle.js.map