function RoomPage(ytplayer) {
	if (!(this instanceof arguments.callee)) {
		return new Roompage();
	}
	
	function loadTrack(track) {
		$('#currentTrack').text(track.name);
		$('#currentTrack').attr('data-trackid', track._id);
		$('var#skipCount').text(0);
		$('var#rating').attr('data-trackId', track._id);
		$('var#rating').text(track.rating);
		$('var#totalTime').text(track.duration.toHHMMSS());
		$('#controls').find('.vote').attr('data-trackid', track._id);
	}
	
	function clearTrack() {
		$('#currentTrack').text('Nothing');
		$('#currentTrack').removeAttr('data-trackid');
		$('var#skipCount').text(0);
		$('var#rating').removeAttr('data-trackId');
		$('var#rating').text(0);
		$('var#totalTime').text('0:00');
		$('var#time').text('0:00');
		$('#controls').find('.vote').removeAttr('data-trackid');
	}
	
	this.isPlaying = function() {
		return !!this.getCurrentTrackId();
	}
	
	this.getCurrentTrackId = function() {
		return $('#currentTrack').attr('data-trackid') || null;
	}
	
	this.getCurrentTrackName = function() {
		return $('#currentTrack').text();
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
	
	this.seekTo = function(pos) {
		ytplayer.seekTo(pos);
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
	
	this.sendResync = function() {
		socket.emit('resync');
	}
	
	function refresh() {
		socket.emit('refresh');
	}
	
	socket.on('room', function(room) {
		roomPage.loadRoom(room);
		socket.emit('ready');
	});

	socket.on('play', function(track) {
		if (track._id === roomPage.popTrackIdFromQueue()) {
			roomPage.playTrack(track);
		} else {
			refresh();
		}
	});
	
	socket.on('resync', function(pos) {
		roomPage.seekTo(pos);
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
		console.log('adding track');
		var text = $('input#trackExtId').val();
		if (text.length > 25) {
			var track = {
				url: text,
				nickname: localStorage.getItem('nickname')
			}
		} else {
			var track = {
				host: 'youtube',
				eid: text,
				nickname: localStorage.getItem('nickname')
			}
		}
		
		connection.addTrack(track);
	  $('input#trackExtId').val('');
	});
	
	$(document).on('click', '#save', function() {
		if (roomPage.isPlaying()) {
			console.log('saving track to local storage');
			var savedTracks = JSON.parse(localStorage.getItem('savedTracks')) || {};
			if (!savedTracks[roomPage.getCurrentTrackId()]) {
				savedTracks[roomPage.getCurrentTrackId()] = roomPage.getCurrentTrackName();
				localStorage.setItem('savedTracks', JSON.stringify(savedTracks));
			}
		}
	});
	
	$(document).on('click', '#changeName', function() {
		localStorage.setItem('nickname', $('input#nickname').val());
	  $('input#nickname').val('');
	});
	
	ytplayer.addEventListener('onStateChange', 'onYouTubeStateChange');
	
	this.startTimer = startTimer;
	this.stopTimer = stopTimer;
	
	var timer = null;
	
	function startTimer() {
		timer = window.setInterval(function() {
			$('var#time').text(ytplayer.getCurrentTime());
		}, 1000);
	}
	
	function stopTimer() {
		if (timer) {
			window.clearInterval(timer);
			timer = null;
		}
	}
	
	this.onYouTubeStateChange = function onYouTubeStateChange(newState) {
		var UNSTARTED = -1;
		var ENDED = 0;
		var PLAYING = 1;
		var PAUSED = 2;
		var BUFFERING = 3;
		var VIDEO_CUED = 5;
		
		if (roomPage.isPlaying() && newState === PLAYING && !onYouTubeStateChange.timer) {
			console.log('starting timer');
			onYouTubeStateChange.timer = window.setInterval(function() {
				var time = Math.floor(ytplayer.getCurrentTime());
				$('var#time').text(time.toHHMMSS());
			}, 1000);
		} else if (onYouTubeStateChange.timer && newState !== PLAYING) {
			console.log('clearing timer');
			window.clearInterval(onYouTubeStateChange.timer);
			onYouTubeStateChange.timer = null;
		}
		
		if (roomPage.isPlaying() && [PAUSED, BUFFERING].indexOf(onYouTubeStateChange.oldState) > -1 && newState === PLAYING) {
			connection.sendResync();
		}
		onYouTubeStateChange.oldState = newState;
	}
}