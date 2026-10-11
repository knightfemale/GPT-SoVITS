import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export interface Track {
  id: string;
  title: string;
  subtitle?: string;
  src: string;
}

interface PlayerContextValue {
  track: Track | null;
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  play: (track: Track) => void;
  toggle: () => void;
  stop: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [track, setTrack] = useState<Track | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);

  const ensureAudio = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = "metadata";
      audioRef.current = audio;
    }
    return audioRef.current;
  }, []);

  useEffect(() => {
    const audio = ensureAudio();
    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => setDuration(audio.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("durationchange", onMeta);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("durationchange", onMeta);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, [ensureAudio]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const play = useCallback(
    (next: Track) => {
      const audio = ensureAudio();
      if (track?.id !== next.id) {
        audio.src = next.src;
        audio.currentTime = 0;
        setCurrentTime(0);
        setDuration(0);
        setTrack(next);
      }
      audio.volume = volume;
      void audio.play().catch(() => setPlaying(false));
    },
    [ensureAudio, track, volume],
  );

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !track) return;
    if (audio.paused) void audio.play().catch(() => setPlaying(false));
    else audio.pause();
  }, [track]);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setCurrentTime(0);
    setPlaying(false);
  }, []);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = time;
    setCurrentTime(time);
  }, []);

  const setVolume = useCallback((next: number) => {
    const clamped = Math.min(1, Math.max(0, next));
    setVolumeState(clamped);
    if (audioRef.current) audioRef.current.volume = clamped;
  }, []);

  const value = useMemo<PlayerContextValue>(
    () => ({ track, playing, currentTime, duration, volume, play, toggle, stop, seek, setVolume }),
    [track, playing, currentTime, duration, volume, play, toggle, stop, seek, setVolume],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer 必须在 PlayerProvider 内使用");
  return ctx;
}
