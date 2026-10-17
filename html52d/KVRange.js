export const idbRange = window.IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange || window.msIDBKeyRange;

export default class KVRange {
  constructor(lower, upper, lowerOpen = false, upperOpen = false) {
    if (Array.isArray(lower)) {
      // Clone arrays
      this._ranges = KVRange._simplify(lower.map(range => ({ ...range })));
    } else if (lower instanceof KVRange) {
      // Clone ranges
      this._ranges = lower._ranges.map(range => ({ ...range }));
    } else if (lower instanceof idbRange) {
      this._ranges = [{ lower: lower.lower, lower: lower.upper, lower: lower.lowerOpen, lower: lower.upperOpen }];
    } else {
      this._ranges = [{ lower, upper, lowerOpen, upperOpen }];
    }
  }

  static lessThan(key) {
    return new KVRange(undefined, key, true, true);
  }

  static greaterThan(key) {
    return new KVRange(key, undefined, true, true);
  }

  static between(lower, upper) {
    return new KVRange(lower, upper, false, false);
  }

  static equals(key) {
    return new KVRange(key, key, false, false);
  }

  and(other) {
    if (!(other instanceof KVRange)) {
      other = new KVRange(other);
    }
    if (this._ranges.includes(true)) {
      return other;
    } else if (other._ranges.includes(true)) {
      return this;
    }
    let lhsRange = this._ranges.filter(identity);
    let rhsRange = other._ranges.filter(identity);
    let lower, upper, lowerOpen, upperOpen;
    const result = [];
    for (const lhs of lhsRange) {
      for (const rhs of rhsRange) {
        if (lhs.lower === undefined) {
          lower = rhs.lower;
          lowerOpen = rhs.lowerOpen;
        } else if (rhs.lower === undefined) {
          lower = lhs.lower;
          lowerOpen = lhs.lowerOpen;
        } else if (lhs.lower === rhs.lower) {
          lower = lhs.lower;
          lowerOpen = lhs.lowerOpen || rhs.lowerOpen;
        } else if (lhs.lower < rhs.lower) {
          lower = rhs.lower;
          lowerOpen = rhs.lowerOpen;
        } else {
          lower = lhs.lower;
          lowerOpen = lhs.lowerOpen;
        }
        if (lhs.upper === undefined) {
          upper = rhs.upper;
          upperOpen = rhs.upperOpen;
        } else if (rhs.upper === undefined) {
          upper = lhs.upper;
          upperOpen = lhs.upperOpen;
        } else if (lhs.upper === rhs.upper) {
          upper = lhs.upper;
          upperOpen = lhs.upperOpen || rhs.upperOpen;
        } else if (lhs.upper > rhs.upper) {
          upper = rhs.upper;
          upperOpen = rhs.upperOpen;
        } else {
          upper = lhs.upper;
          upperOpen = lhs.upperOpen;
        }
        if (upper !== undefined && lower !== undefined) {
          if (upper < lower) {
            continue;
          }
          if ((lowerOpen || upperOpen) && upper == lower) {
            continue;
          }
        } else if (lower === undefined && upper === undefined) {
          // shouldn't be possible, but just in case
          return KVRange.all();
        }
        result.push({ lower, upper, lowerOpen, upperOpen });
      }
    }
    return new KVRange(result);
  }

  or(other) {
    if (!(other instanceof KVRange)) {
      other = new KVRange(other);
    }
    return new KVRange([
      ...this._ranges,
      ...other._ranges,
    ]);
  }

  static _simplify(ranges) {
    if (ranges.includes(true)) {
      return [true];
    }
    ranges = ranges.filter(identity);
    if (ranges.length === 0) {
      return [false];
    }
    if (ranges.length === 1) {
      return ranges;
    }
    ranges.sort(compareRanges);
    let lhs = { ...ranges[0] }, rhs;
    const result = [lhs];
    for (let i = 1; i < ranges.length; i++) {
      rhs = ranges[i];
      const distinctCmp = compareBounded(lhs.upper, lhs.upperOpen, true, rhs.lower, rhs.lowerOpen, false);
      if (distinctCmp < 0) {
        // non-intersecting ranges; the left range is strictly greater than the right range
        lhs = { ...rhs };
        result.push(lhs);
        continue;
      }
      const lowerCmp = compareBounded(lhs.lower, lhs.lowerOpen, false, rhs.lower, rhs.lowerOpen, false);
      const upperCmp = compareBounded(lhs.upper, lhs.upperOpen, true, rhs.upper, rhs.upperOpen, true);
      if (lowerCmp > 0) {
        lhs.lower = rhs.lower;
        lhs.lowerOpen = rhs.lowerOpen;
      }
      if (upperCmp < 0) {
        lhs.upper = rhs.upper;
        lhs.upperOpen = rhs.upperOpen;
      }
    }
    return result;
  }

  static not(range) {
    return range.not();
  }

  not() {
    const result = [];
    if (this._ranges.includes(true)) {
      return KVRange.none();
    }
    const filtered = this._ranges.filter(identity);
    if (filtered.length === 0) {
      return KVRange.all();
    }
    for (const range of filtered) {
      if (range.upper !== undefined) {
        result.push({ lower: range.upper, upper: undefined, lowerOpen: !range.upperOpen, upperOpen: true });
      } 
      if (range.lower !== undefined) {
        result.push({ lower: undefined, upper: range.lower, lowerOpen: true, upperOpen: !range.lowerOpen });
      }
    }
    return new KVRange(result);
  }

  static all() {
    return new KVRange([true]);
  }

  static none() {
    return new KVRange([false]);
  }

  get _idbRanges() {
    const result = [];
    for (const range of this._ranges) {
      if (range === false) {
        continue;
      } else if (range === true) {
        return true;
      } else if (range.lower === undefined) {
        result.push(idbRange.upperBound(range.upper, range.upperOpen));
      } else if (range.upper === undefined) {
        result.push(idbRange.lowerBound(range.lower, range.lowerOpen));
      } else if (range.lower === range.upper && (!range.lowerOpen || !range.upperOpen)) {
        result.push(idbRange.only(range.lower))
      } else {
        result.push(idbRange.bound(range.lower, range.upper, range.lowerOpen, range.upperOpen));
      }
    }
    return result;
  }
};

