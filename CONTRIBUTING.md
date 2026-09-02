# Contributing to Repodest

Thank you for your interest in contributing to Repodest! This document provides guidelines and instructions for contributing.

## How to Contribute

### Reporting Bugs

1. Check [existing issues](https://github.com/mohsen-niksirat/repodest/issues) to avoid duplicates
2. Open a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Browser and OS information

### Suggesting Features

1. Check [existing issues](https://github.com/mohsen-niksirat/repodest/issues) for similar suggestions
2. Open a new issue with the `enhancement` label
3. Describe the feature, its use case, and why it would benefit users

### Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `node tests.test.js`
5. Commit with a clear message
6. Push to your fork and open a Pull Request

## Development Setup

### Prerequisites
- A modern web browser
- Node.js (for running tests)

### Getting Started

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/repodest.git
cd repodest

# Open in browser
npx serve .

# Run tests
node tests.test.js
```

## Code Style

### JavaScript
- Use `'use strict'` mode
- Prefer `const` over `let`, avoid `var`
- Use arrow functions where appropriate
- Keep functions small and focused
- Add JSDoc comments for complex functions

### CSS
- Use CSS custom properties (variables) for theming
- Follow BEM-like naming for new components
- Keep responsive design in mind

### HTML
- Use semantic HTML elements
- Add ARIA labels for accessibility
- Keep the DOM structure clean

## Project Structure

```
repodest/
├── index.html          # HTML structure
├── styles.css          # All CSS styles
├── app.js              # All JavaScript
├── sw.js               # Service worker
├── tests.test.js       # Unit tests
└── docs/               # Documentation
```

### Key Principles

1. **Zero build step**: No bundler or transpiler needed
2. **Client-side only**: No backend dependencies
3. **Accessibility first**: ARIA labels, keyboard navigation, screen reader support
4. **Performance**: Lazy loading, caching, minimal bundle size

## Testing

### Running Tests

```bash
node tests.test.js
```

### Writing Tests

Tests are in `tests.test.js`. The test framework is minimal by design:

```javascript
describe('Feature name', () => {
  it('should do something', () => {
    expect(result).toEqual(expected);
  });
});
```

### Available Matchers

- `toEqual(e)` — strict equality
- `toBeTruthy()` — truthy check
- `toBeFalsy()` — falsy check
- `toContain(s)` — string contains
- `toHaveLength(n)` — array/string length

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation changes
- `style:` — Code style changes
- `refactor:` — Code refactoring
- `test:` — Adding or updating tests
- `chore:` — Maintenance tasks

Examples:
```
feat: add dark/light theme toggle
fix: resolve duplicate function declarations
docs: update README with Farsi translation
test: add unit tests for healthCheck function
```

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive feedback
- Respect different viewpoints and experiences

## Questions?

Open an issue or reach out to [Mohsen Niksirat](https://github.com/mohsen-niksirat).
