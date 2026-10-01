import { useEffect, useRef, useState, useCallback } from 'react';
import {
  PLAYER_PIXELS,
  ENEMY_HEART_PIXELS,
  ENEMY_BRAIN_PIXELS,
  ENEMY_BACTERIA_PIXELS,
  ENEMY_DNA_PIXELS,
  ENEMY_TEST_PIXELS,
  ENEMY_BOOK_PIXELS,
  POWERUP_RAPID_PIXELS,
  POWERUP_DOUBLE_PIXELS,
  POWERUP_SHIELD_PIXELS,
  POWERUP_PULSE_PIXELS,
  EXPLOSION_COLORS,
} from './pixelArts';

const PIXEL_SIZE = 4;
const CANVAS_W = 320;
const CANVAS_H = 480;
const PLAYER_SPEED = 250;
const PROJECTILE_SPEED = 350;
const ENEMY_BASE_SPEED = 60;

export default function GameEngine({ onGameOver }) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastTimeRef = useRef(0);

  // State
  const [state, setState] = useState({
    player: {
      x: CANVAS_W / 2 - 10,
      y: CANVAS_H - 50,
      w: PLAYER_PIXELS[0].length * PIXEL_SIZE,
      h: PLAYER_PIXELS.length * PIXEL_SIZE,
      invulnerable: 0,
      thrust: 0,
    },
    projectiles: [],
    enemies: [],
    powerups: [],
    particles: [],
    scorePopups: [],
    keys: {
      ArrowLeft: false,
      ArrowRight: false,
      KeyA: false,
      KeyD: false,
      Space: false,
    },
    wave: 1,
    score: 0,
    health: 3,
    isShooting: false,
    shootTimer: 0,
    rapidFire: false,
    doubleShot: false,
    shield: false,
    shieldTimer: 0,
    enemySpeed: ENEMY_BASE_SPEED,
    enemySpawnTimer: 0,
    enemySpawnRate: 1200,
    gameOver: false,
    paused: false,
  });

  // Initialize and cleanup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctxRef.current = ctx;
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;

    // Input handlers
    const handleKeyDown = (e) => {
      if (e.code === 'Escape') {
        onGameOver();
        return;
      }
      if (Object.keys(state.keys).includes(e.code)) {
        e.preventDefault();
        setState(prev => ({
          ...prev,
          keys: { ...prev.keys, [e.code]: true }
        }));
      }
    };

    const handleKeyUp = (e) => {
      if (Object.keys(state.keys).includes(e.code)) {
        e.preventDefault();
        setState(prev => ({
          ...prev,
          keys: { ...prev.keys, [e.code]: false }
        }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Start game loop
    const animate = (timestamp) => {
      if (!stateRef.current.mounted) return;

      const dt = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;

      update(dt);
      render();

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    lastTimeRef.current = performance.now();
    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameRef.current);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // State ref for accessing latest state in closures
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Mounted ref
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Update game logic
  const update = useCallback((dt) => {
    if (state.gameOver || state.paused) return;

    // Player movement
    let player = { ...state.player };
    if ((state.keys.ArrowLeft || state.keys.KeyA) && player.x > 0) {
      player.x -= PLAYER_SPEED * dt;
    }
    if ((state.keys.ArrowRight || state.keys.KeyD) && player.x < CANVAS_W - player.w) {
      player.x += PLAYER_SPEED * dt;
    }

    // Shooting
    if ((state.keys.Space || state.keys.KeyD) && !state.isShooting && state.shootTimer <= 0) {
      shoot();
    } else if (!(state.keys.Space || state.keys.KeyD)) {
      setState(prev => ({ ...prev, isShooting: false }));
    }

    // Update timers
    const shootTimer = Math.max(0, state.shootTimer - dt * 1000);
    const shieldTimer = Math.max(0, state.shieldTimer - dt * 1000);

    // Update powerup states (simplified - they last for a set time)
    const rapidFire = state.rapidFire;
    const doubleShot = state.doubleShot;
    const shield = state.shield && state.shieldTimer > 0;

    // Update player state
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    player.thrust = (state.keys.ArrowLeft || state.keys.KeyA || state.keys.ArrowRight || state.keys.KeyD)
      ? (player.thrust + 1) % 4 : 0;

    // Update projectiles
    const projectiles = state.projectiles
      .map(p => ({ ...p, y: p.y - PROJECTILE_SPEED * dt }))
      .filter(p => p.y + p.height > 0);

    // Update enemies
    const enemies = state.enemies
      .map(e => ({ ...e, y: e.y + e.speed * dt }))
      .filter(e => e.y < CANVAS_H);

    // Update powerups
    const powerups = state.powerups
      .map(p => ({ ...p, y: p.y + 30 * dt }))
      .filter(p => p.y < CANVAS_H);

    // Update particles
    const particles = state.particles
      .map(p => ({
        ...p,
        x: p.x + p.vx * dt,
        y: p.y + p.vy * dt,
        life: p.life - dt,
        alpha: p.life / p.maxLife,
      }))
      .filter(p => p.life > 0);

    // Update score popups
    const scorePopups = state.scorePopups
      .map(p => ({
        ...p,
        y: p.y - 20 * dt,
        life: p.life - dt,
        alpha: p.life / p.maxLife,
      }))
      .filter(p => p.life > 0);

    // Check collisions
    const {
      projectiles: newProjectiles,
      enemies: newEnemies,
      powerups: newPowerups,
      particles: newParticles,
      scorePopups: newScorePopups,
      score: newScore,
      health: newHealth,
      player: newPlayer,
      rapidFire: newRapidFire,
      doubleShot: newDoubleShot,
      shield: newShield,
    } = checkCollisions({
      projectiles,
      enemies,
      powerups,
      particles,
      scorePopups,
      score: state.score,
      health: state.health,
      player,
      rapidFire,
      doubleShot,
      shield: state.shield && state.shieldTimer > 0,
    });

    // Spawn enemies
    const { enemies: spawnedEnemies, enemySpawnTimer, enemySpawnRate } = spawnEnemies({
      enemies: newEnemies,
      enemySpawnTimer: state.enemySpawnTimer + dt * 1000,
      enemySpawnRate: state.enemySpawnRate,
      wave: state.wave,
    });

    // Spawn occasional powerups
    const { powerups: spawnedPowerups } = spawnPowerups({
      powerups: newPowerups,
    });

    // Update wave based on score
    const { wave, enemySpeed, enemySpawnRate: newSpawnRate } = updateWave({
      score: newScore,
      wave: state.wave,
      enemySpeed: state.enemySpeed,
      enemySpawnRate: state.enemySpawnRate,
    });

    // Check game over
    if (newHealth <= 0) {
      setState({
        ...state,
        gameOver: true,
        health: 0,
      });
      return;
    }

    // Apply all state updates
    setState({
      player: newPlayer,
      projectiles: newProjectiles,
      enemies: spawnedEnemies,
      powerups: spawnedPowerups,
      particles: newParticles,
      scorePopups: newScorePopups,
      keys: state.keys,
      wave,
      score: newScore,
      health: newHealth,
      isShooting: state.isShooting,
      shootTimer,
      rapidFire: newRapidFire,
      doubleShot: newDoubleShot,
      shield: newShield,
      shieldTimer,
      enemySpeed,
      enemySpawnTimer,
      enemySpawnRate: newSpawnRate,
      gameOver: false,
      paused: false,
    });
  }, []);

  // Shoot projectiles
  function shoot() {
    setState(prev => {
      const newProjectiles = [...prev.projectiles];
      const baseX = prev.player.x + prev.player.w / 2 - 1;

      // Main projectile
      newProjectiles.push({
        x: baseX,
        y: prev.player.y,
        w: 2,
        h: 8,
        color: '#e0b45c',
      });

      // Double shot
      if (prev.doubleShot) {
        newProjectiles.push({
          x: baseX - 3,
          y: prev.player.y,
          w: 2,
          h: 8,
          color: '#e0b45c',
        });
        newProjectiles.push({
          x: baseX + 3,
          y: prev.player.y,
          w: 2,
          h: 8,
          color: '#e0b45c',
        });
      }

      return {
        ...prev,
        projectiles: newProjectiles,
        isShooting: true,
        shootTimer: prev.rapidFire ? 100 : 300,
      };
    });
  }

  // Collision detection
  function checkCollisions({
    projectiles,
    enemies,
    powerups,
    particles,
    scorePopups,
    score,
    health,
    player,
    rapidFire,
    doubleShot,
    shield,
  }) {
    let newProjectiles = [...projectiles];
    let newEnemies = [...enemies];
    let newPowerups = [...powerups];
    let newParticles = [...particles];
    let newScorePopups = [...scorePopups];
    let newScore = score;
    let newHealth = health;
    let newPlayer = { ...player };
    let newRapidFire = rapidFire;
    let newDoubleShot = doubleShot;
    let newShield = shield;

    // Projectile vs Enemies
    newProjectiles = newProjectiles.filter(p => {
      let hit = false;
      newEnemies = newEnemies.filter(e => {
        if (
          p.x < e.x + e.w &&
          p.x + p.w > e.x &&
          p.y < e.y + e.h &&
          p.y + p.h > e.y
        ) {
          hit = true;

          // Add score
          newScore += e.score;

          // Add score popup
          newScorePopups.push({
            x: e.x + e.w / 2,
            y: e.y,
            text: `+${e.score}`,
            life: 0.8,
            maxLife: 0.8,
            alpha: 1,
            color: '#e0b45c',
          });

          // Create explosion
          createExplosion(
            e.x + e.w / 2,
            e.y + e.h / 2,
            newParticles,
            EXPLOSION_COLORS
          );

          // Chance for powerup drop
          if (Math.random() < 0.1) {
            const type = ['rapid', 'double', 'shield', 'pulse'][Math.floor(Math.random() * 4)];
            const powerupDefs = {
              rapid: POWERUP_RAPID_PIXELS,
              double: POWERUP_DOUBLE_PIXELS,
              shield: POWERUP_SHIELD_PIXELS,
              pulse: POWERUP_PULSE_PIXELS,
            };
            newPowerups.push({
              x: e.x,
              y: e.y,
              w: powerupDefs[type][0].length * PIXEL_SIZE,
              h: powerupDefs[type].length * PIXEL_SIZE,
              pixels: powerupDefs[type],
              powerupType: type,
            });
          }

          return false; // remove enemy
        }
        return true;
      });

      return !hit; // keep projectile if no hit
    });

    // Player vs Powerups
    newPowerups = newPowerups.filter(p => {
      if (
        newPlayer.x < p.x + p.w &&
        newPlayer.x + newPlayer.w > p.x &&
        newPlayer.y < p.y + p.h &&
        newPlayer.y + newPlayer.h > p.y
      ) {
        // Collect powerup
        switch (p.powerupType) {
          case 'rapid':
            newRapidFire = true;
            break;
          case 'double':
            newDoubleShot = true;
            break;
          case 'shield':
            newShield = true;
            newShieldTimer = 5000; // 5 seconds
            break;
          case 'pulse':
            // Destroy all enemies
            newEnemies.forEach(e => {
              newScore += e.score;
              newScorePopups.push({
                x: e.x + e.w / 2,
                y: e.y,
                text: `+${e.score}`,
                life: 0.8,
                maxLife: 0.8,
                alpha: 1,
                color: '#e0b45c',
              });
              createExplosion(
                e.x + e.w / 2,
                e.y + e.h / 2,
                newParticles,
                EXPLOSION_COLORS
              );
            });
            newEnemies = [];
            break;
        }
        return false; // remove powerup
      }
      return true;
    });

    // Player vs Enemies (if not invulnerable)
    if (newPlayer.invulnerable <= 0) {
      newEnemies = newEnemies.filter(e => {
        if (
          newPlayer.x < e.x + e.w &&
          newPlayer.x + newPlayer.w > e.x &&
          newPlayer.y < e.y + e.h &&
          newPlayer.y + newPlayer.h > e.y
        ) {
          // Collision!
          newHealth = Math.max(0, newHealth - 1);
          newPlayer.invulnerable = 1.5; // 1.5 seconds invulnerability

          // Create explosion at player position
          createExplosion(
            newPlayer.x + newPlayer.w / 2,
            newPlayer.y + newPlayer.h / 2,
            newParticles,
            EXPLOSION_COLORS
          );

          return false; // remove enemy
        }
        return true;
      });
    }

    return {
      projectiles: newProjectiles,
      enemies: newEnemies,
      powerups: newPowerups,
      particles: newParticles,
      scorePopups: newScorePopups,
      score: newScore,
      health: newHealth,
      player: newPlayer,
      rapidFire: newRapidFire,
      doubleShot: newDoubleShot,
      shield: newShield,
    };
  }

  // Create explosion particles
  function createExplosion(x, y, particlesArray, colors) {
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const speed = 20 + Math.random() * 30;
      particlesArray.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.4 + Math.random() * 0.2,
        maxLife: 0.4 + Math.random() * 0.2,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 2 + Math.random() * 3,
      });
    }
  }

  // Spawn enemies
  function spawnEnemies({ enemies, enemySpawnTimer, enemySpawnRate, wave }) {
    if (enemySpawnTimer < enemySpawnRate) {
      return { enemies, enemySpawnTimer, enemySpawnRate };
    }

    // Select enemy type based on wave
    const enemyDefs = [
      { px: ENEMY_HEART_PIXELS, score: 10, spd: 1 },
      { px: ENEMY_BRAIN_PIXELS, score: 15, spd: 1.2 },
      { px: ENEMY_BACTERIA_PIXELS, score: 20, spd: 1.1 },
      { px: ENEMY_DNA_PIXELS, score: 25, spd: 1.3 },
      { px: ENEMY_TEST_PIXELS, score: 20, spd: 1 },
      { px: ENEMY_BOOK_PIXELS, score: 30, spd: 0.8 },
    ];

    const levelIndex = Math.min(Math.floor((wave - 1) / 2), enemyDefs.length - 1);
    const enemyDef = enemyDefs[levelIndex];

    const maxX = CANVAS_W - (enemyDef.px[0].length * PIXEL_SIZE);
    const x = Math.random() * maxX;

    return {
      enemies: [
        ...enemies,
        {
          x,
          y: -20,
          w: enemyDef.px[0].length * PIXEL_SIZE,
          h: enemyDef.px.length * PIXEL_SIZE,
          pixels: enemyDef.px,
          score: enemyDef.score,
          speed: enemyDef.spd * (1 + (wave - 1) * 0.1),
        }
      ],
      enemySpawnTimer: 0,
      enemySpawnRate: Math.max(400, enemySpawnRate * 0.98), // gradually increase spawn rate
    };
  }

  // Spawn occasional powerups
  function spawnPowerups({ powerups }) {
    if (Math.random() < 0.001) { // 0.1% chance per frame
      const type = ['rapid', 'double', 'shield', 'pulse'][Math.floor(Math.random() * 4)];
      const powerupDefs = {
        rapid: POWERUP_RAPID_PIXELS,
        double: POWERUP_DOUBLE_PIXELS,
        shield: POWERUP_SHIELD_PIXELS,
        pulse: POWERUP_PULSE_PIXELS,
      };
      const def = powerupDefs[type];

      const maxX = CANVAS_W - (def[0].length * PIXEL_SIZE);
      const x = Math.random() * maxX;

      return {
        powerups: [
          ...powerups,
          {
            x,
            y: -20,
            w: def[0].length * PIXEL_SIZE,
            h: def.length * PIXEL_SIZE,
            pixels: def,
            powerupType: type,
          }
        ]
      };
    }

    return { powerups };
  }

  // Update wave and difficulty
  function updateWave({ score, wave, enemySpeed, enemySpawnRate }) {
    const newWave = Math.floor(score / 500) + 1;
    if (newWave === wave) {
      return { wave, enemySpeed, enemySpawnRate };
    }

    return {
      wave: newWave,
      enemySpeed: 60 * (1 + (newWave - 1) * 0.15),
      enemySpawnRate: Math.max(400, 1200 * (1 - (newWave - 1) * 0.1)),
    };
  }

  // Render functions
  function render() {
    const ctx = ctxRef.current;
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // Background
    ctx.fillStyle = '#181818';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Draw player
    drawPixelObject(ctx, state.player, PLAYER_PIXELS, PIXEL_SIZE);

    // Player thrust
    if (state.player.thrust % 2 === 0) {
      drawPixelObject(
        ctx,
        {
          x: state.player.x + state.player.w / 2 - 1.5 * PIXEL_SIZE,
          y: state.player.y + state.player.h,
          w: 3 * PIXEL_SIZE,
          h: 2 * PIXEL_SIZE,
        },
        PLAYER_THRUST,
        PIXEL_SIZE
      );
    }

    // Projectiles
    state.projectiles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.w, p.h);
    });

    // Enemies
    state.enemies.forEach(e => {
      drawPixelObject(ctx, e, e.pixels, PIXEL_SIZE);
    });

    // Powerups
    state.powerups.forEach(p => {
      drawPixelObject(ctx, p, p.pixels, PIXEL_SIZE);
    });

    // Particles
    state.particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Score popups
    state.scorePopups.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(p.text, p.x, p.y);
      ctx.restore();
    });

    // HUD
    drawHUD(ctx);

    // Game Over
    if (state.gameOver) {
      drawGameOver(ctx);
    }
  }

  function drawPixelObject(ctx, obj, pixels, pixelSize) {
    if (!pixels) return;

    for (let row = 0; row < pixels.length; row++) {
      for (let col = 0; col < pixels[row].length; col++) {
        const color = pixels[row][col];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(
            obj.x + col * pixelSize,
            obj.y + row * pixelSize,
            pixelSize,
            pixelSize
          );
        }
      }
    }
  }

  function drawHUD(ctx) {
    // Score
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`امتیاز: ${state.score}`, 10, 25);

    // Wave
    ctx.textAlign = 'center';
    ctx.fillText(`موج: ${state.wave}`, CANVAS_W / 2, 25);

    // Health (hearts)
    ctx.textAlign = 'right';
    for (let i = 0; i < 3; i++) {
      const x = CANVAS_W - 10 - i * 20;
      const y = 25;
      if (i < state.health) {
        ctx.fillStyle = '#e26d6d';
      } else {
        ctx.fillStyle = '#444444';
      }
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x - 2, y - 2, x - 4, y - 2, x - 4, y);
      ctx.bezierCurveTo(x - 4, y + 2, x - 2, y + 2, x, y + 2);
      ctx.bezierCurveTo(x + 2, y + 2, x + 4, y, x + 4, y);
      ctx.bezierCurveTo(x + 4, y - 2, x + 2, y - 2, x, y);
      ctx.fill();
    }

    // Powerup indicators
    let powerupX = 10;
    const powerupY = 50;

    if (state.rapidFire) {
      ctx.fillStyle = '#ff9717';
      ctx.fillRect(powerupX, powerupY, 20, 10);
      ctx.fillStyle = '#000000';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('سریع', powerupX + 10, powerupY + 14);
      powerupX += 25;
    }

    if (state.doubleShot) {
      ctx.fillStyle = '#61d192';
      ctx.fillRect(powerupX, powerupY, 20, 10);
      ctx.fillStyle = '#000000';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('دUBLE', powerupX + 10, powerupY + 14);
      powerupX += 25;
    }

    if (state.shield && state.shieldTimer > 0) {
      ctx.fillStyle = '#5b8cc7';
      ctx.beginPath();
      ctx.arc(powerupX + 10, powerupY + 10, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000000';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(' محافظ', powerupX + 10, powerupY + 24);
    }
  }

  function drawGameOver(ctx) {
    // Overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Game Over
    ctx.fillStyle = '#ffffff';
    ctx.font = '24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('بازی تمام شد', CANVAS_W / 2, CANVAS_H / 2 - 40);

    // Score
    ctx.font = '18px monospace';
    ctx.fillText(`امتیاز: ${state.score}`, CANVAS_W / 2, CANVAS_H / 2);
    ctx.fillText(`موج: ${state.wave}`, CANVAS_W / 2, CANVAS_H / 2 + 25);

    // Instructions
    ctx.font = '14px monospace';
    ctx.fillText('ر برای شروع دوباره', CANVAS_W / 2, CANVAS_H / 2 + 60);
    ctx.fillText('Esc برای خروج', CANVAS_W / 2, CANVAS_H / 2 + 85);
  }

  // Handle restart and exit in game over
  useEffect(() => {
    if (!state.gameOver) return;

    const handleKeyDown = (e) => {
      if (e.key === 'r' || e.key === 'R') {
        // Reset game
        setState({
          player: {
            x: CANVAS_W / 2 - 10,
            y: CANVAS_H - 50,
            w: PLAYER_PIXELS[0].length * PIXEL_SIZE,
            h: PLAYER_PIXELS.length * PIXEL_SIZE,
            invulnerable: 0,
            thrust: 0,
          },
          projectiles: [],
          enemies: [],
          powerups: [],
          particles: [],
          scorePopups: [],
          keys: {
            ArrowLeft: false,
            ArrowRight: false,
            KeyA: false,
            KeyD: false,
            Space: false,
          },
          wave: 1,
          score: 0,
          health: 3,
          isShooting: false,
          shootTimer: 0,
          rapidFire: false,
          doubleShot: false,
          shield: false,
          shieldTimer: 0,
          enemySpeed: ENEMY_BASE_SPEED,
          enemySpawnTimer: 0,
          enemySpawnRate: 1200,
          gameOver: false,
          paused: false,
        });
      } else if (e.key === 'Escape') {
        onGameOver();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.gameOver, onGameOver]);
}