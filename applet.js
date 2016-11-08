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
const GLib = imports.gi.GLib;

const UUID = "rancher@centurix";

const HOME = GLib.get_home_dir();

const HOMESTEAD_PROJECT_FOLDER = HOME + "/Homestead";
const HOMESTEAD_CONFIG_FOLDER = HOME + "/.homestead";

const VAGRANT_CMD = '/usr/bin/vagrant';

const EDITOR = '/usr/bin/xed';

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

			this.homestead_project_folder = HOMESTEAD_PROJECT_FOLDER;
			this.homestead_config_folder = HOMESTEAD_CONFIG_FOLDER;
			this.vagrant_cmd = VAGRANT_CMD;
			this.editor = EDITOR;

			this.settings.bindProperty(
				Settings.BindingDirection.IN, 
				"homesteadProjectFolder",
				"homestead_project_folder",
				this.onProjectFolderUpdate, 
				null
			);
			this.settings.bindProperty(
				Settings.BindingDirection.IN, 
				"homesteadConfigFolder",
				"homestead_config_folder",
				this.onConfigFolderUpdate, 
				null
			);
			this.settings.bindProperty(
				Settings.BindingDirection.IN, 
				"vagrantCmd",
				"vagrant_cmd",
				this.onVagrantCmdUpdate, 
				null
			);
			this.settings.bindProperty(
				Settings.BindingDirection.IN, 
				"editor",
				"editor",
				this.onEditorUpdate, 
				null
			);
			this.settingsApiCheck();
			this.homestead = new Homestead.Homestead(
				this.homestead_project_folder, 
				this.homestead_config_folder, 
				this.vagrant_cmd, 
				this.editor
			);

			this.refreshApplet();
		} catch (e) {
			global.log(UUID + "::_init: " + e);
		}
	},

	onProjectFolderUpdate: function() {
		this.homestead.setProjectFolder(this.homestead_project_folder);
	},

	onConfigFolderUpdate: function() {
		this.homestead.setConfigFolder(this.homestead_config_folder);
	},

	onVagrantCmdUpdate: function() {
		this.homestead.setVagrantCmd(this.vagrant_cmd);
	},

	onEditorUpdate: function() {
		this.homestead.setEditor(this.editor);
	},

	newIconMenuItem: function(icon, label, callback, options = {}) {
		try {
			let newItem = new PopupMenu.PopupIconMenuItem(label, icon, St.IconType.FULLCOLOR, options);
			if (callback) {
				newItem.connect("activate", Lang.bind(this, callback));
			}
			return newItem;
		} catch(e) {
			global.log(UUID + "::newIconMenuItem: " + e);
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
			global.log(UUID + '::homesteadToggle: ' + e);
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

	openBrowser: function(url) {
		matches = (new RegExp('\\("(.*?)"\\)')).exec(url);
		if (matches && matches.length > 0) {
	        Main.Util.spawnCommandLine("xdg-open http://" + matches[1]);
		}
	},

	editHosts: function() {
		Main.Util.spawnCommandLine("gksudo gedit /etc/hosts");
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

				this.subMenuConfig = new PopupMenu.PopupSubMenuMenuItem(_('Configuration'));
				this.subMenuConfig.menu.addMenuItem(this.newIconMenuItem('package_network', _('IP: ') + config.ip, null, {reactive: false}));
				this.subMenuConfig.menu.addMenuItem(this.newIconMenuItem('media-memory', _('Memory: ') + config.memory, null, {reactive: false}));
				this.subMenuConfig.menu.addMenuItem(this.newIconMenuItem('applications-electronics', _('CPU: ') + config.cpu, null, {reactive: false}));
				this.subMenuConfig.menu.addMenuItem(this.newIconMenuItem('virtualbox', _('Provider: ') + config.provider, null, {reactive: false}));
				this.menu.addMenuItem(this.subMenuConfig);

				this.subMenuSites = new PopupMenu.PopupSubMenuMenuItem(_('Hosted Sites') + ' (' + config.sites.length + ')');
				this.subMenuSites.menu.addMenuItem(this.newIconMenuItem('accessories-text-editor', _('Edit hosts file'), this.editHosts));
				for (var index = 0; index < config.sites.length; index++) {
					if (status == Homestead.STATUS_RUNNING) {
						this.subMenuSites.menu.addMenuItem(this.newIconMenuItem('emblem-web', config.sites[index], this.openBrowser));
					} else {
						this.subMenuSites.menu.addMenuItem(this.newIconMenuItem('emblem-web', config.sites[index] + " (down)", null, {reactive: false}));
					}
				}
				this.menu.addMenuItem(this.subMenuSites);

				this.subMenuDatabases = new PopupMenu.PopupSubMenuMenuItem(_('Hosted Databases') + ' (' + config.databases.length + ')');
				for (var index = 0; index < config.databases.length; index++) {
					if (status == Homestead.STATUS_RUNNING) {
						this.subMenuDatabases.menu.addMenuItem(this.newIconMenuItem('drive-harddisk', config.databases[index], null, {reactive: false}));
					} else {
						this.subMenuDatabases.menu.addMenuItem(this.newIconMenuItem('drive-harddisk', config.databases[index] + " (down)", null, {reactive: false}));
					}
				}
				this.menu.addMenuItem(this.subMenuDatabases);
			}

		} catch(e) {
			global.log(UUID + "::updateMenu: " + e);
		}
	},
}

function main(metadata, orientation, panelHeight, instanceId) {
	return new Rancher(metadata, orientation, panelHeight, instanceId);
}
