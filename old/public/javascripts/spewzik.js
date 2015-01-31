String.prototype.replaceAll = function (find, replace) {
    var str = this;
    return str.replace(new RegExp(find.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), replace);
};

Number.prototype.toHHMMSS = function () {
	var hours = Math.floor(this / 3600);
	var minutes = Math.floor((this - (hours * 3600)) / 60);
	var seconds = this - (hours * 3600) - (minutes * 60);
	
	var time = '';
	if (hours > 0) {
		if (hours < 10) {
			time += '0';
		}
		time += hours + ':';
	}
	if (minutes < 10) {
		time += '0';
	}
	time += minutes + ':';
	if (seconds < 10) {
		time += '0';
	}
	time += seconds;
	return time;
};