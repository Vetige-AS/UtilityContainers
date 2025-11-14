# Changelog

All notable changes to UtilityContainers will be documented in this file.

## [2.0.0] - 2025-11-14

### 🎉 Major Update: Docker-Outside-of-Docker Support

This release adds comprehensive support for using UtilityContainers with VS Code Dev Containers using the **docker-outside-of-docker** pattern, which avoids Docker-in-Docker issues.

### Added

#### New Documentation
- **`docs/DEVCONTAINER_INTEGRATION.md`** - Complete guide for devcontainer integration
  - Architecture diagrams and explanations
  - Network configuration details
  - Environment variable passing patterns
  - Troubleshooting container name resolution
  - Security considerations
  - Migration guide from Docker-in-Docker

#### New Scripts
- **`scripts/setup-for-devcontainer.sh`** - Automated devcontainer setup
  - Generates `.devcontainer/devcontainer.json` with correct configuration
  - Creates host-side startup script (`.devcontainer/start-utility-containers.sh`)
  - Creates devcontainer-side setup script (`.devcontainer/setup-utility-containers.sh`)
  - Updates `.gitignore` automatically

- **`scripts/migrate-to-host-docker.sh`** - Migration tool
  - Helps users migrate from Docker-in-Docker to host Docker
  - Stops old containers, creates network, starts new containers
  - Provides step-by-step instructions for updating devcontainer.json
  - Includes verification checks

#### Documentation Updates
- **`QUICKSTART.new-project.md`** - Added comprehensive DevContainer section
  - **Approach A: Docker-Outside-of-Docker (Recommended)** - Full setup guide
  - **Approach B: Docker-in-Docker (Legacy)** - Alternative for specific use cases
  - Step-by-step workflow explanations
  - Verification instructions

- **`README.md`** - Added DevContainer Projects section
  - Quick start guide for devcontainers
  - Explanation of docker-outside-of-docker benefits
  - Network connectivity reference
  - Environment variable setup

- **`docs/QUICK_REFERENCE.md`** - Major update
  - Added two-approach comparison
  - Quick setup instructions for docker-outside-of-docker
  - Troubleshooting section
  - Migration guide reference

- **`.env.example`** - Enhanced with detailed comments
  - Organized into sections
  - DevContainer usage notes
  - Environment variable passing explanation
  - Security best practices

### Changed

#### Recommended Approach
- **Docker-Outside-of-Docker is now the recommended approach** for devcontainer workflows
- Docker-in-Docker moved to "Alternative/Legacy" section
- All documentation updated to prioritize the new approach

#### Configuration Patterns
- Container names used for internal networking (e.g., `http://diagram-converter:3000`)
- Localhost used for host access (e.g., `http://localhost:3000`)
- Environment variables loaded from host via `containerEnv` in devcontainer.json
- API key reference pattern: `${env:MCP_API_KEY}` in VS Code settings

### Benefits of New Approach

✅ **Resource Efficiency**
- Images downloaded only once on host (not per-devcontainer)
- Saves 2-3GB per devcontainer

✅ **Persistence**
- Containers survive devcontainer rebuilds
- No need to re-pull images or restart services

✅ **Shared Resources**
- Multiple devcontainers can access same containers
- Single set of utility containers for all projects

✅ **Simplified Management**
- Start containers once, use everywhere
- No nested Docker complexity

✅ **Faster Development**
- No waiting for image pulls on rebuild
- Instant devcontainer startup

### Migration Path

Existing users can migrate using:

```bash
# Run migration script
./scripts/migrate-to-host-docker.sh

# Update devcontainer.json (follow script instructions)

# Rebuild devcontainer
# Ctrl+Shift+P → "Dev Containers: Rebuild Container"
```

### Technical Details

#### Network Architecture
```
┌─────────────────────────────────────────────────┐
│                  Docker Host                    │
│  ┌──────────────┐  ┌──────────────────────┐    │
│  │ Dev Container│  │ Utility Containers   │    │
│  │ (on dev-net) │  │ (on dev-net)         │    │
│  │              │  │                      │    │
│  │ Docker CLI ──┼──► /var/run/docker.sock │    │
│  └──────────────┘  └──────────────────────┘    │
└─────────────────────────────────────────────────┘
```

#### Key Configuration
- **Feature**: `ghcr.io/devcontainers/features/docker-outside-of-docker:1`
- **Network**: `dev-network` (external Docker bridge network)
- **Container Names**: Used for DNS resolution between containers
- **Environment**: Loaded from host's `.env` via `containerEnv`

### Documentation Structure

```
UtilityContainers/
├── QUICKSTART.new-project.md       # Updated with DevContainer approaches
├── README.md                        # Added DevContainer section
├── CHANGELOG.md                     # This file (new)
├── .env.example                     # Enhanced with comments
├── scripts/
│   ├── setup-for-devcontainer.sh   # New: Generate devcontainer files
│   └── migrate-to-host-docker.sh   # New: Migration tool
└── docs/
    ├── DEVCONTAINER_INTEGRATION.md # New: Complete guide
    └── QUICK_REFERENCE.md          # Updated: Added troubleshooting
```

### Backward Compatibility

- All existing functionality remains unchanged
- Docker-in-Docker approach still documented as alternative
- No breaking changes to existing deployments
- Can run both approaches simultaneously on same host

### Testing

Recommended verification steps:
- [ ] Run `scripts/setup-for-devcontainer.sh` generates correct files
- [ ] Start containers on host before opening devcontainer
- [ ] Devcontainer connects to existing containers via `dev-network`
- [ ] Agent files download correctly using container names
- [ ] MCP connection works with environment variable
- [ ] Rebuilding devcontainer doesn't require re-downloading images
- [ ] `docker ps` from inside devcontainer shows host containers
- [ ] `curl http://diagram-converter:3000/health` works from devcontainer

### Known Issues

None at this time.

### Future Improvements

Potential enhancements for future releases:
- Docker Compose integration for devcontainer workflows
- Automatic health checks in setup scripts
- Port conflict detection and resolution
- Multi-instance support documentation
- GitHub Actions workflow examples

---

## [1.0.0] - Previous Release

Initial release with:
- Diagram converter service (SVG, Mermaid → PNG)
- Confluence MCP server
- Docker Compose setup
- Generic mode for multiple Confluence instances
- VS Code agent definitions
- Basic devcontainer support (Docker-in-Docker)
