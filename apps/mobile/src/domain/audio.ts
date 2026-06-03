export type BgmTrack = {
  id: string;
  title: string;
  mood: 'rain_cafe' | 'quiet_night' | 'neon_city' | 'warm_piano' | 'library';
};

export type AudioSettings = {
  enabled: boolean;
  selectedTrackId: string;
  bgmVolume: number;
  ambienceVolume: number;
};

export const mockBgmTracks: BgmTrack[] = [
  { id: 'rain-cafe', title: 'Rain Cafe Loop', mood: 'rain_cafe' },
  { id: 'quiet-night', title: 'Quiet Night Desk', mood: 'quiet_night' },
  { id: 'neon-city', title: 'Soft Neon City', mood: 'neon_city' }
];
