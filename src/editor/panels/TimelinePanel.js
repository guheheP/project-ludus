import { ANIMATABLE_PROPERTIES, Keyframe } from '../../engine/components/AnimationClip.js';
import { EASINGS } from '../../engine/systems/TweenManager.js';

/**
 * TimelinePanel — Visual keyframe animation editor
 * 
 * Displays as a tab in the bottom panel alongside Console/Script/Project.
 * Shows tracks (property rows) with keyframe diamonds that can be
 * added, removed, and selected. Includes a playhead for scrubbing.
 */
export class TimelinePanel {
  /** @type {HTMLElement} */
  container;

  /** @type {import('../../engine/components/AnimationPlayer.js').AnimationPlayer|null} */
  player = null;

  /** @type {import('../../engine/Entity.js').Entity|null} */
  entity = null;

  /** @type {Function|null} Called when user modifies animation data */
  onChanged = null;

  /** @type {number} Pixels per second on the timeline */
  _pixelsPerSecond = 200;

  /** @type {number} Horizontal scroll offset in pixels */
  _scrollOffset = 0;

  /** @type {object|null} Currently selected keyframe { trackIndex, keyframeIndex } */
  _selectedKf = null;

  /** @type {boolean} Is the playhead being dragged? */
  _draggingPlayhead = false;

  /** @type {number|null} Animation frame ID for preview playback */
  _previewAnimId = null;

  /** @type {number} Last timestamp for preview */
  _lastPreviewTime = 0;

  constructor(container) {
    this.container = container;
    this._build();
  }

  _build() {
    this.container.innerHTML = '';
    this.container.className = 'timeline-panel';

    // Top controls bar
    const controls = document.createElement('div');
    controls.className = 'timeline-controls';

    // Play/Stop buttons
    this._btnPlay = this._createBtn('▶', 'Play animation', () => this._togglePlay());
    this._btnStop = this._createBtn('⏹', 'Stop', () => this._stopPreview());
    this._btnAddKf = this._createBtn('◆+', 'Add keyframe at playhead', () => this._addKeyframeAtPlayhead());
    this._btnDelKf = this._createBtn('◆−', 'Delete selected keyframe', () => this._deleteSelectedKeyframe());

    controls.appendChild(this._btnPlay);
    controls.appendChild(this._btnStop);
    controls.appendChild(this._btnAddKf);
    controls.appendChild(this._btnDelKf);

    // Time display
    this._timeDisplay = document.createElement('span');
    this._timeDisplay.className = 'timeline-time-display';
    this._timeDisplay.textContent = '0.00s';
    controls.appendChild(this._timeDisplay);

    // Clip name
    this._clipName = document.createElement('input');
    this._clipName.className = 'timeline-clip-name';
    this._clipName.value = 'Default';
    this._clipName.title = 'Clip name';
    this._clipName.addEventListener('change', () => {
      if (this.player?.currentClip) {
        this.player.currentClip.name = this._clipName.value;
        this._emitChanged();
      }
    });
    controls.appendChild(this._clipName);

    // Loop toggle
    this._btnLoop = this._createBtn('🔁', 'Toggle loop', () => {
      if (this.player?.currentClip) {
        this.player.currentClip.loop = !this.player.currentClip.loop;
        this._btnLoop.classList.toggle('active', this.player.currentClip.loop);
        this._emitChanged();
      }
    });
    controls.appendChild(this._btnLoop);

    // Add track selector
    this._trackSelect = document.createElement('select');
    this._trackSelect.className = 'timeline-track-select';
    this._trackSelect.innerHTML = '<option value="">+ Add Track</option>';
    const groups = {};
    for (const prop of ANIMATABLE_PROPERTIES) {
      if (!groups[prop.group]) groups[prop.group] = [];
      groups[prop.group].push(prop);
    }
    for (const [group, props] of Object.entries(groups)) {
      const optgroup = document.createElement('optgroup');
      optgroup.label = group;
      for (const p of props) {
        const opt = document.createElement('option');
        opt.value = p.path;
        opt.textContent = p.label;
        optgroup.appendChild(opt);
      }
      this._trackSelect.appendChild(optgroup);
    }
    this._trackSelect.addEventListener('change', () => {
      const prop = this._trackSelect.value;
      if (prop && this.player?.currentClip) {
        this.player.currentClip.getTrack(prop);
        this._trackSelect.value = '';
        this._renderTracks();
        this._emitChanged();
      }
    });
    controls.appendChild(this._trackSelect);

    this.container.appendChild(controls);

    // Timeline body (tracks area + ruler)
    const body = document.createElement('div');
    body.className = 'timeline-body';

    // Track labels column
    this._labelsCol = document.createElement('div');
    this._labelsCol.className = 'timeline-labels';
    body.appendChild(this._labelsCol);

    // Tracks + ruler area
    const tracksArea = document.createElement('div');
    tracksArea.className = 'timeline-tracks-area';

    // Ruler
    this._ruler = document.createElement('canvas');
    this._ruler.className = 'timeline-ruler';
    this._ruler.height = 24;
    tracksArea.appendChild(this._ruler);

    // Keyframe rows container (scrollable)
    this._rowsContainer = document.createElement('div');
    this._rowsContainer.className = 'timeline-rows';
    tracksArea.appendChild(this._rowsContainer);

    // Playhead line (overlays everything)
    this._playheadLine = document.createElement('div');
    this._playheadLine.className = 'timeline-playhead';
    tracksArea.appendChild(this._playheadLine);

    body.appendChild(tracksArea);
    this.container.appendChild(body);

    // Keyframe properties editor (shown when a keyframe is selected)
    this._kfEditor = document.createElement('div');
    this._kfEditor.className = 'timeline-kf-editor';
    this._kfEditor.style.display = 'none';
    this.container.appendChild(this._kfEditor);

    // Events
    this._ruler.addEventListener('mousedown', (e) => this._onRulerMouseDown(e));
    tracksArea.addEventListener('scroll', () => {
      this._scrollOffset = tracksArea.scrollLeft;
      this._drawRuler();
    });
    this._tracksArea = tracksArea;

    // Resize observer for ruler width
    this._ro = new ResizeObserver(() => {
      this._ruler.width = this._tracksArea.clientWidth;
      this._drawRuler();
    });
    this._ro.observe(this._tracksArea);

    this._showEmpty();
  }

  _createBtn(text, title, onClick) {
    const btn = document.createElement('button');
    btn.className = 'timeline-btn';
    btn.textContent = text;
    btn.title = title;
    btn.addEventListener('click', onClick);
    return btn;
  }

  _showEmpty() {
    this._labelsCol.innerHTML = '';
    this._rowsContainer.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'timeline-empty';
    empty.innerHTML = `<span class="timeline-empty-icon">🎬</span>
      <span>Timeline Editor</span>
      <span class="timeline-empty-sub">Select an entity with an AnimationPlayer component</span>`;
    this._rowsContainer.appendChild(empty);
  }

  /**
   * Set the entity and AnimationPlayer to edit
   * @param {import('../../engine/Entity.js').Entity|null} entity
   */
  setEntity(entity) {
    this._stopPreview();
    this.entity = entity;

    if (entity && entity.hasComponent('AnimationPlayer')) {
      this.player = entity.getComponent('AnimationPlayer');
      const clip = this.player.currentClip;
      if (clip) {
        this._clipName.value = clip.name;
        this._btnLoop.classList.toggle('active', clip.loop);
      }
      this._renderTracks();
    } else {
      this.player = null;
      this._showEmpty();
    }
    this._updatePlayhead();
  }

  /**
   * Refresh the track display
   */
  _renderTracks() {
    const clip = this.player?.currentClip;
    if (!clip) { this._showEmpty(); return; }

    this._labelsCol.innerHTML = '';
    this._rowsContainer.innerHTML = '';

    if (clip.tracks.length === 0) {
      const hint = document.createElement('div');
      hint.className = 'timeline-empty';
      hint.innerHTML = `<span class="timeline-empty-sub">Use "+ Add Track" to add properties to animate</span>`;
      this._rowsContainer.appendChild(hint);
      return;
    }

    const totalDuration = Math.max(clip.duration + 1, 3); // At least 3 seconds visible
    const totalWidth = totalDuration * this._pixelsPerSecond;

    for (let ti = 0; ti < clip.tracks.length; ti++) {
      const track = clip.tracks[ti];
      const propInfo = ANIMATABLE_PROPERTIES.find(p => p.path === track.property);
      const label = propInfo ? propInfo.label : track.property;

      // Label
      const labelRow = document.createElement('div');
      labelRow.className = 'timeline-label-row';

      const labelText = document.createElement('span');
      labelText.className = 'timeline-label-text';
      labelText.textContent = label;
      labelRow.appendChild(labelText);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'timeline-label-remove';
      removeBtn.textContent = '✕';
      removeBtn.title = `Remove ${label} track`;
      removeBtn.addEventListener('click', () => {
        clip.removeTrack(track.property);
        this._renderTracks();
        this._emitChanged();
      });
      labelRow.appendChild(removeBtn);

      this._labelsCol.appendChild(labelRow);

      // Keyframe row
      const row = document.createElement('div');
      row.className = 'timeline-kf-row';
      row.style.width = `${totalWidth}px`;

      // Click on row to add keyframe
      row.addEventListener('dblclick', (e) => {
        const rect = row.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const time = Math.round(x / this._pixelsPerSecond * 20) / 20; // Snap to 0.05s
        const currentValue = this.player.getPropertyValue(track.property) ?? 0;
        track.addKeyframe(new Keyframe(time, currentValue));
        this._renderTracks();
        this._emitChanged();
      });

      // Draw keyframe diamonds
      for (let ki = 0; ki < track.keyframes.length; ki++) {
        const kf = track.keyframes[ki];
        const diamond = document.createElement('div');
        diamond.className = 'timeline-diamond';
        const isSelected = this._selectedKf &&
          this._selectedKf.trackIndex === ti &&
          this._selectedKf.keyframeIndex === ki;
        if (isSelected) diamond.classList.add('selected');

        diamond.style.left = `${kf.time * this._pixelsPerSecond - 6}px`;

        diamond.addEventListener('click', (e) => {
          e.stopPropagation();
          this._selectedKf = { trackIndex: ti, keyframeIndex: ki };
          this._renderTracks();
          this._showKfEditor(track, kf, ti, ki);
        });

        // Drag to move keyframe
        diamond.addEventListener('mousedown', (e) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          e.preventDefault();
          const startX = e.clientX;
          const startTime = kf.time;

          const onMove = (me) => {
            const dx = me.clientX - startX;
            const newTime = Math.max(0, Math.round((startTime + dx / this._pixelsPerSecond) * 20) / 20);
            kf.time = newTime;
            track.keyframes.sort((a, b) => a.time - b.time);
            this._renderTracks();
          };

          const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            this._emitChanged();
          };

          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
        });

        row.appendChild(diamond);
      }

      this._rowsContainer.appendChild(row);
    }

    this._drawRuler();
    this._updatePlayhead();
  }

  /**
   * Draw the time ruler
   */
  _drawRuler() {
    const canvas = this._ruler;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = '#1a1a3e';
    ctx.fillRect(0, 0, w, h);

    const pps = this._pixelsPerSecond;
    const offset = this._scrollOffset;

    // Determine tick interval
    let interval = 0.5; // seconds
    if (pps < 100) interval = 1;
    if (pps < 50) interval = 2;
    if (pps > 300) interval = 0.25;

    const startTime = Math.floor(offset / pps / interval) * interval;
    const endTime = (offset + w) / pps + interval;

    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';

    for (let t = startTime; t <= endTime; t += interval) {
      const x = t * pps - offset;
      if (x < -20 || x > w + 20) continue;

      const isWhole = Math.abs(t - Math.round(t)) < 0.001;
      const tickH = isWhole ? 14 : 8;

      ctx.strokeStyle = isWhole ? '#6c63ff80' : '#6c63ff40';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.lineTo(x, h - tickH);
      ctx.stroke();

      if (isWhole) {
        ctx.fillStyle = '#8888cc';
        ctx.fillText(`${t.toFixed(0)}s`, x, 10);
      }
    }

    // Draw playhead marker on ruler
    if (this.player) {
      const px = this.player._time * pps - offset;
      if (px >= -10 && px <= w + 10) {
        ctx.fillStyle = '#ff6b6b';
        ctx.beginPath();
        ctx.moveTo(px - 5, 0);
        ctx.lineTo(px + 5, 0);
        ctx.lineTo(px + 5, 6);
        ctx.lineTo(px, 12);
        ctx.lineTo(px - 5, 6);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  /**
   * Update the playhead line position
   */
  _updatePlayhead() {
    if (!this.player) {
      this._playheadLine.style.display = 'none';
      return;
    }

    this._playheadLine.style.display = 'block';
    const x = this.player._time * this._pixelsPerSecond - this._scrollOffset;
    this._playheadLine.style.left = `${x}px`;

    this._timeDisplay.textContent = `${this.player._time.toFixed(2)}s`;
    this._drawRuler();
  }

  _onRulerMouseDown(e) {
    if (!this.player) return;
    this._draggingPlayhead = true;
    this._scrubTo(e);

    const onMove = (me) => this._scrubTo(me);
    const onUp = () => {
      this._draggingPlayhead = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  _scrubTo(e) {
    if (!this.player) return;
    const rect = this._ruler.getBoundingClientRect();
    const x = e.clientX - rect.left + this._scrollOffset;
    const time = Math.max(0, x / this._pixelsPerSecond);
    this.player.time = time;
    this._updatePlayhead();
  }

  /**
   * Toggle play/stop preview in editor
   */
  _togglePlay() {
    if (this._previewAnimId !== null) {
      this._stopPreview();
    } else {
      this._startPreview();
    }
  }

  _startPreview() {
    if (!this.player?.currentClip) return;
    this.player.captureInitialState();
    this.player.playing = true;
    this._lastPreviewTime = performance.now();
    this._btnPlay.textContent = '⏸';
    this._btnPlay.title = 'Pause';

    const animate = () => {
      const now = performance.now();
      const dt = (now - this._lastPreviewTime) / 1000;
      this._lastPreviewTime = now;

      this.player.update(dt);
      this._updatePlayhead();

      if (this.player.playing) {
        this._previewAnimId = requestAnimationFrame(animate);
      } else {
        this._stopPreview();
      }
    };

    this._previewAnimId = requestAnimationFrame(animate);
  }

  _stopPreview() {
    if (this._previewAnimId !== null) {
      cancelAnimationFrame(this._previewAnimId);
      this._previewAnimId = null;
    }
    if (this.player) {
      this.player.stop();
    }
    this._btnPlay.textContent = '▶';
    this._btnPlay.title = 'Play animation';
    this._updatePlayhead();
  }

  /**
   * Add keyframe at the current playhead position for all tracks
   */
  _addKeyframeAtPlayhead() {
    const clip = this.player?.currentClip;
    if (!clip) return;

    const time = this.player._time;

    for (const track of clip.tracks) {
      const currentValue = this.player.getPropertyValue(track.property) ?? 0;
      track.addKeyframe(new Keyframe(time, currentValue));
    }

    this._renderTracks();
    this._emitChanged();
  }

  /**
   * Delete the currently selected keyframe
   */
  _deleteSelectedKeyframe() {
    if (!this._selectedKf || !this.player?.currentClip) return;

    const clip = this.player.currentClip;
    const track = clip.tracks[this._selectedKf.trackIndex];
    if (track) {
      track.keyframes.splice(this._selectedKf.keyframeIndex, 1);
      this._selectedKf = null;
      this._kfEditor.style.display = 'none';
      this._renderTracks();
      this._emitChanged();
    }
  }

  /**
   * Show the keyframe editor panel
   */
  _showKfEditor(track, kf, trackIndex, kfIndex) {
    this._kfEditor.style.display = 'flex';
    this._kfEditor.innerHTML = '';

    const propInfo = ANIMATABLE_PROPERTIES.find(p => p.path === track.property);
    const label = propInfo ? propInfo.label : track.property;

    // Time
    const timeLabel = document.createElement('label');
    timeLabel.textContent = 'Time:';
    const timeInput = document.createElement('input');
    timeInput.type = 'number';
    timeInput.step = '0.05';
    timeInput.min = '0';
    timeInput.value = kf.time.toFixed(2);
    timeInput.className = 'timeline-kf-input';
    timeInput.addEventListener('change', () => {
      kf.time = Math.max(0, parseFloat(timeInput.value) || 0);
      track.keyframes.sort((a, b) => a.time - b.time);
      this._renderTracks();
      this._emitChanged();
    });

    // Value
    const valueLabel = document.createElement('label');
    valueLabel.textContent = `${label}:`;
    const valueInput = document.createElement('input');
    valueInput.type = 'number';
    valueInput.step = '0.1';
    valueInput.value = kf.value.toFixed(3);
    valueInput.className = 'timeline-kf-input';
    valueInput.addEventListener('change', () => {
      kf.value = parseFloat(valueInput.value) || 0;
      this._emitChanged();
    });

    // Easing
    const easingLabel = document.createElement('label');
    easingLabel.textContent = 'Easing:';
    const easingSelect = document.createElement('select');
    easingSelect.className = 'timeline-kf-input';
    for (const name of Object.keys(EASINGS)) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      if (name === kf.easing) opt.selected = true;
      easingSelect.appendChild(opt);
    }
    easingSelect.addEventListener('change', () => {
      kf.easing = easingSelect.value;
      this._emitChanged();
    });

    this._kfEditor.appendChild(timeLabel);
    this._kfEditor.appendChild(timeInput);
    this._kfEditor.appendChild(valueLabel);
    this._kfEditor.appendChild(valueInput);
    this._kfEditor.appendChild(easingLabel);
    this._kfEditor.appendChild(easingSelect);
  }

  _emitChanged() {
    if (this.onChanged) this.onChanged();
  }

  dispose() {
    this._stopPreview();
    if (this._ro) this._ro.disconnect();
  }
}
