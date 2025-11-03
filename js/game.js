// Three.js scene setup
let scene, camera, renderer, controls;
let dungeon = [];
const dungeonWidth = 30;
const dungeonHeight = 20;
const tileSize = 1;
let buildMode = null;
let ghostObject = null;
let creatures = [];

// Game Resources
let gold = 5000;
let stone = 2500;
const roomCosts = {
    lair: { gold: 100, stone: 0 }
};

class Creature {
    constructor(x, z, type) {
        this.type = type;
        const geometry = new THREE.CapsuleGeometry(0.25, 0.5, 4, 8);
        const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(x, 0.5, z);
        scene.add(this.mesh);
        this.target = null;
        this.buildJob = null;
    }

    moveTo(target) {
        this.target = target;
    }

    workOn(job) {
        this.buildJob = job;
    }

    update() {
        if (this.target) {
            const direction = this.target.clone().sub(this.mesh.position).normalize();
            this.mesh.position.add(direction.multiplyScalar(0.05));

            if (this.mesh.position.distanceTo(this.target) < 0.1) {
                this.target = null;
                if (this.buildJob) {
                    setTimeout(() => {
                        buildRoom(this.buildJob.x, this.buildJob.y, this.buildJob.type);
                        scene.remove(this.mesh);
                        creatures = creatures.filter(c => c !== this);
                    }, 2000); // 2 second build time
                }
            }
        }
    }
}

function init() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(dungeonWidth / 2, dungeonHeight, dungeonHeight);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.target.set(dungeonWidth / 2, 0, dungeonHeight / 2);
    controls.update();

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    createDungeon();
    placeDungeonHeart();
    updateResourceUI();

    // UI
    document.getElementById('build-lair').addEventListener('click', () => {
        enterBuildMode('lair');
    });

    // Handle window resizing
    window.addEventListener('resize', onWindowResize, false);
    // Handle mouse events
    window.addEventListener('mousemove', onMouseMove, false);
    window.addEventListener('mousedown', onMouseDown, false);

    animate();
}

function createDungeon() {
    const wallGeometry = new THREE.BoxGeometry(tileSize, tileSize, tileSize);
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });

    for (let y = 0; y < dungeonHeight; y++) {
        dungeon[y] = [];
        for (let x = 0; x < dungeonWidth; x++) {
            const wall = new THREE.Mesh(wallGeometry, wallMaterial);
            wall.position.set(x, 0, y);
            wall.userData = {
                x, y,
                type: 'wall',
                hasGold: Math.random() < 0.1,
                hasStone: Math.random() < 0.2
            };
            scene.add(wall);
            dungeon[y][x] = wall;
        }
    }
}

function placeDungeonHeart() {
    const heartSize = 3;
    const centerX = Math.floor(dungeonWidth / 2);
    const centerY = Math.floor(dungeonHeight / 2);

    const heartMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });

    for (let y = centerY - 1; y <= centerY + 1; y++) {
        for (let x = centerX - 1; x <= centerX + 1; x++) {
            if (dungeon[y] && dungeon[y][x]) {
                const wall = dungeon[y][x];
                scene.remove(wall);
                if (x === centerX && y === centerY) {
                    const heart = new THREE.Mesh(new THREE.BoxGeometry(tileSize, tileSize, tileSize), heartMaterial);
                    heart.position.set(x, 0, y);
                    heart.userData = { x, y, type: 'heart' };
                    scene.add(heart);
                    dungeon[y][x] = heart;
                } else {
                    dungeon[y][x] = null; // Dug out area around the heart
                }
            }
        }
    }
}

function updateResourceUI() {
    document.getElementById('gold').textContent = `Gold: ${gold}`;
    document.getElementById('stone').textContent = `Stone: ${stone}`;
}

function enterBuildMode(type) {
    buildMode = type;
    const cost = roomCosts[type];
    if (gold < cost.gold || stone < cost.stone) {
        console.log("Not enough resources!");
        buildMode = null;
        return;
    }

    if (ghostObject) {
        scene.remove(ghostObject);
    }
    const geometry = new THREE.BoxGeometry(tileSize, tileSize, tileSize);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.5 });
    ghostObject = new THREE.Mesh(geometry, material);
    ghostObject.visible = false;
    scene.add(ghostObject);
}

function onMouseMove(event) {
    if (!buildMode) return;

    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersectPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersectPoint);

    if (intersectPoint) {
        const x = Math.floor(intersectPoint.x);
        const y = Math.floor(intersectPoint.z);

        if (x >= 0 && x < dungeonWidth && y >= 0 && y < dungeonHeight) {
            ghostObject.position.set(x, 0, y);
            ghostObject.visible = true;

            if (dungeon[y][x] === null) {
                ghostObject.material.color.set(0x00ff00); // Green for valid
            } else {
                ghostObject.material.color.set(0xff0000); // Red for invalid
            }
        } else {
            ghostObject.visible = false;
        }
    }
}

function onMouseDown(event) {
    // Prevent clicks on the UI from affecting the game world
    if (event.target !== renderer.domElement) {
        return;
    }

    if (buildMode) {
        startBuilding(event);
    } else {
        digTile(event);
    }
}

function digTile(event) {
    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(scene.children);

    if (intersects.length > 0) {
        const object = intersects[0].object;
        if (object.userData.type === 'wall') {
            const { x, y, hasGold, hasStone } = object.userData;
            if (hasGold) {
                gold += 100;
            }
            if (hasStone) {
                stone += 50;
            }
            updateResourceUI();
            scene.remove(object);
            dungeon[y][x] = null;
        }
    }
}

function startBuilding(event) {
    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersectPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersectPoint);

    if (intersectPoint) {
        const x = Math.floor(intersectPoint.x);
        const y = Math.floor(intersectPoint.z);
        const cost = roomCosts[buildMode];

        if (dungeon[y] && dungeon[y][x] === null && gold >= cost.gold && stone >= cost.stone) {
            gold -= cost.gold;
            stone -= cost.stone;
            updateResourceUI();

            // Create an Ogre to build the room
            const ogre = new Creature(dungeonWidth / 2, dungeonHeight / 2, 'ogre');
            creatures.push(ogre);
            ogre.moveTo(new THREE.Vector3(x, 0.5, y));
            ogre.workOn({ x, y, type: buildMode });

            // Exit build mode
            buildMode = null;
            scene.remove(ghostObject);
            ghostObject = null;
        }
    }
}

function buildRoom(x, y, type) {
    const roomGeometry = new THREE.BoxGeometry(tileSize, tileSize, tileSize);
    let roomMaterial;
    if (type === 'lair') {
        roomMaterial = new THREE.MeshStandardMaterial({ color: 0x0000ff }); // Blue for Lair
    }
    const room = new THREE.Mesh(roomGeometry, roomMaterial);
    room.position.set(x, 0, y);
    room.userData = { x, y, type: type };
    scene.add(room);
    dungeon[y][x] = room;
}


function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    creatures.forEach(creature => creature.update());
    renderer.render(scene, camera);
}

init();
