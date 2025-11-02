# Hello, World!

My kinda minimalistic personal site. Built to be extremley fast. 

## Main Dependencies

- Astro 5.12
- Mapbox GL and deck.gl
- Vitest and Playwright
- Turso Cloud DB

## Prerequisites

- Node.js 18.x or higher
- npm 9.x or higher
- Turso Cloud DB account
- Mapbox account (for flight maps)
- Git

## Installation

1. **clone repo**
   ```bash
   git clone https://github.com/Sebastian-Alexis/Hello-World.git
   cd Hello-World
   ```

2. **install dependencies**
   ```bash
   npm install
   ```

3. **deploy on cloudflare pages**


## Development

### Start the deve server
```bash
npm run dev
```

The site will be available at `http://localhost:4321`

## Testing

### Run all tests
```bash
npm run test:all
```

### Specific test suites
```bash
#unit tests
npm run test:unit

#tntegration tests
npm run test:integration

#e2e tests
npm run test:e2e

#blog specific tests
npm run test:blog:full

#performance tests
npm run perf:lighthouse
```

### Test in watch mode
```bash
npm run test:watch
```

### View test coverage
```bash
npm run test:coverage
```

## Building for Prod

1. **Build the project**
   ```bash
   npm run build
   ```

2. **Run deployment checks**
   ```bash
   npm run deploy:check
   ```

## Admin Panel

Access the admin panel at `/admin`

Default credentials (change these immediately in .env):
- Email: `admin@example.com`
- Password: `changeme`

### Admin Features
- Blog post management
- Portfolio project management
- Media uploads with optimization
- Analytics dashboard
- User management
- Performance monitoring

## License

MIT license baby, do whatever you want

## Acknowledgments

Built with some pretty awesome software:
- [Astro](https://astro.build)
- [Svelte](https://svelte.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [Turso](https://turso.tech)
- [Mapbox](https://mapbox.com)
- [deck.gl](https://deck.gl)
