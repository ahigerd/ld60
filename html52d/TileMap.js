import { Sprite, Hitbox } from './Sprite.js';
import Rect from './Rect.js';
import { PIXELS_PER_UNIT, UNITS_PER_PIXEL } from './Point.js';

// Higher numbers use more GPU memory/bandwidth but fewer GPU operations
// 512 is a decent balance on mobile. Desktop can afford to go higher but
// there's almost never a reason to go over 2048.
const MAX_TEXTURE_SIZE = 512;

export class TileMap extends Sprite {
  constructor(config = {}, origin = null) {
    const hasConfigHitboxes = !!config.hitboxes;
    config.hitboxes = config.hitboxes || [new Hitbox(0, 0, config.width, config.height)];
    super(config, origin);
    this.isTileMap = true;
    this.isPassive = true;
    this.cornerTolerance = config.cornerTolerance || .01;
    this.width = config.width | 0;
    this.height = config.height | 0;
    this.tileSize = (config.tileSize || PIXELS_PER_UNIT) | 0;
    this.tilesPerUnit = PIXELS_PER_UNIT / this.tileSize;
    this.unitsPerTile = this.tileSize * UNITS_PER_PIXEL;
    this.image = config.image;
    if (!hasConfigHitboxes) {
      this._hitboxes[0][2] *= this.unitsPerTile;
      this._hitboxes[0][3] *= this.unitsPerTile;
    }

    const tilesPerChunk = (MAX_TEXTURE_SIZE / this.tileSize) | 0;

    // The dimensions of each cache chunk, in tiles
    this.hChunkSize = (this.width < tilesPerChunk ? this.width : tilesPerChunk) | 0;
    this.hLastChunk = (this.width % this.hChunkSize) || this.hChunkSize;
    this.vChunkSize = (this.height < tilesPerChunk ? this.height : tilesPerChunk) | 0;
    this.vLastChunk = (this.height % this.vChunkSize) || this.vChunkSize;

    // The number of cache chunks necessary to cover the tilemap
    this.hChunks = Math.ceil(this.width / this.hChunkSize) | 0;
    this.vChunks = Math.ceil(this.height / this.vChunkSize) | 0;

    // Either copy in the existing tile data, or allocate new memory
    this.tileBits = new Int32Array(config.tileBits || (this.width * this.height));
    const ArrayType = (config.tileTypes.length < 256 ? Uint8Array : Uint16Array);
    if (config.tiles) {
      this.tiles = new ArrayType(config.tiles);
    } else {
      this.tiles = new ArrayType(this.width * this.height).fill(0);
    }
    this.tileTypes = config.tileTypes;

    // Allocate memory for all of the chunks
    this.chunks = [];
    for (let i = 0; i < this.vChunks; i++) {
      const row = [];
      const chunkHeight = (i == this.vChunks - 1) ? this.vLastChunk : this.vChunkSize;
      for (let j = 0; j < this.hChunks - 1; j++) {
        row.push({ valid: false, canvas: null, height: chunkHeight, width: this.hChunkSize });
      }
      row.push({ valid: false, canvas: null, height: chunkHeight, width: this.hLastChunk });
      this.chunks.push(row);
    }

    // For collision to work, either config.tileBits or config.tileTypes must be set
    if (!config.tileBits) {
      this.updateTiles();
    }
  }

  bitsAt(x, y) {
    if (y === undefined) {
      y = x[1];
      x = x[0];
    }
    let tx = (x - this._origin[0]) * this.tilesPerUnit;
    let ty = (y - this._origin[1]) * this.tilesPerUnit;
    if (tx < 0 || ty < 0) return 0;
    tx |= 0;
    ty |= 0;
    if (tx >= this.width || ty >= this.height) return 0;
    return this.tileBits[ty * this.width + tx];
  }

  coordsAt(x, y) {
    if (y === undefined) {
      y = x[1];
      x = x[0];
    }
    return [
      Math.floor((x - this._origin[0]) * this.tilesPerUnit)|0,
      Math.floor((y - this._origin[1]) * this.tilesPerUnit)|0,
    ];
  }

  floorCoordinate(x) {
    return Math.floor(x * this.tilesPerUnit) * this.unitsPerTile;
  }

  ceilCoordinate(x) {
    return Math.ceil(x * this.tilesPerUnit) * this.unitsPerTile;
  }

  computeCollision(other, fast) {
    const otherHitboxes = other.hitboxes;
    const otherLen = otherHitboxes.length;
    const otherHitbox = TileMap._tempRect;
    const cc = Sprite._collisionCache;
    if (!fast) {
      cc.velocities[0][0] = 0;
      cc.velocities[0][1] = 0;
      cc.velocities[1].set(other._velocity);
      cc.velocity[0] = -other._velocity[0];
      cc.velocity[1] = -other._velocity[1];
      cc.penetration[0] = 0;
      cc.penetration[1] = 0;
      cc.speeds[0] = 0;
      cc.speed = cc.speeds[1] = other._velocity.magnitude;
    }
    const tol = this.cornerTolerance;
    // loop temporaries
    let i, x, y, p0, p1;
    let row, bits;
    // current hitbox
    let hx, hy, hxMax, hyMax;
    // tolerance-offset hitbox
    let tx, ty, txMax, tyMax;

    for (i = 0; i < otherLen; ++i) {
      otherHitboxes[i].translateInto(otherHitbox, other._origin);
      otherHitbox.translateXY(-this._origin[0], -this._origin[1]);
      hx = (otherHitbox[0] * this.tilesPerUnit);
      hy = (otherHitbox[1] * this.tilesPerUnit);
      hxMax = (otherHitbox[2] * this.tilesPerUnit);
      hyMax = (otherHitbox[3] * this.tilesPerUnit);
      if (hxMax < 0 || hyMax < 0 || hx >= this.width || hy >= this.height) {
        continue;
      }
      bits = otherHitboxes[i].bits;

      if (fast) {
        hxMax |= 0;
        hyMax |= 0;
        for (y = hy | 0; y <= hyMax; y++) {
          row = y * this.width;
          for (x = hx | 0; x <= hxMax; x++) {
            if (bits & this.tileBits[row + x]) {
              return true;
            }
          }
        }
        continue;
      }

      if (cc.velocity[0]) {
        ty = (hy + tol) | 0;
        tyMax = (hyMax - tol) | 0;
        if (cc.velocity[0] < 0) {
          // If the sprite is moving to the right, sweep the right edge
          p0 = (hxMax + cc.velocity[0]) | 0;
          p1 = hxMax | 0;
          if (p0 < this.width) {
            for (x = p0; x <= p1 && !cc.penetration[0]; x++) {
              for (y = ty; y <= tyMax; y++) {
                if (bits & this.tileBits[y * this.width + x]) {
                  cc.penetration[0] = hxMax - x;
                  break;
                }
              }
            }
          }
        } else if (cc.velocity[0] > 0) {
          // If the sprite is moving to the left, sweep the left edge
          p0 = (hx + cc.velocity[0]) | 0;
          p1 = hx | 0;
          if (p0 >= 0) {
            for (x = p0; x >= p1 && !cc.penetration[0]; x--) {
              for (y = ty; y <= tyMax; y++) {
                if (bits & this.tileBits[y * this.width + x]) {
                  cc.penetration[0] = hx - (x + 1);
                  break;
                }
              }
            }
          }
        }
        if (cc.penetration[0]) {
          const p = cc.penetration[0] * this.unitsPerTile;
          if ((p > 0) ? (p > -cc.velocity[0]) : (p < -cc.velocity[0])) {
            cc.penetration[0] = -cc.velocity[0] * this.tilesPerUnit;
          }
          // Adjust the hitbox to eject before computing vertical penetration
          hx -= cc.penetration[0];
          hxMax -= cc.penetration[0];
        }
      }

      if (cc.velocity[1]) {
        tx = (hx + tol) | 0;
        txMax = (hxMax - tol) | 0;
        if (tx < 0) tx = 0;
        if (txMax >= this.width) txMax = this.width - 1;
        if (cc.velocity[1] < 0 && hxMax > 0) {
          // If the sprite is moving downward, sweep the bottom edge
          p0 = (hyMax + cc.velocity[1]) | 0;
          p1 = hyMax | 0;
          for (y = p0; y <= p1 && !cc.penetration[1]; y++) {
            row = y * this.width;
            for (x = tx; x <= txMax; x++) {
              if (bits & this.tileBits[row + x]) {
                cc.penetration[1] = hyMax - y;
                break;
              }
            }
          }
        } else if (cc.velocity[1] > 0 && hx < this.width) {
          // If the sprite is moving upward, sweep the top edge
          p0 = (hy + cc.velocity[1]) | 0;
          p1 = hy | 0;
          for (y = p0; y >= p1 && !cc.penetration[1]; y--) {
            row = y * this.width;
            for (x = tx; x <= txMax; x++) {
              if (bits & this.tileBits[row + x]) {
                cc.penetration[1] = hy - (y + 1);
                break;
              }
            }
          }
        }
        if (cc.penetration[1]) {
          const p = cc.penetration[1] * this.unitsPerTile;
          if ((p > 0) ? (p > -cc.velocity[1]) : (p < -cc.velocity[1])) {
            cc.penetration[1] = -cc.velocity[1] * this.tilesPerUnit;
          }
        }
      }

      if (cc.penetration[0] || cc.penetration[1]) {
        cc.penetration[0] *= this.unitsPerTile;
        cc.penetration[1] *= this.unitsPerTile;
        return cc;
      }
    }
    return false;
  }

  updateTiles(x1, y1, x2, y2) {
    let x, y;
    let cx1, cy1, cx2, cy2;
    let custom = (x1 !== undefined);
    if (x1 === undefined) {
      x1 = 0;
      y1 = 0;
      x2 = this.width;
      y2 = this.height;
      cx1 = 0;
      cy1 = 0;
      cx2 = this.hChunks;
      cy2 = this.vChunks;
    } else {
      x1 = (x1 < 0 ? 0 : (x1 > this.width - 1 ? this.width - 1 : x1));
      y1 = (y1 < 0 ? 0 : (y1 > this.height - 1 ? this.height - 1 : y1));
      x2 = (x2 < 0 ? 0 : (x2 > this.width - 1 ? this.width - 1 : x2));
      y2 = (y2 < 0 ? 0 : (y2 > this.height - 1 ? this.height - 1 : y2));
      cx1 = (x1 / this.hChunkSize)|0;
      cy1 = (y1 / this.vChunkSize)|0;
      cx2 = (x2 / this.hChunkSize)|0;
      cy2 = (y2 / this.vChunkSize)|0;
      if (cx2 <= cx1) cx2 = cx1 + 1;
      if (cy2 <= cy1) cy2 = cy1 + 1;
    }
    for (y = 0; y < cy2; y++) {
      const row = this.chunks[y];
      for (x = cx1; x < cx2; x++) {
        const chunk = row[x];
        chunk.valid = false;
        if (!chunk.canvas) {
          chunk.canvas = document.createElement('CANVAS');
          chunk.canvas.setAttribute('width', chunk.width * this.tileSize);
          chunk.canvas.setAttribute('height', chunk.height * this.tileSize);
          chunk.context = chunk.canvas.getContext('2d');
          chunk.context.imageSmoothingEnabled = false;
        }
      }
    }

    for (y = y1; y < y2; y++) {
      const row = y * this.width;
      for (x = x1; x < x2; x++) {
        this.tileBits[row + x] = this.tileTypes[this.tiles[row + x]].bits;
      }
    }
  }

  renderTile(context, image, tileType, x, y) {
    context.drawImage(image,
      tileType.x * this.tileSize, tileType.y * this.tileSize,
      this.tileSize, this.tileSize,
      x, y,
      this.tileSize, this.tileSize,
    );
  }

  getChunk(chunkX, chunkY) {
    const chunkData = this.chunks[chunkY][chunkX];
    if (!chunkData.valid) {
      chunkData.valid = true;
      chunkData.context.clearRect(0, 0, chunkData.width * this.tileSize, chunkData.height * this.tileSize);
      for (let y = 0; y < chunkData.height; y++) {
        const tileRow = (chunkY * this.vChunkSize + y) * this.width + chunkX * this.hChunkSize;
        const pixelRow = y * this.tileSize;
        for (let x = 0; x < chunkData.width; x++) {
          const tileType = this.tileTypes[this.tiles[tileRow + x]];
          if (!tileType || tileType.blank) continue;
          this.renderTile(chunkData.context, this.image, tileType, x * this.tileSize, pixelRow);
        }
      }
    }
    return chunkData;
  }

  render(camera) {
    for (let y = 0; y < this.vChunks; y++) {
      const oy = this._origin[1] * PIXELS_PER_UNIT + y * this.vChunkSize * this.tileSize;
      for (let x = 0; x < this.hChunks; x++) {
        const chunk = this.getChunk(x, y);
        camera.layers[this.layer].drawImage(chunk.canvas, this._origin[0] * PIXELS_PER_UNIT + x * this.hChunkSize * this.tileSize, oy);
      }
    }
  }
}

TileMap._tempRect = new Rect(0, 0, 0, 0);

TileMap._workCanvas = (() => {
  const canvas = document.createElement('CANVAS');
  canvas.setAttribute('width', MAX_TEXTURE_SIZE);
  canvas.setAttribute('height', MAX_TEXTURE_SIZE);
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = false;
  return context;
})();

export default TileMap;
