class MainScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainScene' });
    }

    preload() {
        this.load.image('wall', 'assets/wall.png');
        this.load.image('ground', 'assets/ground.png');
        this.load.image('ogre', 'assets/ogre.png');
    }

    create() {
        // Set up game objects here
        this.gold = 5000; // Starting gold
        this.stone = 2500; // Starting stone
        this.dreadstones = 0; // Starting dreadstones
        this.dungeon = this.createDungeon(30, 20);
        this.placeDungeonHeart(15, 10);
        this.drawDungeon();
        this.input.on('pointerdown', this.handleTileClick, this);
        this.buildMode = null; // Can be 'lair', 'hatchery', etc.

        // Simple UI to enter build mode
        this.add.text(10, 10, 'Build Lair (L)', { fill: '#fff' }).setInteractive().on('pointerdown', () => {
            this.buildMode = 'lair';
        });
        this.add.text(10, 30, 'Summon Ogre (O)', { fill: '#fff' }).setInteractive().on('pointerdown', () => {
            this.summonCreature('ogre');
        });

        this.creatures = [];

        // Resource display
        this.goldText = this.add.text(680, 10, 'Gold: ' + this.gold, { fill: '#ffd700' });
        this.stoneText = this.add.text(680, 30, 'Stone: ' + this.stone, { fill: '#c0c0c0' });
        this.dreadstoneText = this.add.text(680, 50, 'Dreadstones: ' + this.dreadstones, { fill: '#ff00ff' });

        // Hamburger menu
        this.menuButton = this.add.text(10, 50, 'Menu', { fill: '#fff' }).setInteractive();
        this.menu = this.add.group();
        this.menu.setVisible(false);

        let restartButton = this.add.text(10, 70, 'Restart', { fill: '#fff' }).setInteractive();
        restartButton.on('pointerdown', () => this.scene.restart());
        this.menu.add(restartButton);

        this.menu.add(this.add.text(10, 90, 'Log Out', { fill: '#fff' }));
        this.menu.add(this.add.text(10, 110, 'Help', { fill: '#fff' }));
        this.menu.add(this.add.text(10, 130, 'Encyclopedia', { fill: '#fff' }));
        this.menu.add(this.add.text(10, 150, 'Settings', { fill: '#fff' }));
        this.menu.add(this.add.text(10, 170, 'Tournament Games', { fill: '#fff' }));

        this.menuButton.on('pointerdown', () => {
            this.menu.setVisible(!this.menu.visible);
        });

        // Zoom functionality
        this.cameras.main.setZoom(1);
        this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
            if (deltaY > 0) {
                this.cameras.main.zoom = Math.max(0.5, this.cameras.main.zoom - 0.1);
            }
            if (deltaY < 0) {
                this.cameras.main.zoom = Math.min(2, this.cameras.main.zoom + 0.1);
            }
        });
    }

    update() {
        this.goldText.setText('Gold: ' + this.gold);
        this.stoneText.setText('Stone: ' + this.stone);
        this.dreadstoneText.setText('Dreadstones: ' + this.dreadstones);
    }

    summonCreature(creatureType) {
        if (creatureType === 'ogre') {
            const creatureCost = { gold: 300 };
            if (this.gold >= creatureCost.gold) {
                this.gold -= creatureCost.gold;
                let creature = new Creature(this, 400, 300, 'ogre');
                this.creatures.push(creature);
            } else {
                console.log("Not enough gold to summon Ogre!");
            }
        }
    }

    handleTileClick(pointer) {
        if (this.buildMode) {
            this.buildRoom(pointer);
        } else {
            this.digTile(pointer);
        }
    }

    buildRoom(pointer) {
        const TILE_SIZE = 32;
        const x = Math.floor(pointer.worldX / TILE_SIZE);
        const y = Math.floor(pointer.worldY / TILE_SIZE);

        if (x >= 0 && x < this.dungeon[0].length && y >= 0 && y < this.dungeon.length) {
            let tile = this.dungeon[y][x];
            if (tile.isDug && tile.tileType === 'ground') {
                const roomCost = { gold: 25 }; // Cost for a Lair tile
                if (this.gold >= roomCost.gold) {
                    this.gold -= roomCost.gold;
                    this.stone -= roomCost.stone;
                    tile.tileType = 'room_lair';
                    tile.gameObject.setTint(0x00FF00); // Green for Lair
                } else {
                    console.log("Not enough resources!");
                }
            }
        }
        this.buildMode = null;
    }

    digTile(pointer) {
        const TILE_SIZE = 32;
        const x = Math.floor(pointer.worldX / TILE_SIZE);
        const y = Math.floor(pointer.worldY / TILE_SIZE);

        if (x >= 0 && x < this.dungeon[0].length && y >= 0 && y < this.dungeon.length) {
            let tile = this.dungeon[y][x];
            if (tile.isWall) {
                tile.isDug = true;
                tile.isWall = false;
                tile.tileType = 'ground';

                if (tile.hasGold) {
                    this.gold += 100;
                    tile.hasGold = false;
                }
                if (tile.hasStone) {
                    this.stone += 50;
                    tile.hasStone = false;
                }
                tile.gameObject.setTexture('ground');
            }
        }
    }

    createDungeon(width, height) {
        let dungeon = [];
        for (let y = 0; y < height; y++) {
            let row = [];
            for (let x = 0; x < width; x++) {
                row.push({
                    x: x,
                    y: y,
                    isDug: false,
                    isWall: true,
                    gameObject: null,
                    hasGold: Math.random() < 0.1,
                    hasStone: Math.random() < 0.2,
                    tileType: 'wall'
                });
            }
            dungeon.push(row);
        }
        return dungeon;
    }

    placeDungeonHeart(centerX, centerY) {
        const heartSize = 3;
        const startX = centerX - Math.floor(heartSize / 2);
        const startY = centerY - Math.floor(heartSize / 2);

        for (let y = startY; y < startY + heartSize; y++) {
            for (let x = startX; x < startX + heartSize; x++) {
                let tile = this.dungeon[y][x];
                tile.isDug = true;
                tile.isWall = false;
                tile.tileType = 'room_heart';
            }
        }

        const clearRadius = 5;
        for (let y = centerY - clearRadius; y <= centerY + clearRadius; y++) {
            for (let x = centerX - clearRadius; x <= centerX + clearRadius; x++) {
                if (x >= 0 && x < this.dungeon[0].length && y >= 0 && y < this.dungeon.length) {
                    let tile = this.dungeon[y][x];
                    if (tile.isWall && tile.tileType !== 'room_heart') {
                        let distance = Phaser.Math.Distance.Between(centerX, centerY, x, y);
                        if (distance <= clearRadius) {
                            tile.isDug = true;
                            tile.isWall = false;
                            tile.tileType = 'ground';
                        }
                    }
                }
            }
        }
    }

    drawDungeon() {
        const TILE_SIZE = 32;
        for (let y = 0; y < this.dungeon.length; y++) {
            for (let x = 0; x < this.dungeon[y].length; x++) {
                let tile = this.dungeon[y][x];
                let tileSprite;

                if (tile.tileType === 'wall') {
                    tileSprite = this.add.sprite(x * TILE_SIZE, y * TILE_SIZE, 'wall').setOrigin(0);
                } else {
                    tileSprite = this.add.sprite(x * TILE_SIZE, y * TILE_SIZE, 'ground').setOrigin(0);
                    if (tile.tileType === 'room_heart') {
                        tileSprite.setTint(0xFF0000);
                    } else if (tile.tileType === 'room_lair') {
                        tileSprite.setTint(0x00FF00);
                    }
                }
                tile.gameObject = tileSprite;
            }
        }
    }
}

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    scene: [MainScene]
};

const game = new Phaser.Game(config);
