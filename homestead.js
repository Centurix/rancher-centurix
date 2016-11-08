const TerminalReader = imports.applet.terminal_reader;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Main = imports.ui.main;

const HOME = GLib.get_home_dir();

const HOMESTEAD_PROJECT_FOLDER = HOME + "/Homestead";
const HOMESTEAD_CONFIG_FOLDER = HOME + "/.homestead";

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
		try {
			return this.checkProjectExists() && this.checkConfigExists() && this.checkVagrantExists();
		} catch(e) {
			global.log(e);
			return false;
		}
	},

	checkStatus: function(callback) {
		try {
			reader = new TerminalReader.TerminalReader(HOMESTEAD_PROJECT_FOLDER, VAGRANT_CMD + ' status', Lang.bind(this, function (command, status, stdout) {
				reader.destroy();
				if (new RegExp('running').test(stdout)) {
					if (typeof callback == 'function') {
						callback(this.exists(), STATUS_RUNNING);
					}
				}
				if (new RegExp('saved').test(stdout)) {
					if (typeof callback == 'function') {
						callback(this.exists(), STATUS_SAVED);
					}
				}
				if (new RegExp('poweroff').test(stdout)) {
					if (typeof callback == 'function') {
						callback(this.exists(), STATUS_POWER_OFF);
					}
				}
				if (new RegExp('not created').test(stdout)) {
					if (typeof callback == 'function') {
						callback(this.exists(), STATUS_NOT_CREATED);
					}
				}
			}));
			reader.executeReader();
		} catch (e) {
			global.log(e);
		}
	},

	vagrantExec: function(command, callback = null) {
		callback = callback;
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
					if (typeof callback == 'function') {
						callback();
					}
				})
			);
		} catch(e) {
			global.log(UUID + "::exec(" + command + "): " + e);
		}
	},

	up: function(callback) {
		this.vagrantExec(['up'], callback);
	},

	halt: function(callback) {
		this.vagrantExec(['halt'], callback);
	},

	destroy: function(callback) {
		this.vagrantExec(['destroy', '--force'], callback);
	},

	suspend: function(callback) {
		this.vagrantExec(['suspend'], callback);
	},

	provision: function(callback) {
		this.vagrantExec(['provision'], callback);
	},

	ssh: function() {
		Main.Util.spawnCommandLine("gnome-terminal --working-directory=" + HOMESTEAD_PROJECT_FOLDER + " -x vagrant ssh");
	},

	edit: function() {
		try {
			GLib.spawn_async(
				HOMESTEAD_CONFIG_FOLDER,
				[EDITOR, HOMESTEAD_CONFIG_FOLDER + '/Homestead.yaml'],
				null,
				GLib.SpawnFlags.DEFAULT,
				null
			);
		} catch(e) {
			global.log(UUID + "::edit: " + e);
		}
	}

}
