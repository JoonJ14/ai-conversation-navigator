# Troubleshooting

Platform-specific issues, root causes, and how they were resolved. If you run into a problem, check here first.

---

## Gemini

### Navigate button does nothing (Chrome only)

**Versions affected:** v4.0  
**Fixed in:** v5.0  
**Browser:** Chrome only (Firefox and other browsers were not affected)

**Symptoms:**
- The toggle button appears on the right side of the screen
- Clicking the button does nothing — the panel never slides out
- The button may work initially after first install, then stop working after a page refresh
- DevTools Console shows red errors:
  ```
  TypeError: Failed to set the 'innerHTML' property on 'Element':
  This document requires 'TrustedHTML' assignment.
  ```

**Root cause:**  
Gemini enforces a [Trusted Types](https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API) Content Security Policy (CSP) on Chrome. This is a browser security feature that blocks all direct `innerHTML` assignments to prevent Cross-Site Scripting (XSS) attacks. 

Our script was using `innerHTML` to build the panel contents (header, refresh button, question list, etc.). Chrome silently blocked these assignments on Gemini, so the panel was created as an empty `<div>` with no content inside. The toggle button would technically open an empty, invisible panel — making it look like the button was broken.

This only affected Chrome because Firefox does not enforce Trusted Types CSP the same way.

**Fix:**  
Replaced every instance of `innerHTML` with programmatic DOM creation:
- `document.createElement()` to create elements
- `.textContent` to set text safely
- `.appendChild()` to build the DOM tree

Also added defensive measures for Gemini's aggressive SPA re-rendering:
- **DOM Guardian** — a MutationObserver that detects when injected elements are removed and re-creates them
- **SPA navigation hooks** — intercepts `history.pushState`/`replaceState` to survive route changes
- **Periodic health check** — verifies elements exist every 3 seconds

**How to diagnose similar issues in the future:**  
1. Open DevTools (F12) → Console tab
2. Look for `TypeError` messages mentioning `innerHTML` or `TrustedHTML`
3. If present, the fix is to replace `innerHTML` with programmatic DOM creation

---

## General Issues

### Script not appearing?

- Make sure the userscript manager is enabled
- **Chrome users:** Enable **Developer Mode** in `chrome://extensions/`
- **Still not working on Chrome 138+?** You may also need to enable **"Allow User Scripts"** in Tampermonkey's Details page, then **relaunch Chrome**
- If you don't see the "Allow User Scripts" option, your Chrome version only needs Developer Mode
- Try hard-refreshing the page (Ctrl+Shift+R / Cmd+Shift+R)

### Script not appearing on any site

**Possible causes:**
- Tampermonkey is disabled — check that the extension is enabled in your browser's extension settings
- The script is disabled within Tampermonkey — click the Tampermonkey icon and verify the script shows a green toggle
- Chrome's Developer Mode is off — required for extensions to run. Go to `chrome://extensions/` and enable it
- Page needs a refresh — after installing or updating the script, refresh the page

### Messages not detected (0 questions found)

**Possible causes:**
- The AI platform updated its HTML structure and the CSS selectors no longer match
- The conversation hasn't fully loaded yet — try clicking the ↻ Refresh button in the panel

**How to investigate:**
1. Open DevTools (F12) → Elements tab
2. Right-click on one of your messages → Inspect
3. Look at the element's class names and data attributes
4. Compare with the selectors in the script's `getUserMessages()` function
5. If they don't match, the platform has changed its structure

**Current selectors by platform:**
| Platform | Primary Selector |
|----------|-----------------|
| Claude | `[data-testid="user-human-turn"]` |
| ChatGPT | `[data-message-author-role="user"]` |
| Grok | `div.message-bubble` |
| Gemini | `div.query-text` |

---

## Reporting New Issues

If you hit a problem not listed here:

1. Note which **platform** and **browser** are affected
2. Open DevTools Console (F12) and check for error messages
3. Include the error text when reporting
4. Open an issue on GitHub with these details
