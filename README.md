# 3D Room Tour & Descriptions

A modern, interactive 3D room viewer built with Angular 17 and Three.js. This application allows users to explore a virtual room, interact with furniture objects, and view detailed descriptions through an immersive 3D experience.

## Features

- **Interactive 3D Environment**: Navigate through a beautifully designed virtual room
- **Object Interaction**: Click on furniture to view detailed descriptions
- **Smooth Navigation**: Orbit controls with teleportation system
- **Modern UI**: Clean, responsive interface with glassmorphism design
- **Real-time Rendering**: High-quality 3D graphics with shadows and lighting
- **Responsive Design**: Works seamlessly across different screen sizes

## Technology Stack

- **Frontend**: Angular 17 (Standalone Components)
- **3D Graphics**: Three.js
- **Styling**: SCSS with modern CSS features
- **TypeScript**: Full type safety
- **Build Tool**: Angular CLI

## Getting Started

### Prerequisites

- Node.js (version 18 or higher)
- npm or yarn package manager

### Installation

1. Clone the repository:

```bash
git clone https://github.com/your-username/room-tour-and-descriptions.git
cd room-tour-and-descriptions
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm start
```

4. Open your browser and navigate to `http://localhost:4200`

### Build for Production

```bash
npm run build
```

The build artifacts will be stored in the `dist/` directory.

## Project Structure

```
src/
├── app/
│   ├── components/
│   │   └── viewer/
│   │       ├── viewer.component.ts
│   │       ├── viewer.component.html
│   │       └── viewer.component.scss
│   ├── services/
│   │   └── scene.service.ts
│   ├── app.component.ts
│   └── app.config.ts
├── assets/
│   └── models/
│       ├── bookshelf/
│       ├── poker_table/
│       └── sofa/
└── styles.scss
```

## Usage

### Navigation Controls

- **Mouse Drag**: Rotate the camera around the scene
- **Click on Floor**: Teleport to the clicked location
- **Click on Objects**: View object information and descriptions
- **Scroll**: Zoom in/out (if enabled)

### Available Objects

The virtual room includes several interactive objects:

- **Modern Sofa**: Contemporary design perfect for your living room
- **Poker Table**: Professional gaming table for friends and family
- **Bookshelf**: Modern and spacious storage for books and decoration

## Development

### Code Quality Tools

This project uses several tools to maintain code quality and consistency:

- **Prettier**: Code formatting with 2-space indentation
- **ESLint**: JavaScript/TypeScript linting with Angular-specific rules
- **Lint-Staged**: Automated linting on staged files before commit
- **Husky**: Git hooks for quality assurance
- **EditorConfig**: Consistent editor settings across different IDEs

### Code Architecture

The project follows SOLID principles and clean code practices:

- **Single Responsibility**: Each service and component has a single, well-defined purpose
- **Open/Closed**: Extensible design for adding new features
- **Liskov Substitution**: Proper interface implementations
- **Interface Segregation**: Focused, specific interfaces
- **Dependency Inversion**: Dependency injection throughout

### Key Services

- **SceneService**: Manages the 3D scene, camera, lighting, and object interactions
- **ModelLoaderService**: Handles 3D model loading and management
- **CameraControllerService**: Manages camera movement and teleportation
- **ObjectInteractionService**: Handles object selection and information display

### Adding New Objects

1. Place your 3D model files in `src/assets/models/your-object/`
2. Update the model loading configuration in the appropriate service
3. Add object metadata (name, description) to the configuration

## Customization

### Styling

The application uses SCSS with CSS custom properties for easy theming. Key variables can be found in `src/styles.scss`.

### Room Design

Room dimensions, colors, and lighting can be customized in the `SceneService` configuration.

### Object Descriptions

Object information is managed through the object metadata system, making it easy to update descriptions and add new objects.

## Performance Optimization

- Efficient 3D model loading with progress tracking
- Optimized rendering with proper material management
- Memory cleanup on component destruction
- Responsive design for various screen sizes

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge

WebGL support is required for 3D rendering.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Three.js community for excellent 3D graphics library
- Angular team for the robust framework
- 3D model creators for the furniture assets
