const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Lang = imports.lang;
const Settings = imports.ui.settings;
const Gtk = imports.gi.Gtk;
const Homestead = imports.applet.homestead;
const Util = imports.applet.util;
const MessageTray = imports.ui.messageTray;
const Main = imports.ui.main;
const St = imports.gi.St;

const UUID = "rancher@centurix";

const APPLET_FOLDER = global.userdatadir + "/applets/rancher@centurix/";

const ICON_UP = APPLET_FOLDER + "icons/laravel_up_128x128.png";
const ICON_DOWN = APPLET_FOLDER + "icons/laravel_down_128x128.png";
const ICON_MISSING = APPLET_FOLDER + "icons/laravel_missing_128x128.png";

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

			this._msgsrc = new MessageTray.SystemNotificationSource("Rancher");
			Main.messageTray.add(this._msgsrc);

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

	newIconMenuItem: function(icon, label, callback, options = {}) {
		try {
			let newItem = new PopupMenu.PopupIconMenuItem(label, icon, St.IconType.FULLCOLOR);
			if (callback) {
				newItem.connect("activate", Lang.bind(this, callback));
			}
			return newItem;
		} catch(e) {
			global.log(e);
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
		this.homestead.edit();
		this.notification(_("Editing Homestead configuration..."));
	},

	homesteadToggle: function(event) {
		try {
			if (event._switch.state) {
				this.transitionMenu(_("Rancher: Bringing Homestead up, please wait..."));
				this.homestead.up(Lang.bind(this, this.refreshApplet));
				this.notification(_("Bringing Homestead up..."));
				return true;
			}
			this.transitionMenu(_("Rancher: Taking Homestead down, please wait..."));
			this.homestead.halt(Lang.bind(this, this.refreshApplet));
			this.notification(_("Taking Homestead down..."));
		} catch(e) {
			global.log(e);
		}
	},

	homesteadProvision: function() {
		this.transitionMenu(_("Rancher: Provisioning Homestead, please wait..."));
		this.homestead.provision(Lang.bind(this, this.refreshApplet));
		this.notification(_("Provisioning Homestead..."));
	},

	homesteadDestroy: function() {
		this.transitionMenu(_("Rancher: Destroying Homestead, please wait..."));
		this.homestead.destroy(Lang.bind(this, this.refreshApplet));
		this.notification(_("Destroying Homestead..."));
	},

	homesteadSuspend: function() {
		this.transitionMenu(_("Rancher: Suspending Homestead, please wait..."));
		this.homestead.suspend(Lang.bind(this, this.refreshApplet));
		this.notification(_("Suspending Homestead..."));
	},

	homesteadSSH: function() {
		this.homestead.ssh();
		this.notification(_("Homestead SSH Terminal opened"));
	},

	refreshApplet: function() {
		this.homestead.checkStatus(Lang.bind(this, this.updateApplet));
	},

	notification: function(message) {
		let notification = new MessageTray.Notification(this._msgsrc, "Rancher", message);
		notification.setTransient(true);
		this._msgsrc.notify(notification);
	},

	transitionMenu: function(message) {
		this.set_applet_icon_path(ICON_DOWN);
		this.set_applet_tooltip(message);
		this.menu.removeAll();
		this.menu.addMenuItem(this.newIconMenuItem('dialog-information', message, null, {reactive: false}));
	},

	updateApplet: function(exists, status) {
		try {
			text_status = "";
			if (!exists) {
				this.set_applet_icon_path(ICON_MISSING);
				this.set_applet_tooltip(_("Rancher: Homestead missing or not configured."));
				this.notification(_("Homestead missing or not configured."));
			}

			this.set_applet_icon_path(ICON_DOWN);

			if (status == Homestead.STATUS_RUNNING) {
				this.set_applet_icon_path(ICON_UP);
				this.set_applet_tooltip(_("Rancher: Homestead up."));
				this.notification(_("Homestead up."));
				text_status = _(" (Running)");
			}

			if (status == Homestead.STATUS_SAVED) {
				this.set_applet_tooltip(_("Rancher: Homestead suspended."));
				this.notification(_("Homestead suspended."));
				text_status = _(" (Suspended)");
			}
			if (status == Homestead.STATUS_POWER_OFF) {
				this.set_applet_tooltip(_("Rancher: Homestead down."));
				this.notification(_("Homestead down."));
				text_status = _(" (Down)");
			}
			if (status == Homestead.STATUS_NOT_CREATED) {
				this.set_applet_tooltip(_("Rancher: Homestead not created."));
				this.notification(_("Homestead not created"));
				text_status = _(" (Not created/Destroyed)");
			}

			this.menu.removeAll();
			if (!exists) {
				this.menu.addMenuItem(this.newIconMenuItem('apport', _('Homestead missing or not configured'), null, {reactive: false}));
				return false;
			}
			this.menu.addMenuItem(this.newSwitchMenuItem(_('Status') + text_status, (status == Homestead.STATUS_RUNNING), this.homesteadToggle));
			this.menu.addMenuItem(this.newSeparator());
			if (status == Homestead.STATUS_RUNNING) {
				this.menu.addMenuItem(this.newIconMenuItem('system-run', _('Run provisioning'), this.homesteadProvision));
				this.menu.addMenuItem(this.newIconMenuItem('media-playback-pause', _('Suspend Homestead'), this.homesteadSuspend));
				this.menu.addMenuItem(this.newIconMenuItem('utilities-terminal', _('SSH Terminal'), this.homesteadSSH));
				this.menu.addMenuItem(this.newSeparator());
			}
			if (status != Homestead.STATUS_NOT_CREATED) {
				this.menu.addMenuItem(this.newIconMenuItem('list-remove', _('Destroy Homestead'), this.homesteadDestroy));
			}
			this.menu.addMenuItem(this.newSeparator());
			this.menu.addMenuItem(this.newIconMenuItem('accessories-text-editor', _('Edit Homestead configuration'), this.editHomestead));
			this.menu.addMenuItem(this.newSeparator());
			this.menu.addMenuItem(this.newIconMenuItem('view-refresh', _('Refresh this menu'), this.refreshApplet));

			if (exists) {
				this.menu.addMenuItem(this.newSeparator());
				config = this.homestead.parseConfig();
				this.subMenu = new PopupMenu.PopupSubMenuMenuItem(_('Configuration'));
				this.subMenu.menu.addAction(_('- IP: ') + config.ip, null, {reactive: false});
				this.subMenu.menu.addAction(_('- Memory: ') + config.memory, null, {reactive: false});
				this.subMenu.menu.addAction(_('- CPU: ') + config.cpu, null, {reactive: false});
				this.subMenu.menu.addAction(_('- Provider: ') + config.provider, null, {reactive: false});
				this.menu.addMenuItem(this.subMenu);
				this.subMenu = new PopupMenu.PopupSubMenuMenuItem(_('Hosted Sites'));
				for (var index = 0; index < config.sites.length; index++) {
					this.subMenu.menu.addAction(config.sites[index], null, {reactive: false});
				}
				this.menu.addMenuItem(this.subMenu);
				this.subMenu = new PopupMenu.PopupSubMenuMenuItem(_('Hosted Databases'));
				for (var index = 0; index < config.databases.length; index++) {
					this.subMenu.menu.addAction(config.databases[index], null, {reactive: false});
				}
				this.menu.addMenuItem(this.subMenu);
			}

		} catch(e) {
			global.log(UUID + "::updateMenu: " + e);
		}
	},
}

function main(metadata, orientation, panelHeight, instanceId) {
	return new Rancher(metadata, orientation, panelHeight, instanceId);
}
