import Rect from './Rect.js';

export class Scene {
  constructor() {
    // An object is faster than a Map here because we're using integer keys
    this.buckets = {};
    // An array is faster than a Set here because iteration is more common than deletion
    this.objects = [];
    this.nextObjects = [];
    this.frame = 0;
  }

  add(sprite) {
    sprite.isAsleep = false;
    this.nextObjects.push(sprite);
    this.postUpdate(sprite);
    sprite.scene = this;
    sprite.start(this);
  }

  remove(sprite) {
    sprite.isAsleep = true;
    this.postUpdate(sprite);
    sprite._collisions.clear();
    sprite.scene = null;
    let pos = this.objects.indexOf(sprite);
    if (pos >= 0) {
      this.objects.splice(pos, 1);
    }
    pos = this.nextObjects.indexOf(sprite);
    if (pos >= 0) {
      this.nextObjects.splice(pos, 1);
    }
  }

  getBucket(bx, by) {
    const bucketID = (
      (0x2000000 + by) << 26 |
      (0x2000000 + bx)
    );
    const bucket = this.buckets[bucketID];
    if (!bucket) {
      return (this.buckets[bucketID] = new Set());
    }
    return bucket;
  }

  updateBucketRange(rect, sprite, isContained) {
    const minX = rect[0]|0;
    const minY = rect[1]|0;
    const maxX = rect[2]|0;
    const maxY = rect[3]|0;
    if (isContained) {
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          this.getBucket(x, y).add(sprite);
        }
      }
    } else {
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          this.getBucket(x, y).delete(sprite);
        }
      }
    }
  }

  postUpdate(sprite) {
    if (!sprite) return;
    let before = null;
    if (sprite.lastAabb) {
      Scene._beforeReuse.set(sprite.lastAabb);
      before = Scene._beforeReuse;
    }
    let after;
    sprite._coarseCollisions.clear();
    if (sprite.isAsleep) {
      if (!before) {
        // It was asleep before, and it's still asleep now
        // Don't bother updating anything
        return;
      }
      // Sleeping sprites don't fire onCollisionExit on themselves
      // though other sprites will still get onCollisionExit fired
      sprite._collisions.clear();
      sprite.lastAabb = null;
      after = null;
    } else {
      sprite.computeBoxes();
      if (sprite.lateUpdate) {
        sprite.lateUpdate(this);
      }
      after = sprite.lastAabb;
    }
    if (Rect.equal(before, after) || !sprite.hasCollision) {
      // No changes, or doesn't need to be tracked in buckets
      return;
    }
    if (before) {
      this.updateBucketRange(before, sprite, false);
    }
    if (after) {
      this.updateBucketRange(after, sprite, true);
    }
  }

  tick(ms) {
    ++this.frame;
    if (ms > 63) {
      // Don't even try to support less than 16fps
      ms = 63;
    }
    this.deltaTime = ms;
    const len = this.objects.length;
    let i, sprite;
    for (i = 0; i < len; ++i) {
      sprite = this.objects[i];
      if (sprite && !sprite.isAsleep) {
        sprite.internalUpdate(this, ms);
      }
    }
    for (i = 0; i < len; ++i) {
      this.postUpdate(this.objects[i]);
    }
    if (this.nextObjects.length) {
      this.objects.push.apply(this.objects, this.nextObjects);
      this.nextObjects = [];
    }
    this.updateCollisions();
  }

  render(camera) {
    const len = this.objects.length;
    let sprite;
    for (let i = 0; i < len; ++i) {
      sprite = this.objects[i];
      if (sprite && !sprite.isAsleep && (sprite.lastAabb.intersects(camera.aabb) || camera.layers[sprite.layer].noTransform)) {
        sprite.render(camera);
      }
    }
  }

  updateCollisions() {
    let minX, minY, maxX, maxY, bucket, x, y, sprite, other;
    // Broad phase: figure out which objects are close enough to each other that they might collide
    for (sprite of this.objects) {
      // Sleeping sprites don't collide with anything
      // Tilemap collisions are asymmetrical
      // Passive sprites don't collide, but can be collided with
      if (sprite.isAsleep || sprite.isTileMap || sprite.isPassive || !sprite.hasCollision) {
        continue;
      }
      // While this loop is structurally identical to updateBucketRange, writing this loop inline
      // is up to 8% faster than writing a function that returns an array of buckets and up to 15%
      // faster than writing a generator function.
      minX = sprite.lastAabb[0]|0;
      minY = sprite.lastAabb[1]|0;
      maxX = sprite.lastAabb[2]|0;
      maxY = sprite.lastAabb[3]|0;
      if (sprite._moved) {
        sprite._velocity[0] = sprite._origin[0] - sprite._lastOrigin[0];
        sprite._velocity[1] = sprite._origin[1] - sprite._lastOrigin[1];
      }
      for (y = minY; y <= maxY; y++) {
        for (x = minX; x <= maxX; x++) {
          bucket = this.getBucket(x, y);
          for (const other of bucket) {
            // TODO: swept collisions
            if (!other.isAsleep && other !== sprite && !sprite._coarseCollisions.has(other) && sprite.lastAabb.intersects(other.lastAabb)) {
              if (!other.isTileMap) sprite._coarseCollisions.add(other);
              other._coarseCollisions.add(sprite);
            }
          }
        }
      }
    }
    // Narrow phase: figure out which pairs of objects actually are colliding at full resolution
    for (sprite of this.objects) {
      if (sprite.isAsleep || !sprite.hasCollision) {
        continue;
      }
      if (sprite._coarseCollisions.size === 0) continue;
      for (other of sprite._coarseCollisions.values()) {
        // Remove from the other sprite's broadphase to avoid double-processing this collision
        other._coarseCollisions.delete(sprite);
        const methodName = sprite._collisions.has(other) ? 'onCollisionStay' : 'onCollisionEnter';
        const collision = sprite.computeCollision(other, !(sprite[methodName] || other[methodName]));
        if (!collision) continue;
        sprite[methodName] && sprite[methodName](other, collision);
        (collision !== true) && collision.invert();
        other[methodName] && other[methodName](sprite, collision);
        sprite._collisions.set(other, this.frame);
        other._collisions.set(sprite, this.frame);
      }
    }
    // Cleanup phase: check existing collisions for expiration
    for (sprite of this.objects) {
      if (sprite.isAsleep) {
        continue;
      }
      for (const coll of sprite._collisions) {
        if (coll[1] !== this.frame || coll[0].isAsleep) {
          sprite.onCollisionExit && sprite.onCollisionExit(coll[0]);
          if (!coll[0].isAsleep) {
            coll[0].onCollisionExit && coll[0].onCollisionExit(sprite);
            coll[0]._collisions.delete(sprite);
          }
          sprite._collisions.delete(coll[0]);
        }
      }
    }
  }

  spritesAt(pointOrX, y = null) {
    let x = pointOrX;
    if (y === null) {
      y = pointOrX[1]
      x = pointOrX[0]
    }
    const bucket = this.getBucket(x|0, y|0);
    const result = [];
    for (const sprite of bucket) {
      if (sprite.lastAabb.containsXY(x, y)) {
        result.push(sprite);
      }
    }
    return result;
  }
}

Scene._beforeReuse = new Rect(0, 0, 0, 0);

export default Scene;
