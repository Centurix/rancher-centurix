const Gio = imports.gi.Gio;
const Util = imports.applet.util;

function HomesteadYamlReader(yaml_file) {
	this._init(yaml_file);
}

/**
 * A VERY simple YAML reader for Homestead. It looks for very specific patterns.
 */
HomesteadYamlReader.prototype = {
	_init: function(yaml_file) {
		this._yaml_file = yaml_file;
		this.ip = "";
		this.memory = 0;
		this.cpu = 0;
		this.provider = "";
		this.sites = [];
		this.databases = [];

		this._parse();
	},

	_parse: function() {
		let input_file = Gio.file_new_for_path(this._yaml_file);
		let [ok, data, etag] = input_file.load_contents(null);
		if (ok) {
			lines = data.toString('utf-8').split('\n');
			reIP = new RegExp('ip:.*?"(.*?)"');
			reMemory = new RegExp('memory:.*?(\\d+)');
			reCPU = new RegExp('cpus:.*?(\\d+)');
			reProvider = new RegExp('provider:.*?(\\w+)');
			reSites = new RegExp('sites:');
			reDatabases = new RegExp('databases:');
			reSiteCollectionItem = new RegExp('^\\s*-\\s*map:\\s*(.*)');
			reDatabaseCollectionItem = new RegExp('^\\s*-\\s*(.*)');
			currentSection = "";
			for (var i = 0; i < lines.length; i++) {
				matches = reIP.exec(lines[i]);
				if (matches && matches.length > 0) {
					this.ip = matches[1];
					currentSection = "";
				}
				matches = reMemory.exec(lines[i]);
				if (matches && matches.length > 0) {
					this.memory = matches[1];
					currentSection = "";
				}
				matches = reCPU.exec(lines[i]);
				if (matches && matches.length > 0) {
					this.cpu = matches[1];
					currentSection = "";
				}
				matches = reProvider.exec(lines[i]);
				if (matches && matches.length > 0) {
					this.provider = matches[1];
					currentSection = "";
				}
				if (reSites.test(lines[i])) {
					currentSection = "sites";
				}
				if (reDatabases.test(lines[i])) {
					currentSection = "databases";
				}
				matches = reSiteCollectionItem.exec(lines[i]);
				if (matches && matches.length > 0 && currentSection == "sites") {
					this.sites.push(matches[1]);
				}
				matches = reDatabaseCollectionItem.exec(lines[i]);
				if (matches && matches.length > 0 && currentSection == "databases") {
					this.databases.push(matches[1]);
				}
			}
		}
	}
}
