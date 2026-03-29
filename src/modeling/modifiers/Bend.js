import { Modifier } from '../Modifier.js';

/**
 * Bend Modifier — Bends geometry around an axis
 */
export class BendModifier extends Modifier {
  static typeName = 'Bend';

  /** @type {number} Bend angle in degrees */
  angle = 45;

  /** @type {string} Axis to bend around */
  axis = 'y';

  /** @type {string} Direction to bend towards */
  direction = 'x';

  apply(positions, bounds) {
    const result = new Float32Array(positions);

    const angleRad = (this.angle * Math.PI) / 180;
    const axisMap = { x: 0, y: 1, z: 2 };
    const axisIdx = axisMap[this.axis];
    const dirIdx = axisMap[this.direction];

    const size = bounds.size[this.axis] || 1;

    if (Math.abs(angleRad) < 0.001) return result;

    const radius = size / angleRad;

    for (let i = 0; i < result.length; i += 3) {
      // Normalized position along bend axis
      const t = size > 0
        ? (result[i + axisIdx] - bounds.min[this.axis]) / size
        : 0;

      const bendAngle = angleRad * t;
      const cos = Math.cos(bendAngle);
      const sin = Math.sin(bendAngle);

      // Current offset in bend direction
      const offset = result[i + dirIdx] - bounds.center[this.direction];

      // Apply bend
      const newAxis = (radius + offset) * sin + bounds.min[this.axis];
      const newDir = (radius + offset) * cos - radius + bounds.center[this.direction];

      result[i + axisIdx] = newAxis;
      result[i + dirIdx] = newDir;
    }

    return result;
  }

  getParams() {
    return [
      { name: 'Angle', key: 'angle', type: 'number', value: this.angle, min: -180, max: 180, step: 5 },
      { name: 'Axis', key: 'axis', type: 'select', value: this.axis, options: ['x', 'y', 'z'] },
      { name: 'Direction', key: 'direction', type: 'select', value: this.direction, options: ['x', 'y', 'z'] },
    ];
  }
}
