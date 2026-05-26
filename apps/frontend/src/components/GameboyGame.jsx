import { useEffect, useRef } from 'react';
import Phaser from 'phaser';

const GAME_WIDTH = 320;
const GAME_HEIGHT = 240;

class ShowtimeScene extends Phaser.Scene {
  constructor() {
    super('ShowtimeScene');
    this.rover = null;
    this.cursors = null;
    this.score = 0;
    this.lives = 3;
    this.take = 27;
    this.gameOver = false;
    this.invincible = false;
    this.invincibleTimer = 0;
    this.spawnTimer = 0;
    this.overheadSpawnTimer = 0;
  }

  preload() {
    this.load.image('background_stars', '/game/background_stars.png');
    this.load.image('soundstage_bg', '/game/soundstage_bg.png');
    this.load.image('tilemap', '/game/tilemap.png');
    this.load.image('rover', '/game/lander.png');
    this.load.image('spotlight', '/game/spotlight.png');
    this.load.image('moonrock', '/game/moonrock.png');
    this.load.image('crane', '/game/crane.png');
    this.load.image('director', '/game/director.png');
    this.load.image('clapper', '/game/clapper.png');
    this.load.image('crewhand', '/game/crewhand.png');
    this.load.image('crewhands', '/game/crewhands.png');
  }

  create() {
    this.bgStars = this.add
      .tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, 'background_stars')
      .setOrigin(0, 0);

    this.soundstage = this.add
      .tileSprite(0, 40, GAME_WIDTH, 160, 'soundstage_bg')
      .setOrigin(0, 0);

    this.ground = this.physics.add
      .staticImage(GAME_WIDTH / 2, GAME_HEIGHT - 16, 'tilemap')
      .setScale(2, 1)
      .refreshBody();

    this.rover = this.physics.add.sprite(60, GAME_HEIGHT - 40, 'rover');
    this.rover.setCollideWorldBounds(true);
    this.rover.setGravityY(200);
    this.physics.add.collider(this.rover, this.ground);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.groundObstacles = this.physics.add.group();
    this.overheadObstacles = this.physics.add.group();

    this.physics.add.overlap(
      this.rover,
      this.groundObstacles,
      () => this.handleHit(),
      null,
      this
    );
    this.physics.add.overlap(
      this.rover,
      this.overheadObstacles,
      () => this.handleHit(),
      null,
      this
    );

    const hudStyle = {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#ffffff',
    };

    this.scoreText = this.add.text(8, 8, 'SCORE: 000000', hudStyle);
    this.takeText = this.add
      .text(GAME_WIDTH / 2, 8, `TAKE: ${this.take}`, hudStyle)
      .setOrigin(0.5, 0);
    this.livesText = this.add
      .text(GAME_WIDTH - 8, 8, 'LIVES: 🚀 🚀 🚀', hudStyle)
      .setOrigin(1, 0);

    this.gameOverText = this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 - 20,
        'GAME OVER\n\nPAGE NOT FOUND\n404',
        {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#ffffff',
          align: 'center',
        }
      )
      .setOrigin(0.5)
      .setVisible(false);
  }

  handleHit() {
    if (this.gameOver || this.invincible) return;

    this.lives -= 1;
    this.updateLivesText();

    if (this.lives <= 0) {
      this.triggerGameOver();
      return;
    }

    this.invincible = true;
    this.invincibleTimer = 1500;

    this.tweens.add({
      targets: this.rover,
      alpha: 0.3,
      yoyo: true,
      repeat: -1,
      duration: 150,
    });
  }

  updateLivesText() {
    const icons = ['🚀', '🚀', '🚀'].slice(0, this.lives).join(' ');
    this.livesText.setText(`LIVES: ${icons}`);
  }

  triggerGameOver() {
    this.gameOver = true;
    this.rover.setVelocity(0, 0);
    this.rover.body.enable = false;
    this.groundObstacles.clear(true, true);
    this.overheadObstacles.clear(true, true);
    this.gameOverText.setVisible(true);
  }

  spawnGroundObstacle() {
    const type = Phaser.Utils.Array.GetRandom(['moonrock', 'spotlight']);
    const obstacle = this.groundObstacles.create(
      GAME_WIDTH + 20,
      GAME_HEIGHT - 32,
      type
    );
    obstacle.setVelocityX(-80);
    obstacle.setImmovable(true);
    obstacle.body.allowGravity = false;
  }

  spawnOverheadObstacle() {
    const obstacle = this.overheadObstacles.create(
      GAME_WIDTH + 20,
      80,
      'crane'
    );
    obstacle.setVelocityX(-80);
    obstacle.body.allowGravity = false;
  }

  update(_, delta) {
    if (this.gameOver) return;

    const dt = delta / 1000;

    this.bgStars.tilePositionX += 10 * dt;
    this.soundstage.tilePositionX += 30 * dt;

    this.score += Math.floor(10 * dt);
    this.scoreText.setText(
      `SCORE: ${this.score.toString().padStart(6, '0')}`
    );

    if (this.invincible) {
      this.invincibleTimer -= delta;
      if (this.invincibleTimer <= 0) {
        this.invincible = false;
        this.rover.alpha = 1;
        this.tweens.killTweensOf(this.rover);
      }
    }

    this.groundObstacles.children.iterate(child => {
      if (child && child.x < -40) child.destroy();
    });

    this.overheadObstacles.children.iterate(child => {
      if (child && child.x < -40) child.destroy();
    });

    const onGround =
      this.rover.body.blocked.down || this.rover.body.touching.down;

    if ((this.cursors.up.isDown || this.cursors.space?.isDown) && onGround) {
      this.rover.setVelocityY(-160);
    }

    if (this.cursors.down.isDown) {
      this.rover.setScale(1, 0.6);
      this.rover.body.setSize(
        this.rover.width,
        this.rover.height * 0.6
      );
      this.rover.body.offset.y = this.rover.height * 0.4;
    } else {
      this.rover.setScale(1, 1);
      this.rover.body.setSize(this.rover.width, this.rover.height);
      this.rover.body.offset.y = 0;
    }

    this.spawnTimer += delta;
    if (this.spawnTimer > 1200) {
      this.spawnTimer = 0;
      this.spawnGroundObstacle();
    }

    this.overheadSpawnTimer += delta;
    if (this.overheadSpawnTimer > 2000) {
      this.overheadSpawnTimer = 0;
      this.spawnOverheadObstacle();
    }
  }
}

const GameboyGame = () => {
  const gameRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (gameRef.current) return;

    const config = {
      type: Phaser.AUTO,
      parent: containerRef.current,
      pixelArt: true,

      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },

      physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 }, debug: false },
      },

      scene: [ShowtimeScene],
    };

    gameRef.current = new Phaser.Game(config);

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  return (
    <div className="w-full h-full flex items-center justify-center">
      <div
        ref={containerRef}
        className="border border-gray-700 bg-black"
        style={{
          width: '100vw',
          height: '100vh',
          imageRendering: 'pixelated',
          display: 'block',
        }}
      />
      <p className="absolute bottom-4 text-xs text-gray-400 text-center w-full font-mono">
        Use ↑ to jump, ↓ to duck. Avoid props and overhead gear on the lunar soundstage.
      </p>
    </div>
  );
};

export default GameboyGame;
