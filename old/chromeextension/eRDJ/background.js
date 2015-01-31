REQUEST_DONE_STATE = 4;

chrome.browserAction.onClicked.addListener(function(tab) {
  if (tab.url.indexOf("youtube") != -1) {
		var params = tab.url.split('?')[1].split('&');
		var videoId = null;
		for (var i in params) {
			if (params[i].split('=')[0] === 'v') {
				videoId = params[i].split('=')[1];
			}
		}
		if (videoId) {
			var baseUrl = localStorage.getItem('spewzik_base_url');
			var roomId = localStorage.getItem('spewzik_room_id');
			var roomName = localStorage.getItem('spewzik_room_name');
			if (baseUrl === null || roomId === null || roomName === null) {
				window.open('./options.html', '_blank');
			} else {
				sendTrackToRoom(baseUrl, roomId, 'youtube', videoId, function(response) {
					var data = JSON.parse(response.responseText);
					if (response.status === 200) {
						alert('Success: Track added to \'' + roomName + '\'');
					} else if (data.error) {
						alert('Error: ' + data.error);
					} else {
						alert('Error: unknown');
					}
				});
			}
		}
	}
});

function getRoomsDetails(baseUrl, callback) {
	var xmlHttpRequest = new XMLHttpRequest();
	var url = baseUrl + '/rooms/';
	xmlHttpRequest.open('GET', url, true);
	xmlHttpRequest.setRequestHeader('content-type', 'application/json');
	xmlHttpRequest.send();
	xmlHttpRequest.onreadystatechange = function() {
		if (xmlHttpRequest.readyState !== REQUEST_DONE_STATE) return;
		return typeof callback === 'function' && callback(xmlHttpRequest);
	}
}

function sendTrackToRoom(baseUrl, roomId, host, eid, callback) {
	var xmlHttpRequest = new XMLHttpRequest();
	var url = baseUrl + '/rooms/' + roomId + '/tracks/?host=' + host + '&eid=' + eid;
	xmlHttpRequest.open('POST', url, true);
	xmlHttpRequest.setRequestHeader('content-type', 'application/json');
	xmlHttpRequest.send();
	xmlHttpRequest.onreadystatechange = function() {
		if (xmlHttpRequest.readyState !== REQUEST_DONE_STATE) return;
		return typeof callback === 'function' && callback(xmlHttpRequest);
	}
}

function onRequest(request, sender, callback) {
	
	if (request.action === 'sendTrackToRoom') {
		sendTrackToRoom(request.baseUrl, request.roomId, request.host, request.eid, callback);
	} else if (request.action === 'getRoomsDetails') {
		getRoomsDetails(request.baseUrl, callback);
	}
}

chrome.extension.onRequest.addListener(onRequest);