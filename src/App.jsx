import { useEffect, useRef, useState } from "react";
import { Game } from "./game/engine";
import "./App.css";

export default function App() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const gameRef = useRef(null);

  const [hud, setHud] = useState({ score: 0, level: 1, lives: 3, highScore: 0, combo: 0 });
  const [status, setStatus] = useState({ state: "menu", muted: false });

  useEffect(() => {
    const game = new Game(canvasRef.current, {
      onHudUpdate: setHud,
      onStateChange: setStatus,
    });
    gameRef.current = game;

    const resize = () => {
      const rect = containerRef.current.getBoundingClientRect();
      game.resize(rect.width, rect.height);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(containerRef.current);

    game.draw();

    return () => {
      observer.disconnect();
      game.destroy();
    };
  }, []);

  const start = () => gameRef.current?.start();
  const togglePause = () => gameRef.current?.togglePause();
  const toggleMute = () => gameRef.current?.toggleMute();

  const { state, muted } = status;

  return (
    <div className="app">
      <div className="stage" ref={containerRef}>
        <canvas ref={canvasRef} className="game-canvas" />

        {state === "playing" || state === "paused" ? (
          <div className="hud">
            <div className="hud-left">
              <div className="hud-score">{hud.score.toLocaleString()}</div>
              <div className="hud-sub">RECORDE {hud.highScore.toLocaleString()}</div>
            </div>
            <div className="hud-mid">
              {hud.combo > 1 && <div className="combo-badge">COMBO x{hud.combo}</div>}
              <div className="powerup-row">
                {hud.rapid && <span className="chip chip-rapid">RÁPIDO</span>}
                {hud.spread && <span className="chip chip-spread">TRIPLO</span>}
                {hud.shield && <span className="chip chip-shield">ESCUDO</span>}
              </div>
            </div>
            <div className="hud-right">
              <div className="hud-level">NÍVEL {hud.level}</div>
              <div className="lives">
                {Array.from({ length: hud.lives }).map((_, i) => (
                  <span key={i} className="life-dot" />
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {(state === "playing" || state === "paused") && (
          <div className="ingame-controls">
            <button className="icon-btn" onClick={toggleMute} title="Mudo">
              {muted ? "🔇" : "🔊"}
            </button>
            <button className="icon-btn" onClick={togglePause} title="Pausar">
              {state === "paused" ? "▶" : "⏸"}
            </button>
          </div>
        )}

        {state === "menu" && (
          <div className="overlay">
            <h1 className="title">
              NEON <span className="title-accent">BLASTER</span>
            </h1>
            <p className="subtitle">Sobreviva às ondas. Colete power-ups. Bata seu recorde.</p>
            <button className="primary-btn" onClick={start}>
              INICIAR JOGO
            </button>
            <div className="instructions">
              <p>
                <strong>Mover:</strong> setas / WASD / arrastar no touch
              </p>
              <p>
                <strong>Atirar:</strong> espaço / toque na tela
              </p>
              <p>
                <strong>Pausar:</strong> Esc &nbsp;·&nbsp; <strong>Mudo:</strong> M
              </p>
            </div>
            {hud.highScore > 0 && <div className="menu-highscore">Recorde: {hud.highScore.toLocaleString()}</div>}
          </div>
        )}

        {state === "paused" && (
          <div className="overlay overlay-thin">
            <h2 className="title-small">PAUSADO</h2>
            <button className="primary-btn" onClick={togglePause}>
              CONTINUAR
            </button>
          </div>
        )}

        {state === "gameover" && (
          <div className="overlay">
            <h2 className="title-small">FIM DE JOGO</h2>
            <div className="final-score">{hud.score.toLocaleString()}</div>
            {hud.score >= hud.highScore && hud.score > 0 && <div className="new-record">NOVO RECORDE!</div>}
            <p className="subtitle">Recorde: {hud.highScore.toLocaleString()}</p>
            <button className="primary-btn" onClick={start}>
              JOGAR NOVAMENTE
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
