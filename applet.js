const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Lang = imports.lang;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;

const UUID = "rancher@centurix";

const APPLET_FOLDER = global.userdatadir + "/applets/rancher@centurix/";

const HOME = GLib.get_home_dir();

const HOMESTEAD_PROJECT_FOLDER = HOME + "/Homestead/";
const HOMESTEAD_CONFIG_FOLDER = HOME + "/.homestead/";

const ICON_UP = APPLET_FOLDER + "icons/laravel_up_128x128.png";
const ICON_DOWN = APPLET_FOLDER + "icons/laravel_down_128x128.png";
const ICON_MISSING = APPLET_FOLDER + "icons/laravel_missing_128x128.png";

const VAGRANT_CMD = '/usr/bin/vagrant';

const EDITOR = '/usr/bin/xed';

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

	isUp: function(forceCheck = false) {
		try {
			global.log('Running a status check');

			if (this._status_pause != null && this._up != null && !forceCheck) {
				global.log('Paused, returning: ' + this._up);
				return this._up;
			}

			let [res, list, err, status] = GLib.spawn_sync(HOMESTEAD_PROJECT_FOLDER, [VAGRANT_CMD, 'status'], null, GLib.SpawnFlags.DEFAULT, null);
			let reStatus = new RegExp('running');
			this._up = reStatus.test(list);
			this._status_pause = Mainloop.timeout_add(5, this.unPause);

			return this._up;
		} catch(e) {
			global.log(UUID + "::isUp: " + e);
		}
	},

	testReturn: function() {
		global.log('Returned from async!');
	},

	unPause: function() {
		global.log('Unpausing');
		Mainloop.source_remove(this._status_pause);
		this._status_pause = null;
	},

	vagrantExec: function(command, option = '') {
		global.log('Executing command: ' + command);
		try {
			GLib.spawn_sync(HOMESTEAD_PROJECT_FOLDER, [VAGRANT_CMD, command, option], null, GLib.SpawnFlags.DEFAULT, null);
		} catch(e) {
			global.log(UUID + "::exec(" + command + "): " + e);
		}
	},

	up: function() {
		this.vagrantExec('up');
		this.isUp(true);
	},

	halt: function() {
		this.vagrantExec('halt');
		this.isUp(true);
	},

	destroy: function() {
		this.vagrantExec('destroy', '--force');
		this.isUp(true);
	},

	suspend: function() {
		this.vagrantExec('suspend');
		this.isUp(true);
	},

	provision: function() {
		this.vagrantExec('provision');
	},

	ssh: function() {
		this.vagrantExec('ssh');
	},

	edit: function() {
		global.log('Editing Homestead configuration');
		try {
			GLib.spawn_sync(HOMESTEAD_CONFIG_FOLDER, [EDITOR, HOMESTEAD_CONFIG_FOLDER + 'Homestead.yaml'], null, GLib.SpawnFlags.DEFAULT, null);
		} catch(e) {
			global.log(UUID + "::edit: " + e);
		}		
	}

}

/**
 * Applet manager
 **/
function Rancher(metadata, orientation, panelHeight, instanceId) {
	this._init(orientation, panelHeight, instanceId);
}

Rancher.prototype = {
	__proto__: Applet.IconApplet.prototype,

	_init: function(orientation, panelHeight, instanceId) {
		Applet.IconApplet.prototype._init.call(this, orientation, panelHeight, instanceId);

		try {
			this.menu = new Applet.AppletPopupMenu(this, orientation);
			this._menuManager.addMenu(this.menu);

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

	newSwitchMenuItem: function(label) {
		let newItem = new PopupMenu.PopupSwitchMenuItem(label);
		return newItem;
	},

	newSeparator: function() {
		return new PopupMenu.PopupSeparatorMenuItem();
	},

	updateMenu: function() {
		try {
			this.menu.removeAll();
			if (!this.homestead.exists()) {
				this.menu.addMenuItem(this.newMenuItem('Homestead missing or not configured', null, {reactive: false}));
				return false;
			}
			if (this.homestead.isUp()) {
				this.menu.addMenuItem(this.newMenuItem('Status: Up', null, {reactive: false}));
				this.menu.addMenuItem(this.newSeparator());
				this.menu.addMenuItem(this.newSwitchMenuItem('Testing!'));
				this.menu.addMenuItem(this.newMenuItem('Run provisioning', this.homesteadProvision));
				this.menu.addMenuItem(this.newMenuItem('Suspend Homestead', this.homesteadSuspend));
				this.menu.addMenuItem(this.newMenuItem('Halt Homestead', this.homesteadHalt));
				this.menu.addMenuItem(this.newMenuItem('SSH Terminal', this.homesteadSSH));
			} else {
				this.menu.addMenuItem(this.newMenuItem('Status: Down', null, {reactive: false}));
				this.menu.addMenuItem(this.newSeparator());
				this.menu.addMenuItem(this.newMenuItem('Start Homestead', this.homesteadUp));
			}
			this.menu.addMenuItem(this.newMenuItem('Destroy Homestead', this.homesteadDestroy));
			this.menu.addMenuItem(this.newSeparator());
			this.menu.addMenuItem(this.newMenuItem('Edit Homestead configuration', this.editHomestead));
			this.menu.addMenuItem(this.newMenuItem('Update Homestead box', null, {reactive: false}));
			this.menu.addMenuItem(this.newSeparator());
			this.menu.addMenuItem(this.newMenuItem('Refresh this menu', this.refreshApplet));

		} catch(e) {
			global.log(UUID + "::updateMenu: " + e);
		}
	},

	on_applet_clicked: function(event) {
		try {
			this.menu.toggle();
		} catch(e) {
			global.log(UUID + '::on_applet_clicked: ' + e);
		}
	},

	editHomestead: function() {
		// this.homestead.edit();
	},

	refreshApplet: function() {
		this.updateMenu();
		this.updateAppletIcon();
	},

	homesteadProvision: function() {
		this.homestead.provision();
	},

	homesteadDestroy: function() {
		this.homestead.destroy();
		this.refreshApplet();
	},

	homesteadUp: function() {
		this.homestead.up();
		this.refreshApplet();
	},

	homesteadSuspend: function() {
		this.homestead.suspend();
		this.refreshApplet();
	},

	homesteadHalt: function() {
		this.homestead.halt();
		this.refreshApplet();
	},

	homesteadSSH: function() {
		this.homestead.ssh();
	},

	updateAppletIcon: function() {
		if (!this.homestead.exists()) {
			this.set_applet_icon_path(ICON_MISSING);
			this.set_applet_tooltip(_("Rancher: Homestead missing or not configured."));
			return true;
		}

		if (!this.homestead.isUp()) {
			this.set_applet_icon_path(ICON_DOWN);
			this.set_applet_tooltip(_("Rancher: Homestead down."));
			return true;
		}
		this.set_applet_icon_path(ICON_UP);
		this.set_applet_tooltip(_("Rancher: Homestead up."));
		return true;
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
