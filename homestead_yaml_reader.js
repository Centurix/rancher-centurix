const Gio = imports.gi.Gio;
const Util = imports.applet.util;

function HomesteadYamlReader(yaml_file) {
	this._init(yaml_file);
}

/**
 * A VERY simple YAML reader for Homestead. It looks for very specific patterns. Supports scalars and simple blocks.
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

			reBlockTest = new RegExp('^(\\w+):');
			reIP = new RegExp('ip:.*?"(.*?)"');
			reMemory = new RegExp('memory:.*?(\\d+)');
			reCPU = new RegExp('cpus:.*?(\\d+)');
			reProvider = new RegExp('provider:.*?(\\w+)');
			reSiteCollectionItem = new RegExp('^\\s*-\\s*map:\\s*(.*)');
			reDatabaseCollectionItem = new RegExp('^\\s*-\\s*(.*)');

			currentSection = "";

			for (var i = 0; i < lines.length; i++) {
				currentSection = this._firstMatch(reBlockTest, lines[i], currentSection);
				this.ip = this._firstMatch(reIP, lines[i], this.ip);
				this.memory = this._firstMatch(reMemory, lines[i], this.memory);
				this.cpu = this._firstMatch(reCPU, lines[i], this.cpu);
				this.provider = this._firstMatch(reProvider, lines[i], this.provider);
				this._pushToCollection(reSiteCollectionItem, lines[i], this.sites, "sites", currentSection);
				this._pushToCollection(reDatabaseCollectionItem, lines[i], this.databases, "databases", currentSection);
			}
		}
	},

	_firstMatch: function(re, line, passthrough) {
		matches = re.exec(line);
		if (matches && matches.length > 0) {
			return matches[1];
		}
		return passthrough;
	},

	_pushToCollection: function(re, line, collection, section, currentSection) {
		matches = re.exec(line);
		if (matches && matches.length > 0 && currentSection == section) {
			collection.push(matches[1]);
		}
	}
}
