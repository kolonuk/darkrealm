class Creature extends Phaser.GameObjects.Sprite {
    constructor(scene, x, y, type) {
        super(scene, x, y, type);
        scene.add.existing(this);
        this.type = type;
        this.moveTimer = scene.time.addEvent({
            delay: 1000,
            callback: this.move,
            callbackScope: this,
            loop: true
        });
    }

    move() {
        const TILE_SIZE = 32;
        let currentTileX = Math.floor(this.x / TILE_SIZE);
        let currentTileY = Math.floor(this.y / TILE_SIZE);

        let possibleMoves = [];
        let directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];

        for (let dir of directions) {
            let nextX = currentTileX + dir[0];
            let nextY = currentTileY + dir[1];
            if (
                nextX >= 0 && nextX < this.scene.dungeon[0].length &&
                nextY >= 0 && nextY < this.scene.dungeon.length &&
                this.scene.dungeon[nextY][nextX].isDug
            ) {
                possibleMoves.push({ x: nextX, y: nextY });
            }
        }

        if (possibleMoves.length > 0) {
            let move = Phaser.Math.RND.pick(possibleMoves);
            this.scene.tweens.add({
                targets: this,
                x: move.x * TILE_SIZE + TILE_SIZE / 2,
                y: move.y * TILE_SIZE + TILE_SIZE / 2,
                duration: 500
            });
        }
    }
}
