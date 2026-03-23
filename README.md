# 🏠 3D Room Tour & Descriptions

> **An interactive 3D room viewer built with Angular 17 and Three.js — explore a virtual room, click on furniture, and read object descriptions through an immersive browser experience.**

[![Angular](https://img.shields.io/badge/Angular-17-DD0031?logo=angular&logoColor=white)](https://angular.io/)
[![Three.js](https://img.shields.io/badge/Three.js-0.162-000000?logo=threedotjs&logoColor=white)](https://threejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Angular Material](https://img.shields.io/badge/Angular%20Material-17-FF4081?logo=angular&logoColor=white)](https://material.angular.io/)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-000000?logo=vercel)](https://room-tour-and-descriptions.vercel.app/)

---

## 🌐 Live Demo

**[room-tour-and-descriptions.vercel.app](https://room-tour-and-descriptions.vercel.app/)**

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Technology Stack](#-technology-stack)
- [Architecture](#-architecture)
- [Getting Started](#-getting-started)
- [Usage](#-usage)
- [Code Quality](#-code-quality)

---

## 🎯 Overview

A modern, interactive 3D room viewer built with Angular 17 and Three.js. Users can explore a virtual room, interact with furniture objects, and view detailed descriptions through an immersive 3D experience. The project demonstrates advanced 3D web rendering, clean Angular architecture, and production-grade code quality tooling.

---

## ✨ Features

- **Interactive 3D Environment** — Navigate through a beautifully designed virtual room
- **Object Interaction** — Click on furniture to view detailed descriptions
- **Smooth Navigation** — Orbit controls with teleportation system for seamless movement
- **Glassmorphism UI** — Clean, modern interface with glass-effect overlays
- **Real-time Rendering** — High-quality 3D graphics with shadows and dynamic lighting
- **Responsive Design** — Works across different screen sizes and devices

---

## 🚀 Technology Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| **Angular 17** | SPA framework with standalone components |
| **TypeScript** | Full type safety |
| **Three.js 0.162** | 3D rendering engine |
| **Angular Material 17** | UI components (dialogs, overlays) |
| **SCSS** | Component styling |

### Development Tools
| Tool | Purpose |
|------|---------|
| **ESLint** | Code linting with Angular-specific rules |
| **Prettier** | Consistent code formatting |
| **Husky** | Git hooks for pre-commit quality checks |
| **Lint-Staged** | Run linters only on staged files |
| **EditorConfig** | Consistent editor settings across IDEs |

---

## 🏗️ Architecture

The project follows SOLID principles with a clean service-oriented architecture:

```
src/app/
├── components/
│   └── viewer/           # Main 3D viewer component
├── services/
│   ├── scene.service.ts          # 3D scene, camera, and lighting
│   ├── model-loader.service.ts   # 3D model loading and management
│   ├── camera-controller.service.ts  # Camera movement and teleportation
│   └── object-interaction.service.ts # Object selection and info display
└── app.config.ts
```

### Key Services
- **SceneService** — Manages the Three.js scene, camera, renderer, and lighting setup
- **ModelLoaderService** — Handles async loading of GLTF/GLB 3D models
- **CameraControllerService** — Orbit controls and floor-click teleportation
- **ObjectInteractionService** — Raycasting for object selection and description display

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
git clone https://github.com/frxncismor/room-tour-and-descriptions.git
cd room-tour-and-descriptions
npm install
npm start
```

Open `http://localhost:4200` in your browser.

### Build for Production

```bash
npm run build
```

---

## 🎮 Usage

### Navigation Controls
| Input | Action |
|-------|--------|
| **Mouse Drag** | Rotate camera around the scene |
| **Click on Floor** | Teleport to that location |
| **Click on Objects** | View object name and description |
| **Scroll** | Zoom in / out |

### Interactive Objects
- **Modern Sofa** — Contemporary living room sofa
- **Poker Table** — Professional gaming table
- **Bookshelf** — Modern storage unit for books and decoration

---

## 🛠️ Code Quality

This project enforces code quality at every stage:

- **Pre-commit hooks** via Husky + Lint-Staged run ESLint and Prettier before every commit
- **SOLID principles** applied throughout the service architecture
- **Strict TypeScript** for end-to-end type safety
- **Angular standalone components** for optimal tree-shaking and modularity

---

## 🤝 Contact

Built by [Francisco Morales](https://frxncismor.dev) · [GitHub](https://github.com/frxncismor)
