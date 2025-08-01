# Personal Website

A high-performance personal website built with Astro, featuring a blog system, flight tracking, portfolio showcase, and comprehensive admin panel.

## 🚀 Features

- **Ultra-fast Static Site Generation** with Astro 5.12
- **Dynamic Blog System** with categories, tags, and search
- **Interactive Flight Tracking** with Mapbox GL & deck.gl
- **Portfolio Showcase** with filtering and search capabilities
- **Admin Dashboard** for content management
- **Performance Optimized** with Lighthouse CI integration
- **Comprehensive Testing** with Vitest and Playwright
- **Edge Database** with Turso Cloud DB

## 📋 Prerequisites

- Node.js 18.x or higher
- npm 9.x or higher
- Turso Cloud DB account
- Mapbox account (for flight maps)
- Git

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Hello-World
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   # Turso Database
   DATABASE_URL=libsql://[database-name]-[organization-name].turso.io
   DATABASE_AUTH_TOKEN=your-database-auth-token

   # Authentication
   JWT_SECRET=your-jwt-secret
   JWT_REFRESH_SECRET=your-jwt-refresh-secret

   # External Services
   PUBLIC_MAPBOX_ACCESS_TOKEN=your-mapbox-token
   
   # Optional: Cloudflare
   CLOUDFLARE_ACCOUNT_ID=your-account-id
   CLOUDFLARE_API_TOKEN=your-api-token
   
   # Optional: Monitoring
   SENTRY_DSN=your-sentry-dsn
   ```

4. **Set up the database**
   ```bash
   npm run db:setup
   npm run db:migrate
   npm run db:seed  # Optional: Add sample data
   ```

5. **Install Playwright browsers (for E2E testing)**
   ```bash
   npm run playwright:install
   ```

## 🏃 Development

### Start the development server
```bash
npm run dev
```

The site will be available at `http://localhost:4321`

### Other development commands
```bash
# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix

# Formatting
npm run format
```

## 🧪 Testing

### Run all tests
```bash
npm run test:all
```

### Specific test suites
```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Blog-specific tests
npm run test:blog:full

# Performance tests
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

## 📦 Building for Production

1. **Build the project**
   ```bash
   npm run build
   ```

2. **Preview the production build**
   ```bash
   npm run preview
   ```

3. **Run deployment checks**
   ```bash
   npm run deploy:check
   ```

## 🗄️ Database Management

### Database commands
```bash
# Setup database
npm run db:setup

# Run migrations
npm run db:migrate

# Seed with sample data
npm run db:seed

# Reset database
npm run db:reset

# Full setup (setup + migrate + seed)
npm run db:setup:full
```

## 📊 Performance Monitoring

### Lighthouse CI
```bash
# Run Lighthouse tests
npm run perf:lighthouse

# Run performance gate checks
npm run perf:gate

# Run CI performance tests
npm run perf:ci
```

### Core Web Vitals
The project includes automated Core Web Vitals monitoring. Check the performance dashboard in the admin panel.

## 🔐 Admin Panel

Access the admin panel at `/admin`

Default credentials (change these immediately):
- Email: `admin@example.com`
- Password: `changeme`

### Admin Features
- Blog post management
- Portfolio project management
- Media uploads with optimization
- Analytics dashboard
- User management
- Performance monitoring

## 📁 Project Structure

```
├── src/
│   ├── assets/          # Static assets
│   ├── components/      # Reusable components
│   ├── layouts/         # Page layouts
│   ├── lib/             # Core utilities
│   ├── middleware/      # Request middleware
│   ├── pages/           # File-based routing
│   └── styles/          # Global styles
├── public/              # Public assets
├── scripts/             # Build scripts
├── tests/               # Test suites
└── .github/             # GitHub Actions
```

## 🌐 API Documentation

The project includes a comprehensive REST API. See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for details.

Key endpoints:
- `/api/auth/*` - Authentication
- `/api/blog/*` - Blog operations
- `/api/portfolio/*` - Portfolio operations
- `/api/admin/*` - Admin operations
- `/api/analytics/*` - Analytics

## 🚢 Deployment

### Environment Variables
Ensure all required environment variables are set in your deployment platform:

- `DATABASE_URL` - Turso database URL
- `DATABASE_AUTH_TOKEN` - Turso auth token
- `JWT_SECRET` - JWT signing secret
- `JWT_REFRESH_SECRET` - JWT refresh secret
- `PUBLIC_MAPBOX_ACCESS_TOKEN` - Mapbox token

### Deployment Platforms
The project is optimized for deployment on:
- Vercel
- Netlify
- Cloudflare Pages
- AWS Amplify

### Post-deployment
1. Run database migrations
2. Update environment-specific configurations
3. Set up monitoring and alerts
4. Configure CDN and caching
5. Enable security headers

## 🔧 Configuration

### Astro Configuration
Edit `astro.config.mjs` for:
- Site URL
- Build output format
- Integrations
- Vite configuration

### Tailwind Configuration
Edit `tailwind.config.cjs` for:
- Custom colors
- Typography settings
- Responsive breakpoints

### TypeScript Configuration
Edit `tsconfig.json` for:
- Path aliases
- Compiler options
- Type checking strictness

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new features
5. Run the test suite
6. Submit a pull request

### Code Style
- Follow existing patterns
- Use TypeScript for type safety
- Write meaningful commit messages
- Add JSDoc comments for functions
- Ensure all tests pass

## 📚 Documentation

- [Project Documentation](./PROJECT_DOCUMENTATION.md) - Overall project architecture
- [API Documentation](./API_DOCUMENTATION.md) - REST API endpoints
- [Components Documentation](./COMPONENTS_DOCUMENTATION.md) - Component library
- [Flight Map Documentation](./src/components/flight-map/README.md) - Flight tracking component

## 🐛 Troubleshooting

### Common Issues

1. **Database connection errors**
   - Verify Turso credentials
   - Check network connectivity
   - Ensure database is provisioned

2. **Build failures**
   - Clear node_modules and reinstall
   - Check for TypeScript errors
   - Verify environment variables

3. **Test failures**
   - Update Playwright browsers
   - Check test database setup
   - Verify API endpoints

### Debug Mode
Enable debug logging:
```bash
DEBUG=* npm run dev
```

## 📄 License

This project is private and proprietary.

## 🙏 Acknowledgments

Built with:
- [Astro](https://astro.build)
- [Svelte](https://svelte.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [Turso](https://turso.tech)
- [Mapbox](https://mapbox.com)
- [deck.gl](https://deck.gl)