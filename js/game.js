// Three.js scene setup
let scene, camera, renderer, controls;
let dungeon = [];
const dungeonWidth = 30;
const dungeonHeight = 20;
const tileSize = 1;
let buildMode = null;
let ghostObject = null;
let creatures = [];
let jobQueue = [];

// Game Resources
let gold = 5000;
let stone = 2500;
const roomCosts = {
    'spawning-pit': { gold: 150, stone: 0 }
};

class Ogre {
    constructor(x, z) {
        this.type = 'ogre';

        const bodyGeometry = new THREE.SphereGeometry(0.3, 8, 6);
        const headGeometry = new THREE.SphereGeometry(0.2, 8, 6);
        const armGeometry = new THREE.CapsuleGeometry(0.1, 0.4, 4, 8);
        const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });

        this.mesh = new THREE.Group();
        const body = new THREE.Mesh(bodyGeometry, material);
        const head = new THREE.Mesh(headGeometry, material);
        const leftArm = new THREE.Mesh(armGeometry, material);
        const rightArm = new THREE.Mesh(armGeometry, material);

        body.position.y = 0.3;
        head.position.y = 0.6;
        head.position.z = 0.1;
        leftArm.position.set(-0.3, 0.4, 0);
        leftArm.rotation.z = Math.PI / 4;
        rightArm.position.set(0.3, 0.4, 0);
        rightArm.rotation.z = -Math.PI / 4;

        this.mesh.add(body);
        this.mesh.add(head);
        this.mesh.add(leftArm);
        this.mesh.add(rightArm);

        this.mesh.position.set(x, 0, z);
        scene.add(this.mesh);
        this.job = null;
        this.path = null;
        this.state = 'idle'; // idle, moving, working, returning
        this.workTimer = 0;
        this.workDuration = 0;
    }

    findJob() {
        if (jobQueue.length > 0) {
            this.job = jobQueue.shift();
            const startNode = { x: Math.floor(this.mesh.position.x), y: Math.floor(this.mesh.position.z) };
            const endNode = { x: this.job.x, y: this.job.y };
            this.path = findPath(startNode, endNode);
            if (this.path) {
                this.state = 'moving';
            } else {
                jobQueue.unshift(this.job);
                this.job = null;
            }
        }
    }

    update() {
        switch (this.state) {
            case 'idle':
                this.findJob();
                break;
            case 'moving':
                if (this.path.length > 0) {
                    const targetNode = this.path[0];
                    const targetPosition = new THREE.Vector3(targetNode.x, 0, targetNode.y);
                    const direction = targetPosition.clone().sub(this.mesh.position).normalize();
                    this.mesh.position.add(direction.multiplyScalar(0.05));
                    if (this.mesh.position.distanceTo(targetPosition) < 0.1) {
                        this.path.shift();
                    }
                } else {
                    this.state = 'working';
                     this.workDuration = 200; // 2 seconds at 60fps
                     this.workTimer = 200;
                }
                break;
            case 'working':
                this.workTimer--;
                if (this.workTimer <= 0) {
                    if (this.job.type === 'dig') {
                        const { x, y } = this.job;
                        const object = dungeon[y][x];
                        if (object && object.userData.type === 'wall') {
                             if (object.userData.hasGold) {
                                gold += 100;
                            }
                            if (object.userData.hasStone) {
                                stone += 50;
                            }
                            updateResourceUI();
                            scene.remove(object);
                            dungeon[y][x] = null;
                        }
                    } else if (this.job.type === 'build') {
                        buildRoom(this.job.x, this.job.y, this.job.roomType);
                    }
                    const heartPosition = new THREE.Vector3(Math.floor(dungeonWidth / 2), 0, Math.floor(dungeonHeight / 2));
                    const startNode = { x: Math.floor(this.mesh.position.x), y: Math.floor(this.mesh.position.z) };
                    const endNode = { x: Math.floor(heartPosition.x), y: Math.floor(heartPosition.z) };
                    this.path = findPath(startNode, endNode);
                    this.state = 'returning';
                }
                break;
            case 'returning':
                if (this.path.length > 0) {
                    const targetNode = this.path[0];
                    const targetPosition = new THREE.Vector3(targetNode.x, 0, targetNode.y);
                    const direction = targetPosition.clone().sub(this.mesh.position).normalize();
                    this.mesh.position.add(direction.multiplyScalar(0.05));
                    if (this.mesh.position.distanceTo(targetPosition) < 0.1) {
                        this.path.shift();
                    }
                } else {
                    this.state = 'idle';
                    this.job = null;
                }
                break;
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

    const ogre = new Ogre(Math.floor(dungeonWidth / 2), Math.floor(dungeonHeight / 2));
    creatures.push(ogre);

    // UI
    document.getElementById('build-spawning-pit').addEventListener('click', () => {
        enterBuildMode('spawning-pit');
    });

    // Handle window resizing
    window.addEventListener('resize', onWindowResize, false);
    // Handle mouse events
    window.addEventListener('mousemove', onMouseMove, false);
    window.addEventListener('mousedown', onMouseDown, false);
    window.addEventListener('dblclick', onDoubleClick, false);

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
    }
}

function onDoubleClick(event) {
    // Prevent clicks on the UI from affecting the game world
    if (event.target !== renderer.domElement) {
        return;
    }

    if (!buildMode) {
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
            const { x, y } = object.userData;
            addJobToQueue({ type: 'dig', x, y });
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

            addJobToQueue({ type: 'build', x, y, roomType: buildMode });

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
    if (type === 'spawning-pit') {
        roomMaterial = new THREE.MeshStandardMaterial({ color: 0x8A2BE2 }); // Blue-Violet for Spawning Pit
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

function findPath(start, end) {
    const openSet = [start];
    const closedSet = [];
    const cameFrom = {};

    const gScore = {};
    gScore[`${start.x},${start.y}`] = 0;

    const fScore = {};
    fScore[`${start.x},${start.y}`] = heuristic(start, end);

    while (openSet.length > 0) {
        let current = openSet[0];
        for (let i = 1; i < openSet.length; i++) {
            if (fScore[`${openSet[i].x},${openSet[i].y}`] < fScore[`${current.x},${current.y}`]) {
                current = openSet[i];
            }
        }

        if (current.x === end.x && current.y === end.y) {
            return reconstructPath(cameFrom, current);
        }

        openSet.splice(openSet.indexOf(current), 1);
        closedSet.push(current);

        const neighbors = getNeighbors(current);
        for (const neighbor of neighbors) {
            if (closedSet.find(node => node.x === neighbor.x && node.y === neighbor.y)) {
                continue;
            }

            const tentativeGScore = gScore[`${current.x},${current.y}`] + 1;
            if (!openSet.find(node => node.x === neighbor.x && node.y === neighbor.y)) {
                openSet.push(neighbor);
            } else if (tentativeGScore >= gScore[`${neighbor.x},${neighbor.y}`]) {
                continue;
            }

            cameFrom[`${neighbor.x},${neighbor.y}`] = current;
            gScore[`${neighbor.x},${neighbor.y}`] = tentativeGScore;
            fScore[`${neighbor.x},${neighbor.y}`] = gScore[`${neighbor.x},${neighbor.y}`] + heuristic(neighbor, end);
        }
    }

    return null; // No path found
}

function getNeighbors(node) {
    const neighbors = [];
    const { x, y } = node;

    if (x > 0 && dungeon[y][x - 1] === null) neighbors.push({ x: x - 1, y });
    if (x < dungeonWidth - 1 && dungeon[y][x + 1] === null) neighbors.push({ x: x + 1, y });
    if (y > 0 && dungeon[y - 1][x] === null) neighbors.push({ x, y: y - 1 });
    if (y < dungeonHeight - 1 && dungeon[y + 1][x] === null) neighbors.push({ x, y: y + 1 });

    return neighbors;
}

function heuristic(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function reconstructPath(cameFrom, current) {
    const totalPath = [current];
    while (cameFrom[`${current.x},${current.y}`]) {
        current = cameFrom[`${current.x},${current.y}`];
        totalPath.unshift(current);
    }
    return totalPath;
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    creatures.forEach(creature => creature.update());
    updateJobQueueUI();
    renderer.render(scene, camera);
}

function addJobToQueue(job) {
    if (jobQueue.length < 5) {
        jobQueue.push(job);
        updateJobQueueUI();
    }
}

function updateJobQueueUI() {
    const jobList = document.getElementById('job-list');
    jobList.innerHTML = '';

    // Find the Ogre and its job
    const ogre = creatures.find(c => c.type === 'ogre' && c.job);
    const activeJob = ogre ? ogre.job : null;

    // Display the active job with progress
    if (activeJob) {
        const listItem = document.createElement('li');
        listItem.classList.add('job-item');

        const jobText = document.createElement('span');
        jobText.textContent = `${activeJob.type.charAt(0).toUpperCase() + activeJob.type.slice(1)} (${activeJob.x}, ${activeJob.y})`;
        listItem.appendChild(jobText);

        const progressBar = document.createElement('div');
        progressBar.classList.add('progress-bar');
        const progressBarInner = document.createElement('div');
        progressBarInner.classList.add('progress-bar-inner');
        const progress = ogre.state === 'working' ? (1 - (ogre.workTimer / ogre.workDuration)) * 100 : 0;
        progressBarInner.style.width = `${progress}%`;
        progressBar.appendChild(progressBarInner);
        listItem.appendChild(progressBar);

        jobList.appendChild(listItem);
    }

    // Display the rest of the job queue
    jobQueue.forEach(job => {
        const listItem = document.createElement('li');
        listItem.classList.add('job-item');

        const jobText = document.createElement('span');
        jobText.textContent = `${job.type.charAt(0).toUpperCase() + job.type.slice(1)} (${job.x}, ${job.y})`;
        listItem.appendChild(jobText);

        const progressBar = document.createElement('div');
        progressBar.classList.add('progress-bar');
        const progressBarInner = document.createElement('div');
        progressBarInner.classList.add('progress-bar-inner');
        progressBar.appendChild(progressBarInner);
        listItem.appendChild(progressBar);

        jobList.appendChild(listItem);
    });
}

init();
