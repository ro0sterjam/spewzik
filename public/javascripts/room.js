String.prototype.replaceAll = function (find, replace) {
    var str = this;
    return str.replace(new RegExp(find.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), replace);
};

function RoomPage(ytplayer) {
	if (!(this instanceof arguments.callee)) {
		return new Roompage();
	}
	
	function loadTrack(track) {
		$('#currentTrackName').text(track.name);
		$('var#skipCount').text(0);
		$('var#rating').attr('data-trackId', track._id);
		$('var#rating').text(track.rating);
		$('#controls').find('.vote').attr('data-trackid', track._id);
	}
	
	function clearTrack() {
		$('#currentTrackName').text('Nothing');
		$('var#skipCount').text(0);
		$('var#rating').removeAttr('data-trackId');
		$('var#rating').text(0);
		$('#controls').find('.vote').removeAttr('data-trackid');
	}
	
	this.getRoomId = function() {
		return $('var#roomId').attr('data-roomid');
	}
	
	this.loadRoom = function(room) {
		$('#title').text(room.name);
		this.updateListeners(room.listenerCount);
		this.updateSkips(room.skipCount);
		$('div#tracks').empty();
		for (var i in room.playlist) {
			this.addTrackToQueue(room.playlist[i]);
		}
	}
	
	this.playTrack = function(track) {
		loadTrack(track);
		ytplayer.loadVideoById(track.eid, track.pos);
	}
	
	this.stopTrack = function() {
		ytplayer.stopVideo();
		clearTrack();
	}
	
	this.popTrackIdFromQueue = function() {
		var track$ = $('div#tracks').children('div.track:first').remove();
		return track$.attr('data-trackid') || null;
	}
	
	this.addTrackToQueue = function(track) {
		var trackHtml = $('div#trackHtml').html();
		trackHtml = trackHtml.replaceAll('{trackId}', track._id);
		trackHtml = trackHtml.replaceAll('{trackName}', track.name);
		trackHtml = trackHtml.replaceAll('{trackRating}', track.rating);
		$('div#tracks').append(trackHtml);
	}
	
	this.updateListeners = function(listenerCount) {
		$('var#listenerCount').text(listenerCount);
	}
	
	this.updateSkips = function(skipCount) {
		$('var#skipCount').text(skipCount);
	}
	
	this.updateTrack = function(track) {
		$($("var.rating[data-trackid='" + track._id + "']")).text(track.rating);
	}
	
	this.setError = function(message) {
		$('#error').text(message);
	}
	
	this.clearError = function() {
		$('#error').text('');
	}
}

function ServerConnection(roomId, roomPage) {
	if (!(this instanceof arguments.callee)) {
		return new ServerConnection(roomId, roomPage);
	}
	
	var socket = io.connect('/room');
	
	socket.on('connect', function() {
		socket.emit('join', roomId);
	});
	
	this.vote = function(trackId, val) {
		socket.emit('vote', trackId, val);
	}
	
	this.skipTrack = function() {
		socket.emit('skip');
	}
	
	this.addTrack = function(track) {
		socket.emit('track', track);
	}
	
	function refresh() {
		socket.emit('refresh');
	}
	
	socket.on('room', function(room) {
		roomPage.loadRoom(room);
		socket.emit('ready');
	});

	socket.on('play', function(track) {
		var nextTrackId = roomPage.popTrackIdFromQueue();
		if (nextTrackId !== track._id) {
			refresh();
		} else {
			roomPage.playTrack(track);
		}
	});
	
	socket.on('stop', function() {
		roomPage.stopTrack();
	});
	
	socket.on('error', function(message) {
		roomPage.setError(message);
	});

	socket.on('track', function(track) {
		roomPage.addTrackToQueue(track);
	});
	
	socket.on('listenerCount', function(listenerCount) {
		roomPage.updateListeners(listenerCount);
	});
	
	socket.on('trackUpdate', function(track) {
		roomPage.updateTrack(track);
	});
	
	socket.on('skipCount', function(skipCount) {
		roomPage.updateSkips(skipCount)
	});
}
	
function onYouTubePlayerReady() {
	var ytplayer = document.getElementById('ytplayer');
	var roomPage = new RoomPage(ytplayer);
	var roomId = roomPage.getRoomId();
	var connection = new ServerConnection(roomId, roomPage);

	$(document).on('click', '.vote', function() {
	  var trackId = $(this).attr('data-trackid');
		if (trackId) {
		  var val = $(this).attr('data-val');
			connection.vote(trackId, val);
		}
	});

	$(document).on('click', '#skip', function() {
	  connection.skipTrack();
	});

	$(document).on('click', '#addTrack', function() {
		var track = {
			host: 'youtube',
			eid: $('input#trackExtId').val()
		}
		connection.addTrack(track);
	  $('input#trackExtId').val('');
	});
}