import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const MODIFIER_KEYS = new Set([
    Gdk.KEY_Shift_L, Gdk.KEY_Shift_R,
    Gdk.KEY_Control_L, Gdk.KEY_Control_R,
    Gdk.KEY_Alt_L, Gdk.KEY_Alt_R,
    Gdk.KEY_Super_L, Gdk.KEY_Super_R,
    Gdk.KEY_Meta_L, Gdk.KEY_Meta_R,
]);

export default class DropdownWebPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: 'Dropdown Web',
            icon_name: 'preferences-system-symbolic',
        });
        window.add(page);

        // ---- General group: URL + size ----
        const generalGroup = new Adw.PreferencesGroup({title: 'Web Page'});
        page.add(generalGroup);

        const urlRow = new Adw.EntryRow({title: 'URL'});
        urlRow.set_text(settings.get_string('web-url'));
        settings.bind('web-url', urlRow, 'text', Gio.SettingsBindFlags.DEFAULT);
        generalGroup.add(urlRow);

        const widthRow = new Adw.SpinRow({
            title: 'Window width',
            subtitle: 'Fraction of screen width',
            adjustment: new Gtk.Adjustment({
                lower: 0.1, upper: 1.0, step_increment: 0.05, page_increment: 0.1,
            }),
            digits: 2,
        });
        settings.bind('window-width', widthRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        generalGroup.add(widthRow);

        const heightRow = new Adw.SpinRow({
            title: 'Window height',
            subtitle: 'Fraction of screen height',
            adjustment: new Gtk.Adjustment({
                lower: 0.1, upper: 1.0, step_increment: 0.05, page_increment: 0.1,
            }),
            digits: 2,
        });
        settings.bind('window-height', heightRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        generalGroup.add(heightRow);

        // ---- Shortcut group ----
        const shortcutGroup = new Adw.PreferencesGroup({title: 'Shortcut'});
        page.add(shortcutGroup);

        const shortcutRow = new Adw.ActionRow({title: 'Toggle dropdown'});
        shortcutGroup.add(shortcutRow);

        const shortcutLabel = new Gtk.ShortcutLabel({
            disabled_text: 'Not set',
            valign: Gtk.Align.CENTER,
        });
        this._syncShortcutLabel(settings, shortcutLabel);

        const setButton = new Gtk.Button({
            label: 'Set Shortcut…',
            valign: Gtk.Align.CENTER,
            css_classes: ['flat'],
        });
        setButton.connect('clicked', () => {
            this._captureShortcut(window, settings, shortcutLabel);
        });

        shortcutRow.add_suffix(shortcutLabel);
        shortcutRow.add_suffix(setButton);
        shortcutRow.set_activatable_widget(setButton);
    }

    _syncShortcutLabel(settings, label) {
        const arr = settings.get_strv('toggle-shortcut');
        label.set_accelerator(arr.length > 0 ? arr[0] : '');
    }

    _captureShortcut(parentWindow, settings, shortcutLabel) {
        const dialog = new Gtk.Window({
            title: 'Set Shortcut',
            transient_for: parentWindow,
            modal: true,
            default_width: 320,
            default_height: 120,
        });

        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            margin_top: 24,
            margin_bottom: 24,
            margin_start: 24,
            margin_end: 24,
            valign: Gtk.Align.CENTER,
        });
        box.append(new Gtk.Label({
            label: 'Press a key combination…',
            css_classes: ['title-4'],
        }));
        box.append(new Gtk.Label({label: 'Esc to cancel'}));
        dialog.set_content(box);

        const controller = new Gtk.EventControllerKey();
        dialog.add_controller(controller);

        controller.connect('key-pressed', (_ctrl, keyval, _keycode, state) => {
            if (keyval === Gdk.KEY_Escape) {
                dialog.close();
                return true;
            }

            // Ignore a lone modifier press; wait for the full combo.
            if (MODIFIER_KEYS.has(keyval))
                return true;

            const mask = state & Gtk.accelerator_get_default_mod_mask();
            const accel = Gtk.accelerator_name(keyval, mask);

            if (accel) {
                settings.set_strv('toggle-shortcut', [accel]);
                this._syncShortcutLabel(settings, shortcutLabel);
            }
            dialog.close();
            return true;
        });

        dialog.present();
    }
}
