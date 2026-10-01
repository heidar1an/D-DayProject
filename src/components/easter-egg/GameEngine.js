import { useState, useRef, useCallback, useEffect } from 'react';
import {
  PLAYER_PIXELS,
  PLAYER_THRUST,
  ENEMY_HEART_PIXELS,
  ENEMY_BRAIN_PIXELS,
  ENEMY_BACTERIA_PIXELS,
  ENEMY_DNA_PIXELS,
  ENEMY_TEST_PIXELS,
  ENEMY_BOOK_PIXELS,
  ENEMY_FLASHCARD_PIXELS,
  ENEMY_MINIBOSS_PIXELS,
  POWERUP_RAPID_PIXELS,
  POWERUP_DOUBLE_PIXELS,
  POWERUP_SHIELD_PIXELS,
  POWERUP_PULSE_PIXELS,
  EXPLOSION_COLORS,
  SCORE_POPUP_COLOR,
  BOSS_HEALTH_COLOR,
  BOSS_HEALTH_BG_COLOR,
} from './pixelArts';

const PIXEL_SIZE = 4; // Size of each pixel in pixels

// Game constants
const CANVAS_WIDTH = 320;
const CANVAS_HEIGHT = 480;
const PLAYER_SPEED = 200; // pixels per second
const PROJECTILE_SPEED = 300; // pixels per second
const ENEMY_SPEED_BASE = 50; // base speed, increases with wave
const ENEMY_SPAWN_RATE_BASE = 1500; // ms between spawns
const POWERUP_SPAWN_CHANCE = 0.1; // 10% chance when enemy dies
const PARTICLE_COUNT = 8; // particles per explosion

// Enemy types
const ENEMY_TYPES = [
  { pixels: ENEMY_HEART_PIXELS, score: 10, speed: 1 },
  { pixels: ENEMY_BRAIN_PIXELS, score: 15, speed: 1.2 },
  { pixels: ENEMY_BACTERIA_PIXELS, score: 20, speed: 1.1 },
  { pixels: ENEMY_DNA_PIXELS, score: 25, speed: 1.3 },
  { pixels: ENEMY_TEST_PIXELS, score: 20, speed: 1 },
  { pixels: ENEMY_BOOK_PIXELS, score: 30, speed: 0.8 },
  { pixels: ENEMY_FLASHCARD_PIXELS, score: 15, speed: 1.4 },
];

// Power-up types
const POWERUP_TYPES = [
  { pixels: POWERUP_RAPID_PIXELS, type: 'rapid' },
  { pixels: POWERUP_DOUBLE_PIXELS, type: 'double' },
  { pixels: POWERUP_SHIELD_PIXELS, type: 'shield' },
  { pixels: POWERUP_PULSE_PIXELS, type: 'pulse' },
];

/**
 * Main game engine for Tapesh Space Shooter Easter Egg
 */
export function GameEngine({ onGameOver }) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastTimeRef = useRef(0);

  // Game state
  const [state, setState] = useState({
    player: {
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT - 40,
      width: PLAYER_PIXELS[0].length * PIXEL_SIZE,
      height: PLAYER_PIXELS.length * PIXEL_SIZE,
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
    enemySpeed: ENEMY_SPEED_BASE,
    enemySpawnRate: ENEMY_SPAWN_RATE_BASE,
    bossActive: false,
    boss: null,
    gameOver: false,
    paused: false,
  });

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctxRef.current = ctx;

    // Set canvas size
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    // Start game loop
    animate(performance.now());

    // Event listeners
    const handleKeyDown = (e) => {
      if (e.code === 'Escape') {
        onGameOver?.();
        return;
      }
      if (state.keys[e.code] !== undefined) {
        e.preventDefault();
        setState(prev => ({
          ...prev,
          keys: { ...prev.keys, [e.code]: true }
        }));
      }
    };

    const handleKeyUp = (e) => {
      if (state.keys[e.code] !== undefined) {
        e.preventDefault();
        setState(prev => ({
          ...prev,
          keys: { ...prev.keys, [e.code]: false }
        }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      cancelAnimationFrame(animationFrameRef.current);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [state, onGameOver]);

  // Game loop
  const animate = useCallback((timestamp) => {
    if (!ctxRef.current) return;

    const deltaTime = (timestamp - lastTimeRef.current) / 1000; // seconds
    lastTimeRef.current = timestamp;

    // Update game state
    update(deltaTime);

    // Render
    render();

    // Request next frame
    animationFrameRef.current = requestAnimationFrame(animate);
  }, []);

  // Update game state
  const update = useCallback((deltaTime) => {
    if (state.gameOver || state.paused) return;

    // Update player position based on input
    updatePlayer(deltaTime);

    // Update projectiles
    updateProjectiles(deltaTime);

    // Update enemies
    updateEnemies(deltaTime);

    // Update powerups
    updatePowerups(deltaTime);

    // Update particles
    updateParticles(deltaTime);

    // Update score popups
    updateScorePopups(deltaTime);

    // Update timers
    updateTimers(deltaTime);

    // Spawn enemies
    spawnEnemies(deltaTime);

    // Spawn powerups
    spawnPowerups();

    // Check collisions
    checkCollisions();

    // Update wave
    updateWave();
  }, []);

  // Update player position and state
  const updatePlayer = useCallback((deltaTime) => {
    const player = state.player;
    let moved = false;

    // Horizontal movement
    if ((state.keys.ArrowLeft || state.keys.KeyA) && player.x > 0) {
      player.x -= PLAYER_SPEED * deltaTime;
      moved = true;
    }
    if ((state.keys.ArrowRight || state.keys.KeyD) && player.x < CANVAS_WIDTH - player.width) {
      player.x += PLAYER_SPEED * deltaTime;
      moved = true;
    }

    // Shooting
    if ((state.keys.Space || state.keys.KeyD) && !state.isShooting) {
      shoot();
    } else if (!(state.keys.Space || state.keys.KeyD)) {
      setState(prev => ({ ...prev, isShooting: false }));
    }

    // Update thrust animation
    player.thrust = moved ? (player.thrust + 1) % 4 : 0;

    // Update invulnerability timer
    if (player.invulnerable > 0) {
      player.invulnerable -= deltaTime * 1000; // convert to ms
    }

    setState(prev => ({ ...prev, player: { ...player } }));
  }, []);

  // Shoot projectile
  const shoot = useCallback(() => {
    setState(prev => {
      const newProjectiles = [];

      // Main projectile
      newProjectiles.push({
        x: prev.player.x + prev.player.width / 2 - 1,
        y: prev.player.y,
        width: 2,
        height: 8,
        color: '#e0b45c',
        prev: { ...prev },
      });

      // Double shot powerup
      if (prev.doubleShot) {
        newProjectiles.push({
          x: prev.player.x + prev.player.width / 2 - 4,
          y: prev.player.y,
          width: 2,
          height: 8,
          color: '#e0b45c',
          prev: { ...prev },
        });
        newProjectiles.push({
          x: prev.player.x + prev.player.width / 2 + 2,
          y: prev.player.y,
          width: 2,
          height: 8,
          color: '#e0b45c',
          prev: { ...prev },
        });
      }

      return {
        ...prev,
        projectiles: [...prev.projectiles, ...newProjectiles],
        isShooting: true,
        shootTimer: prev.rapidFire ? 100 : 300, // ms between shots
      };
    });
  }, []);

  // Update projectiles
  const updateProjectiles = useCallback((deltaTime) => {
    setState(prev => {
      const updatedProjectiles = prev.projectiles.map(p => ({
        ...p,
        y: p.y - PROJECTILE_SPEED * deltaTime,
      }));

      // Remove off-screen projectiles
      const filtered = updatedProjectiles.filter(p => p.y + p.height > 0);

      return { ...prev, projectiles: filtered };
    });
  }, []);

  // Update enemies
  const updateEnemies = useCallback((deltaTime) => {
    setState(prev => {
      const updatedEnemies = prev.enemies.map(enemy => ({
        ...enemy,
        y: enemy.y + (enemy.speed * prev.enemySpeed * deltaTime),
      }));

      // Remove enemies that went off screen
      const filtered = updatedEnemies.filter(enemy => enemy.y < CANVAS_HEIGHT);

      // Check if any enemies reached bottom (player takes damage)
      let health = prev.health;
      const enemiesThatReachedBottom = updatedEnemies.filter(
        enemy => enemy.y >= CANVAS_HEIGHT - enemy.height
      );

      if (enemiesThatReachedBottom.length > 0 && prev.player.invulnerable <= 0) {
        health = Math.max(0, health - enemiesThatReachedBottom.length);

        // Make player temporarily invulnerable
        const player = { ...prev.player, invulnerable: 1.5 }; // 1.5 seconds

        return {
          ...prev,
          enemies: filtered,
          health,
          player,
        };
      }

      return { ...prev, enemies: filtered };
    });
  }, []);

  // Update powerups
  const updatePowerups = useCallback((deltaTime) => {
    setState(prev => {
      const updatedPowerups = prev.powerups.map(p => ({
        ...p,
        y: p.y + 30 * deltaTime, // slow fall speed
      }));

      // Remove off-screen powerups
      const filtered = updatedPowerups.filter(p => p.y < CANVAS_HEIGHT);

      return { ...prev, powerups: filtered };
    });
  }, []);

  // Update particles (explosions)
  const updateParticles = useCallback((deltaTime) => {
    setState(prev => {
      const updatedParticles = prev.particles.map(p => ({
        ...p,
        x: p.x + p.vx * deltaTime,
        y: p.y + p.vy * deltaTime,
        life: p.life - deltaTime,
        alpha: p.life / p.maxLife,
      }));

      // Remove dead particles
      const filtered = updatedParticles.filter(p => p.life > 0);

      return { ...prev, particles: filtered };
    });
  }, []);

  // Update score popups
  const updateScorePopups = useCallback((deltaTime) => {
    setState(prev => {
      const updatedScorePopups = prev.scorePopups.map(s => ({
        ...s,
        y: s.y - 20 * deltaTime, // float up
        life: s.life - deltaTime,
        alpha: s.life / s.maxLife,
      }));

      // Remove faded popups
      const filtered = updatedScorePopups.filter(s => s.life > 0);

      return { ...prev, scorePopups: filtered };
    });
  }, []);

  // Update timers
  const updateTimers = useCallback((deltaTime) => {
    setState(prev => {
      let shootTimer = prev.shootTimer;
      let shieldTimer = prev.shieldTimer;
      let rapidFire = prev.rapidFire;
      let doubleShot = prev.doubleShot;
      let shield = prev.shield;

      if (shootTimer > 0) {
        shootTimer -= deltaTime * 1000;
        if (shootTimer <= 0) shootTimer = 0;
      }

      if (shieldTimer > 0) {
        shieldTimer -= deltaTime * 1000;
        if (shieldTimer <= 0) {
          shieldTimer = 0;
          shield = false;
        }
      }

      // Powerup timers (simplified - they last for a fixed time after pickup)
      // In a full implementation, these would have their own timers

      return {
        ...prev,
        shootTimer,
        shieldTimer,
        rapidFire,
        doubleShot,
        shield,
      };
    });
  }, []);

  // Spawn enemies based on wave
  const spawnEnemies = useCallback((deltaTime) => {
    setState(prev => {
      if (prev.bossActive) return prev; // Don't spawn regular enemies during boss

      prev.enemySpawnTimer = (prev.enemySpawnTimer || 0) + deltaTime * 1000;

      if (prev.enemySpawnTimer >= prev.enemySpawnRate) {
        prev.enemySpawnTimer = 0;

        // Select enemy type based on wave
        const enemyIndex = Math.min(
          Math.floor((prev.wave - 1) / 2),
          ENEMY_TYPES.length - 1
        );
        const enemyType = ENEMY_TYPES[enemyIndex];

        // Spawn at random x position
        const maxX = CANVAS_WIDTH - (enemyType.pixels[0].length * PIXEL_SIZE);
        const x = Math.random() * maxX;

        return {
          ...prev,
          enemies: [...prev.enemies, {
            x,
            y: -20, // start slightly above screen
            width: enemyType.pixels[0].length * PIXEL_SIZE,
            height: enemyType.pixels.length * PIXEL_SIZE,
            pixels: enemyType.pixels,
            score: enemyType.score,
            speed: enemyType.speed * (1 + (prev.wave - 1) * 0.1), // increase speed with wave
          }]
        };
      }

      return prev;
    });
  }, []);

  // Spawn powerups
  const spawnPowerups = useCallback(() => {
    setState(prev => {
      // Simple powerup spawning - in reality this would happen when enemies die
      // For now, occasional random spawns
      if (Math.random() < 0.001) { // 0.1% chance per frame
        const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
        const maxX = CANVAS_WIDTH - (type.pixels[0].length * PIXEL_SIZE);
        const x = Math.random() * maxX;

        return {
          ...prev,
          powerups: [...prev.powerups, {
            x,
            y: -20,
            width: type.pixels[0].length * PIXEL_SIZE,
            height: type.pixels.length * PIXEL_SIZE,
            pixels: type.pixels,
            powerupType: type.type,
          }]
        };
      }

      return prev;
    });
  }, []);

  // Check collisions
  const checkCollisions = useCallback(() => {
    setState(prev => {
      let projectiles = [...prev.projectiles];
      let enemies = [...prev.enemies];
      let powerups = [...prev.powerups];
      let score = prev.score;
      let health = prev.health;
      let player = { ...prev.player };
      let particles = [...prev.particles];
      let scorePopups = [...prev.scorePopups];
      let rapidFire = prev.rapidFire;
      let doubleShot = prev.doubleShot;
      let shield = prev.shield;

      // Projectile vs Enemies
      projectiles = projectiles.filter((p, pIndex) => {
        let hit = false;

        enemies = enemies.filter((e, eIndex) => {
          if (
            p.x < e.x + e.width &&
            p.x + p.width > e.x &&
            p.y < e.y + e.height &&
            p.y + p.height > e.y
          ) {
            // Collision!
            hit = true;

            // Add score
            score += e.score;

            // Add score popup
            scorePopups.push({
              x: e.x + e.width / 2,
              y: e.y,
              text: `+${e.score}`,
              life: 0.8,
              maxLife: 0.8,
              alpha: 1,
              color: SCORE_POPUP_COLOR,
            });

            // Create explosion
            createExplosion(
              e.x + e.width / 2,
              e.y + e.height / 2,
              particles,
              EXPLOSION_COLORS
            );

            // Chance to drop powerup
            if (Math.random() < POWERUP_SPAWN_CHANCE) {
              const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
              powerups.push({
                x: e.x,
                y: e.y,
                width: type.pixels[0].length * PIXEL_SIZE,
                height: type.pixels.length * PIXEL_SIZE,
                pixels: type.pixels,
                powerupType: type.type,
              });
            }

            return false; // remove enemy
          }
          return true;
        });

        return !hit; // keep projectile if it didn't hit anything
      });

      // Player vs Powerups
      powerups = powerups.filter((pu, puIndex) => {
        if (
          player.x < pu.x + pu.width &&
          player.x + player.width > pu.x &&
          player.y < pu.y + pu.height &&
          player.y + player.height > pu.y
        ) {
          // Powerup collected!
          switch (pu.powerupType) {
            case 'rapid':
              rapidFire = true;
              // In a full game, this would timeout after some time
              break;
            case 'double':
              doubleShot = true;
              break;
            case 'shield':
              shield = true;
              shieldTimer = 5000; // 5 seconds
              break;
            case 'pulse':
              // Pulse - destroy all enemies on screen
              enemies.forEach(enemy => {
                score += enemy.score;
                scorePopups.push({
                  x: enemy.x + enemy.width / 2,
                  y: enemy.y,
                  text: `+${enemy.score}`,
                  life: 0.8,
                  maxLife: 0.8,
                  alpha: 1,
                  color: SCORE_POPUP_COLOR,
                });
                createExplosion(
                  enemy.x + enemy.width / 2,
                  enemy.y + enemy.height / 2,
                  particles,
                  EXPLOSION_COLORS
                );
              });
              enemies = [];
              break;
          }

          return false; // remove powerup
        }
        return true;
      });

      // Player vs Enemies (if not invulnerable)
      if (player.invulnerable <= 0) {
        enemies = enemies.filter(enemy => {
          if (
            player.x < enemy.x + enemy.width &&
            player.x + player.width > enemy.x &&
            player.y < enemy.y + enemy.height &&
            player.y + player.height > enemy.y
          ) {
            // Collision with enemy
            health = Math.max(0, health - 1);
            player.invulnerable = 1.5; // temporary invulnerability

            // Create explosion at player position
            createExplosion(
              player.x + player.width / 2,
              player.y + player.height / 2,
              particles,
              EXPLOSION_COLORS
            );

            return false; // remove enemy
          }
          return true;
        });
      }

      // Check for game over
      if (health <= 0) {
        return {
          ...prev,
          gameOver: true,
          health: 0,
        };
      }

      return {
        ...prev,
        projectiles,
        enemies,
        powerups,
        score,
        health,
        player,
        particles,
        scorePopups,
        rapidFire,
        doubleShot,
        shield,
      };
    });
  }, []);

  // Create explosion particles
  const createExplosion = useCallback((x, y, particlesArray, colors) => {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = (Math.PI * 2 * i) / PARTICLE_COUNT;
      const speed = 20 + Math.random() * 30;
      particlesArray.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.4 + Math.random() * 0.2, // 0.4-0.6 seconds
        maxLife: 0.4 + Math.random() * 0.2,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 2 + Math.random() * 3,
      });
    }
  }, []);

  // Update wave based on score
  const updateWave = useCallback(() => {
    setState(prev => {
      const newWave = Math.floor(prev.score / 500) + 1; // new wave every 500 points
      if (newWave !== prev.wave) {
        // Increase difficulty with wave
        return {
          ...prev,
          wave: newWave,
          enemySpeed: ENEMY_SPEED_BASE * (1 + (newWave - 1) * 0.15),
          enemySpawnRate: Math.max(300, ENEMY_SPAWN_RATE_BASE * (1 - (newWave - 1) * 0.1)),
        };
      }
      return prev;
    });
  }, []);

  // Render the game
  const render = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw background (dark with subtle gradient)
    ctx.fillStyle = '#181818';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw player
    drawPixelObject(ctx, state.player, PLAYER_PIXELS, PIXEL_SIZE);

    // Draw player thrust
    if (state.player.thrust % 2 === 0) {
      drawPixelObject(
        ctx,
        {
          x: state.player.x + state.player.width / 2 - 1.5 * PIXEL_SIZE,
          y: state.player.y + state.player.height,
          width: 3 * PIXEL_SIZE,
          height: 2 * PIXEL_SIZE,
        },
        PLAYER_THRUST,
        PIXEL_SIZE
      );
    }

    // Draw projectiles
    state.projectiles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.width, p.height);
    });

    // Draw enemies
    state.enemies.forEach(enemy => {
      drawPixelObject(ctx, enemy, enemy.pixels, PIXEL_SIZE);
    });

    // Draw powerups
    state.powerups.forEach(powerup => {
      drawPixelObject(ctx, powerup, powerup.pixels, PIXEL_SIZE);

      // Add a subtle pulse effect
      const pulse = Math.sin(performance.now() * 0.005) * 0.2 + 0.8;
      ctx.save();
      ctx.globalAlpha = 0.3 * pulse;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(
        powerup.x,
        powerup.y,
        powerup.width,
        powerup.height
      );
      ctx.restore();
    });

    // Draw particles
    state.particles.forEach(particle => {
      ctx.save();
      ctx.globalAlpha = particle.alpha;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Draw score popups
    state.scorePopups.forEach(popup => {
      ctx.save();
      ctx.globalAlpha = popup.alpha;
      ctx.fillStyle = popup.color;
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(popup.text, popup.x, popup.y);
      ctx.restore();
    });

    // Draw HUD
    drawHUD(ctx);

    // Draw game over screen
    if (state.gameOver) {
      drawGameOver(ctx);
    }
  }, []);

  // Draw pixel-based object
  const drawPixelObject = useCallback((ctx, obj, pixels, pixelSize) => {
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
  }, []);

  // Draw HUD (Heads Up Display)
  const drawHUD = useCallback((ctx) => {
    // Score
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${state.score}`, 10, 25);

    // Wave
    ctx.textAlign = 'center';
    ctx.fillText(`Wave: ${state.wave}`, CANVAS_WIDTH / 2, 25);

    // Health (hearts)
    ctx.textAlign = 'right';
    for (let i = 0; i < 3; i++) {
      const x = CANVAS_WIDTH - 10 - i * 20;
      const y = 25;
      if (i < state.health) {
        ctx.fillStyle = '#e26d6d'; // red heart
      } else {
        ctx.fillStyle = '#444444'; // empty heart
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
    const powerupY = 50;
    let powerupX = 10;

    if (state.rapidFire) {
      ctx.fillStyle = '#ff9717';
      ctx.fillRect(powerupX, powerupY, 20, 10);
      ctx.fillStyle = '#000000';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('RAPID', powerupX + 10, powerupY + 14);
      powerupX += 25;
    }

    if (state.doubleShot) {
      ctx.fillStyle = '#61d192';
      ctx.fillRect(powerupX, powerupY, 20, 10);
      ctx.fillStyle = '#000000';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('DOUBLE', powerupX + 10, powerupY + 14);
      powerupX += 25;
    }

    if (state.shield) {
      ctx.fillStyle = '#5b8cc7';
      ctx.beginPath();
      ctx.arc(powerupX + 10, powerupY + 10, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000000';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SHIELD', powerupX + 10, powerupY + 24);
    }
  }, []);

  // Draw game over screen
  const drawGameOver = useCallback((ctx) => {
    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Game Over text
    ctx.fillStyle = '#ffffff';
    ctx.font = '24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40);

    // Score
    ctx.font = '18px monospace';
    ctx.fillText(`Score: ${state.score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    ctx.fillText(`Wave: ${state.wave}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 25);

    // Instructions
    ctx.font = '14px monospace';
    ctx.fillText('Press R to Restart', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 60);
    ctx.fillText('Press ESC to Exit', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 85);
  }, []);

  // Handle restart (R key) and exit (ESC key) in game over
  useEffect(() => {
    if (!state.gameOver) return;

    const handleKeyDown = (e) => {
      if (e.key === 'r' || e.key === 'R') {
        // Reset game
        setState({
          player: {
            x: CANVAS_WIDTH / 2,
            y: CANVAS_HEIGHT - 40,
            width: PLAYER_PIXELS[0].length * PIXEL_SIZE,
            height: PLAYER_PIXELS.length * PIXEL_SIZE,
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
          enemySpeed: ENEMY_SPEED_BASE,
          enemySpawnRate: ENEMY_SPAWN_RATE_BASE,
          bossActive: false,
          boss: null,
          gameOver: false,
          paused: false,
        });
      } else if (e.key === 'Escape') {
        onGameOver?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.gameOver, onGameOver]);
}

// Export for use in other files
export default GameEngine;