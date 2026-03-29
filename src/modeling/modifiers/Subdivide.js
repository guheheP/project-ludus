import { Modifier } from '../Modifier.js';

/**
 * Subdivide Modifier — Subdivides the mesh for smoother deformations
 * Note: This works by increasing the segment count when rebuilding geometry,
 * not by actually subdividing the triangle mesh (which would require more complex topology handling).
 * The actual subdivision is handled by ProceduralMesh when generating the base geometry.
 */
export class SubdivideModifier extends Modifier {
  static typeName = 'Subdivide';

  /** @type {number} Number of subdivision iterations (multiplier for segments) */
  iterations = 1;

  apply(positions, bounds) {
    // Subdivide doesn't modify positions - it affects geometry generation
    // The ProceduralMesh component handles this by multiplying segment counts
    return positions;
  }

  /**
   * Get the segment multiplier based on iterations
   * @returns {number}
   */
  getSegmentMultiplier() {
    return Math.pow(2, this.iterations);
  }

  getParams() {
    return [
      { name: 'Iterations', key: 'iterations', type: 'number', value: this.iterations, min: 0, max: 4, step: 1 },
    ];
  }
}
