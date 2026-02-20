# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please email the maintainers directly rather than creating a public issue.

## Development vs Production Secrets

### Important Security Notes

This repository contains **default development credentials** in `docker-compose.yml` for local development convenience. These are:

- PostgreSQL: `postgres / postgres`
- TimescaleDB: `postgres / postgres`
- pgAdmin: `admin@viabaq.com / admin`

**These default passwords:**
- Are acceptable for **local development only**
- Should **NEVER** be used in production
- Can be overridden via environment variables

### Production Deployment

For production deployments:

1. **Create a `.env` file** (never commit this):
 ```bash
 cp .env.docker.example .env
 ```

2. **Set strong passwords**:
 ```env
 POSTGRES_PASSWORD=your_strong_random_password_here
 TIMESCALE_PASSWORD=another_strong_random_password
 PGADMIN_PASSWORD=yet_another_strong_password
 ```

3. **Use secrets management**:
 - Vercel: Use Environment Variables in project settings
 - Railway: Use Variables tab
 - AWS: Use Secrets Manager
 - Docker Swarm: Use Docker Secrets
 - Kubernetes: Use Kubernetes Secrets

### API Keys

External API keys should be configured in `server/.env`:

```env
OPENWEATHER_API_KEY=your_real_api_key
GOOGLE_MAPS_API_KEY=your_real_api_key
TOMTOM_API_KEY=your_real_api_key
```

**Never commit `server/.env` to version control** - it's already in `.gitignore`.

### GitGuardian False Positives

GitGuardian may flag the default development credentials in `docker-compose.yml`. This is expected and documented in `.gitguardian.yaml`. The use of environment variables with fallback values (`${VAR:-default}`) is intentional for development convenience.

## Best Practices

1. Use environment variables for all secrets
2. Rotate passwords regularly in production
3. Use different passwords for each service
4. Enable 2FA where available (pgAdmin, cloud providers)
5. Restrict database access to specific IPs in production
6. Use HTTPS/TLS for all external connections
7. Keep dependencies updated (`npm audit`)

## Secure Configuration Checklist

- [ ] Changed all default passwords
- [ ] Set up environment variables in production
- [ ] Enabled database connection encryption (SSL/TLS)
- [ ] Configured firewall rules
- [ ] Enabled database audit logging
- [ ] Set up automated backups
- [ ] Configured rate limiting
- [ ] Enabled API key restrictions (HTTP referrers, IP addresses)
- [ ] Reviewed and updated `.gitignore`
- [ ] Enabled Dependabot security updates

## Contact

For security concerns, contact: [your-email@domain.com]
