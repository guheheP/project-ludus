import { Modifier } from '../Modifier.js';

/**
 * Twist Modifier — Twists geometry around an axis
 */
export class TwistModifier extends Modifier {
  static typeName = 'Twist';

  /** @type {number} Twist angle in degrees */
  angle = 45;

  /** @type {string} Axis to twist around: 'x', 'y', 'z' */
  axis = 'y';

  apply(positions, bounds) {
    const result = new Float32Array(positions);
    const axisIdx = { x: 0, y: 1, z: 2 }[this.axis];
    const u = (axisIdx + 1) % 3;
    const v = (axisIdx + 2) % 3;

    const angleRad = (this.angle * Math.PI) / 180;
    const size = bounds.size[this.axis] || 1;

    for (let i = 0; i < result.length; i += 3) {
      // Normalized position along axis (0 to 1)
      const t = size > 0
        ? (result[i + axisIdx] - bounds.min[this.axis]) / size
        : 0;

      const twistAngle = angleRad * t;
      const cos = Math.cos(twistAngle);
      const sin = Math.sin(twistAngle);

      // Get centered coordinates
      const cu = result[i + u] - bounds.center[{ x: 'x', y: 'y', z: 'z' }[['x', 'y', 'z'][u]]];
      const cv = result[i + v] - bounds.center[{ x: 'x', y: 'y', z: 'z' }[['x', 'y', 'z'][v]]];

      // Rotate around axis
      result[i + u] = cu * cos - cv * sin + bounds.center[['x', 'y', 'z'][u]];
      result[i + v] = cu * sin + cv * cos + bounds.center[['x', 'y', 'z'][v]];
    }

    return result;
  }

  getParams() {
    return [
      { name: 'Angle', key: 'angle', type: 'number', value: this.angle, min: -720, max: 720, step: 5 },
      { name: 'Axis', key: 'axis', type: 'select', value: this.axis, options: ['x', 'y', 'z'] },
    ];
  }
}
