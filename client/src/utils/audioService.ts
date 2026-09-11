class AudioService {
  private audioContext: AudioContext | null = null;
  private isPlaying = false;

  async playBuzzer(duration: number = 1000): Promise<void> {
    if (this.isPlaying) return;

    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }

      this.isPlaying = true;
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = "sine";

      gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration / 1000);

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + duration / 1000);

      oscillator.onended = () => {
        this.isPlaying = false;
      };
    } catch (error) {
      console.error("Error playing buzzer:", error);
      this.isPlaying = false;
    }
  }

  stop(): void {
    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.isPlaying = false;
  }
}

export const audioService = new AudioService();

