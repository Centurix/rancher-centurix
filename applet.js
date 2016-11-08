const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Lang = imports.lang;
const Settings = imports.ui.settings;
const Gtk = imports.gi.Gtk;
const Homestead = imports.applet.homestead;
const Util = imports.applet.util;

const UUID = "rancher@centurix";

const APPLET_FOLDER = global.userdatadir + "/applets/rancher@centurix/";

const ICON_UP = APPLET_FOLDER + "icons/laravel_up_128x128.png";
const ICON_DOWN = APPLET_FOLDER + "icons/laravel_down_128x128.png";
const ICON_MISSING = APPLET_FOLDER + "icons/laravel_missing_128x128.png";

const EDITOR = '/usr/bin/xed';

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
			this.homestead = new Homestead.Homestead();

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

	homesteadToggle: function(event) {
		try {
			if (event._switch.state) {
				this.transitionMenu(_("Rancher: Bringing Homestead up, please wait..."));
				this.homestead.up(Lang.bind(this, this.refreshApplet));
				return true;
			}
			this.transitionMenu(_("Rancher: Taking Homestead down, please wait..."));
			this.homestead.halt(Lang.bind(this, this.refreshApplet));
		} catch(e) {
			global.log(e);
		}
	},

	homesteadProvision: function() {
		this.homestead.provision();
	},

	homesteadDestroy: function() {
		this.transitionMenu(_("Rancher: Destroying Homestead, please wait..."));
		this.homestead.destroy(Lang.bind(this, this.refreshApplet));
	},

	homesteadSuspend: function() {
		this.transitionMenu(_("Rancher: Suspending Homestead, please wait..."));
		this.homestead.suspend(Lang.bind(this, this.refreshApplet));
	},

	homesteadSSH: function() {
		this.homestead.ssh();
	},

	refreshApplet: function() {
		this.homestead.checkStatus(Lang.bind(this, this.updateApplet));
	},

	transitionMenu: function(message) {
		this.set_applet_icon_path(ICON_DOWN);
		this.set_applet_tooltip(message);
		this.menu.removeAll();
		this.menu.addMenuItem(this.newMenuItem(message, null, {reactive: false}));
	},

	updateApplet: function(exists, status) {
		try {
			if (!exists) {
				this.set_applet_icon_path(ICON_MISSING);
				this.set_applet_tooltip(_("Rancher: Homestead missing or not configured."));
			}

			this.set_applet_icon_path(ICON_DOWN);

			if (status == Homestead.STATUS_RUNNING) {
				this.set_applet_icon_path(ICON_UP);
				this.set_applet_tooltip(_("Rancher: Homestead up."));
			}

			if (status == Homestead.STATUS_SAVED) {
				this.set_applet_tooltip(_("Rancher: Homestead suspended."));
			}
			if (status == Homestead.STATUS_POWER_OFF) {
				this.set_applet_tooltip(_("Rancher: Homestead down."));
			}
			if (status == Homestead.STATUS_NOT_CREATED) {
				this.set_applet_tooltip(_("Rancher: Homestead not created."));
			}

			this.menu.removeAll();
			if (!exists) {
				this.menu.addMenuItem(this.newMenuItem(_('Homestead missing or not configured'), null, {reactive: false}));
				return false;
			}
			this.menu.addMenuItem(this.newSwitchMenuItem(_('Status'), (status == Homestead.STATUS_RUNNING), this.homesteadToggle));
			this.menu.addMenuItem(this.newSeparator());
			if (status == Homestead.STATUS_RUNNING) {
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

function main(metadata, orientation, panelHeight, instanceId) {
	return new Rancher(metadata, orientation, panelHeight, instanceId);
}
