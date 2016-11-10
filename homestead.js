const TerminalReader = imports.applet.terminal_reader;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Main = imports.ui.main;
const Util = imports.applet.util;
const HomesteadYamlReader = imports.applet.homestead_yaml_reader;

const STATUS_RUNNING = 0;
const STATUS_SAVED = 1;
const STATUS_POWER_OFF = 2;
const STATUS_NOT_CREATED = 3;
const STATUS_KERNAL_NOT_LOADED = 4;

/**
 * Homestead/Vagrant manager
 */
function Homestead(project_folder, config_folder, vagrant_cmd, editor) {
	this._init(project_folder, config_folder, vagrant_cmd, editor);
}

Homestead.prototype = {
	_init: function(project_folder, config_folder, vagrant_cmd, editor) {
		this._project_folder = project_folder;
		this._config_folder = config_folder;
		this._vagrant_cmd = vagrant_cmd;
		this._editor = editor;

		this._up = null;
		this._status_pause = null;
		this._out = {};
	},

	setProjectFolder: function(folder) {
		this._project_folder = folder;
	},

	setConfigFolder: function(folder) {
		this._config_folder = folder;
	},

	setVagrantCmd: function(cmd) {
		this._vagrant_cmd = cmd;
	},

	setEditor: function(editor) {
		this._editor = editor;
	},

	checkProjectExists: function() {
		try {
			return GLib.file_test(Util.resolveHome(this._project_folder) + "/Vagrantfile", GLib.FileTest.EXISTS);
		} catch(e) {
			global.log(UUID + "::checkProjectExists: " + e);
		}
	},

	checkConfigExists: function() {
		try {
			return GLib.file_test(Util.resolveHome(this._config_folder) + "/Homestead.yaml", GLib.FileTest.EXISTS);
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
			reader = new TerminalReader.TerminalReader(Util.resolveHome(this._project_folder), this._vagrant_cmd + ' status', Lang.bind(this, function (command, status, stdout) {
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
				if (new RegExp('VBoxManage --version').test(stdout)) {
					if (typeof callback == 'function') {
						callback(this.exists(), STATUS_KERNAL_NOT_LOADED);
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
				Util.resolveHome(this._project_folder),
				[this._vagrant_cmd].concat(command),
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

	recompile: function(callback) {
		Main.Util.spawnCommandLine("gnome-terminal --working-directory=" + Util.resolveHome(this._project_folder) + " -x sudo /sbin/rcvboxdrv setup");
	},

	ssh: function() {
		Main.Util.spawnCommandLine("gnome-terminal --working-directory=" + Util.resolveHome(this._project_folder) + " -x vagrant ssh");
	},

	edit: function() {
		try {
			GLib.spawn_async(
				Util.resolveHome(this._config_folder),
				[this._editor, Util.resolveHome(this._config_folder) + '/Homestead.yaml'],
				null,
				GLib.SpawnFlags.DEFAULT,
				null
			);
		} catch(e) {
			global.log(UUID + "::edit: " + e);
		}
	},

	parseConfig: function() {
		try {
			yaml = new HomesteadYamlReader.HomesteadYamlReader(Util.resolveHome(this._config_folder) + "/Homestead.yaml");

			return {
				ip: yaml.ip,
				memory: yaml.memory,
				cpu: yaml.cpu,
				provider: yaml.provider,
				sites: yaml.sites,
				databases: yaml.databases
			}
		} catch(e) {
			global.log(e);
		}
	}

}
