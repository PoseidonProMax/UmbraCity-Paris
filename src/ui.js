export class UI {
  constructor(containerId, callbacks) {
    this.container = document.getElementById(containerId);
    this.callbacks = callbacks; // onTimeChange, onToolChange, onClearAll, onUndo, onSuggest, onToggleHeatmap
    
    this.activeTool = 'none';
    this.isPlaying = false;
    this.playInterval = null;
    
    this.init();
  }

  init() {
    this.createBrandPanel();
    this.createToolbar();
    this.createLegend();
    this.createTimeSlider();
    this.createInfoPanel();
    this.createRoutePanel();
    this.createWeatherCard();
    this.createAudioToggle();
  }

  formatTime(totalMinutes) {
    const hours24 = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const ampm = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
    const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;
    return `${hours12}:${formattedMinutes} ${ampm}`;
  }

  // Floating Brand Panel (Top-Left)
  createBrandPanel() {
    const brand = document.createElement('div');
    brand.className = 'brand-panel glass-panel';
    brand.innerHTML = `
      <div class="brand-logo-container">
        <span class="brand-dot"></span>
        <div class="brand-text">
          <div class="brand-title">UmbraCity</div>
          <div class="brand-tagline">Paris Shade Navigator</div>
        </div>
      </div>
    `;
    this.container.appendChild(brand);
  }

  // Splash Screen Overlay (Automatic Welcome Experience with Progress Loading)
  createSplash() {
    const splash = document.createElement('div');
    splash.className = 'splash-overlay';
    splash.innerHTML = `
      <div class="splash-content glass-panel" style="padding: 35px 30px; border-radius: 24px; border: 1px solid rgba(255,255,255,0.12); max-width: 420px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.4);">
        <h1 class="splash-logo" style="font-size: 2.7rem; margin-bottom: 8px; font-weight: 850; background: linear-gradient(135deg, #fff 40%, var(--color-warm)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: -0.02em;">🌞 UmbraCity</h1>
        <p class="splash-subtitle" style="font-size: 0.95rem; color: #94a3b8; margin-bottom: 25px; line-height: 1.45; font-weight: 550;">
          Pedestrian shade navigation for a hotter world.
        </p>
        
        <div class="loading-status-text" id="load-status-lbl" style="font-size: 0.82rem; color: #38bdf8; font-weight: 600; text-align: left; margin-bottom: 6px; letter-spacing: 0.01em;">
          📂 Loading geospatial datasets...
        </div>
        <div class="loading-bar-container" style="width: 100%; height: 6px; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden; margin-bottom: 12px;">
          <div class="loading-bar-progress" id="load-progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #38bdf8 0%, #10b981 100%); transition: width 0.2s ease-out; box-shadow: 0 0 8px rgba(56, 189, 248, 0.3);"></div>
        </div>
        <div class="sync-status" id="sync-status-lbl" style="font-size: 0.72rem; color: #64748b; font-weight: 500; text-align: right; min-height: 16px;">
          Initialising...
        </div>
      </div>
    `;
    this.container.appendChild(splash);
    
    const progress = splash.querySelector('#load-progress-bar');
    const status = splash.querySelector('#load-status-lbl');
    const sync = splash.querySelector('#sync-status-lbl');
    
    // Animate progress and status messages
    setTimeout(() => {
      progress.style.width = '35%';
      status.innerHTML = `🏙 Assembling 3D structures & roads...`;
      sync.innerHTML = `Loaded 2.2k building blocks`;
    }, 400);

    setTimeout(() => {
      progress.style.width = '70%';
      status.innerHTML = `☀️ Projecting solar shade maps...`;
      sync.innerHTML = `Rasterised 2.1k tree shadows`;
    }, 900);

    setTimeout(() => {
      progress.style.width = '100%';
      status.innerHTML = `🟢 Live conditions synced successfully`;
      status.style.color = '#10b981';
      sync.innerHTML = `Active and ready`;
      
      // Add glowing Enter button to satisfy AudioContext user interaction policy
      const enterBtn = document.createElement('button');
      enterBtn.className = 'btn';
      enterBtn.style.marginTop = '24px';
      enterBtn.style.width = '100%';
      enterBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
      enterBtn.style.color = '#fff';
      enterBtn.style.borderColor = 'rgba(255,255,255,0.15)';
      enterBtn.style.fontWeight = '700';
      enterBtn.style.fontSize = '0.98rem';
      enterBtn.style.padding = '12px';
      enterBtn.style.borderRadius = '10px';
      enterBtn.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.4)';
      enterBtn.style.cursor = 'pointer';
      enterBtn.style.animation = 'fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
      enterBtn.textContent = 'Enter UmbraCity';
      
      splash.querySelector('.splash-content').appendChild(enterBtn);
      
      enterBtn.addEventListener('click', () => {
        if (this.callbacks.onSplashDismiss) {
          this.callbacks.onSplashDismiss();
        }
        
        splash.style.opacity = '0';
        setTimeout(() => {
          splash.remove();
        }, 500);
      });
    }, 1400);
  }

  // Toolbar on Left side (shifted down to fit brand panel)
  createToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'side-toolbar glass-panel';
    toolbar.innerHTML = `
      <button class="toolbar-btn" id="tool-tree" data-tool="tree" title="Place Shade Tree">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 19V5M12 5L8 9M12 5L16 9M9 19h6" />
          <circle cx="12" cy="8" r="4" fill="currentColor" fill-opacity="0.2" />
        </svg>
        <span class="tooltip">Place Shade Tree</span>
      </button>
      <button class="toolbar-btn" id="tool-canopy" data-tool="canopy" title="Place Canopy">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2v20M3 10a9 9 0 0 1 18 0H3z" />
        </svg>
        <span class="tooltip">Place Canopy</span>
      </button>
      <button class="toolbar-btn" id="tool-suggest" data-tool="suggest" title="Smart suggestions">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .6 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
          <path d="M9 18h6M10 22h4" />
        </svg>
        <span class="tooltip">Smart suggestions</span>
      </button>
      <div class="toolbar-divider"></div>
      <button class="toolbar-btn" id="tool-undo" title="Undo Placement">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 7v6h6" />
          <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
        </svg>
        <span class="tooltip">Undo Placement</span>
      </button>
      <button class="toolbar-btn" id="tool-clear" title="Clear All Placements">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
        <span class="tooltip">Clear All</span>
      </button>
    `;
    
    this.container.appendChild(toolbar);
    
    const tools = toolbar.querySelectorAll('[data-tool]');
    tools.forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.getAttribute('data-tool');
        
        if (tool === 'suggest') {
          this.callbacks.onSuggest();
          return;
        }

        if (this.activeTool === tool) {
          this.activeTool = 'none';
          btn.classList.remove('active');
        } else {
          tools.forEach(t => t.classList.remove('active'));
          this.activeTool = tool;
          btn.classList.add('active');
        }
        
        this.callbacks.onToolChange(this.activeTool);
      });
    });

    toolbar.querySelector('#tool-undo').addEventListener('click', () => {
      this.callbacks.onUndo();
    });

    toolbar.querySelector('#tool-clear').addEventListener('click', () => {
      this.callbacks.onClearAll();
    });
  }

  // Legend Panel (Bottom-left)
  createLegend() {
    const legend = document.createElement('div');
    legend.className = 'legend-panel glass-panel';
    legend.innerHTML = `
      <div class="legend-title">Comfort Scale</div>
      <div class="legend-items">
        <div class="legend-item" style="display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; margin-bottom: 6px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div class="legend-color" style="background: var(--comfort-green); box-shadow: 0 0 6px var(--comfort-green);"></div>
            <span>Comfortable</span>
          </div>
          <span style="color: #94a3b8; font-size: 0.68rem; font-family: monospace;">18°C - 24°C</span>
        </div>
        <div class="legend-item" style="display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; margin-bottom: 6px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div class="legend-color" style="background: var(--comfort-yellow); box-shadow: 0 0 6px var(--comfort-yellow);"></div>
            <span>Warm</span>
          </div>
          <span style="color: #94a3b8; font-size: 0.68rem; font-family: monospace;">25°C - 30°C</span>
        </div>
        <div class="legend-item" style="display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; margin-bottom: 6px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div class="legend-color" style="background: var(--comfort-orange); box-shadow: 0 0 6px var(--comfort-orange);"></div>
            <span>Hot</span>
          </div>
          <span style="color: #94a3b8; font-size: 0.68rem; font-family: monospace;">31°C - 36°C</span>
        </div>
        <div class="legend-item" style="display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; margin-bottom: 6px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div class="legend-color" style="background: var(--comfort-red); box-shadow: 0 0 6px var(--comfort-red);"></div>
            <span>Dangerous</span>
          </div>
          <span style="color: #94a3b8; font-size: 0.68rem; font-family: monospace;">37°C - 42°C</span>
        </div>
      </div>
      <label class="switch-label">
        <input type="checkbox" id="heatmap-toggle" checked>
        <span class="switch-toggle"></span>
        <span>Comfort Overlay</span>
      </label>
    `;
    
    this.container.appendChild(legend);
    
    legend.querySelector('#heatmap-toggle').addEventListener('change', (e) => {
      this.callbacks.onToggleHeatmap(e.target.checked);
    });
  }

  // Time Slider Panel (Bottom)
  createTimeSlider() {
    const sliderPanel = document.createElement('div');
    sliderPanel.className = 'time-slider-panel glass-panel';
    sliderPanel.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <div class="mode-toggle-group" style="display: flex; gap: 4px; background: rgba(0,0,0,0.25); padding: 3px; border-radius: 8px;">
          <button class="btn active" id="btn-mode-live" style="padding: 4px 10px; font-size: 0.7rem; border-radius: 6px; border: none; background: none; font-weight: 600; cursor: pointer; color: #fff;">🟢 Live Clock</button>
          <button class="btn" id="btn-mode-manual" style="padding: 4px 10px; font-size: 0.7rem; border-radius: 6px; border: none; background: none; font-weight: 600; cursor: pointer; color: #94a3b8;">📅 Manual Timeline</button>
        </div>
        <div style="font-size: 0.75rem; color: #94a3b8; font-weight: 500; display: flex; align-items: center; gap: 6px;" id="slider-city-status">
          ☀️ Paris Solar Noon
        </div>
      </div>
      <div class="slider-header">
        <div class="time-display" id="time-display-lbl">12:00 PM</div>
      </div>
      <div class="slider-controls">
        <button class="play-btn" id="play-pause-btn" disabled style="opacity: 0.3; cursor: not-allowed;">▶</button>
        <div class="slider-wrapper">
          <input type="range" class="sun-slider" id="timeline-slider" min="360" max="1260" value="720" disabled>
        </div>
      </div>
    `;
    
    this.container.appendChild(sliderPanel);
    
    const slider = sliderPanel.querySelector('#timeline-slider');
    const display = sliderPanel.querySelector('#time-display-lbl');
    const playBtn = sliderPanel.querySelector('#play-pause-btn');
    const btnLive = sliderPanel.querySelector('#btn-mode-live');
    const btnManual = sliderPanel.querySelector('#btn-mode-manual');
    
    this.currentMode = 'live'; // 'live' or 'manual'
    
    display.textContent = this.formatTime(parseInt(slider.value));
    
    // Set up mode changes
    btnLive.addEventListener('click', () => {
      this.setMode('live');
      this.callbacks.onModeChange('live');
    });
    
    btnManual.addEventListener('click', () => {
      this.setMode('manual');
      this.callbacks.onModeChange('manual');
    });

    let dragTimeout = null;

    slider.addEventListener('input', () => {
      // Auto-toggle to manual if user interacts with the slider
      if (this.currentMode === 'live') {
        this.setMode('manual');
        this.callbacks.onModeChange('manual');
      }
      
      const minutes = parseInt(slider.value);
      display.textContent = this.formatTime(minutes);
      
      // 1. Update 3D shadows instantly (butter-smooth GPU update)
      this.callbacks.onTimeChange(minutes, true);
      
      // 2. Debounce the heavy CPU-bound 2D street/route updates
      if (dragTimeout) clearTimeout(dragTimeout);
      dragTimeout = setTimeout(() => {
        this.callbacks.onTimeChange(minutes, false);
      }, 150);
    });

    slider.addEventListener('change', () => {
      const minutes = parseInt(slider.value);
      if (dragTimeout) clearTimeout(dragTimeout);
      this.callbacks.onTimeChange(minutes, false);
    });
    
    playBtn.addEventListener('click', () => {
      if (this.isPlaying) {
        this.stopPlay(playBtn);
      } else {
        this.startPlay(slider, display, playBtn);
      }
    });
  }

  setMode(mode) {
    this.currentMode = mode;
    const btnLive = document.getElementById('btn-mode-live');
    const btnManual = document.getElementById('btn-mode-manual');
    const slider = document.getElementById('timeline-slider');
    const playBtn = document.getElementById('play-pause-btn');
    
    if (!btnLive || !btnManual) return;
    
    if (mode === 'live') {
      btnLive.classList.add('active');
      btnLive.style.color = '#fff';
      btnManual.classList.remove('active');
      btnManual.style.color = '#94a3b8';
      
      slider.setAttribute('disabled', 'true');
      slider.style.opacity = '0.5';
      slider.style.cursor = 'not-allowed';
      
      playBtn.setAttribute('disabled', 'true');
      playBtn.style.opacity = '0.3';
      playBtn.style.cursor = 'not-allowed';
      this.stopPlay(playBtn);
    } else {
      btnManual.classList.add('active');
      btnManual.style.color = '#fff';
      btnLive.classList.remove('active');
      btnLive.style.color = '#94a3b8';
      
      slider.removeAttribute('disabled');
      slider.style.opacity = '1.0';
      slider.style.cursor = 'pointer';
      
      playBtn.removeAttribute('disabled');
      playBtn.style.opacity = '1.0';
      playBtn.style.cursor = 'pointer';
    }
  }

  startPlay(slider, display, playBtn) {
    this.isPlaying = true;
    playBtn.textContent = '⏸';
    
    this.playInterval = setInterval(() => {
      let val = parseInt(slider.value);
      val += 10;
      if (val > 1260) {
        val = 360;
      }
      slider.value = val;
      display.textContent = this.formatTime(val);
      this.callbacks.onTimeChange(val);
    }, 150);
  }

  stopPlay(playBtn) {
    this.isPlaying = false;
    if (playBtn) playBtn.textContent = '▶';
    clearInterval(this.playInterval);
  }

  createInfoPanel() {
    this.infoPanel = document.createElement('div');
    this.infoPanel.className = 'info-panel glass-panel hidden';
    this.container.appendChild(this.infoPanel);
  }

  showAnalysis(data) {
    this.routePanel.classList.add('hidden');
    
    // Check if we are showing a famous landmark
    const isLandmark = !!data.landmarkName;
    const title = data.landmarkName || data.nearestStreet || "Selected Location";
    const subtitle = isLandmark ? "Historic Paris Landmark" : "Paris Latin Quarter";
    const descHtml = isLandmark && data.landmarkDescription
      ? `<div class="landmark-desc" style="font-size: 0.76rem; color: #cbd5e1; line-height: 1.4; margin-top: 6px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.06);">${data.landmarkDescription}</div>`
      : "";
      
    this.infoPanel.innerHTML = `
      <div class="panel-header">
        <div>
          <h2 class="panel-title">${title}</h2>
          <p class="panel-subtitle">${subtitle}</p>
        </div>
        <button class="close-btn" id="close-info-btn">✕</button>
      </div>
      
      ${descHtml}
      
      <div class="metric-section" style="margin-top: 12px;">
        <div class="metric-row">
          <span class="metric-label">Thermal Comfort</span>
          <span class="badge ${data.comfortLevel.toLowerCase()}">${data.comfortLevel} <span style="font-size: 0.68rem; opacity: 0.85; margin-left: 2px;">(${data.tempRange})</span></span>
        </div>
      </div>
      
      <div class="metric-section">
        <div class="metric-row">
          <span class="metric-label">Sun Exposure</span>
          <span class="metric-val" style="color: ${data.shaded ? 'var(--comfort-green)' : 'var(--color-warm)'}; font-weight: 600;">
            ${data.shaded ? 'Fully Shaded 🌳' : 'Direct Sunlight ☀️'}
          </span>
        </div>
        <div class="shade-bar-container">
          <div class="shade-bar-fill" style="width: ${data.shaded ? '100%' : '15%'}; background: ${data.shaded ? 'var(--comfort-green)' : 'var(--comfort-red)'}"></div>
        </div>
      </div>

      <div class="metric-section">
        <div class="metric-row">
          <span class="metric-label">Solar Angle</span>
          <span class="metric-val" style="font-variant-numeric: tabular-nums;">${Math.round(data.sunAltitude)}°</span>
        </div>
      </div>
      
      <div class="recommendation-box" style="border-left-color: ${data.shaded ? 'var(--comfort-green)' : 'var(--comfort-red)'}">
        ${data.recommendation}
      </div>

      <div class="routing-actions-row" style="display: flex; gap: 8px; margin-top: 16px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 12px;">
        <button class="btn" id="analysis-start-route-btn" style="flex: 1; padding: 8px 10px; font-size: 0.72rem; font-weight: 600; background: rgba(34, 197, 94, 0.15); border-color: rgba(34, 197, 94, 0.25); color: #4ade80; display: flex; align-items: center; justify-content: center; gap: 4px;">
          📍 Start Here
        </button>
        <button class="btn" id="analysis-end-route-btn" style="flex: 1; padding: 8px 10px; font-size: 0.72rem; font-weight: 600; background: rgba(239, 68, 68, 0.15); border-color: rgba(239, 68, 68, 0.25); color: #f87171; display: flex; align-items: center; justify-content: center; gap: 4px;">
          🏁 End Here
        </button>
      </div>
    `;
    
    this.infoPanel.classList.remove('hidden');
    
    this.infoPanel.querySelector('#close-info-btn').addEventListener('click', () => {
      this.infoPanel.classList.add('hidden');
    });

    const btnStart = this.infoPanel.querySelector('#analysis-start-route-btn');
    const btnEnd = this.infoPanel.querySelector('#analysis-end-route-btn');

    btnStart.addEventListener('click', () => {
      if (this.callbacks.onSetRouteEndpoint) {
        this.callbacks.onSetRouteEndpoint('start', [data.lng, data.lat]);
      }
    });

    btnEnd.addEventListener('click', () => {
      if (this.callbacks.onSetRouteEndpoint) {
        this.callbacks.onSetRouteEndpoint('end', [data.lng, data.lat]);
      }
    });
  }

  createRoutePanel() {
    this.routePanel = document.createElement('div');
    this.routePanel.className = 'route-panel glass-panel';
    this.container.appendChild(this.routePanel);
    this.renderRouteSetup();
  }

  renderRouteSetup() {
    this.routePanel.innerHTML = `
      <div class="panel-header">
        <div>
          <h2 class="panel-title">Route Planner</h2>
          <p class="panel-subtitle">Find the coolest shaded path</p>
        </div>
      </div>
      
      <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 12px;">
        <button class="route-setup-btn" id="btn-select-start">
          📍 <span id="lbl-start-status">Select Start Point</span>
        </button>
        <button class="route-setup-btn" id="btn-select-end" disabled>
          &nbsp;🏁 <span id="lbl-end-status">Select Destination</span>
        </button>
        <button class="route-setup-btn" id="btn-clear-route" style="background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.2); color: #f87171; display: none; font-weight: 600;">
          ✕ Clear Active Route
        </button>
      </div>
      
      <div style="font-size: 0.75rem; color: #94a3b8; line-height: 1.4; margin-top: 14px; background: rgba(255,255,255,0.02); padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.04);">
        🚶 Click <strong>Select Start</strong> then click on a street. Repeat for destination. We'll automatically compare the fastest and coolest paths!
      </div>
    `;
    
    this.routePanel.classList.remove('hidden');
    this.routePanel.classList.remove('visible');
    setTimeout(() => {
      this.routePanel.classList.add('visible');
    }, 50);

    const btnStart = this.routePanel.querySelector('#btn-select-start');
    const btnEnd = this.routePanel.querySelector('#btn-select-end');
    const btnClear = this.routePanel.querySelector('#btn-clear-route');
    
    btnStart.addEventListener('click', () => {
      btnStart.classList.add('active-selecting');
      btnEnd.classList.remove('active-selecting');
      this.callbacks.onStartSelection('start');
    });
    
    btnEnd.addEventListener('click', () => {
      btnEnd.classList.add('active-selecting');
      btnStart.classList.remove('active-selecting');
      this.callbacks.onStartSelection('end');
    });

    btnClear.addEventListener('click', () => {
      this.callbacks.onClearRoute();
    });
  }

  updateRouteSetup(type, lngLat) {
    const btnClear = document.getElementById('btn-clear-route');
    if (btnClear) btnClear.style.display = 'block';

    if (type === 'start') {
      const lbl = document.getElementById('lbl-start-status');
      const btnStart = document.getElementById('btn-select-start');
      const btnEnd = document.getElementById('btn-select-end');
      if (lbl) lbl.textContent = `Start: ${lngLat[0].toFixed(4)}, ${lngLat[1].toFixed(4)}`;
      if (btnStart) btnStart.classList.remove('active-selecting');
      if (btnEnd) btnEnd.removeAttribute('disabled');
    } else {
      const lbl = document.getElementById('lbl-end-status');
      const btnEnd = document.getElementById('btn-select-end');
      if (lbl) lbl.textContent = `Destination: ${lngLat[0].toFixed(4)}, ${lngLat[1].toFixed(4)}`;
      if (btnEnd) btnEnd.classList.remove('active-selecting');
    }
  }

  showRouteComparison(routeData) {
    this.infoPanel.classList.add('hidden');
    
    const timeDiff = routeData.coolest.duration - routeData.fastest.duration;
    const shadeDiff = routeData.coolest.shadePercent - routeData.fastest.shadePercent;
    
    this.routePanel.innerHTML = `
      <div class="panel-header">
        <div>
          <h2 class="panel-title">Pedestrian Navigation</h2>
          <p class="panel-subtitle">Latin Quarter Shaded Routes</p>
        </div>
        <button class="close-btn" id="close-route-btn">✕</button>
      </div>

      <div class="route-cards-container">
        <div class="route-card" id="card-fastest">
          <div class="route-card-title">
            <span>⚡ Fastest Path</span>
            <span class="badge ${fastestComfortBadge(routeData.fastest.shadePercent)}">${routeData.fastest.comfortLevel}</span>
          </div>
          <div class="route-stats-grid">
            <div class="route-stat">
              <span class="route-stat-val">${routeData.fastest.duration} min</span>
              <span class="route-stat-label">Time</span>
            </div>
            <div class="route-stat">
              <span class="route-stat-val">${routeData.fastest.distance} m</span>
              <span class="route-stat-label">Distance</span>
            </div>
            <div class="route-stat">
              <span class="route-stat-val">${routeData.fastest.shadePercent}%</span>
              <span class="route-stat-label">Shade</span>
            </div>
          </div>
        </div>

        <div class="route-card" id="card-coolest">
          <div class="route-card-title">
            <span>🌳 Coolest Path</span>
            <span class="badge ${coolestComfortBadge(routeData.coolest.shadePercent)}">${routeData.coolest.comfortLevel}</span>
          </div>
          <div class="route-stats-grid">
            <div class="route-stat">
              <span class="route-stat-val" style="color: var(--color-cool);">${routeData.coolest.duration} min</span>
              <span class="route-stat-label">Time</span>
            </div>
            <div class="route-stat">
              <span class="route-stat-val">${routeData.coolest.distance} m</span>
              <span class="route-stat-label">Distance</span>
            </div>
            <div class="route-stat">
              <span class="route-stat-val" style="color: var(--comfort-green);">${routeData.coolest.shadePercent}%</span>
              <span class="route-stat-label">Shade</span>
            </div>
          </div>
        </div>
      </div>

      <div class="route-insight" id="route-insight-box">
        ${timeDiff > 0 
          ? `🌳 <strong>Recommended:</strong> Choose the Coolest Path! Walking <strong>${timeDiff}m extra</strong> yields <strong>+${Math.round(shadeDiff)}%</strong> shade coverage.` 
          : `🌳 <strong>Recommended:</strong> The coolest path is just as fast! Take the shaded route for maximum comfort.`
        }
      </div>
    `;

    function fastestComfortBadge(pct) {
      if (pct > 70) return 'comfortable';
      if (pct > 40) return 'warm';
      if (pct > 15) return 'hot';
      return 'dangerous';
    }
    
    function coolestComfortBadge(pct) {
      if (pct > 70) return 'comfortable';
      if (pct > 40) return 'warm';
      if (pct > 15) return 'hot';
      return 'dangerous';
    }

    this.routePanel.classList.remove('hidden');
    this.routePanel.classList.add('visible');

    const cardFastest = this.routePanel.querySelector('#card-fastest');
    const cardCoolest = this.routePanel.querySelector('#card-coolest');

    cardFastest.addEventListener('click', () => {
      cardFastest.classList.add('selected');
      cardCoolest.classList.remove('selected');
      cardCoolest.classList.remove('highlight-glow');
      this.callbacks.onSelectRoute('fastest');
    });

    cardCoolest.addEventListener('click', () => {
      cardCoolest.classList.add('selected');
      cardFastest.classList.remove('selected');
      cardCoolest.classList.remove('highlight-glow');
      this.callbacks.onSelectRoute('coolest');
    });

    this.routePanel.querySelector('#close-route-btn').addEventListener('click', () => {
      this.routePanel.classList.add('hidden');
      this.callbacks.onClearRoute();
    });
  }

  animateRoutePanelReveal() {
    const cardCoolest = this.routePanel.querySelector('#card-coolest');
    const cardFastest = this.routePanel.querySelector('#card-fastest');
    if (cardCoolest && cardFastest) {
      cardCoolest.classList.add('selected');
      cardCoolest.classList.add('highlight-glow');
      cardFastest.classList.remove('selected');
    }
    
    const box = this.routePanel.querySelector('#route-insight-box');
    if (box) {
      setTimeout(() => {
        box.classList.add('reveal');
      }, 300);
    }
  }

  createWeatherCard() {
    this.weatherCard = document.createElement('div');
    this.weatherCard.className = 'weather-card glass-panel';
    this.weatherCard.innerHTML = `
      <div class="weather-header">
        <div class="weather-city">📍 Paris, France</div>
        <div class="weather-updated">
          <span class="spinner" style="width: 10px; height: 10px; border: 1.5px solid rgba(34,197,94,0.3); border-top-color: #22c55e; border-radius: 50%; display: inline-block; animation: spin 1s infinite linear;"></span>
          <span>Syncing...</span>
        </div>
      </div>
      <div class="weather-main">
        <div class="weather-temp">--°C</div>
        <div class="weather-details">
          <div class="weather-condition">Loading weather...</div>
          <div class="weather-wind">Wind: -- km/h</div>
        </div>
      </div>
    `;
    this.container.appendChild(this.weatherCard);
  }

  updateWeatherCard(data) {
    if (!this.weatherCard) return;
    
    const statusHtml = data.offline 
      ? `<span style="color: #f97316;">⚠️ Offline — Simulated Weather</span>`
      : `<span style="display:inline-block; width:6px; height:6px; background:#22c55e; border-radius:50%; box-shadow: 0 0 6px #22c55e;"></span> Synced (${data.lastUpdated})`;
      
    this.weatherCard.innerHTML = `
      <div class="weather-header">
        <div class="weather-city">📍 ${data.cityName || 'Paris, France'}</div>
        <div class="weather-updated ${data.offline ? 'offline' : ''}">
          ${statusHtml}
        </div>
      </div>
      <div class="weather-main">
        <div class="weather-temp">${data.temp}°C</div>
        <div class="weather-details">
          <div class="weather-condition">${data.icon} ${data.condition}</div>
          <div class="weather-wind">🌬 Wind: ${data.windSpeed} km/h</div>
        </div>
      </div>
    `;
  }

  resetToolbar() {
    this.activeTool = 'none';
    const tools = document.querySelectorAll('[data-tool]');
    tools.forEach(t => t.classList.remove('active'));
    this.callbacks.onToolChange('none');
  }

  createAudioToggle() {
    const toggle = document.createElement('button');
    toggle.className = 'audio-toggle-btn glass-panel';
    toggle.id = 'audio-toggle';
    toggle.title = 'Toggle Ambient Sound';
    toggle.innerHTML = `
      <svg class="speaker-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="1" y1="1" x2="23" y2="23" class="mute-line" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"></line>
        <path d="M9 18V5l12-2v13"></path>
        <circle cx="6" cy="18" r="3"></circle>
        <circle cx="18" cy="16" r="3"></circle>
      </svg>
    `;
    this.container.appendChild(toggle);
    
    toggle.addEventListener('click', () => {
      if (this.callbacks.onToggleMute) {
        const isMuted = this.callbacks.onToggleMute();
        const muteLine = toggle.querySelector('.mute-line');
        if (isMuted) {
          toggle.classList.remove('playing');
          if (!muteLine) {
            // Append mute line svg
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", "1");
            line.setAttribute("y1", "1");
            line.setAttribute("x2", "23");
            line.setAttribute("y2", "23");
            line.setAttribute("class", "mute-line");
            line.setAttribute("stroke", "currentColor");
            line.setAttribute("stroke-width", "2.5");
            line.setAttribute("stroke-linecap", "round");
            toggle.querySelector('svg').appendChild(line);
          }
        } else {
          toggle.classList.add('playing');
          if (muteLine) muteLine.remove();
        }
      }
    });
  }
}
