export interface RainState {
  speed: number; // 1.0 = normal, 0.0 = stopped, -1.0 = reverse
  isActive: boolean; // true if hand is detected controlling it
}

export interface AppConfig {
  particleCount: number;
  rainColor: number;
}
