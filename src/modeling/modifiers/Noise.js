import { Modifier } from '../Modifier.js';

/**
 * Noise Modifier — Adds random displacement to vertices
 */
export class NoiseModifier extends Modifier {
  static typeName = 'Noise';

  /** @type {number} Noise strength */
  strength = 0.1;

  /** @type {number} Noise frequency */
  frequency = 1.0;

  /** @type {number} Random seed */
  seed = 42;

  /** @type {boolean} Apply along normals only */
  alongNormals = false;

  apply(positions, bounds) {
    const result = new Float32Array(positions);

    // Simple seeded pseudo-random noise
    const hash = (x, y, z) => {
      let h = this.seed;
      h = ((h << 5) - h + Math.floor(x * 1000)) | 0;
      h = ((h << 5) - h + Math.floor(y * 1000)) | 0;
      h = ((h << 5) - h + Math.floor(z * 1000)) | 0;
      return ((Math.sin(h) * 43758.5453) % 1 + 1) % 1; // 0 to 1
    };

    // Simple 3D value noise
    const noise3D = (x, y, z) => {
      const fx = x * this.frequency;
      const fy = y * this.frequency;
      const fz = z * this.frequency;

      // Use multiple octaves of hash for smoother noise
      const n1 = hash(fx, fy, fz) - 0.5;
      const n2 = hash(fx + 17.3, fy + 31.7, fz + 47.1) - 0.5;
      const n3 = hash(fx + 59.2, fy + 73.8, fz + 97.4) - 0.5;

      return { x: n1, y: n2, z: n3 };
    };

    for (let i = 0; i < result.length; i += 3) {
      const x = positions[i];
      const y = positions[i + 1];
      const z = positions[i + 2];

      const n = noise3D(x, y, z);

      result[i] += n.x * this.strength;
      result[i + 1] += n.y * this.strength;
      result[i + 2] += n.z * this.strength;
    }

    return result;
  }

  getParams() {
    return [
      { name: 'Strength', key: 'strength', type: 'number', value: this.strength, min: 0, max: 2, step: 0.01 },
      { name: 'Frequency', key: 'frequency', type: 'number', value: this.frequency, min: 0.1, max: 10, step: 0.1 },
      { name: 'Seed', key: 'seed', type: 'number', value: this.seed, min: 0, max: 9999, step: 1 },
    ];
  }
}
