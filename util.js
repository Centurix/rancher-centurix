
function objectSniff(object_sniff) {
	var keys = Object.keys(object_sniff);
	for (var i=0; i < keys.length; i++) {
		global.log(keys[i]);
	}
}
