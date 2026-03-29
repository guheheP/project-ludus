import { Modifier } from '../Modifier.js';

/**
 * Taper Modifier — Tapers geometry along an axis (makes it narrower at one end)
 */
export class TaperModifier extends Modifier {
  static typeName = 'Taper';

  /** @type {number} Taper amount (0 = no taper, 1 = point at top) */
  amount = 0.5;

  /** @type {string} Axis to taper along */
  axis = 'y';

  /** @type {string} Curve type */
  curve = 'linear';

  apply(positions, bounds) {
    const result = new Float32Array(positions);
    const axisMap = { x: 0, y: 1, z: 2 };
    const axisIdx = axisMap[this.axis];
    const size = bounds.size[this.axis] || 1;

    for (let i = 0; i < result.length; i += 3) {
      // Normalized position along axis (0 = bottom, 1 = top)
      const t = size > 0
        ? (result[i + axisIdx] - bounds.min[this.axis]) / size
        : 0;

      // Calculate scale factor
      let scaleFactor;
      switch (this.curve) {
        case 'smooth':
          scaleFactor = 1 - this.amount * (t * t);
          break;
        case 'sqrt':
          scaleFactor = 1 - this.amount * Math.sqrt(t);
          break;
        default: // linear
          scaleFactor = 1 - this.amount * t;
          break;
      }

      scaleFactor = Math.max(0.001, scaleFactor);

      // Scale the other two axes
      for (let a = 0; a < 3; a++) {
        if (a !== axisIdx) {
          const center = bounds.center[['x', 'y', 'z'][a]];
          result[i + a] = center + (result[i + a] - center) * scaleFactor;
        }
      }
    }

    return result;
  }

  getParams() {
    return [
      { name: 'Amount', key: 'amount', type: 'number', value: this.amount, min: -2, max: 2, step: 0.05 },
      { name: 'Axis', key: 'axis', type: 'select', value: this.axis, options: ['x', 'y', 'z'] },
      { name: 'Curve', key: 'curve', type: 'select', value: this.curve, options: ['linear', 'smooth', 'sqrt'] },
    ];
  }
}
