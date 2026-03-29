import { Component } from '../Component.js';

/**
 * AudioSource - Emits audio from this entity's position
 */
export class AudioSource extends Component {
  static typeName = 'AudioSource';

  constructor() {
    super();
    
    /** @type {string} ID of the audio asset from AssetManager */
    this.assetId = ''; 
    
    /** @type {boolean} Automatically play on start */
    this.autoplay = false;
    
    /** @type {boolean} Loop the audio */
    this.loop = false;
    
    /** @type {number} Volume multiplier (0.0 to 1.0) */
    this.volume = 1.0;
    
    /** @type {boolean} Whether audio has 3D positional panning */
    this.spatial = true;
    
    /** @type {import('three').PositionalAudio | import('three').Audio | null} Runtime three.js audio node */
    this.threeAudio = null;
  }
  
  clone() {
    const cloned = new AudioSource();
    cloned.assetId = this.assetId;
    cloned.autoplay = this.autoplay;
    cloned.loop = this.loop;
    cloned.volume = this.volume;
    cloned.spatial = this.spatial;
    return cloned;
  }

  serialize() {
    return {
      assetId: this.assetId,
      autoplay: this.autoplay,
      loop: this.loop,
      volume: this.volume,
      spatial: this.spatial
    };
  }

  deserialize(data) {
    if (data.assetId !== undefined) this.assetId = data.assetId;
    if (data.autoplay !== undefined) this.autoplay = data.autoplay;
    if (data.loop !== undefined) this.loop = data.loop;
    if (data.volume !== undefined) this.volume = data.volume;
    if (data.spatial !== undefined) this.spatial = data.spatial;
  }
}
