# Neurolens

Calm, interactive neuroscience study desktop app built with Electron, Three.js, and custom canvas visualization.

Neurolens presents a 3D neuron model, an animated action-potential trace, topic navigation, quiz prompts, and a focused study layout for medical and neuroscience learners.

## Features

- Interactive Three.js neuron scene with orbit controls, auto-rotation, lighting, and particle depth.
- Animated action-potential wave travelling across the axon model.
- Canvas-based membrane voltage graph synced to the 3D firing animation.
- Topic navigation for core neuroscience concepts.
- Quiz prompt mode with optional browser speech synthesis.
- Secure Electron shell with context isolation and no Node integration in the renderer.

## Tech Stack

| Area | Choice |
|---|---|
| App shell | Electron |
| 3D rendering | Three.js |
| Visualization | Canvas 2D + WebGL |
| UI | HTML, CSS, JavaScript |
| Desktop runtime | Node.js |

## Getting Started

```bash
npm install
npm start
```

For development with Electron inspection enabled:

```bash
npm run dev
```

## Architecture

```text
main.js              # Electron window creation and security settings
preload.js           # Context-isolated preload boundary
src/
  index.html         # App layout and study panels
  renderer.js        # Three.js scene, AP animation, UI wiring
  neuron.js          # Procedural neuron model
  ap-graph.js        # Membrane voltage graph widget
  OrbitControls.js   # Camera controls
  styles.css         # Desktop app styling
```

## Product Direction

- Expand topics into complete study modules.
- Add spaced-repetition review and progress persistence.
- Add guided explanations for each action-potential phase.
- Package signed desktop builds for macOS and Windows.

## License

MIT
