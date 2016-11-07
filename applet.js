const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Lang = imports.lang;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const TerminalReader = imports.applet.terminal_reader;

const UUID = "rancher@centurix";

const APPLET_FOLDER = global.userdatadir + "/applets/rancher@centurix/";

const HOME = GLib.get_home_dir();

const HOMESTEAD_PROJECT_FOLDER = HOME + "/Homestead";
const HOMESTEAD_CONFIG_FOLDER = HOME + "/.homestead";

const ICON_UP = APPLET_FOLDER + "icons/laravel_up_128x128.png";
const ICON_DOWN = APPLET_FOLDER + "icons/laravel_down_128x128.png";
const ICON_MISSING = APPLET_FOLDER + "icons/laravel_missing_128x128.png";

const VAGRANT_CMD = '/usr/bin/vagrant';

const EDITOR = '/usr/bin/xed';

const STATUS_RUNNING = 0;
const STATUS_SAVED = 1;
const STATUS_POWER_OFF = 2;
const STATUS_NOT_CREATED = 3;

/**
 * Homestead/Vagrant manager
 */
function Homestead() {
	this._init();
}

Homestead.prototype = {
	_init: function() {
		this._up = null;
		this._status_pause = null;
		this._out = {};
	},

	checkProjectExists: function() {
		try {
			return GLib.file_test(HOMESTEAD_PROJECT_FOLDER + "/Vagrantfile", GLib.FileTest.EXISTS);
		} catch(e) {
			global.log(UUID + "::checkProjectExists: " + e);
		}
	},

	checkConfigExists: function() {
		try {
			return GLib.file_test(HOMESTEAD_CONFIG_FOLDER + "/Homestead.yaml", GLib.FileTest.EXISTS);
		} catch(e) {
			global.log(UUID + "::checkConfigExists: " + e);
		}
	},

	checkVagrantExists: function() {
		try {
			let [res, list, err, status] = GLib.spawn_command_line_sync("which vagrant");
			return parseInt(status) == 0;
		} catch(e) {
			global.log(UUID + "::checkVagrantExists: " + e);
		}
	},

	exists: function() {
		return this.checkProjectExists() && this.checkConfigExists() && this.checkVagrantExists();
	},

	checkStatus: function(callback) {
		this._callback = callback;
		try {
			reader = new TerminalReader.TerminalReader(HOMESTEAD_PROJECT_FOLDER, VAGRANT_CMD + ' status', Lang.bind(this, function (command, status, stdout) {
				reader.destroy();
				if (new RegExp('running').test(stdout)) {
					this._callback(this.exists(), STATUS_RUNNING);
				}
				if (new RegExp('saved').test(stdout)) {
					this._callback(this.exists(), STATUS_SAVED);
				}
				if (new RegExp('poweroff').test(stdout)) {
					this._callback(this.exists(), STATUS_POWER_OFF);
				}
				if (new RegExp('not created').test(stdout)) {
					this._callback(this.exists(), STATUS_NOT_CREATED);
				}
			}));
			reader.executeReader();
		} catch (e) {
			global.log(e);
		}
	},

	vagrantExec: function(command, callback = null) {
		this._callback = callback;
		global.log('Executing command: ' + [VAGRANT_CMD].concat(command));
		try {
			let [exit, pid, stdin, stdout, stderr] = GLib.spawn_async_with_pipes(
				HOMESTEAD_PROJECT_FOLDER,
				[VAGRANT_CMD].concat(command),
				null,
				GLib.SpawnFlags.DO_NOT_REAP_CHILD,
				null
			); 
			this._watch = GLib.child_watch_add(
				GLib.PRIORITY_DEFAULT,
				pid,
				Lang.bind(this, function(pid, status, requestObj) {
					GLib.source_remove(this._watch);
					if (this._callback) {
						this._callback();
					}
				})
			);
		} catch(e) {
			global.log(UUID + "::exec(" + command + "): " + e);
		}
	},

	up: function(callback) {
		this.vagrantExec(['up'], function() {
			global.log('Calling callback');
			this.checkStatus(callback);
		});
	},

	halt: function(callback) {
		this.vagrantExec(['halt'], Lang.bind(this, function() {
			this.checkStatus(callback);
		}));
	},

	destroy: function(callback) {
		this.vagrantExec(['destroy', '--force'], Lang.bind(this, function() {
			this.checkStatus(callback);
		}));
	},

	suspend: function(callback) {
		this.vagrantExec(['suspend'], Lang.bind(this, function() {
			this.checkStatus(callback);
		}));
	},

	provision: function() {
		this.vagrantExec(['provision']);
	},

	ssh: function() {
		this.vagrantExec(['ssh']);
	},

	edit: function() {
		global.log('Editing Homestead configuration');
		try {
			GLib.spawn_async(HOMESTEAD_CONFIG_FOLDER, [EDITOR, HOMESTEAD_CONFIG_FOLDER + 'Homestead.yaml'], null, GLib.SpawnFlags.DEFAULT, null);
			// GLib.spawn_sync(HOMESTEAD_CONFIG_FOLDER, [EDITOR, HOMESTEAD_CONFIG_FOLDER + 'Homestead.yaml'], null, GLib.SpawnFlags.DEFAULT, null);
		} catch(e) {
			global.log(UUID + "::edit: " + e);
		}		
	}

}

/**
 * Applet manager
 **/
function Rancher(metadata, orientation, panelHeight, instanceId) {
	this.settings = new Settings.AppletSettings(this, UUID, instanceId);
	this._init(orientation, panelHeight, instanceId);
}

Rancher.prototype = {
	__proto__: Applet.IconApplet.prototype,

	_init: function(orientation, panelHeight, instanceId) {
		Applet.IconApplet.prototype._init.call(this, orientation, panelHeight, instanceId);

		try {
			this.menu = new Applet.AppletPopupMenu(this, orientation);
			this._menuManager.addMenu(this.menu);

			// this.settings.bindProperty(
			// 	Settings.BindingDirection.IN, 
			// 	KEY_UPDATE,
			// 	AUTOUPDATE,
			// 	this.onSwitchAutoUpdate, 
			// 	null
			// );
			this.settingsApiCheck();
			this.homestead = new Homestead();

			this.refreshApplet();
		} catch (e) {
			global.log(UUID + "::_init: " + e);
		}
	},

	newMenuItem: function(label, callback, options = {}) {
		let newItem = new PopupMenu.PopupMenuItem(label, options);
		if (callback) {
			newItem.connect("activate", Lang.bind(this, callback));
		}
		return newItem;
	},

	newSwitchMenuItem: function(label, state, callback) {
		let newItem = new PopupMenu.PopupSwitchMenuItem(label, state);
		if (callback) {
			newItem.connect("activate", Lang.bind(this, callback));
		}
		return newItem;
	},

	newSeparator: function() {
		return new PopupMenu.PopupSeparatorMenuItem();
	},

	settingsApiCheck: function() {
		const Config = imports.misc.config;
		const SETTINGS_API_MIN_VERSION = 2;
		const CMD_SETTINGS = "cinnamon-settings applets " + UUID;

		let cinnamonVersion = Config.PACKAGE_VERSION.split('.');
		let majorVersion = parseInt(cinnamonVersion[0]);

		if (majorVersion >= SETTINGS_API_MIN_VERSION) {
			return;
		}

		let mi = new Applet.MenuItem(_("Settings"), Gtk.STOCK_EDIT, Lang.bind(this, function() {
			Util.spawnCommandLine(CMD_SETTINGS)
		}));
		this._applet_context_menu.addMenuItem(mi);
	},

	on_applet_clicked: function(event) {
		try {
			if (!this.menu.isOpen) {
				this.menu.toggle();
			}
		} catch(e) {
			global.log(UUID + '::on_applet_clicked: ' + e);
		}
	},

	editHomestead: function() {
		// this.homestead.edit();
	},

	objectSniff: function(object_sniff) {
		var keys = Object.keys(object_sniff);
		for (var i=0; i < keys.length; i++) {
			global.log(keys[i]);
		}
	},

	homesteadToggle: function(event) {
		if (event._switch.state) {
			this.homesteadUp(Lang.bind(this, this.updateApplet));
			return true;
		}
		this.homesteadHalt(Lang.bind(this, this.updateApplet));
	},

	homesteadProvision: function() {
		this.homestead.provision();
	},

	homesteadDestroy: function() {
		this.homestead.destroy(this.updateApplet);
	},

	homesteadUp: function() {
		this.homestead.up(this.updateApplet);
	},

	homesteadSuspend: function() {
		this.homestead.suspend(this.updateApplet);
	},

	homesteadHalt: function() {
		this.homestead.halt(this.updateApplet);
	},

	homesteadSSH: function() {
		this.homestead.ssh();
	},

	refreshApplet: function() {
		this.homestead.checkStatus(Lang.bind(this, this.updateApplet));
	},

	updateApplet: function(exists, status) {
		global.log(exists);
		global.log(status);
		if (!exists) {
			this.set_applet_icon_path(ICON_MISSING);
			this.set_applet_tooltip(_("Rancher: Homestead missing or not configured."));
		}

		this.set_applet_icon_path(ICON_DOWN);

		if (status == STATUS_RUNNING) {
			this.set_applet_icon_path(ICON_UP);
			this.set_applet_tooltip(_("Rancher: Homestead up."));
		}

		if (status == STATUS_SAVED) {
			this.set_applet_tooltip(_("Rancher: Homestead suspended."));
		}
		if (status == STATUS_POWER_OFF) {
			this.set_applet_tooltip(_("Rancher: Homestead down."));
		}
		if (status == STATUS_NOT_CREATED) {
			this.set_applet_tooltip(_("Rancher: Homestead not created."));
		}

		try {
			this.menu.removeAll();
			if (!exists) {
				this.menu.addMenuItem(this.newMenuItem(_('Homestead missing or not configured'), null, {reactive: false}));
				return false;
			}
			this.menu.addMenuItem(this.newSwitchMenuItem(_('Status'), (status == STATUS_RUNNING), this.homesteadToggle));
			this.menu.addMenuItem(this.newSeparator());
			if (status == STATUS_RUNNING) {
				this.menu.addMenuItem(this.newMenuItem(_('Run provisioning'), this.homesteadProvision));
				this.menu.addMenuItem(this.newMenuItem(_('Suspend Homestead'), this.homesteadSuspend));
				this.menu.addMenuItem(this.newMenuItem(_('SSH Terminal'), this.homesteadSSH));
			}
			this.menu.addMenuItem(this.newMenuItem(_('Destroy Homestead'), this.homesteadDestroy));
			this.menu.addMenuItem(this.newSeparator());
			this.menu.addMenuItem(this.newMenuItem(_('Edit Homestead configuration'), this.editHomestead));
			this.menu.addMenuItem(this.newMenuItem(_('Update Homestead box'), null, {reactive: false}));
			this.menu.addMenuItem(this.newSeparator());
			this.menu.addMenuItem(this.newMenuItem(_('Refresh this menu'), this.refreshApplet));

		} catch(e) {
			global.log(UUID + "::updateMenu: " + e);
		}
	}
}

/**
 * metadata: [object]
 * orientation: 0
 * panelHeight: 25
 * instanceId: 26
 */
function main(metadata, orientation, panelHeight, instanceId) {
	return new Rancher(metadata, orientation, panelHeight, instanceId);
}
