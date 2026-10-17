export const PIXELS_PER_UNIT = 32;
export const UNITS_PER_PIXEL = 1 / PIXELS_PER_UNIT;

function makePointClass(superclass) {
  /**
  * Compact, performance-optimized 2D point/vector.
  */
  class Point extends superclass {
    /**
    * Constructs a new Point object. There are three accepted sets of parameters:
    *
    * new Point(ArrayBuffer, offset): creates a Point that can modify another ArrayBuffer
    * new Point(other): copies the coordinates from another Point or an array
    * new Point(x, y): creates a new point with the specified x and y coordinates
    */
    constructor(x, y) {
      if (x instanceof ArrayBuffer) {
        super(x, y, 2);
      } else if (y === undefined) {
        // Surprisingly, it's faster to create an uninitialized array and then
        // populate it one element at a time than it is to use the copy
        // constructor (`super(x)`).
        super(2);
        this[0] = x[0];
        this[1] = x[1];
      } else {
        super(2);
        this[0] = x;
        this[1] = y;
      }
    }

    /**
    * Fetches the x coordinate of the point.
    *
    * This is provided for API convenience, but `point[0]` is slightly faster
    * than `point.x`.
    */
    get x() {
      return this[0];
    }

    /**
    * Updates the x coordinate of the point.
    *
    * This is provided for API convenience, but `point[0]` is slightly faster
    * than `point.x`.
    *
    * @param {Number} The new x coordinate
    */
    set x(val) {
      this[0] = val;
    }

    /**
    * Fetches the y coordinate of the point.
    *
    * This is provided for API convenience, but `point[1]` is slightly faster
    * than `point.y`.
    */
    get y() {
      return this[1];
    }

    /**
    * Updates the y coordinate of the point.
    *
    * This is provided for API convenience, but `point[1]` is slightly faster
    * than `point.y`.
    *
    * @param {Number} The new y coordinate
    */
    set y(val) {
      this[1] = val;
    }

    /**
    * Updates the coordinates of this point to match another point.
    *
    * This is faster than `point = other;` because it avoids some allocations.
    * @param {Iterable} The source Point or a two-element array.
    */
    set(other) {
      this[0] = other[0];
      this[1] = other[1];
    }

    /**
    * Updates the coordinates of this point to a specified x, y pair.
    *
    * This is much faster than the alternatives `point = new Point(x, y);` or
    * `point.set(new Point(x, y));` because it doesn't require creating new
    * objects.
    * @param {Number} The new x coordinate
    * @param {Number} The new y coordinate
    */
    setXY(x, y) {
      this[0] = x;
      this[1] = y;
    }

    /**
    * Performs a vector addition, modifying this point's coordinates.
    *
    * @param {Iterable} The other Point or a two-element array.
    */
    add(other) {
      this[0] += other[0];
      this[1] += other[1];
    }

    /**
    * Performs a vector addition, returning a new Point and leaving this one
    * unmodified.
    *
    * This is slower than `point.add(other);` but does not modify the point.
    * @param {Iterable} The other Point or a two-element array.
    */
    added(other) {
      return new Point(this[0] + other[0], this[1] + other[1]);
    }

    /**
    * Performs a vector subtraction, modifying this point's coordinates.
    *
    * @param {Iterable} The other Point or a two-element array.
    * @return {Point} The result of the vector addition.
    */
    subtract(other) {
      this[0] -= other[0];
      this[1] -= other[1];
    }

    /**
    * Performs a vector subtraction, returning a new Point and leaving this one
    * unmodified.
    *
    * This is slower than `point.subtract(other);` but does not modify the point.
    * @param {Iterable} The other Point or a two-element array.
    * @return {Point} The result of the vector subtraction.
    */
    subtracted(other) {
      return new Point(this[0] - other[0], this[1] - other[1]);
    }

    /**
     * Mirrors this point across the origin.
     */
    invert() {
      this[0] = -this[0];
      this[1] = -this[1];
    }

    /**
     * Returns the Euclidean distance between this point and another one.
     * @param {Iterable} The other Point or a two-element array.
     * @returns {Number} The distance, in world units.
     */
    distanceTo(other) {
      const dx = this[0] - other[0];
      const dy = this[1] - other[1];
      return Math.sqrt(dx*dx + dy*dy);
    }

    /**
     * Returns the magnitude of the vector represented by this point.
     * @returns {Number} The magnitude, in world units.
     */
    get magnitude() {
      return Math.sqrt(this[0]*this[0] + this[1]*this[1]);
    }

    /**
     * Returns the squared magnitude of the vector represented by this point.
     * @returns {Number} The squared magnitude, in world units.
     */
    get magnitudeSquared() {
      return this[0]*this[0] + this[1]*this[1];
    }

    /**
     * Scales the vector represented by this point to have length 1.
     */
    normalize() {
      const dist = this.magnitude;
      this[0] /= dist;
      this[1] /= dist;
    }

    /**
     * Constrains the length of the vector represented by this point to a
     * specified maximum value.
     */
    clampMagnitude(max) {
      const dist = this.magnitude;
      if (dist > max) {
        this[0] = (this[0] / dist) * max;
        this[1] = (this[1] / dist) * max;
      }
    }

    /**
     * Multiplies the the vector by a scalar.
     */
    scale(scalar) {
      this[0] *= scalar;
      this[1] *= scalar;
    }

    /**
     * Computes the dot product of this point treated as a vector with another
     * point also treated as a vector.
     * @param {Point} The other vector.
     * @returns {Number} The dot product.
     */
    dot(other) {
      return (this[0] * other[0]) + (this[1] * other[1]);
    }

    /**
     * Computes the dot product of this point treated as a vector with another
     * vector specified by x and y components.
     * @param {Number} The other vector's x component.
     * @param {Number} The other vector's y component.
     * @returns {Number} The dot product.
     */
    dotXY(x, y) {
      return (this[0] * x) + (this[1] * y);
    }

    /**
    * Returns a human-readable representation of the point for debugging.
    * @returns {String} A description of the point.
    */
    toString() {
      return ['(', this[0], ',', this[1], ')'].join('');
    }
  }
  return Point;
}

export const Point = makePointClass(Float32Array);
export const IntPoint = makePointClass(Int32Array);
export default Point;
