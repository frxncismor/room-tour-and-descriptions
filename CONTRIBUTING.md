# Contributing Guidelines

## Development Setup

### Prerequisites

- Node.js 22 or higher (LTS)
- npm

### Installation

```bash
npm ci
```

### Development Commands

#### Start Development Server

```bash
npm start
```

#### Linting

```bash
# Run linting
npm run lint

# Fix linting issues automatically
npm run lint:fix

# Run comprehensive lint check
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
# Run unit tests (headless, single run)
npm test

# Interactive watch mode
npm run test:watch
```

#### Build

```bash
# Build for production
npm run build
```

## Code Quality

This project uses several tools to maintain code quality:

### Lint-Staged

- Automatically runs linting on staged files before commit
- Configured in `package.json` under `lint-staged`
- Runs Angular linting and Prettier formatting

### Prettier

- Code formatting tool
- Configuration in `.prettierrc`
- Ignores files listed in `.prettierignore`

### ESLint

- JavaScript/TypeScript linting
- Configuration in `.eslintrc.json`
- Integrates with Angular linting

### Husky

- Git hooks for automated quality checks
- Pre-commit hook runs lint-staged
- Configuration in `.husky/` directory

## Git Workflow

### Pre-commit Hook

Before each commit, the following checks run automatically:

1. Angular linting on staged TypeScript, HTML, and SCSS files
2. Prettier formatting on staged files
3. If any check fails, the commit is blocked

### Commit Message Format

Use conventional commits format (`type(scope): summary`):

- `feat:` - new feature
- `fix:` - bug fix
- `refactor:` - code refactoring
- `chore:` - maintenance tasks
- `docs:` - documentation changes
- `test:` - test changes

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

- Use standalone components
- Follow Angular style guide
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
2. Run linting manually: `npm run lint`
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
