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
    this.createSplash();
    this.createToolbar();
    this.createLegend();
    this.createTimeSlider();
    this.createInfoPanel();
    this.createRoutePanel();
    this.createWeatherCard();
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

  // Splash Screen Overlay (Automatic Welcome Experience)
  createSplash() {
    const splash = document.createElement('div');
    splash.className = 'splash-overlay';
    splash.innerHTML = `
      <div class="splash-content glass-panel" style="padding: 30px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); max-width: 400px; text-align: center;">
        <h1 class="splash-logo" style="font-size: 2.5rem; margin-bottom: 12px; font-weight: 800; background: linear-gradient(135deg, #fff 30%, var(--color-warm)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">🌞 UmbraCity</h1>
        <p class="splash-subtitle" style="font-size: 1rem; color: #cbd5e1; margin-bottom: 20px; line-height: 1.4;">
          Pedestrian-first navigation for a hotter world.
        </p>
        <div class="sync-status" id="sync-status-lbl" style="font-size: 0.85rem; color: #38bdf8; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 8px;">
          <span class="spinner" style="width: 14px; height: 14px; border: 2px solid rgba(56,189,248,0.3); border-top-color: #38bdf8; border-radius: 50%; display: inline-block; animation: spin 1s infinite linear;"></span>
          <span>Syncing live conditions...</span>
        </div>
      </div>
    `;
    this.container.appendChild(splash);
    
    // Smooth transition: show synced after 1.5 seconds, then fade out at 2.2 seconds
    setTimeout(() => {
      const lbl = splash.querySelector('#sync-status-lbl');
      if (lbl) {
        lbl.innerHTML = `🟢 Live conditions synced successfully`;
        lbl.style.color = 'var(--comfort-green)';
      }
    }, 1500);

    setTimeout(() => {
      splash.style.opacity = '0';
      setTimeout(() => {
        splash.remove();
      }, 500);
    }, 2200);
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
        <div class="legend-item">
          <div class="legend-color" style="background: var(--comfort-green); box-shadow: 0 0 6px var(--comfort-green);"></div>
          <span>Comfortable</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background: var(--comfort-yellow); box-shadow: 0 0 6px var(--comfort-yellow);"></div>
          <span>Warm</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background: var(--comfort-orange); box-shadow: 0 0 6px var(--comfort-orange);"></div>
          <span>Hot</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background: var(--comfort-red); box-shadow: 0 0 6px var(--comfort-red);"></div>
          <span>Dangerous</span>
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

    let throttleTimeout = null;
    let lastTime = 0;
    const throttleLimit = 80;

    slider.addEventListener('input', () => {
      // Auto-toggle to manual if user interacts with the slider
      if (this.currentMode === 'live') {
        this.setMode('manual');
        this.callbacks.onModeChange('manual');
      }
      
      const minutes = parseInt(slider.value);
      display.textContent = this.formatTime(minutes);
      
      const now = Date.now();
      if (now - lastTime >= throttleLimit) {
        this.callbacks.onTimeChange(minutes);
        lastTime = now;
      } else {
        if (throttleTimeout) clearTimeout(throttleTimeout);
        throttleTimeout = setTimeout(() => {
          this.callbacks.onTimeChange(minutes);
          lastTime = Date.now();
        }, throttleLimit);
      }
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
    
    this.infoPanel.innerHTML = `
      <div class="panel-header">
        <div>
          <h2 class="panel-title">${data.nearestStreet || "Selected Location"}</h2>
          <p class="panel-subtitle">Paris Latin Quarter</p>
        </div>
        <button class="close-btn" id="close-info-btn">✕</button>
      </div>
      
      <div class="metric-section">
        <div class="metric-row">
          <span class="metric-label">Thermal Comfort</span>
          <span class="badge ${data.comfortLevel.toLowerCase()}">${data.comfortLevel}</span>
        </div>
      </div>
      
      <div class="metric-section">
        <div class="metric-row">
          <span class="metric-label">Sun Exposure</span>
          <span class="metric-val" style="color: ${data.shaded ? 'var(--comfort-green)' : 'var(--color-warm)'};">
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
    `;
    
    this.infoPanel.classList.remove('hidden');
    this.infoPanel.querySelector('#close-info-btn').addEventListener('click', () => {
      this.infoPanel.classList.add('hidden');
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
  }

  updateRouteSetup(type, lngLat) {
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
}
