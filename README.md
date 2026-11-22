# Envisage

Run the website from this folder in PowerShell:

```powershell
.\start.cmd
```

Open http://localhost:4173. Keep the terminal open while using the website. Stop it with Ctrl+C. To use another port, run `.\start.cmd 4174`. You can also double-click `start.cmd`.

The server uses the included Node executable, serves the `login` folder, and listens only on this computer. Internet access is required for Supabase authentication and data.

Run the regression checks:

```powershell
.\.tools\node.exe --test login/tests/*.test.cjs
.\.tools\node.exe .tools/run-dom.mjs
```

Backend configuration and email setup are documented in [login/SUPABASE-SETUP.md](login/SUPABASE-SETUP.md).

The hosted copy is prepared in `sites/envisage/dist`, with its Site identity in `sites/envisage/.openai/hosting.json`. Future deployments must copy updated website files from `login` into this folder before packaging and publishing. Only website files and assets belong in the hosted copy; omit local tools, tests, and database migrations.

For production email links, configure Supabase Authentication URL Configuration with the deployed origin as Site URL and add that origin's `/auth/login.html` and `/auth/update-password.html` to Redirect URLs. This is separate from deploying the website.

## GitHub Pages research deployment

`.github/workflows/pages.yml` tests and publishes the research website whenever `main` changes. It packages website files from `login` using `.github/scripts/build-pages.mjs`, excluding local tools, regression fixtures, and SQL migrations from the hosted artifact.

Use a public repository for GitHub Free. In the repository's Settings → Pages, select **GitHub Actions** as the publishing source, then run the **Deploy Envisage to GitHub Pages** workflow. Its deployment result provides the actual public URL. Project-relative navigation supports a repository path such as `https://USERNAME.github.io/REPOSITORY/`.

After deployment, set the exact GitHub Pages URL (including the repository path) in Supabase Authentication URL Configuration. Allow the corresponding `auth/login.html` and `auth/update-password.html` redirect URLs so research participants receive working email links. The database continues to run on the existing Supabase project.
