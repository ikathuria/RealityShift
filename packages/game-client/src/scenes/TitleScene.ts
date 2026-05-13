import Phaser from "phaser";

export class TitleScene extends Phaser.Scene {
  constructor() {
    super("title");
  }

  create() {
    const { width, height } = this.scale;

    const gradient = this.add.graphics();
    gradient.fillGradientStyle(0x0b1728, 0x10233c, 0x143552, 0x09111d, 1);
    gradient.fillRect(0, 0, width, height);

    for (let index = 0; index < 48; index += 1) {
      const x = Phaser.Math.Between(0, width);
      const y = Phaser.Math.Between(0, height);
      const alpha = Phaser.Math.FloatBetween(0.18, 0.65);

      this.add.circle(x, y, Phaser.Math.Between(1, 3), 0xaed8ff, alpha);
    }

    this.add
      .text(width / 2, height / 2 - 88, "REALITYSHIFT", {
        fontFamily: "Georgia, serif",
        fontSize: "42px",
        color: "#f4ede1",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 - 16, "The Architect allows only stable rewrites.", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "20px",
        color: "#d9e8f8",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 44, "Browser scaffold active", {
        fontFamily: "Courier New, monospace",
        fontSize: "16px",
        color: "#8dd0ff",
      })
      .setOrigin(0.5);

    const pulse = this.add
      .rectangle(width / 2, height - 78, 280, 2, 0xd9b55a, 0.9)
      .setOrigin(0.5);

    this.tweens.add({
      targets: pulse,
      scaleX: 0.72,
      alpha: 0.35,
      duration: 1350,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }
}
