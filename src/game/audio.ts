import type { SoundEvent } from './types';

export class NeonAudio {
  private ctx: AudioContext | null = null;
  private muted = false;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  public unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      try {
        this.ctx = new AudioCtx();
      } catch {
        this.ctx = null;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
  }

  public play(event: SoundEvent): void {
    if (this.muted) return;
    this.unlock();
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    switch (event) {
      case 'shoot': {
        const pitchVar = 0.94 + Math.random() * 0.12;
        this.tone(ctx, 'sawtooth', 760 * pitchVar, 240 * pitchVar, 0.085, 0.055, now);
        break;
      }
      case 'enemyDestroy': {
        const pitchVar = 0.92 + Math.random() * 0.16;
        this.tone(ctx, 'triangle', 320 * pitchVar, 75, 0.16, 0.11, now);
        this.tone(ctx, 'square', 640 * pitchVar, 160, 0.1, 0.05, now);
        break;
      }
      case 'enemyTelegraph': {
        this.tone(ctx, 'sine', 520, 880, 0.11, 0.03, now);
        break;
      }
      case 'playerHit': {
        this.tone(ctx, 'sawtooth', 190, 48, 0.28, 0.16, now);
        this.tone(ctx, 'square', 110, 42, 0.24, 0.12, now);
        break;
      }
      case 'graze': {
        const pitchVar = 0.96 + Math.random() * 0.08;
        this.tone(ctx, 'sine', 1240 * pitchVar, 1760 * pitchVar, 0.065, 0.035, now);
        break;
      }
      case 'powerUp': {
        this.tone(ctx, 'triangle', 523.25, 659.25, 0.09, 0.07, now);
        this.tone(ctx, 'triangle', 659.25, 1046.5, 0.14, 0.08, now + 0.06);
        break;
      }
      case 'shieldBreak': {
        this.tone(ctx, 'triangle', 720, 220, 0.18, 0.11, now);
        this.tone(ctx, 'sine', 480, 140, 0.2, 0.08, now + 0.03);
        break;
      }
      case 'waveUp': {
        this.tone(ctx, 'triangle', 440, 440, 0.1, 0.07, now);
        this.tone(ctx, 'triangle', 554.37, 554.37, 0.1, 0.07, now + 0.07);
        this.tone(ctx, 'triangle', 659.25, 880, 0.2, 0.09, now + 0.14);
        break;
      }
      case 'start': {
        this.tone(ctx, 'triangle', 330, 660, 0.14, 0.08, now);
        this.tone(ctx, 'sine', 660, 990, 0.16, 0.06, now + 0.07);
        break;
      }
      case 'gameOver': {
        this.tone(ctx, 'sawtooth', 310, 140, 0.24, 0.11, now);
        this.tone(ctx, 'sawtooth', 210, 62, 0.45, 0.12, now + 0.18);
        break;
      }
    }
  }

  private tone(
    ctx: AudioContext,
    type: OscillatorType,
    freqStart: number,
    freqEnd: number,
    duration: number,
    gainPeak: number,
    startTime: number
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, startTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), startTime + duration);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(gainPeak, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }
}
