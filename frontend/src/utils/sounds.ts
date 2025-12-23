// Sound effects utility using Web Audio API
// No external files needed - generates sounds programmatically

type SoundType = "alert" | "success" | "error" | "scan" | "payout";

class SoundEngine {
  private audioCtx: AudioContext | null = null;
  private enabled = true;

  private getContext(): AudioContext {
    if (!this.audioCtx) {
      this.audioCtx = new AudioContext();
    }
    return this.audioCtx;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  isEnabled() {
    return this.enabled;
  }

  // Play a beep with specific frequency and duration
  private beep(frequency: number, duration: number, type: OscillatorType = "sine", volume = 0.1) {
    if (!this.enabled) return;
    
    try {
      const ctx = this.getContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
      
      // Envelope: quick attack, sustain, quick release
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration);
    } catch (e) {
      console.warn("Sound playback failed:", e);
    }
  }

  play(sound: SoundType) {
    switch (sound) {
      case "alert":
        // Urgent alarm: two-tone alert
        this.beep(880, 0.15, "square", 0.08);
        setTimeout(() => this.beep(660, 0.15, "square", 0.08), 180);
        setTimeout(() => this.beep(880, 0.15, "square", 0.08), 360);
        break;

      case "success":
        // Pleasant ascending tone
        this.beep(523, 0.1, "sine", 0.1);
        setTimeout(() => this.beep(659, 0.1, "sine", 0.1), 100);
        setTimeout(() => this.beep(784, 0.15, "sine", 0.1), 200);
        break;

      case "error":
        // Descending warning
        this.beep(440, 0.15, "sawtooth", 0.05);
        setTimeout(() => this.beep(330, 0.2, "sawtooth", 0.05), 150);
        break;

      case "scan":
        // Scanning/processing sound
        this.beep(1200, 0.05, "sine", 0.03);
        setTimeout(() => this.beep(1400, 0.05, "sine", 0.03), 100);
        setTimeout(() => this.beep(1600, 0.05, "sine", 0.03), 200);
        break;

      case "payout":
        // Cash register / transaction success
        this.beep(1047, 0.08, "sine", 0.08);
        setTimeout(() => this.beep(1319, 0.08, "sine", 0.08), 80);
        setTimeout(() => this.beep(1568, 0.08, "sine", 0.08), 160);
        setTimeout(() => this.beep(2093, 0.2, "sine", 0.1), 240);
        break;
    }
  }
}

export const soundEngine = new SoundEngine();
