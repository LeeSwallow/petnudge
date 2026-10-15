import { describe, expect, it } from 'vitest';
import {
  decideMusicAction,
  isContextRef,
  isExternalPlayer,
  isValidMusicRef,
  parseMusicLink,
  parseNowPlaying,
  pickNowPlaying,
  type MusicSyncSettings,
  type NowPlaying
} from './music';

const TRACK = 'spotify:track:4uLU6hMCjMI75M1A2tKUQC';
const spotifyPlaying: NowPlaying = { player: 'Spotify', state: 'playing', ref: TRACK, title: 'Snowman', artist: 'WYS' };
const musicPaused: NowPlaying = { player: 'Music', state: 'paused', ref: 'A1B2C3D4E5F60718', title: 'Coffee', artist: 'Kupla' };
const sync: MusicSyncSettings = { musicSync: true, focusPlaylistId: null, breakPlaylistId: null };

describe('parseNowPlaying', () => {
  it('parses tab separated player output including the track ref', () => {
    expect(parseNowPlaying(`Spotify\tplaying\t${TRACK}\tSnowman\tWYS\n`)).toEqual(spotifyPlaying);
  });

  it('keeps tabs inside the artist field intact', () => {
    expect(parseNowPlaying('Music\tpaused\tA1B2C3D4E5F60718\tCoffee\tKupla\tfeat. x')?.artist).toBe('Kupla\tfeat. x');
  });

  it('returns null for empty, stopped, or unknown output', () => {
    expect(parseNowPlaying('')).toBeNull();
    expect(parseNowPlaying('Spotify\tstopped\t\t\t')).toBeNull();
    expect(parseNowPlaying('Winamp\tplaying\tx\ta\tb')).toBeNull();
    expect(parseNowPlaying('garbage')).toBeNull();
  });
});

describe('pickNowPlaying', () => {
  it('prefers a playing player over a paused one', () => {
    expect(pickNowPlaying([musicPaused, spotifyPlaying])).toEqual(spotifyPlaying);
  });

  it('falls back to a paused player, or null when nothing is open', () => {
    expect(pickNowPlaying([null, musicPaused])).toEqual(musicPaused);
    expect(pickNowPlaying([null])).toBeNull();
  });
});

describe('music refs', () => {
  it('only accepts exact Spotify URIs and Apple Music persistent IDs', () => {
    expect(isValidMusicRef('Spotify', TRACK)).toBe(true);
    expect(isValidMusicRef('Spotify', 'spotify:track:abc" & do shell script "x')).toBe(false);
    expect(isValidMusicRef('Music', 'A1B2C3D4E5F60718')).toBe(true);
    expect(isValidMusicRef('Music', 'a1b2')).toBe(false);
  });

  it('accepts absolute paths to audio files as local refs', () => {
    expect(isValidMusicRef('Local', '/Users/me/Music/rain lofi.mp3')).toBe(true);
    expect(isValidMusicRef('Local', 'C:\\Users\\me\\Music\\beat.FLAC')).toBe(true);
    expect(isValidMusicRef('Local', 'relative/song.mp3')).toBe(false);
    expect(isValidMusicRef('Local', '/etc/passwd')).toBe(false);
  });

  it('separates external players from the built-in one', () => {
    expect(isExternalPlayer('Spotify')).toBe(true);
    expect(isExternalPlayer('Local')).toBe(false);
    expect(parseNowPlaying('Local\tplaying\t/a.mp3\ta\tb')).toBeNull();
  });

  it('parses Spotify share links and URIs', () => {
    expect(parseMusicLink('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=abc')).toEqual({
      player: 'Spotify',
      ref: TRACK,
      kind: 'track'
    });
    expect(parseMusicLink('https://open.spotify.com/intl-ko/playlist/37i9dQZF1DWWQRwui0ExPn')?.ref).toBe(
      'spotify:playlist:37i9dQZF1DWWQRwui0ExPn'
    );
    expect(parseMusicLink(` ${TRACK} `)?.ref).toBe(TRACK);
    expect(parseMusicLink('https://youtube.com/watch?v=1')).toBeNull();
  });

  it('treats albums and playlists as contexts', () => {
    expect(isContextRef('spotify:playlist:37i9dQZF1DWWQRwui0ExPn')).toBe(true);
    expect(isContextRef(TRACK)).toBe(false);
  });
});

describe('decideMusicAction', () => {
  it('resumes paused music when focus starts without a focus playlist', () => {
    expect(decideMusicAction('idle', 'focus', musicPaused, sync)).toEqual({ type: 'play' });
  });

  it('pauses playing music when focus ends into a break without a break playlist', () => {
    expect(decideMusicAction('focus', 'break', spotifyPlaying, sync)).toEqual({ type: 'pause' });
  });

  it('starts the mode playlist when one is assigned', () => {
    const withPlaylists = { ...sync, focusPlaylistId: 'f', breakPlaylistId: 'b' };

    expect(decideMusicAction('idle', 'focus', null, withPlaylists)).toEqual({ type: 'playlist', playlistId: 'f' });
    expect(decideMusicAction('focus', 'break', spotifyPlaying, withPlaylists)).toEqual({ type: 'playlist', playlistId: 'b' });
  });

  it('does nothing when sync is off, nothing to resume, or mode did not change meaningfully', () => {
    expect(decideMusicAction('idle', 'focus', musicPaused, { ...sync, musicSync: false })).toBeNull();
    expect(decideMusicAction('idle', 'focus', null, sync)).toBeNull();
    expect(decideMusicAction('idle', 'focus', spotifyPlaying, sync)).toBeNull();
    expect(decideMusicAction('focus', 'idle', spotifyPlaying, sync)).toBeNull();
    expect(decideMusicAction('focus', 'focus', spotifyPlaying, sync)).toBeNull();
  });
});
