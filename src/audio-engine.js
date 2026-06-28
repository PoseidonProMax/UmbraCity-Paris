// Procedural Ambient Audio Engine using Web Audio API (Offline & zero dependencies)
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.padOscillators = [];
    this.padFilter = null;
    this.lfo = null;
    this.delayNode = null;
    this.chimeTimeout = null;
    this.isMuted = true; // Start muted to satisfy browser autoplay policies
    this.isPlaying = false;
  }

  init() {
    if (this.ctx) return;
    
    // Create audio context
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContextClass();
    
    // Master Gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime); // start silent
    this.masterGain.connect(this.ctx.destination);

    // Feedback Delay Line (adds huge spaciousness to chimes & pad)
    this.delayNode = this.ctx.createDelay(2.0);
    this.delayNode.delayTime.setValueAtTime(0.6, this.ctx.currentTime);
    
    const delayFeedback = this.ctx.createGain();
    delayFeedback.gain.setValueAtTime(0.42, this.ctx.currentTime);
    
    this.delayNode.connect(delayFeedback);
    delayFeedback.connect(this.delayNode); // feedback loop
    this.delayNode.connect(this.masterGain);

    // Evolving low-pass filter for the pad synth
    this.padFilter = this.ctx.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.frequency.setValueAtTime(320, this.ctx.currentTime);
    this.padFilter.Q.setValueAtTime(2.0, this.ctx.currentTime);
    this.padFilter.connect(this.masterGain);
    this.padFilter.connect(this.delayNode);

    // Slow moving LFO to modulate filter cutoff (simulating natural wind movement)
    this.lfo = this.ctx.createOscillator();
    this.lfo.type = 'sine';
    this.lfo.frequency.setValueAtTime(0.08, this.ctx.currentTime); // 12-second cycle
    
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(150, this.ctx.currentTime); // modulate up to 150Hz
    
    this.lfo.connect(lfoGain);
    lfoGain.connect(this.padFilter.frequency);
    this.lfo.start();

    // Spawn oscillators for evolving pad chord (C Major 7th/9th chord)
    // C3 (130.81), G3 (196.00), C4 (261.63), E4 (329.63), B4 (493.88)
    const chordFreqs = [130.81, 196.00, 261.63, 329.63, 493.88];
    chordFreqs.forEach((freq, index) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle'; // warm, soft harmonic profile
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      
      const oscGain = this.ctx.createGain();
      // Give different volumes and slow LFO-like drifts
      const baseVolume = index === 0 ? 0.15 : 0.08;
      oscGain.gain.setValueAtTime(baseVolume, this.ctx.currentTime);
      
      osc.connect(oscGain);
      oscGain.connect(this.padFilter);
      osc.start();
      
      this.padOscillators.push({ osc, oscGain });
    });
    
    this.isPlaying = true;
    
    // Start the randomized bell chimes scheduler
    this.scheduleChime();
  }

  // Plays a randomized sparkling bell note
  playChime() {
    if (!this.ctx || this.ctx.state === 'suspended' || this.isMuted) return;

    // Pentatonic scale chime frequencies: C5, E5, G5, A5, C6, E6
    const chimeFreqs = [523.25, 659.25, 783.99, 880.00, 1046.50, 1318.51];
    const freq = chimeFreqs[Math.floor(Math.random() * chimeFreqs.length)];
    
    const chimeOsc = this.ctx.createOscillator();
    chimeOsc.type = 'sine'; // pure bell tone
    chimeOsc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    
    const chimeGain = this.ctx.createGain();
    chimeGain.gain.setValueAtTime(0, this.ctx.currentTime);
    
    // Connect to master and the feedback delay line
    chimeOsc.connect(chimeGain);
    chimeGain.connect(this.masterGain);
    chimeGain.connect(this.delayNode);
    
    // Fast attack, extremely slow decay envelope
    const now = this.ctx.currentTime;
    chimeGain.gain.linearRampToValueAtTime(0.07, now + 0.03); // fast pluck
    chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + 7.0); // slow bell decay
    
    chimeOsc.start(now);
    chimeOsc.stop(now + 8.0);
  }

  // Schedules the next chime at a random interval (8 to 15 seconds)
  scheduleChime() {
    this.chimeTimeout = setTimeout(() => {
      this.playChime();
      this.scheduleChime();
    }, 8000 + Math.random() * 7000);
  }

  // Toggles the mute state (ramping volume smoothly to prevent pops)
  toggleMute() {
    if (!this.ctx) {
      this.init();
    }
    
    // Resume context if browser suspended it
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const now = this.ctx.currentTime;
    this.isMuted = !this.isMuted;
    
    if (this.isMuted) {
      // Fade out volume over 0.8 seconds
      this.masterGain.gain.linearRampToValueAtTime(0.0, now + 0.8);
    } else {
      // Fade in volume over 1.2 seconds
      this.masterGain.gain.linearRampToValueAtTime(0.45, now + 1.2);
      this.playChime(); // Play an immediate chime feedback!
    }
    
    return this.isMuted;
  }

  stop() {
    if (this.chimeTimeout) {
      clearTimeout(this.chimeTimeout);
    }
    this.padOscillators.forEach(item => {
      try {
        item.osc.stop();
      } catch(e) {}
    });
    if (this.lfo) {
      try {
        this.lfo.stop();
      } catch(e) {}
    }
    if (this.ctx) {
      this.ctx.close();
    }
    this.isPlaying = false;
  }
}
