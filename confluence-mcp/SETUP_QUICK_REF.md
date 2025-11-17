# Confluence MCP - Quick Setup Reference

## Current Mode: ✅ Generic Mode (Multi-Project)

Your server is running in **generic mode** - no Confluence credentials needed in `.env`.

## What You Need

### For Each Project/Workspace

Call `confluence_setup_project` once with these parameters:

```javascript
confluence_setup_project({
  confluenceUrl: "https://your-company.atlassian.net",  // Your Confluence URL
  username: "your-email@company.com",                    // Your email
  apiToken: "ATATT3xFfGF0...",                          // API token (see below)
  spaceKey: "MYSPACE"                                    // Space key from URL
})
```

## Getting Your Credentials (5 minutes)

### 1️⃣ Confluence URL
- Find it in your browser when you open Confluence
- Cloud: `https://yourcompany.atlassian.net`
- Server: `https://confluence.yourcompany.com`

### 2️⃣ Username
- Your Atlassian email address
- Example: `john.doe@company.com`

### 3️⃣ API Token (⚠️ Most Important)
1. Go to: https://id.atlassian.com/manage-profile/security/api-tokens
2. Click **"Create API token"**
3. Label: `Confluence MCP`
4. **Copy it immediately** - you can't see it again!
5. Store in password manager

### 4️⃣ Space Key
1. Open your Confluence space
2. Look at URL: `.../wiki/spaces/**MYSPACE**/...`
3. The **MYSPACE** part is your space key

## Quick Test

After setup, verify everything works:

```javascript
// 1. Test connection
confluence_test_connection()  // Should return success

// 2. List spaces (verify access)
confluence_list_spaces()      // Should show your spaces

// 3. Create test page
confluence_create_page({
  title: "MCP Test Page",
  markdownContent: "# Hello\n\nThis works!"
})
```

## Current .env Configuration

Your `.env` file should have:

```env
# Required - Already set ✅
MCP_API_KEY=90214cca4e92a32e3edce91bea4e242172e2003afd95853d4d670ff5e270d3a5

# Optional - Leave blank for generic mode ✅
# CONFLUENCE_BASE_URL=
# CONFLUENCE_USERNAME=
# CONFLUENCE_API_TOKEN=
```

**No changes needed to `.env`!** Your setup is correct for generic mode.

## Alternative: Pre-configured Mode (Single Instance)

If you always use the **same** Confluence instance, you can add credentials to `.env`:

```env
MCP_API_KEY=90214cca4e92a32e3edce91bea4e242172e2003afd95853d4d670ff5e270d3a5

# Add these for pre-configured mode
CONFLUENCE_BASE_URL=https://your-company.atlassian.net
CONFLUENCE_USERNAME=your-email@company.com
CONFLUENCE_API_TOKEN=ATATT3xFfGF0...
```

Then restart: `docker-compose restart confluence-mcp`

**Generic mode is recommended** - it's more flexible!

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Authentication failed" | Double-check email and API token |
| "Space not found" | Verify space key (case-sensitive) |
| "No spaces found" | Check you have Confluence access |
| Need to change config | Call `confluence_setup_project` again |

## Available Tools

After setup, you can use:

- `confluence_list_spaces` - List all spaces
- `confluence_list_pages` - List pages in a space
- `confluence_create_page` - Create from Markdown
- `confluence_update_page` - Update existing page
- `confluence_delete_page` - Delete page
- `confluence_show_config` - Show current config
- `confluence_test_connection` - Test connection

## Security Notes

✅ **DO:**
- Use your personal API token
- Store tokens in password manager
- Add `.env` to `.gitignore`

❌ **DON'T:**
- Commit tokens to git
- Share tokens with others
- Use service account tokens without permission

---

**Ready to test?** Use one of your existing Confluence servers and follow the Quick Test steps above!

For complete documentation, see [CONFIGURATION.md](./CONFIGURATION.md)
