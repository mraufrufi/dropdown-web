import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

// Identifiers used to recognize "our" window among all windows the Shell
// manages. gtk_application_id is the most reliable (works on Wayland for
// GTK4 apps); wm_class and title are fallbacks for older toolkits/setups.
// Keep GTK_APPLICATION_ID in sync with APP_ID in webdrop-app.py.
const GTK_APPLICATION_ID = 'org.local.WebDropApp';
const WM_CLASS = 'WebDropApp';
const WINDOW_TITLE = 'WebDrop';

const ANIMATION_DURATION_MS = 220;

export default class DropdownWebExtension extends Extension {
    enable() {
        log('dropdown-web: enable() called');

        this._settings = this.getSettings();
        this._window = null;
        this._visible = false;
        this._animating = false;
        // True while we're waiting for a freshly-launched window to map.
        this._pendingShow = false;

        Main.wm.addKeybinding(
            'toggle-shortcut',
            this._settings,
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.ALL,
            this._toggle.bind(this)
        );
        log('dropdown-web: keybinding registered');

        // We hook the window MANAGER's 'map' signal rather than display's
        // 'window-created' — by the time 'window-created' fires, Mutter has
        // often already applied its default placement, so acting here is
        // both earlier and lets us suppress the built-in open animation.
        this._mapId = global.window_manager.connect('map', (wm, actor) => {
            this._onWindowMapped(wm, actor);
        });
        log('dropdown-web: map signal connected, enable() finished');
    }

    disable() {
        if (this._mapId) {
            global.window_manager.disconnect(this._mapId);
            this._mapId = null;
        }
        Main.wm.removeKeybinding('toggle-shortcut');
        this._settings = null;
        this._window = null;
    }

    _matchesOurWindow(win) {
        if (!win)
            return false;

        try {
            if (win.get_gtk_application_id &&
                win.get_gtk_application_id() === GTK_APPLICATION_ID)
                return true;
        } catch (e) {
            // get_gtk_application_id may not exist on some Mutter versions;
            // fall through to the other checks.
        }

        if (win.get_wm_class() === WM_CLASS)
            return true;

        return win.get_title() === WINDOW_TITLE;
    }

    _onWindowMapped(wm, actor) {
        const win = actor.meta_window;
        if (!win || this._window)
            return;

        if (!this._matchesOurWindow(win)) {
            if (this._pendingShow) {
                log(`dropdown-web: unmatched window while waiting for ` +
                    `launch — wm_class="${win.get_wm_class()}" ` +
                    `title="${win.get_title()}" ` +
                    `gtk_app_id="${win.get_gtk_application_id ? win.get_gtk_application_id() : 'n/a'}"`);
            }
            return;
        }

        log('dropdown-web: matched our window, taking control');

        this._window = win;
        win.stick(); // visible on every workspace

        win.connect('unmanaged', () => {
            this._window = null;
            this._visible = false;
        });

        // Suppress Mutter's default open animation — we drive the slide
        // ourselves via the actor's translation, below.
        wm.skipNextEffect(actor);

        // IMPORTANT: the window's real frame position always stays at the
        // "shown" spot. We never move the actual frame off-screen — Mutter
        // enforces keep-on-screen constraints that snap an off-screen frame
        // back into view, which is what caused the "slides out, then jumps
        // back" bug. Instead we purely animate the compositor actor's
        // visual translation, and minimize the window once it's fully
        // translated out of view. Minimizing is a real, supported hidden
        // state that Mutter doesn't fight.
        const geom = this._getGeometry();
        win.move_resize_frame(false, geom.x, geom.shownY, geom.width, geom.height);
        actor.translation_y = -geom.height;
        this._visible = false;

        if (this._pendingShow) {
            this._pendingShow = false;
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 30, () => {
                this._show();
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    _getGeometry() {
        const monitor = Main.layoutManager.primaryMonitor;
        const widthFrac = this._settings.get_double('window-width');
        const heightFrac = this._settings.get_double('window-height');
        const width = Math.floor(monitor.width * widthFrac);
        const height = Math.floor(monitor.height * heightFrac);
        const x = monitor.x + Math.floor((monitor.width - width) / 2);
        const shownY = monitor.y;
        return {x, width, height, shownY};
    }

    _toggle() {
        if (!this._window) {
            this._launch();
            return;
        }
        if (this._animating)
            return;

        if (this._visible)
            this._hide();
        else
            this._show();
    }

    _launch() {
        this._pendingShow = true;
        const url = this._settings.get_string('web-url');
        try {
            Gio.Subprocess.new(['webdrop-app', url], Gio.SubprocessFlags.NONE);
            log(`dropdown-web: launched webdrop-app with url=${url}`);
        } catch (e) {
            this._pendingShow = false;
            logError(e, 'dropdown-web: failed to launch web app');
        }
    }

    _show() {
        if (!this._window)
            return;
        const actor = this._window.get_compositor_private();
        if (!actor)
            return;

        if (this._window.minimized)
            this._window.unminimize();

        const geom = this._getGeometry();
        this._window.move_resize_frame(false, geom.x, geom.shownY, geom.width, geom.height);
        Main.activateWindow(this._window);

        this._animating = true;
        actor.remove_all_transitions();
        actor.ease({
            translation_y: 0,
            duration: ANIMATION_DURATION_MS,
            mode: Clutter.AnimationMode.EASE_OUT_CUBIC,
            onComplete: () => {
                this._animating = false;
            },
        });
        this._visible = true;
    }

    _hide() {
        if (!this._window)
            return;
        const actor = this._window.get_compositor_private();
        if (!actor)
            return;

        const geom = this._getGeometry();

        this._animating = true;
        actor.remove_all_transitions();
        actor.ease({
            translation_y: -geom.height,
            duration: ANIMATION_DURATION_MS,
            mode: Clutter.AnimationMode.EASE_OUT_CUBIC,
            onComplete: () => {
                this._animating = false;
                // Fully hide it once off-screen visually — minimize is a
                // real state Mutter respects instead of fighting.
                if (this._window && !this._visible)
                    this._window.minimize();
            },
        });
        this._visible = false;
    }
}
