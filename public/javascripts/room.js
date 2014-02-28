function RoomPage(ytplayer) {
	if (!(this instanceof arguments.callee)) {
		return new Roompage();
	}
	
	function loadTrack(track) {
		$('#currentTrack').attr('data-trackid', track._id);
		$('#currentTrack').attr('data-trackname', track.name);
		$('var#skipCount').text(0);
		$('var#rating').attr('data-trackId', track._id);
		$('var#rating').text(track.rating);
		$('var#totalTime').text(track.duration.toHHMMSS());
		$('#belowPlayer').find('.vote').attr('data-trackid', track._id);
		if ((JSON.parse(localStorage.getItem('savedTracks')) || {})[track._id]) {
			$('#save').addClass('fa-heart');
			$('#save').removeClass('fa-heart-o');
		}
	}
	
	function clearTrack() {
		$('#currentTrack').removeAttr('data-trackid');
		$('#currentTrack').removeAttr('data-trackname');
		$('var#skipCount').text(0);
		$('var#rating').removeAttr('data-trackId');
		$('var#rating').text(0);
		$('var#totalTime').text('0:00');
		$('var#currentTime').text('0:00');
		
		$('#belowPlayer').find('.vote').removeAttr('data-trackid');
		$('#belowPlayer').find('.vote[value="1"]').addClass('fa-thumbs-o-up');
		$('#belowPlayer').find('.vote[value="-1"]').addClass('fa-thumbs-o-down');
		$('#belowPlayer').find('.vote[value="1"]').removeClass('fa-thumbs-up');
		$('#belowPlayer').find('.vote[value="-1"]').removeClass('fa-thumbs-down');
		$('#save').addClass('fa-heart-o');
		$('#save').removeClass('fa-heart');
	}
	
	this.updateVote = function(trackId, rate) {
		$('.vote[data-trackid="' + trackId + '"][value="1"]').addClass('fa-thumbs-o-up');
		$('.vote[data-trackid="' + trackId + '"][value="-1"]').addClass('fa-thumbs-o-down');
		$('.vote[data-trackid="' + trackId + '"][value="1"]').removeClass('fa-thumbs-up');
		$('.vote[data-trackid="' + trackId + '"][value="-1"]').removeClass('fa-thumbs-down');
		if (rate === 1) {
			$('.vote[data-trackid="' + trackId + '"][value="1"]').addClass('fa-thumbs-up');
			$('.vote[data-trackid="' + trackId + '"][value="1"]').removeClass('fa-thumbs-o-up');
		} else if (rate === -1) {
			$('.vote[data-trackid="' + trackId + '"][value="-1"]').addClass('fa-thumbs-down');
			$('.vote[data-trackid="' + trackId + '"][value="-1"]').removeClass('fa-thumbs-o-down');
		}
	}
	
	this.setVolume = function(volume) {
		$('#volume-bar').val(volume);
		if (volume == 0) {
			$('#mute').addClass('fa-volume-off');
			$('#mute').removeClass('fa-volume-up');
			$('#mute').removeClass('fa-volume-down');
			ytplayer.setVolume(0);
		} else if (volume <= 0.5){	
			$('#mute').addClass('fa-volume-down');
			$('#mute').removeClass('fa-volume-up');
			$('#mute').removeClass('fa-volume-off');
			ytplayer.setVolume(volume * 100);
		} else {	
			$('#mute').addClass('fa-volume-up');
			$('#mute').removeClass('fa-volume-down');
			$('#mute').removeClass('fa-volume-off');
			ytplayer.setVolume(volume * 100);
		}
	}
	
	this.setMuted = function(mute) {
		if (mute) {
			this.prevVolume = $('#volume-bar').val();
			this.setVolume(0);
			ytplayer.mute();
		} else {	
			this.setVolume(this.prevVolume || 1);
		}
	}
	
	this.isPlaying = function() {
		return !!this.getCurrentTrackId();
	}
	
	this.getCurrentTrackId = function() {
		return $('#currentTrack').attr('data-trackid') || null;
	}
	
	this.getCurrentTrackName = function() {
		return $('#currentTrack').attr('data-trackname') || null;
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
		clearTrack();
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
		$($('var.rating[data-trackid="' + track._id + '"]')).text(track.rating);
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
	
	this.vote = function(trackId, rate) {
		socket.emit('vote', trackId, rate);
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
	
	socket.on('vote', function(trackId, rate) {
		roomPage.updateVote(trackId, rate);
	});
}

function onYouTubePlayerReady() {
	var ytplayer = document.getElementById('ytplayer');
	var roomPage = new RoomPage(ytplayer);
	var roomId = roomPage.getRoomId();
	var connection = new ServerConnection(roomId, roomPage);
	
	$(document).on('change', '#volume-bar', function() {
		roomPage.setVolume($(this).val());
	});
	
	$(document).on('click', '#mute', function() {
		roomPage.setMuted(!ytplayer.isMuted());
	});

	$(document).on('click', '.vote', function() {
	  var trackId = $(this).attr('data-trackid');
		console.log(trackId);
		if (trackId) {
			connection.vote(trackId, parseInt($(this).attr('value')));
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
				$(this).addClass('fa-heart');
				$(this).removeClass('fa-heart-o');
			} else {
				delete(savedTracks[roomPage.getCurrentTrackId()]);
				localStorage.setItem('savedTracks', JSON.stringify(savedTracks));
				$(this).addClass('fa-heart-o');
				$(this).removeClass('fa-heart');
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
			$('var#currentTime').text(ytplayer.getCurrentTime());
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
				$('var#currentTime').text(time.toHHMMSS());
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