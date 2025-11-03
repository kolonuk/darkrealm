# Animation Integration Guide

This guide explains how to add new animated 3D models to the "Dark Realms" project.

## 1. Model Format

Your 3D models should be in the **`glTF` (`.gltf` or `.glb`) format**. This is a modern, efficient format that is well-supported by Three.js. When exporting from your 3D modeling software (like Blender), make sure to include the animations.

## 2. File Placement

1.  Create a new folder named `models` inside the `assets` directory.
2.  Place your `.gltf` or `.glb` file in the `assets/models` folder.

## 3. Loading the Model

To load a model, you'll need to modify the `Creature` class in `js/game.js`. Here's a template for how to load a glTF model and replace the placeholder geometry:

```javascript
class Creature {
    constructor(x, z, type) {
        this.type = type;
        this.mesh = null; // We'll load the model asynchronously
        this.mixer = null; // For animations
        this.clock = new THREE.Clock();

        const loader = new THREE.GLTFLoader();
        loader.load(
            `assets/models/your-model-name.gltf`, // <-- CHANGE THIS
            (gltf) => {
                this.mesh = gltf.scene;
                this.mesh.position.set(x, 0, z); // Adjust y as needed
                scene.add(this.mesh);

                // --- Animation Setup ---
                this.mixer = new THREE.AnimationMixer(this.mesh);
                const clips = gltf.animations;

                // Find and play a specific animation
                const clip = THREE.AnimationClip.findByName(clips, 'Walk'); // <-- CHANGE 'Walk'
                const action = this.mixer.clipAction(clip);
                action.play();
                // ---------------------
            },
            undefined, // onProgress callback (optional)
            (error) => {
                console.error('An error happened while loading the model:', error);
            }
        );

        this.target = null;
        this.buildJob = null;
    }

    // ... (rest of the class) ...

    update() {
        if (this.mixer) {
            this.mixer.update(this.clock.getDelta());
        }
        // ... (rest of the update method) ...
    }
}
```

## 4. How It Works

*   **`GLTFLoader`**: This is a Three.js tool for loading `glTF` files.
*   **`loader.load()`**: This function fetches and parses your model file. It's asynchronous, which means the rest of the code will continue to run while the model is loading.
*   **`gltf.scene`**: This is the main 3D object from your file. We assign it to `this.mesh`.
*   **`AnimationMixer`**: This is the Three.js component that controls animations.
*   **`gltf.animations`**: This is an array of animation clips included with your model.
*   **`THREE.AnimationClip.findByName(clips, 'Walk')`**: You can find a specific animation clip by its name. You'll need to know the names of the animations in your model file.
*   **`action.play()`**: This starts the animation.

By following these steps, you can easily replace the placeholder creature with your own animated models.
