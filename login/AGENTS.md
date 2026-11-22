# Repository Guidelines

## Agent Working Rule

Whenever an action can be completed independently, do it without asking the user. This includes starting local apps or preview servers, running relevant checks, and verifying completed changes. Ask for input only when an action requires unavailable credentials, explicit user choices, or permission beyond this repository.

## Project Structure & Module Organization

This is a lightweight, static login-page prototype with no build system or package manager.

- `index.html` contains the page structure, form controls, and accessibility attributes.
- `styles.css` holds all visual styles, responsive rules, and design tokens in `:root`.
- `script.js` provides the small client-side interactions: account-role selection, password visibility, and demo form feedback.

Keep related markup, styles, and interactions together by feature. If the app grows, place images and fonts in `assets/`, and split large JavaScript features into clearly named modules such as `js/auth.js`.

## Build, Test, and Development Commands

There are no install, build, or automated test commands yet. Preview the page with a static server instead of opening it directly when possible:

```powershell
# VS Code: install the Live Server extension, then use “Open with Live Server”
# Or, if Python is installed:
python -m http.server 4173
```

Visit `http://localhost:4173` and test both desktop and mobile viewport sizes. Do not add a framework or dependency solely for a small visual change.

## Coding Style & Naming Conventions

Use two-space indentation in HTML, CSS, and JavaScript. Prefer semantic HTML (`main`, `section`, `nav`, `label`, `button`) and keep form labels connected with `for` and `id` attributes.

Use lowercase, hyphenated CSS class names such as `.login-panel` and `.password-wrap`. Use `camelCase` for JavaScript variables and clear `data-*` attributes for UI state. Reuse the CSS custom properties already defined in `:root` instead of repeating color values.

## Testing Guidelines

No test framework is configured. Before submitting changes, manually verify:

- Client and creative role buttons update their active state.
- Password visibility toggle works and retains an accurate accessible label.
- Required form validation appears for blank or invalid email input.
- Layout works at mobile widths (around 375px) and wide desktop widths.

When introducing non-trivial logic, add a test setup and name tests after user-visible behavior, for example `shows selected creative role`.

## Commit & Pull Request Guidelines

The repository has no commit history yet, so use concise imperative commit messages: `Add password visibility toggle` or `Improve mobile sign-in layout`. Keep commits focused.

Pull requests should describe the user-facing change, list the manual checks performed, link any related issue, and include before/after screenshots for visual updates. Never commit passwords, API keys, or real user data.
