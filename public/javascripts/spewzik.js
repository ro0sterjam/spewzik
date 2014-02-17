var socket;

function addRoomDetails(room) {
	$('div#rooms').append('<a href="#" data-roomid="' + room._id + '" data-roomname="' + room.name + '" class="roomLink">' + room.name + ' - <var data-roomid="' + room._id + '" class="listenersCount">' + room.listeners + '</var> listeners</a><br>');
}

function createRoom(roomName) {
	socket.emit('room', roomName);
}

function joinRoom(roomId, roomName) {
	$('var#roomId').attr('data-val', roomId);
	$('div#front').hide();
	$('#title').text(roomName);
	$('div#room').show();
	$('#back').show();
}

function leaveRoom(roomId) {
	stopPlayer();
	socket.emit('leave', roomId);
	$('div#room').hide();
	$('#back').hide();
	$('#title').text($(this).attr('Communities'));
	$('div#front').show();
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
	ytplayer.stopVideo();
	$('#currentTrackName').text('Nothing');
}

function loadPlayingDetails(track) {
	$('#currentTrackName').text(track.name);
}

function popFromQueueDetails() {
	var roomDiv = $('div#tracks')[0];
	if (roomDiv.firstChild) {
		roomDiv.removeChild(roomDiv.firstChild);
	}
}

function loadQueueDetails(playlist) {
	for (var i = 0; i < playlist.length; i++) {
		addTrackDetails(playlist[i]);
	}
}

function addTrackDetails(track) {
	$('div#tracks').append('<div class="track" data-trackid="' + track._id + '"><p>' + track.name + '</p><p>Rating: <var class="rating" data-trackid="' + track._id + '">' + track.rating + '</var></p><button class="vote" data-trackid="' + track._id + '" data-val="up">Up</button><button class="vote" data-trackid="' + track._id + '" data-val="down">Down</button></div>');
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

	socket.on('play', function(data) {
		var ytplayer = document.getElementById('ytplayer');
		ytplayer.loadVideoById(data.track.eid, data.start);
		loadPlayingDetails(data.track);
		popFromQueueDetails();
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