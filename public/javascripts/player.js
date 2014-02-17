function onYouTubePlayerReady(playerApiId) {
	var ytplayer = document.getElementById(playerApiId);
	var roomId = $('var#roomId').attr('data-val');
	
	socket.emit('join', roomId);
	
	socket.on('room', function(room) {
		loadRoomDetails(room);
	});

	socket.on('play', function(data) {
		ytplayer.loadVideoById(data.track.eid, data.start);
		loadCurrentTrackDetails(data.track);
		popFromQueueDetails();
	});

	socket.on('track', function(track) {
		addTrackDetails(track);
	});
	
	socket.on('error', function(message) {
		$('var#error').text(message);
	});
	
	socket.on('trackUpdate', function(track) {
		$($("var[data-trackid='" + track._id + "']")).text(track.rating);
	});
	
}

function loadCurrentTrackDetails(track) {
	$('var#currentTrackName').text(track.name);
}

function popFromQueueDetails() {
	var roomDiv = $('div#tracks')[0];
	if (roomDiv.firstChild) {
		roomDiv.removeChild(roomDiv.firstChild);
	}
}

function loadRoomDetails(room) {
	var roomDiv = $('div#tracks')[0];
	
	// Remove all the current track data
	// Apparently this loop is much faster than setting innerText
	while (roomDiv.firstChild) {
		roomDiv.removeChild(roomDiv.firstChild);
	}
	
	if (room.tracks.length > 0) {
		$('var#roomName').text(room.name);
		loadCurrentTrackDetails(room.playlist[0]);
	}
	
	for (var i = 0; i < room.tracks.length; i++) {
		var track = room.playlist[i];
		addTrackDetails(track);
	}
	
}

function addTrackDetails(track) {
	var roomDiv = $('div#tracks')[0];
	roomDiv.append('<div data-trackid="' + track._id + '"><p>' + track.name + '</p><p>Rating: <var class="rating" data-trackid="' + track._id + '">' + track.rating + '</var></p><button data-trackid="' + track._id + '" class="vote" data-val="up">Up</button><button data-trackid="' + track._id + '" class="vote" data-val="down">Down</button></div>');
}