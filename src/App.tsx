import { useCallback, useEffect, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import { GameOverModal, PauseModal } from './components/Modals';
import { TitleOverlay } from './components/TitleOverlay';
import { NeonAudio } from './game/audio';
import { ARENA_HEIGHT, ARENA_WIDTH, MAX_LIVES } from './game/constants';
import {
  createInitialSimulation,
  getSnapshot,
  loadBestScore,
  stepSimulation,
} from './game/engine';
import { renderSimulation } from './game/renderer';
import type { GameSnapshot, InputState, SimulationState } from './game/types';

function shouldAutostart(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('autostart') === '1';
}

export default function App() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scoreElRef = useRef<HTMLSpanElement | null>(null);
  const lastRenderedScoreRef = useRef<number>(-1);

  const initialBest = loadBestScore();
  const autostart = shouldAutostart();

  const simRef = useRef<SimulationState>(
    createInitialSimulation(initialBest, autostart ? 'playing' : 'title')
  );
  const audioRef = useRef<NeonAudio>(new NeonAudio());
  const keysHeldRef = useRef<Set<string>>(new Set());
  const fireJustPressedRef = useRef<boolean>(false);

  const [snapshot, setSnapshot] = useState<GameSnapshot>(() => getSnapshot(simRef.current));
  const [muted, setMuted] = useState<boolean>(false);

  const syncBodyState = useCallback((phase: GameSnapshot['phase']) => {
    if (document.body.dataset.state !== phase) {
      document.body.dataset.state = phase;
    }
  }, []);

  const syncSnapshotIfChanged = useCallback((sim: SimulationState, force = false) => {
    if (scoreElRef.current && lastRenderedScoreRef.current !== sim.score) {
      lastRenderedScoreRef.current = sim.score;
      scoreElRef.current.textContent = sim.score.toLocaleString();
    }

    setSnapshot((prev) => {
      if (
        !force &&
        prev.phase === sim.phase &&
        prev.wave === sim.wave &&
        prev.lives === sim.lives &&
        prev.isNewBest === sim.isNewBest &&
        (sim.phase === 'playing' || prev.score === sim.score)
      ) {
        return prev;
      }
      return getSnapshot(sim);
    });
    syncBodyState(sim.phase);
  }, [syncBodyState]);

  const clearInputs = useCallback(() => {
    keysHeldRef.current.clear();
    fireJustPressedRef.current = false;
  }, []);

  const startNewRun = useCallback(() => {
    const best = Math.max(simRef.current.bestScore, loadBestScore());
    const fresh = createInitialSimulation(best, 'playing');
    simRef.current = fresh;
    clearInputs();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    audioRef.current.unlock();
    audioRef.current.play('start');
    syncSnapshotIfChanged(fresh, true);
  }, [clearInputs, syncSnapshotIfChanged]);

  const togglePause = useCallback(() => {
    const sim = simRef.current;
    if (sim.phase === 'playing') {
      sim.phase = 'paused';
      clearInputs();
      syncSnapshotIfChanged(sim, true);
    } else if (sim.phase === 'paused') {
      sim.phase = 'playing';
      clearInputs();
      syncSnapshotIfChanged(sim, true);
    }
  }, [clearInputs, syncSnapshotIfChanged]);

  const quitToTitle = useCallback(() => {
    const best = Math.max(simRef.current.bestScore, loadBestScore());
    const titleSim = createInitialSimulation(best, 'title');
    simRef.current = titleSim;
    clearInputs();
    syncSnapshotIfChanged(titleSim, true);
  }, [clearInputs, syncSnapshotIfChanged]);

  const toggleMute = useCallback(() => {
    const nextMuted = audioRef.current.toggleMute();
    setMuted(nextMuted);
  }, []);

  // Initialize body state attribute on mount
  useEffect(() => {
    syncBodyState(simRef.current.phase);
  }, [syncBodyState]);

  // Keyboard listener (WASD + Arrows + Space + P/Escape + M)
  useEffect(() => {
    const isGameKey = (code: string) =>
      code === 'Space' ||
      code === 'ArrowUp' ||
      code === 'ArrowDown' ||
      code === 'ArrowLeft' ||
      code === 'ArrowRight' ||
      code === 'KeyW' ||
      code === 'KeyA' ||
      code === 'KeyS' ||
      code === 'KeyD';

    const onKeyDown = (e: KeyboardEvent) => {
      if (isGameKey(e.code)) {
        e.preventDefault();
      }

      const sim = simRef.current;

      if (e.code === 'KeyM' && !e.repeat) {
        toggleMute();
        return;
      }

      if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) {
        if (sim.phase === 'playing' || sim.phase === 'paused') {
          togglePause();
        }
        return;
      }

      if (sim.phase === 'title' || sim.phase === 'gameover') {
        if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) {
          e.preventDefault();
          startNewRun();
        }
        return;
      }

      if (sim.phase === 'playing') {
        if (e.code === 'Space' && !e.repeat) {
          fireJustPressedRef.current = true;
        }
        keysHeldRef.current.add(e.code);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysHeldRef.current.delete(e.code);
    };

    const onBlur = () => {
      clearInputs();
    };

    const onVisibility = () => {
      if (document.hidden) {
        clearInputs();
      }
    };

    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [clearInputs, startNewRun, toggleMute, togglePause]);

  // Responsive Canvas2D DPR sizing + isolated 60fps requestAnimationFrame loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const updateCanvasSize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(ARENA_WIDTH * dpr);
      canvas.height = Math.round(ARENA_HEIGHT * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    updateCanvasSize();
    const resizeObserver = new ResizeObserver(updateCanvasSize);
    resizeObserver.observe(container);

    let rafId = 0;
    let lastTime = performance.now();

    const frame = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;

      const sim = simRef.current;
      const held = keysHeldRef.current;

      const input: InputState = {
        up: held.has('KeyW') || held.has('ArrowUp'),
        down: held.has('KeyS') || held.has('ArrowDown'),
        left: held.has('KeyA') || held.has('ArrowLeft'),
        right: held.has('KeyD') || held.has('ArrowRight'),
        fireHeld: held.has('Space'),
        fireJustPressed: fireJustPressedRef.current,
      };
      fireJustPressedRef.current = false;

      stepSimulation(sim, input, rawDt);

      // Dispatch audio cues emitted by this step
      for (let i = 0; i < sim.pendingEvents.length; i++) {
        audioRef.current.play(sim.pendingEvents[i]);
      }

      // Sync React HUD only when discrete values change
      syncSnapshotIfChanged(sim);

      renderSimulation(ctx, sim, now / 1000);
      rafId = window.requestAnimationFrame(frame);
    };

    rafId = window.requestAnimationFrame(frame);

    return () => {
      window.cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
    };
  }, [syncSnapshotIfChanged]);

  return (
    <main className="relative flex h-dvh w-screen items-center justify-center overflow-hidden bg-[#05060b] p-0 sm:p-4">
      {/* Responsive aspect-locked arena frame */}
      <div
        ref={containerRef}
        className="relative flex items-center justify-center overflow-hidden border-y border-[#8b5cf6]/30 bg-[#05060b] shadow-[0_0_60px_rgba(0,245,255,0.08)] sm:rounded-lg sm:border"
        style={{
          width: 'min(100vw, calc(100dvh * 1.25))',
          height: 'min(100dvh, calc(100vw / 1.25))',
          maxWidth: '1200px',
          maxHeight: '960px',
        }}
      >
        <canvas
          ref={canvasRef}
          data-testid="game-canvas"
          className="block h-full w-full"
          aria-label="NEON SIEGE game playfield"
        />

        {/* Playing & Paused HUD */}
        {(snapshot.phase === 'playing' || snapshot.phase === 'paused') && (
          <GameHud
            score={snapshot.score}
            scoreRef={scoreElRef}
            wave={snapshot.wave}
            lives={snapshot.lives}
            maxLives={MAX_LIVES}
            muted={muted}
            onToggleMute={toggleMute}
            onTogglePause={togglePause}
          />
        )}

        {/* Start Screen */}
        {snapshot.phase === 'title' && (
          <TitleOverlay bestScore={snapshot.bestScore} onStart={startNewRun} />
        )}

        {/* Pause Modal */}
        {snapshot.phase === 'paused' && (
          <PauseModal
            score={snapshot.score}
            wave={snapshot.wave}
            onResume={togglePause}
            onRestart={startNewRun}
            onQuitToTitle={quitToTitle}
          />
        )}

        {/* Game Over Modal ("SYSTEM BREACH") */}
        {snapshot.phase === 'gameover' && (
          <GameOverModal
            score={snapshot.score}
            bestScore={snapshot.bestScore}
            wave={snapshot.wave}
            elapsedSeconds={snapshot.elapsedSeconds}
            isNewBest={snapshot.isNewBest}
            onRetry={startNewRun}
            onQuitToTitle={quitToTitle}
          />
        )}
      </div>
    </main>
  );
}
