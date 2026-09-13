const MASK64 = (1n << 64n) - 1n;
const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;

function fnv1a64(text) {
  let hash = FNV_OFFSET;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= BigInt(text.charCodeAt(i));
    hash = (hash * FNV_PRIME) & MASK64;
  }
  return hash;
}

function tokenize(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\u00c0-\uffff\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function shingles(tokens, size) {
  if (tokens.length === 0) return [];
  if (tokens.length <= size) return [tokens.join(' ')];
  const out = [];
  for (let i = 0; i + size <= tokens.length; i += 1) {
    out.push(tokens.slice(i, i + size).join(' '));
  }
  return out;
}

function simhash(text, bits = 64, shingleSize = 3) {
  const grams = shingles(tokenize(text), shingleSize);
  if (grams.length === 0) return 0n;

  const counts = new Array(bits).fill(0);
  for (const gram of grams) {
    const hash = fnv1a64(gram);
    for (let bit = 0; bit < bits; bit += 1) {
      const set = (hash >> BigInt(bit)) & 1n;
      counts[bit] += set === 1n ? 1 : -1;
    }
  }

  let fingerprint = 0n;
  for (let bit = 0; bit < bits; bit += 1) {
    if (counts[bit] > 0) fingerprint |= (1n << BigInt(bit));
  }
  return fingerprint;
}

function popcount(value) {
  let count = 0;
  let n = value;
  while (n > 0n) {
    count += Number(n & 1n);
    n >>= 1n;
  }
  return count;
}

function hammingDistance(a, b) {
  return popcount((a ^ b) & MASK64);
}

class ContentDedup {
  constructor(options = {}) {
    this.threshold   = options.threshold   ?? 3;
    this.shingleSize = options.shingleSize ?? 3;
    this.maxEntries  = options.maxEntries  ?? 10000;
    this._entries    = [];
  }

  fingerprint(text) {
    return simhash(text, 64, this.shingleSize);
  }

  add(text) {
    const fingerprint = this.fingerprint(text);
    this._entries.push(fingerprint);
    if (this._entries.length > this.maxEntries) this._entries.shift();
    return fingerprint;
  }

  find(text) {
    const fingerprint = this.fingerprint(text);
    let closest = null;

    for (const entry of this._entries) {
      const distance = hammingDistance(fingerprint, entry);
      if (closest === null || distance < closest.distance) {
        closest = { distance };
        if (distance === 0) break;
      }
    }

    return { fingerprint, distance: closest ? closest.distance : null };
  }

  isDuplicate(text) {
    const { fingerprint, distance } = this.find(text);
    return { duplicate: distance !== null && distance <= this.threshold, distance, fingerprint };
  }

  check(text, options = {}) {
    const autoAdd = options.add ?? true;
    const result  = this.isDuplicate(text);
    if (autoAdd && !result.duplicate) this.add(text);
    return result;
  }

  size() {
    return this._entries.length;
  }

  clear() {
    this._entries = [];
  }
}

module.exports = ContentDedup;
module.exports.simhash = simhash;
module.exports.hammingDistance = hammingDistance;
module.exports.tokenize = tokenize;
