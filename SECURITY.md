# Sports Predictor Pro - Security Documentation

## 🔒 Security Measures Implemented

### 1. Authentication
- API key required for protected endpoints
- Keys passed via `Authorization: Bearer <key>` header
- Default key must be changed in production

### 2. Rate Limiting
- **General API**: 100 requests per 15 minutes
- **Betting endpoints**: 10 requests per hour
- Prevents brute force and abuse

### 3. CORS Configuration
- Strict origin whitelist
- Only allows specific origins in production
- Prevents cross-origin attacks

### 4. HTTP Headers (Helmet)
- Content Security Policy
- X-Frame-Options
- X-Content-Type-Options
- HSTS headers

### 5. Input Validation
- Body size limited to 10KB
- JSON parsing with limits
- SQL injection prevention (prepared statements)

### 6. Secure Development Practices

#### Never commit:
- API keys
- Tokens
- Passwords
- Private keys

#### Use environment variables:
```bash
export API_KEY=your-secure-key
export SPORTS_API_KEY=your-odds-api-key
```

### 7. File Permissions
- Log files: 640 (readable by owner and group)
- Database: 600 (owner only)
- Scripts: 755 (executable)

---

## 🚨 Security Checklist

### Before Production

- [ ] Change default API key
- [ ] Set up HTTPS/TLS
- [ ] Configure firewall
- [ ] Set up monitoring
- [ ] Enable logging
- [ ] Review CORS origins
- [ ] Set rate limits appropriate for traffic
- [ ] Secure GitHub token

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `API_KEY` | Yes | Secret for API access |
| `SPORTS_API_KEY` | No | The Odds API key |
| `PORT` | No | Server port (default: 3001) |
| `NODE_ENV` | Yes | Set to `production` |

---

## 🔐 API Key Management

### Generate Secure API Key

```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Setting API Key

```bash
# Environment variable
export API_KEY=your-generated-key

# Or in .env file
API_KEY=your-generated-key
```

### Using API with Key

```bash
curl http://localhost:3001/api/v1/stats \
  -H "Authorization: Bearer YOUR_API_KEY"
```

---

## 🛡️ Attack Vectors Covered

| Attack Type | Protection |
|-------------|------------|
| DDoS | Rate limiting |
| SQL Injection | Prepared statements |
| XSS | CSP headers |
| CSRF | CORS configuration |
| Brute Force | Rate limiting |
| Information Leak | Error handling |
| Replay Attacks | Unique requests |

---

## 📝 Logging

Logs are stored in `/logs/` directory:
- `builder-agent.log` - Development activity
- `test-agent.log` - Test results
- `research-agent.log` - Research findings
- `deploy-agent.log` - Deployment status
- `performance.jsonl` - Performance metrics

**Note:** Logs may contain sensitive data. Secure log files appropriately.

---

## 🔄 Updates & Patches

The system auto-updates via the Builder Agent:
1. Pulls latest code from Git
2. Runs tests
3. Commits changes
4. Pushes to GitHub

Monitor logs for unusual activity.

---

## 📞 Incident Response

If security incident suspected:

1. **Disable API access**: Set `API_KEY` to invalid value
2. **Review logs**: Check `/logs/` for suspicious activity
3. **Check GitHub**: Review recent commits for unauthorized changes
4. **Rotate keys**: Generate new API keys
5. **Restore from backup**: If needed

---

## ✅ Security Audit Checklist

- [ ] No hardcoded credentials in code
- [ ] Environment variables used for secrets
- [ ] HTTPS enabled in production
- [ ] Rate limits configured
- [ ] CORS properly configured
- [ ] Input validation enabled
- [ ] Logging active
- [ ] Monitoring configured
- [ ] Backup strategy in place
- [ ] Access logs reviewed regularly
