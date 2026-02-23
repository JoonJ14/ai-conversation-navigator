# /Commands — Implementation Spec

User-created reusable prompts that persist across chats and platforms. Click to copy a well-crafted prompt to clipboard, paste into any AI chat. Like Claude Code's slash commands, but lives in the ACN sidebar and works everywhere.

**Last updated:** 2026-02-23  
**Applies to:** v10.7 (ships with Tools panel)  
**Status:** Ready for implementation  
**Depends on:** None (self-contained, uses GM_setValue)

---

## Table of Contents

1. [Overview](#overview)
2. [Data Model](#data-model)
3. [Storage](#storage)
4. [Access Methods](#access-methods)
5. [Tools Panel UI](#tools-panel-ui)
6. [Floating Palette](#floating-palette)
7. [Injection Mechanism](#injection-mechanism)
8. [CRUD Operations](#crud-operations)
9. [Default Commands](#default-commands)
10. [Implementation Details](#implementation-details)
11. [Testing Checklist](#testing-checklist)

---

## Overview

Users write full, well-crafted prompts and save them as named commands. These aren't one-liners — they're complete, reproducible prompts that produce consistent, high-quality results across conversations and platforms.

Example:

```
Name:    /handoff
Description: Generate a handoff document for this conversation
Prompt:  Please generate a comprehensive handoff document for our conversation 
         so far. Include: 1) Project context and goals, 2) Key decisions made 
         and their rationale, 3) Current state of implementation, 4) Open 
         questions and unresolved items, 5) Next steps with priorities. Format 
         as a structured document with clear headings. Be thorough — this 
         document will be read by someone with no prior context.
```

Two access methods:
1. **Tools panel** — browse and manage commands in the sidebar
2. **Floating palette** — keyboard shortcut triggers a VS Code-style overlay for quick access

Commands persist via `GM_setValue` — follow you across chats, across platforms, across browser restarts.

---

## Data Model

```javascript
var command = {
    id: 'cmd_1708934567890',           // unique ID (timestamp-based)
    name: 'handoff',                    // short name (displayed as "/handoff")
    description: 'Generate handoff doc', // one-line description
    prompt: '...',                       // the full prompt text (can be long)
    createdAt: 1708934567890,           // timestamp
    updatedAt: 1708934567890,           // timestamp
    usageCount: 0,                       // incremented on each use
    lastUsedAt: null                     // timestamp of last use
};
```

### Name rules

- Lowercase alphanumeric + hyphens only (like CLI commands)
- No spaces (enforced: spaces auto-converted to hyphens)
- Max 30 characters
- Must be unique
- Displayed with `/` prefix: user types "handoff", displayed as "/handoff"

### Prompt field

- No character limit (well, practical limit ~10,000 chars — larger than any AI chat input)
- Supports multi-line text
- Can contain template variables for future enhancement (v11+): `{{topic}}`, `{{language}}`
- Stored as plain text

---

## Storage

```javascript
// GM_setValue key
var COMMANDS_KEY = 'acn-commands';

// Stored value: array of command objects
GM_setValue('acn-commands', [
    { id: 'cmd_...', name: 'handoff', description: '...', prompt: '...', ... },
    { id: 'cmd_...', name: 'review', description: '...', prompt: '...', ... }
]);
```

### Persistence behavior

- Survives: page refresh, browser restart, script updates, computer restart
- Follows user: same commands on Claude, ChatGPT, Gemini, Grok, Perplexity (all share GM storage)
- Wiped only by: uninstalling Tampermonkey script, clearing all extension data
- No sync across devices (GM_setValue is local to browser profile)

### Helper functions

```javascript
function loadCommands() {
    return GM_getValue(COMMANDS_KEY, []);
}

function saveCommands(commands) {
    GM_setValue(COMMANDS_KEY, commands);
}

function getCommandByName(name) {
    var commands = loadCommands();
    for (var i = 0; i < commands.length; i++) {
        if (commands[i].name === name) return commands[i];
    }
    return null;
}
```

---

## Access Methods

### Method 1: Tools Panel

Commands section in the Tools panel sidebar, below Image Gallery and exports. Always available, full CRUD (create, read, update, delete).

### Method 2: Floating Palette

Keyboard shortcut triggers an overlay for quick access. Search, filter, execute — no need to open the sidebar.

**Trigger:** `Ctrl+/` (or `Cmd+/` on Mac)

Why this shortcut:
- `/` is the slash in "slash commands" — intuitive mnemonic
- `Ctrl+/` is commonly "toggle comment" in editors, but NOT used by any AI chat platform
- Doesn't conflict with browser shortcuts
- Easy to remember: "Ctrl + slash = slash commands"

Both methods use the same command data and the same injection mechanism.

---

## Tools Panel UI

### Layout in Tools panel

```
┌─────────────────────────────────┐
│  🖼️ Image Gallery               │ ← existing
│  [thumbnail grid...]            │
├─────────────────────────────────┤
│  📋 Exports                     │ ← existing
│  [Full Conversation] [Bookmarks]│
│  [Summary]                      │
├─────────────────────────────────┤
│  ⌨️ /Commands                   │ ← NEW
│                                 │
│  (empty state when no commands) │
│  No commands yet.               │
│  Create your first command to   │
│  save reusable prompts.         │
│  [+ New Command]                │
│                                 │
│  (populated state)              │
│  ┌─────────────────────────┐    │
│  │ /handoff          [▶][✎][✕]│ │
│  │ Generate handoff doc     │    │
│  ├─────────────────────────┤    │
│  │ /review           [▶][✎][✕]│ │
│  │ Code review conversation │    │
│  ├─────────────────────────┤    │
│  │ /decisions        [▶][✎][✕]│ │
│  │ Summarize key decisions  │    │
│  └─────────────────────────┘    │
│  [+ New Command]                │
│                                 │
│  Tip: Ctrl+/ to quick-access   │
└─────────────────────────────────┘
```

### Command card

Each command displays as a compact card:
- **Left side:** `/name` in monospace font (bold), description below in smaller gray text
- **Right side:** Three icon buttons
  - `▶` (play) — execute: copy prompt to clipboard + inject
  - `✎` (edit) — open edit form
  - `✕` (delete) — delete with confirm

### New/Edit form

Clicking `[+ New Command]` or `✎` replaces the commands list with an inline form:

```
┌─────────────────────────────────┐
│  Create Command                 │
│                                 │
│  Name                           │
│  / [handoff              ]      │
│                                 │
│  Description                    │
│  [Generate handoff doc   ]      │
│                                 │
│  Prompt                         │
│  ┌───────────────────────────┐  │
│  │ Please generate a         │  │
│  │ comprehensive handoff     │  │
│  │ document for our          │  │
│  │ conversation so far...    │  │
│  │                           │  │
│  └───────────────────────────┘  │
│                                 │
│  [Cancel]  [Save Command]       │
└─────────────────────────────────┘
```

- Name field: text input with `/` prefix shown (not editable, decorative)
- Description field: single-line text input
- Prompt field: textarea, resizable, ~6 rows default height
- Save validates: name required, name unique, prompt required
- Cancel returns to list view without saving

---

## Floating Palette

### Appearance

Absolutely-positioned overlay, centered horizontally, near top of viewport. Dark themed to match ACN sidebar. Appears above all platform content.

```
                    ┌──────────────────────────────────────┐
                    │  /  [Search commands...          ]   │
                    ├──────────────────────────────────────┤
                    │  /handoff                            │
                    │  Generate handoff doc           ▶    │
                    ├──────────────────────────────────────┤
                    │  /review                             │
                    │  Code review conversation       ▶    │
                    ├──────────────────────────────────────┤
                    │  /decisions                          │
                    │  Summarize key decisions         ▶   │
                    └──────────────────────────────────────┘
```

### Behavior

1. **Open:** `Ctrl+/` (or `Cmd+/` on Mac) toggles palette open/closed
2. **Search:** Input field auto-focused, type to fuzzy-filter by name and description
3. **Navigate:** Arrow keys move selection highlight up/down
4. **Execute:** Enter or click `▶` on selected command → inject + close palette
5. **Close:** Escape, click outside, or `Ctrl+/` again
6. **Empty state:** "No commands yet. Create one in Tools → /Commands"

### Fuzzy filtering

Simple substring match on both `name` and `description`:

```javascript
function filterCommands(query, commands) {
    if (!query) return commands;
    var q = query.toLowerCase();
    return commands.filter(function (cmd) {
        return cmd.name.toLowerCase().indexOf(q) !== -1 ||
               cmd.description.toLowerCase().indexOf(q) !== -1;
    });
}
```

### Sorting

Commands sorted by `lastUsedAt` (most recently used first), with never-used commands at the bottom sorted by `createdAt`. This means frequently used commands naturally bubble to the top.

```javascript
function sortCommands(commands) {
    return commands.slice().sort(function (a, b) {
        // Both used: sort by most recently used
        if (a.lastUsedAt && b.lastUsedAt) return b.lastUsedAt - a.lastUsedAt;
        // One used, one not: used one first
        if (a.lastUsedAt) return -1;
        if (b.lastUsedAt) return 1;
        // Neither used: sort by creation date
        return b.createdAt - a.createdAt;
    });
}
```

### Keyboard interaction

```javascript
document.addEventListener('keydown', function (e) {
    // Ctrl+/ or Cmd+/ to toggle palette
    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        toggleCommandPalette();
        return;
    }

    // Only handle these when palette is open
    if (!isPaletteOpen()) return;

    if (e.key === 'Escape') {
        closePalette();
    } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveSelection(1);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveSelection(-1);
    } else if (e.key === 'Enter') {
        e.preventDefault();
        executeSelected();
    }
});
```

### Palette CSS

```css
.acn-palette-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 99999;
    display: flex;
    justify-content: center;
    padding-top: 20vh;  /* positioned in upper third */
}

.acn-palette {
    width: 480px;
    max-height: 400px;
    background: #1a1a2e;
    border: 1px solid #333;
    border-radius: 12px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.acn-palette-input {
    padding: 12px 16px;
    background: transparent;
    border: none;
    border-bottom: 1px solid #333;
    color: #eee;
    font-size: 15px;
    outline: none;
}

.acn-palette-list {
    overflow-y: auto;
    flex: 1;
}

.acn-palette-item {
    padding: 10px 16px;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(255,255,255,0.05);
}

.acn-palette-item:hover,
.acn-palette-item.acn-selected {
    background: rgba(255, 255, 255, 0.08);
}

.acn-palette-item-name {
    font-family: monospace;
    font-weight: bold;
    color: #eee;
    font-size: 14px;
}

.acn-palette-item-desc {
    color: #888;
    font-size: 12px;
    margin-top: 2px;
}
```

---

## Injection Mechanism

When a user executes a command, we need to get the prompt text into the platform's chat input.

### Strategy: Clipboard + attempt direct injection

```javascript
function executeCommand(command) {
    var prompt = command.prompt;

    // Update usage stats
    command.usageCount++;
    command.lastUsedAt = Date.now();
    saveCommands(loadCommands()); // persist updated stats

    // Step 1: Copy to clipboard (always works)
    copyToClipboard(prompt);

    // Step 2: Try direct injection into platform's input field
    var injected = tryDirectInject(prompt);

    // Step 3: Focus the input field
    focusChatInput();

    // Step 4: Show appropriate toast
    if (injected) {
        showToast(i18n('commandInjected', { name: command.name }));
    } else {
        showToast(i18n('commandCopied', { name: command.name }));
    }
}
```

### Clipboard copy (reliable fallback)

```javascript
function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(function () {
            fallbackCopy(text);
        });
    } else {
        fallbackCopy(text);
    }
}

function fallbackCopy(text) {
    var textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
}
```

### Direct injection (best effort, per platform)

```javascript
function tryDirectInject(text) {
    if (!platform) return false;

    try {
        var input = findChatInput();
        if (!input) return false;

        if (input.tagName === 'TEXTAREA') {
            // Simple textarea: set value + trigger input event
            var nativeSetter = Object.getOwnPropertyDescriptor(
                HTMLTextAreaElement.prototype, 'value'
            ).set;
            nativeSetter.call(input, text);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            return true;
        }

        if (input.contentEditable === 'true') {
            // ProseMirror / contenteditable: insert text
            input.focus();
            // Clear existing content
            input.textContent = '';
            // Insert new text
            document.execCommand('insertText', false, text);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            return true;
        }
    } catch (e) {
        // Direct injection failed — clipboard fallback already done
        return false;
    }

    return false;
}
```

### Find chat input (per platform)

```javascript
function findChatInput() {
    // Platform-specific selectors for the chat input field
    var selectors = {
        claude: [
            'div.ProseMirror[contenteditable="true"]',
            '[contenteditable="true"].prose',
            'fieldset textarea'
        ],
        chatgpt: [
            '#prompt-textarea',
            'textarea[data-id="root"]',
            'div[contenteditable="true"]#prompt-textarea'
        ],
        grok: [
            'textarea',
            '[contenteditable="true"]'
        ],
        gemini: [
            'div.ql-editor[contenteditable="true"]',
            '.text-input-field [contenteditable="true"]',
            'rich-textarea [contenteditable="true"]'
        ],
        perplexity: [
            'textarea',
            '[contenteditable="true"]'
        ]
    };

    var platformSelectors = selectors[platform.id] || ['textarea', '[contenteditable="true"]'];

    for (var i = 0; i < platformSelectors.length; i++) {
        var el = document.querySelector(platformSelectors[i]);
        if (el) return el;
    }
    return null;
}
```

### Focus input after injection

```javascript
function focusChatInput() {
    var input = findChatInput();
    if (input) {
        input.focus();
        // Move cursor to end
        if (input.tagName === 'TEXTAREA') {
            input.selectionStart = input.selectionEnd = input.value.length;
        } else if (input.contentEditable === 'true') {
            var range = document.createRange();
            range.selectNodeContents(input);
            range.collapse(false);
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
    }
}
```

### Toast messages

```javascript
// If direct injection succeeded:
"✓ /handoff injected — press Enter to send"

// If clipboard fallback:
"📋 /handoff copied — Ctrl+V to paste"
```

---

## CRUD Operations

### Create

```javascript
function createCommand(name, description, prompt) {
    var commands = loadCommands();

    // Validate
    name = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (!name || name.length > 30) return { error: i18n('commandNameInvalid') };
    if (getCommandByName(name)) return { error: i18n('commandNameExists') };
    if (!prompt.trim()) return { error: i18n('commandPromptRequired') };

    var command = {
        id: 'cmd_' + Date.now(),
        name: name,
        description: description || '',
        prompt: prompt.trim(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        usageCount: 0,
        lastUsedAt: null
    };

    commands.push(command);
    saveCommands(commands);
    return { success: true, command: command };
}
```

### Update

```javascript
function updateCommand(id, updates) {
    var commands = loadCommands();
    for (var i = 0; i < commands.length; i++) {
        if (commands[i].id === id) {
            // If name changed, validate uniqueness
            if (updates.name && updates.name !== commands[i].name) {
                var cleanName = updates.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                if (getCommandByName(cleanName)) return { error: i18n('commandNameExists') };
                commands[i].name = cleanName;
            }
            if (updates.description !== undefined) commands[i].description = updates.description;
            if (updates.prompt !== undefined) commands[i].prompt = updates.prompt.trim();
            commands[i].updatedAt = Date.now();
            saveCommands(commands);
            return { success: true };
        }
    }
    return { error: 'Command not found' };
}
```

### Delete

```javascript
function deleteCommand(id) {
    var commands = loadCommands();
    commands = commands.filter(function (cmd) { return cmd.id !== id; });
    saveCommands(commands);
}
```

### Delete confirmation

Clicking `✕` shows an inline confirm: the card background turns red, button text changes to "Delete?" with a brief timeout. Click again to confirm, or it auto-cancels after 3 seconds.

```javascript
// No browser confirm() dialog — inline visual confirmation
// Card turns red, "✕" becomes "Sure?", auto-resets after 3s
```

---

## Default Commands

Ships empty. No pre-loaded commands.

**Rationale:** Users who want /Commands know what they want. Pre-loaded defaults feel presumptuous — one person's "generate handoff doc" is another person's irrelevant clutter. An empty state with clear guidance ("Create your first command") teaches the feature without imposing opinions.

The empty state in the Tools panel includes:

```
⌨️ /Commands

No commands yet.
Create reusable prompts you can inject
into any AI chat with one click.

[+ New Command]

Tip: Ctrl+/ to open quick palette
```

---

## Implementation Details

### Summary of changes

| Location | Change |
|----------|--------|
| Tools panel (`orbBuildPanelTools()`) | Add /Commands section below exports |
| New functions | `createCommand()`, `updateCommand()`, `deleteCommand()`, `executeCommand()`, `findChatInput()`, `tryDirectInject()`, `copyToClipboard()`, `focusChatInput()` |
| New UI | Floating palette overlay (created/destroyed dynamically) |
| New keyboard listener | `Ctrl+/` / `Cmd+/` for palette toggle |
| GM_setValue storage | `acn-commands` key |
| CSS | `.acn-palette-*`, `.acn-cmd-*` styles |

### Where this lives in the codebase

All /Commands code is part of Group E2 (Tools). It's a section within the Tools panel, plus the floating palette which is an independent overlay. No other groups need to know about it.

### i18n strings

```javascript
// English
commandsTitle: '/Commands',
commandsEmpty: 'No commands yet.',
commandsEmptyHint: 'Create reusable prompts you can inject into any AI chat with one click.',
commandNew: '+ New Command',
commandSave: 'Save Command',
commandCancel: 'Cancel',
commandDelete: 'Sure?',
commandNameLabel: 'Name',
commandDescLabel: 'Description',
commandPromptLabel: 'Prompt',
commandNameInvalid: 'Name must be 1-30 lowercase characters, numbers, or hyphens',
commandNameExists: 'A command with this name already exists',
commandPromptRequired: 'Prompt is required',
commandInjected: '✓ /{name} injected — press Enter to send',
commandCopied: '📋 /{name} copied — Ctrl+V to paste',
commandPalettePlaceholder: 'Search commands...',
commandPaletteEmpty: 'No commands yet. Create one in Tools → /Commands',
commandPaletteTip: 'Tip: Ctrl+/ to open quick palette',

// Korean
commandsTitle: '/Commands',  // keep as-is (brand name)
commandsEmpty: '명령어가 없습니다.',
commandsEmptyHint: '재사용 가능한 프롬프트를 만들어 원클릭으로 AI 채팅에 입력하세요.',
commandNew: '+ 새 명령어',
commandSave: '명령어 저장',
commandCancel: '취소',
commandDelete: '삭제할까요?',
commandNameLabel: '이름',
commandDescLabel: '설명',
commandPromptLabel: '프롬프트',
commandNameInvalid: '이름은 1-30자의 소문자, 숫자, 하이픈이어야 합니다',
commandNameExists: '같은 이름의 명령어가 이미 있습니다',
commandPromptRequired: '프롬프트를 입력해주세요',
commandInjected: '✓ /{name} 입력됨 — Enter를 눌러 전송',
commandCopied: '📋 /{name} 복사됨 — Ctrl+V로 붙여넣기',
commandPalettePlaceholder: '명령어 검색...',
commandPaletteEmpty: '명령어가 없습니다. 도구 → /Commands에서 만드세요',
commandPaletteTip: '팁: Ctrl+/로 빠른 팔레트 열기',
```

### Keyboard shortcut conflicts

`Ctrl+/` is safe across all target platforms:
- Claude: not used
- ChatGPT: not used
- Gemini: not used
- Grok: not used
- VS Code web: used for "toggle comment" but we're not running in VS Code
- Browser: not a native shortcut in Chrome, Firefox, Safari, or Edge

The listener should only fire when our script is active (platform detected, not in settings/usage pages).

---

## Testing Checklist

### CRUD
- [ ] Create command with valid name, description, prompt → saved to GM_setValue
- [ ] Create command with duplicate name → error shown
- [ ] Create command with empty prompt → error shown
- [ ] Name auto-sanitized: spaces → hyphens, uppercase → lowercase, special chars removed
- [ ] Edit command name, description, prompt → changes persisted
- [ ] Delete command with inline confirmation
- [ ] Commands persist across page refresh
- [ ] Commands persist across different platforms (create on Claude, see on ChatGPT)

### Tools panel UI
- [ ] Empty state shown when no commands
- [ ] Command cards display name, description, action buttons
- [ ] New Command form shows inline, replaces list
- [ ] Save returns to list with new command visible
- [ ] Cancel returns to list without changes
- [ ] Tip text shows keyboard shortcut

### Floating palette
- [ ] `Ctrl+/` opens palette overlay
- [ ] `Ctrl+/` again closes it (toggle)
- [ ] `Escape` closes palette
- [ ] Click outside closes palette
- [ ] Search input auto-focused on open
- [ ] Typing filters commands by name and description
- [ ] Arrow keys navigate selection
- [ ] Enter executes selected command
- [ ] Click executes clicked command
- [ ] Empty state shown when no commands exist
- [ ] Commands sorted by most recently used

### Injection
- [ ] Execute command → prompt copied to clipboard
- [ ] Direct injection works on Claude (ProseMirror)
- [ ] Direct injection works on ChatGPT (textarea)
- [ ] Fallback to clipboard when direct injection fails
- [ ] Chat input focused after injection
- [ ] Cursor positioned at end of injected text
- [ ] Correct toast message shown (injected vs copied)
- [ ] Usage count incremented after execution
- [ ] lastUsedAt updated after execution

### Edge cases
- [ ] Very long prompt (5,000+ chars) handles correctly
- [ ] Command with special characters in prompt (quotes, backticks, newlines)
- [ ] Palette works when sidebar is closed
- [ ] Palette works when sidebar is open
- [ ] Multiple rapid `Ctrl+/` presses don't create duplicate palettes
- [ ] No keyboard shortcut conflicts with platform shortcuts

---

*This spec is part of the Tools panel (v10.7). Implemented by Group E2. The floating palette and /Commands section are additions to the TOOLS.md spec scope.*
