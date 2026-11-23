# Contributing Guidelines

## Development Setup

### Prerequisites

- Node.js 22.12 or higher (LTS)
- npm
- A browser with WebGL to run the viewer (unit tests do not need one)

### Installation

```bash
npm ci
```

### Development Commands

#### Start Development Server

```bash
npm start
```

The app is served at <http://localhost:4200>.

#### Linting

```bash
# Run ESLint (flat config in eslint.config.js)
npm run lint

# Fix linting issues automatically
npm run lint:fix

# ESLint + Prettier check (the same command CI runs)
npm run lint:check
```

#### Code Formatting

```bash
# Format all code (2 spaces, no tabs, LF line endings)
npm run format

# Check formatting only
npx prettier --check "src/**/*.{ts,html,scss}"
```

**Automatic Formatting**: The project is configured to format code automatically on save in VS Code. Make sure you have the Prettier extension installed.

#### Testing

```bash
# Run unit tests (single run, Vitest + jsdom, no browser needed)
npm test

# Watch mode
npm run test:watch

# A single spec file
npm test -- --include "**/camera.service.spec.ts"
```

#### Build

```bash
# Build for production (output in dist/interior-viewer/browser)
npm run build
```

The production build enforces bundle budgets (see `angular.json`); keep the initial bundle under them.

Before opening a pull request, run `npm run lint:check && npm run build && npm test`. The same three steps run in GitHub Actions on every push and pull request.

## Code Quality

This project uses several tools to maintain code quality:

### Lint-Staged

- Automatically runs linting on staged files before commit
- Configured in `package.json` under `lint-staged`
- Runs ESLint (with `--fix`) and Prettier on staged files

### Prettier

- Code formatting tool
- Configuration in `.prettierrc`
- Ignores files listed in `.prettierignore`

### ESLint

- JavaScript/TypeScript linting
- Flat configuration in `eslint.config.js` (`typescript-eslint` + `angular-eslint`)
- Integrates with Angular linting

### Husky

- Git hooks for automated quality checks
- Pre-commit hook runs lint-staged
- Configuration in `.husky/` directory

## Git Workflow

### Pre-commit Hook

Before each commit, the following checks run automatically:

1. ESLint on staged TypeScript and HTML files
2. Prettier formatting on staged TypeScript, HTML, SCSS, JSON and Markdown files
3. If any check fails, the commit is blocked

### Commit Message Format

Use conventional commits format (`type(scope): summary`):

- `feat:` - new feature
- `fix:` - bug fix
- `refactor:` - code refactoring
- `chore:` - maintenance tasks
- `docs:` - documentation changes
- `test:` - test changes
- `build:` - build system or dependency changes
- `ci:` - continuous integration configuration
- `perf:` - performance improvements

Example:

```
feat(viewer): add object interaction service
fix(camera): resolve teleportation bounds issue
refactor(services): apply SOLID principles
```

## Code Standards

### TypeScript

- Use strict typing
- Prefer interfaces over types for object shapes
- Use readonly for immutable properties
- Avoid `any` type when possible

### Angular

- Use standalone components and signals; the app is zoneless, so do not rely on Zone.js
- Run per-frame work from the single render loop in `SceneService`, never from extra `requestAnimationFrame` callbacks
- Dispose of Three.js geometries, materials and textures you create
- Keep user-facing text in `src/app/config/ui-text.ts` (English)
- Follow Angular style guide
- Add or update a Vitest spec next to the code you change
- Use dependency injection
- Implement OnDestroy for cleanup

### Clean Code

- Single responsibility principle
- Small, focused functions
- Descriptive variable and function names
- Consistent formatting: 2 spaces for indentation (never tabs), LF line endings

## Troubleshooting

### Lint-Staged Issues

If lint-staged fails:

1. Check if all dependencies are installed: `npm install`
2. Run linting manually: `npm run lint:check`
3. Fix formatting issues: `npm run format`

### Pre-commit Hook Issues

If pre-commit hook fails:

1. Check husky installation: `npm run prepare`
2. Verify hook file exists: `.husky/pre-commit`
3. Check file permissions on Unix systems

### Common Issues

- **ESLint errors**: Run `npm run lint:fix`
- **Prettier errors**: Run `npm run format`
- **TypeScript errors**: Check imports and type definitions
