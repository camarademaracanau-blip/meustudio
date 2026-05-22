# Deploy Netlify Skill

Deploy the MeuStudio project to Netlify from GitHub.

## Parameters
- `github_repo` (string, required): GitHub repository in format "user/repo" (e.g., "camarademaracanau-blip/meustudio")
- `netlify_site_id` (string, required): Netlify Site ID (found in Site Settings > General > Site details)
- `netlify_access_token` (string, required): Netlify Personal Access Token (from User Settings > Applications)

## Steps
1. Clone/pull the latest code from GitHub
2. Trigger Netlify deploy via API
3. Report deployment status