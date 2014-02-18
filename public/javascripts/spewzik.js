var socket;

String.prototype.replaceAll = function (find, replace) {
    var str = this;
    return str.replace(new RegExp(find.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), replace);
};

function addRoomDetails(room) {
	var roomLinkHtml = $('div#roomLinkHtml').html();
	roomLinkHtml = roomLinkHtml.replaceAll('{roomId}', room._id);
	roomLinkHtml = roomLinkHtml.replaceAll('{roomName}', room.name);
	roomLinkHtml = roomLinkHtml.replaceAll('{roomListeners}', room.listeners);
	$('div#rooms').append(roomLinkHtml);
}

function addTrackDetails(track) {
	console.log('adding track');
	var trackHtml = $('div#trackHtml').html();
	trackHtml = trackHtml.replaceAll('{trackId}', track._id);
	trackHtml = trackHtml.replaceAll('{trackName}', track.name);
	trackHtml = trackHtml.replaceAll('{trackRating}', track.rating);
	$('div#tracks').append(trackHtml);
}

function createRoom(roomName) {
	socket.emit('room', roomName);
}

function joinRoom(roomId, roomName) {
	$('var#roomId').attr('data-val', roomId);
	$('div#front').hide();
	$('#title').text(roomName);
	$('var#mainListenersCount').attr('data-roomid', roomId);
	$('div#room').show();
	$('#back').show();
}

function leaveRoom(roomId) {
	stopPlayer();
	socket.emit('leave', roomId);
	$('div#room').hide();
	$('#back').hide();
	$('#title').text('Communities');
	$('var#mainListenersCount').removeAttr('data-roomid');
	$('var#mainListenersCount').text(0);
	$('div#front').show();
	clearTracksDetails();
}

function clearTracksDetails() {
	var roomDiv = $('div#tracks')[0];
	while (roomDiv.firstChild) {
		roomDiv.removeChild(roomDiv.firstChild);
	}
}

function onYouTubePlayerReady(playerApiId) {
	var roomId = $('var#roomId').attr('data-val');
	socket.emit('join', roomId);
}

function stopPlayer() {
	var ytplayer = document.getElementById('ytplayer');
	if (ytplayer.stopVideo) {
		ytplayer.stopVideo();
	}
	$('#currentTrackName').text('Nothing');
}

function loadPlayingDetails(track) {
	$('#currentTrackName').text(track.name);
}

function popFromQueueDetails(track) {
	var roomDiv = $('div#tracks')[0];
	if (roomDiv.firstChild && $(roomDiv.firstChild).attr('data-trackid') === track._id) {
		roomDiv.removeChild(roomDiv.firstChild);
	} else {
		console.log('playlist out of sync refetch');
		var roomId = $('var#roomId').attr('data-val');
		socket.emit('refetch', roomId);
	}
}

function loadQueueDetails(playlist) {
	clearTracksDetails();
	for (var i = 0; i < playlist.length; i++) {
		addTrackDetails(playlist[i]);
	}
}

$(document).ready(function(){
  socket = io.connect();

	socket.on('error', function(message) {
		$('#error').text(message);
	});

	socket.on('room', function(room) {
		addRoomDetails(room);
	});

	socket.on('rooms', function(rooms) {
		for (var i in rooms) {
			addRoomDetails(rooms[i]);
		}
	});

	socket.on('listeners', function(data) {
		$($("var.listenersCount[data-roomid='" + data.roomId + "']")).text(data.listeners);
	});
	
	socket.on('playlist', function(playlist) {
		loadQueueDetails(playlist);
		var roomId = $('var#roomId').attr('data-val');
		socket.emit('ready', roomId);
	});

	socket.on('play', function(track) {
		var ytplayer = document.getElementById('ytplayer');
		ytplayer.loadVideoById(track.eid, track.pos);
		loadPlayingDetails(track);
		popFromQueueDetails(track);
	});
	
	socket.on('stop', function() {
		stopPlayer();
	});

	socket.on('track', function(track) {
		addTrackDetails(track);
	});
	
	socket.on('trackUpdate', function(track) {
		$($("var.rating[data-trackid='" + track._id + "']")).text(track.rating);
	});

});

$(document).on('click', '#addRoom', function() {
  createRoom($("input#roomName").val());
	$("input#roomName").val('');
});

$(document).on('click', '#openAdd', function() {
  $('#addWrapper').css({ height: $('#addContainer').height() });
});

$(document).on('click', '.roomLink', function() {
	var roomId = $(this).attr('data-roomid');
	var roomName = $(this).attr('data-roomname');
	joinRoom(roomId, roomName);
});

$(document).on('click', '#back', function() {
	var roomId = $('var#roomId').attr('data-val');
	leaveRoom(roomId);
});

$(document).on('click', '.vote', function() {
  var trackId = $(this).attr('data-trackid');
  var val = $(this).attr('data-val');
  var roomId = $('var#roomId').attr('data-val');
  socket.emit('vote', { roomId: roomId, trackId: trackId, val: val });
});

$(document).on('click', '#skip', function() {
  var roomId = $('var#roomId').attr('data-val');
  socket.emit('skip', roomId);
});

$(document).on('click', '#addTrack', function() {
  var trackEid = $('input#trackExtId').val();
  $('input#trackExtId').val('');
  var roomId = $('var#roomId').attr('data-val');
  socket.emit('track', { roomId: roomId, trackEid: trackEid });
});