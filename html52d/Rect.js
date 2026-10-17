import { Point, IntPoint } from './Point.js';

function makeRectClass(superclass, Point) {
  /**
  * Compact, performance-optimized 2D rectangle.
  */
  class Rect extends superclass {
    /**
    * Constructs a new Rect object. There are three accepted sets of parameters:
    *
    * new Rect(x1, y1, x2, y2): creates a Rect spanning from (x1, y1) to (x2, y2)
    * new Rect(p1, p2): creates a Rect spanning from p1 to p2
    * new Rect(other): copies the coordinates from another Rect or an array
    */
    constructor(p1, p2, p3, p4) {
      super(4);
      // The ternary operator is several times faster than Math.min().
      if (p4 !== undefined) {
        this[0] = p1 < p3 ? p1 : p3;
        this[1] = p2 < p4 ? p2 : p4;
        this[2] = p1 > p3 ? p1 : p3;
        this[3] = p2 > p4 ? p2 : p4;
      } else if (p2) {
        this[0] = p1[0] < p2[0] ? p1[0] : p2[0];
        this[1] = p1[1] < p2[1] ? p1[1] : p2[1];
        this[2] = p1[0] > p2[0] ? p1[0] : p2[0];
        this[3] = p1[1] > p2[1] ? p1[1] : p2[1];
      } else {
        // Surprisingly it's faster to copy an iterable element-wise than to use
        // the copy constructor.
        this[0] = p1[0];
        this[1] = p1[1];
        this[2] = p1[2];
        this[3] = p1[3];
      }
    }

    /**
    * Constructs a new Rect object starting from a point with a given size.
    * @param {Point} The starting point of the rectangle
    * @param {Point} The size of the rectangle
    * @return {Rect} The constructed Rect
    */
    static fromSize(origin, size) {
      return new Rect(origin[0], origin[1], origin[0]+size[0], origin[1]+size[1]);
    }

    /**
    * Fetches the x coordinate of the left side of the rectangle.
    *
    * This is provided for API convenience, but `rect[0]` is slightly faster
    * than `rect.x1`.
    */
    get x1() {
      return this[0];
    }

    /**
    * Updates the x coordinate of the left side of the rectangle.
    *
    * This is provided for API convenience, but `rect[0]` is slightly faster
    * than `rect.x1`.
    *
    * @param {Number} The new x coordinate
    */
    set x1(val) {
      this[0] = val;
    }

    /**
    * Fetches the y coordinate of the top side of the rectangle.
    *
    * This is provided for API convenience, but `rect[1]` is slightly faster
    * than `rect.y1`.
    */
    get y1() {
      return this[1];
    }

    /**
    * Updates the y coordinate of the top side of the rectangle.
    *
    * This is provided for API convenience, but `rect[1]` is slightly faster
    * than `rect.y1`.
    *
    * @param {Number} The new y coordinate
    */
    set y1(val) {
      this[1] = val;
    }

    /**
    * Fetches the x coordinate of the right side of the rectangle.
    *
    * This is provided for API convenience, but `rect[2]` is slightly faster
    * than `rect.x2`.
    */
    get x2() {
      return this[2];
    }

    /**
    * Updates the x coordinate of the right side of the rectangle.
    *
    * This is provided for API convenience, but `rect[2]` is slightly faster
    * than `rect.x2`.
    *
    * @param {Number} The new x coordinate
    */
    set x2(val) {
      this[2] = val;
    }

    /**
    * Fetches the y coordinate of the bottom side of the rectangle.
    *
    * This is provided for API convenience, but `rect[3]` is slightly faster
    * than `rect.y2`.
    */
    get y2() {
      return this[3];
    }

    /**
    * Updates the y coordinate of the bottom side of the rectangle.
    *
    * This is provided for API convenience, but `rect[3]` is slightly faster
    * than `rect.y2`.
    *
    * @param {Number} The new x coordinate
    */
    set y2(val) {
      this[3] = val;
    }

    /**
    * Fetches the top-left corner of the rectangle. Changes to the return value
    * will update the rectangle.
    */
    get min() {
      if (!this._min) {
        this._min = new Point(this.buffer, 0);
      }
      return this._min;
    }

    /**
    * Fetches the bottom-right corner of the rectangle. Changes to the return
    * value will update the rectangle.
    */
    get max() {
      if (!this._max) {
        this._max = new Point(this.buffer, 8);
      }
      return this._max;
    }

    /**
    * Fetches the width of the rectangle.
    */
    get width() {
      return this[2] - this[0];
    }

    /**
    * Updates the width of the rectangle. The left side of the rectangle remains
    * fixed.
    */
    set width(val) {
      this[2] = this[0] + val;
    }

    /**
    * Fetches the height of the rectangle.
    */
    get height() {
      return this[3] - this[1];
    }

    /**
    * Updates the height of the rectangle. The top side of the rectangle remains
    * fixed.
    */
    set height(val) {
      this[3] = this[1] + val;
    }

    /**
    * Updates the coordinates of this rectangle to match another rectangle.
    *
    * This is faster than `rect = other;` because it avoids some allocations.
    * @param {Iterable} The source Rect or a four-element array.
    */
    set(other) {
      this[0] = other[0];
      this[1] = other[1];
      this[2] = other[2];
      this[3] = other[3];
    }

    /**
    * Updates the coordinates of this rectangle to a specified pair of points.
    *
    * This is much faster than the alternatives
    * `rect = new Rect(x1, y1, x2, y2);` or `rect.set(new Rect(x1, y1, x2, y2));`
    * because it doesn't require creating new objects.
    * @param {Number} The new x coordinate of the left side
    * @param {Number} The new y coordinate of the top side
    * @param {Number} The new x coordinate of the right side
    * @param {Number} The new y coordinate of the bottom side
    */
    setCoords(x1, y1, x2, y2) {
      this[0] = x1;
      this[1] = y1;
      this[2] = x2;
      this[3] = y2;
    }

    /**
    * Updates the coordinates of this rectangle to a specified point and size.
    *
    * This is much faster than the alternatives
    * `rect = Rect.fromSize(x, y, w h);` or
    * `rect.set(Rect.fromSize(x, y, w, h));` because it doesn't require creating
    * new objects.
    * @param {Number} The new x coordinate of the left side
    * @param {Number} The new y coordinate of the top side
    * @param {Number} The new x coordinate of the right side
    * @param {Number} The new y coordinate of the bottom side
    */
    setXySize(x, y, w, h) {
      this[0] = x;
      this[1] = y;
      this[2] = x+w;
      this[3] = y+h;
    }

    /**
    * Determines if this rectangle intersects another rectangle.
    * @param {Rect} The other rectangle
    * @returns {Boolean} True if the rectangles intersect
    */
    intersects(other) {
      return (
        this[2] > other[0] &&
        this[0] < other[2] &&
        this[3] > other[1] &&
        this[1] < other[3]
      );
    }

    /**
    * Translates (moves) the rectangle by a vector.
    * @param {Iterable} A Point or two-element array.
    * @returns {Rect} Chainable.
    */
    translate(offset) {
      this[0] += offset[0];
      this[1] += offset[1];
      this[2] += offset[0];
      this[3] += offset[1];
      return this;
    }

    /**
    * Translates (moves) the rectangle by horizontal and vertical distances.
    * @param {Number} The horizontal distance to translate.
    * @param {Number} The vertical distance to translate.
    * @returns {Rect} Chainable.
    */
    translateXY(x, y) {
      this[0] += x;
      this[1] += y;
      this[2] += x;
      this[3] += y;
      return this;
    }

    /**
    * Returns a new rectangle offset from this one by a vector. The current
    * Rect is unmodified.
    * @param {Iterable} A Point or two-element array.
    * @returns {Rect} A new Rect at the new location.
    */
    translated(offset) {
      return new Rect(
        this[0] + offset[0],
        this[1] + offset[1],
        this[2] + offset[0],
        this[3] + offset[1],
      );
    }

    /**
    * Sets another rectangle to be this rectangle offset by a vector. The current
    * Rect is unmodified.
    * @param {Rect} The destination Rect.
    * @param {Iterable} A Point or two-element array.
    */
    translateInto(dest, offset) {
      dest[0] = this[0] + offset[0];
      dest[1] = this[1] + offset[1];
      dest[2] = this[2] + offset[0];
      dest[3] = this[3] + offset[1];
    }

    /**
    * Determines if a point is contained within the rectangle.
    *
    * Points on the top and left edges are considered to be inside the
    * rectangle. Points on the bottom and right edges are considered to be
    * outside the rectangle. This is to allow abutting rectangles to have
    * disjoint contents.
    * @param {Point} The point to test.
    * @returns {Boolean} True if the point is inside the rectangle.
    */
    contains(point) {
      return (
        this[0] <= point[0] &&
        this[1] <= point[1] &&
        this[2] > point[0] &&
        this[3] > point[1]
      );
    }

    /**
    * Determines if a point specified by coordinates is contained within the
    * rectangle.
    *
    * Points on the top and left edges are considered to be inside the
    * rectangle. Points on the bottom and right edges are considered to be
    * outside the rectangle. This is to allow abutting rectangles to have
    * disjoint contents.
    * @param {Number} The x coordinate of the point to test.
    * @param {Number} The y coordinate of the point to test.
    * @returns {Boolean} True if the point is inside the rectangle.
    */
    containsXY(x, y) {
      return (
        this[0] <= x &&
        this[1] <= y &&
        this[2] > x &&
        this[3] > y
      );
    }

    /**
    * Returns a human-readable representation of the rectangle for debugging.
    * @returns {String} A description of the rectangle.
    */
    toString() {
      return ['((', this[0], ',', this[1], ')-(', this[2], ',', this[3], '))'].join('');
    }

    /**
    * Enlarges this rectangle to include another rectangle.
    * @param {Rect} The rectangle to be included.
    * @returns {Rect} Chainable.
    */
    union(other) {
      return Rect.union(this, other);
    }

    /**
    * Enlarges one rectangle to include another rectangle.
    *
    * This function exists as an optimization for bulk operations.
    * @param {Rect} The rectangle to be modified.
    * @param {Rect} The rectangle to be included.
    * @returns {Rect} The modified rectangle, for chaining.
    */
    static union(dest, other) {
      if (dest[0] > other[0]) dest[0] = other[0];
      if (dest[1] > other[1]) dest[1] = other[1];
      if (dest[2] < other[2]) dest[2] = other[2];
      if (dest[3] < other[3]) dest[3] = other[3];
      return dest;
    }

    /**
    * Compares two rectangles for equivalency. Two rectangles are equivalent
    * if they both exist and are the same size and have the same coordinates.
    * @param {?Rect} One of the rectangles to compare.
    * @param {?Rect} One of the rectangles to compare.
    * @returns {Boolean} True if the rectangles are equivalent.
    */
    static equal(lhs, rhs) {
      return (
        lhs && rhs &&
        lhs[0] === rhs[0] &&
        lhs[1] === rhs[1] &&
        lhs[2] === rhs[2] &&
        lhs[3] === rhs[3]
      );
    }
  }
  return Rect;
}

export const Rect = makeRectClass(Float32Array, Point);
export const IntRect = makeRectClass(Int32Array, IntPoint);

export default Rect;
