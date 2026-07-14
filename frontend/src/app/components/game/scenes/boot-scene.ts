import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    this.load.image('soldiers', 'assets/soldiers.png');
    this.load.image('archer', 'assets/archer.png');
    this.load.image('tank', 'assets/tank.png');
    this.load.image('barracks', 'assets/barracks.png');
  }

  create() {
    this.scene.start('GameScene');
  }
}
