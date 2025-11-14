# Dependency Security Assessment

**Date:** 2025-11-14  
**Assessment Tool:** npm audit

## Summary

This document tracks known vulnerabilities in npm dependencies across all services.

## Current Status

### confluence-mcp

**Total Vulnerabilities:** 10 (1 low, 2 moderate, 6 high, 1 critical)

#### Critical

1. **form-data** (v4.0.0 - 4.0.3)
   - Issue: Unsafe random function for choosing boundary
   - Advisory: GHSA-fjxv-7rqg-78g4
   - Fix: `npm audit fix` available

#### High

2. **axios** (v1.0.0 - 1.11.0)
   - Issue: DoS attack through lack of data size check
   - Advisory: GHSA-4hjh-wcwx-xvwj
   - Fix: `npm audit fix` available
   - **Impact:** Used in confluence-client.ts for API calls

3. **tar-fs** (v3.0.0 - 3.1.0)
   - Issue: Multiple path traversal and symlink validation bypass issues
   - Advisories: GHSA-vj76-c3g6-qr5v, GHSA-8cj5-5rvv-wf4v, GHSA-pq67-2wwv-3xjx
   - Fix: Breaking change required (puppeteer update)
   - **Impact:** Indirect dependency via puppeteer

4. **ws** (v8.0.0 - 8.17.0)
   - Issue: DoS when handling request with many HTTP headers
   - Advisory: GHSA-3h5v-q93c-6h6q
   - Fix: Breaking change required (puppeteer update)
   - **Impact:** Indirect dependency via puppeteer

#### Moderate

5. **dompurify** (<3.2.4)
   - Issue: Cross-site Scripting (XSS)
   - Advisory: GHSA-vhxf-7vqr-mrjg
   - Fix: `npm audit fix` available
   - **Impact:** Used by mermaid for diagram rendering

6. **brace-expansion** (v1.0.0 - 1.1.11)
   - Issue: Regular Expression DoS
   - Advisory: GHSA-v6h2-p8h4-qcjw
   - Fix: `npm audit fix` available
   - **Impact:** Indirect dependency

### pandoc-mcp

**Status:** ✅ No vulnerabilities found (as of 2025-11-14)

```bash
$ cd pandoc-mcp && npm audit
found 0 vulnerabilities
```

### diagram-converter

**Status:** ⚠️ Not assessed yet (no package-lock.json committed)

## Recommendations

### Immediate Actions (Before Production)

1. **Update axios to latest version**
   ```bash
   cd confluence-mcp
   npm install axios@latest
   npm audit fix
   ```

2. **Update form-data**
   ```bash
   npm audit fix
   ```

3. **Update dompurify** (via mermaid or direct)
   ```bash
   npm audit fix
   ```

### Consider for Production

4. **Update puppeteer** (Breaking change)
   ```bash
   npm install puppeteer@latest
   npm test  # Verify functionality
   ```
   - This will fix tar-fs and ws vulnerabilities
   - May require code changes
   - Test thoroughly before deploying

### Long-term Strategy

5. **Automate dependency scanning**
   - Add GitHub Dependabot configuration
   - Set up npm audit in CI/CD pipeline
   - Schedule monthly dependency updates

6. **Consider alternative packages**
   - Evaluate if puppeteer is necessary in confluence-mcp
   - Consider lighter alternatives if only using for specific features

## Mitigation Status

### Applied Mitigations (Code-level)

Even with vulnerable dependencies, the following code-level mitigations reduce risk:

- ✅ **API Key authentication** prevents unauthorized access
- ✅ **Rate limiting** reduces DoS attack surface
- ✅ **Input validation** with Zod schemas
- ✅ **Network isolation** via Docker network
- ✅ **Non-root users** in all containers
- ✅ **No shell execution** (replaced with spawn)
- ✅ **Path validation** prevents traversal attacks

### Risk Assessment

| Vulnerability | Severity | Exploitability | Impact | Mitigated? |
|--------------|----------|----------------|--------|------------|
| axios DoS | High | Medium | Medium | Partial (rate limiting) |
| form-data | Critical | Low | Low | Yes (not used for security-critical ops) |
| tar-fs | High | Low | Low | Yes (puppeteer only, not user-facing) |
| ws DoS | High | Medium | Medium | Partial (rate limiting) |
| dompurify XSS | Moderate | Medium | Low | Yes (server-side only, no browser rendering) |

### Overall Risk: 🟡 MEDIUM

While there are high and critical vulnerabilities, most are in indirect dependencies and have limited exploitability in this deployment context. However, **production deployments should update all dependencies** before going live.

## Update Instructions

### Safe Updates (Non-breaking)

```bash
cd confluence-mcp
npm audit fix
npm run build
npm test  # If tests exist
```

### Breaking Updates (Requires Testing)

```bash
cd confluence-mcp
npm audit fix --force
npm run build
# Test all MCP tools manually
# Test Confluence integration
# Test diagram rendering (if used)
```

## Monitoring

### Recommended Tools

1. **Snyk** - Continuous dependency monitoring
2. **GitHub Dependabot** - Automated PRs for updates
3. **npm audit** - Run in CI/CD pipeline
4. **OWASP Dependency-Check** - Additional scanning

### CI/CD Integration

Add to GitHub Actions:

```yaml
- name: Security Audit
  run: |
    cd confluence-mcp && npm audit --production
    cd ../pandoc-mcp && npm audit --production
    cd ../diagram-converter && npm audit --production
```

## Notes

- **Puppeteer vulnerabilities** are primarily in installation/download code, not runtime
- **Server-side rendering** reduces XSS risk from dompurify
- **Network isolation** prevents external exploitation of DoS vulnerabilities
- **This assessment should be re-run monthly** or when adding new dependencies

## Last Updated

**Date:** 2025-11-14  
**By:** Security Assessment  
**Next Review:** 2025-12-14 (Monthly)
