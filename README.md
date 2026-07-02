# Dropdown Web

Dropdown Web is a small GNOME Shell extension that slides a web app window down
from the top of the screen when a keyboard shortcut is pressed, and hides it
when pressed again. It is intended to be used with a small companion launcher
(`webdrop-app`) which opens a single-window web app that the extension
controls.

**Features**
- Toggle a web app window with a keyboard shortcut
- Smooth slide down/up animation
- Configurable URL and window size

**Requirements**
- GNOME Shell 45–50
- A companion `webdrop-app` executable available in `PATH` that creates the
	web app window (see notes below about the expected GTK application id)

**Installation (local)**
1. Copy the repository folder to `~/.local/share/gnome-shell/extensions/dropdown-web@local` (the folder name must match the extension `uuid` in `metadata.json`).
2. If you change the schemas, run:

```bash
glib-compile-schemas schemas/
```

3. Restart GNOME Shell: press `Alt+F2`, enter `r` and press Enter on X11; on Wayland log out and log back in.
4. Enable the extension with:

```bash
gnome-extensions enable dropdown-web@local
```

**Usage**
- Default toggle shortcut: `Super+grave` (can be changed in preferences).
- The extension launches `webdrop-app` with the configured URL when no window
	is present, and controls the visibility of the app window thereafter.

**Configuration (gsettings)**
The extension exposes the following settings under the schema `org.gnome.shell.extensions.dropdown-web`:

- `toggle-shortcut` (type `as`) — default: `['<Super>grave']` — Keyboard shortcut to show/hide the dropdown.
- `web-url` (type `s`) — default: `'https://example.com'` — URL to load in the dropdown window.
- `window-width` (type `d`) — default: `1.0` — Window width as a fraction of screen width (0.0 - 1.0).
- `window-height` (type `d`) — default: `0.5` — Window height as a fraction of screen height (0.0 - 1.0).

You can change a setting from the command line, for example:

```bash
gsettings set org.gnome.shell.extensions.dropdown-web web-url 'https://news.ycombinator.com'
```

**Developer notes**
- Main extension code: [extension.js](extension.js)
- Metadata: [metadata.json](metadata.json)
- Settings schema: [schemas/org.gnome.shell.extensions.dropdown-web.gschema.xml](schemas/org.gnome.shell.extensions.dropdown-web.gschema.xml)

The extension looks for a window with the GTK application id `org.local.WebDropApp`,
WM class `WebDropApp`, or window title `WebDrop` (see `extension.js`). If you use a
custom launcher, make sure it sets an application id that matches the constant
`GTK_APPLICATION_ID` in `extension.js`, or update the constant to match your app.

**License**
See the repository license or include one as needed.

---

For questions or improvements, open an issue or pull request.