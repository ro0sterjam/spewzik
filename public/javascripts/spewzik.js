String.prototype.replaceAll = function (find, replace) {
    var str = this;
    return str.replace(new RegExp(find.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), replace);
};

function FrontPage() {
	if (!(this instanceof arguments.callee)) {
		return new FrontPage();
	}
	
	this.loadRooms = function(rooms) {
		$('div#rooms').empty();
		for (var i in rooms) {
			this.addRoomToList(rooms[i]);
		}
	}
	
	this.addRoomToList = function(room) {
		console.log(room);
		var roomLinkHtml = $('div#roomLinkHtml').html();
		roomLinkHtml = roomLinkHtml.replaceAll('{roomId}', room._id);
		roomLinkHtml = roomLinkHtml.replaceAll('{roomName}', room.name);
		roomLinkHtml = roomLinkHtml.replaceAll('{roomListeners}', room.listenerCount);
		$('div#rooms').append(roomLinkHtml);
	}
	
	this.updateListeners = function(roomId, listenerCount) {
		$($("var.listenerCount[data-roomid='" + roomId + "']")).text(listenerCount);
	}
	
	this.setError = function(message) {
		$('#error').text(message);
	}
	
	this.clearError = function() {
		$('#error').text('');
	}
}

function ServerConnection(frontPage) {
	if (!(this instanceof arguments.callee)) {
		return new ServerConnection(frontPage);
	}
	
	console.log('connecting');
	var socket = io.connect('/front');
	
	this.createRoom = function(roomName) {
		socket.emit('room', roomName);
	}

	socket.on('room', function(room) {
		frontPage.addRoomToList(room);
	});

	socket.on('rooms', function(rooms) {
		frontPage.loadRooms(rooms);
	});
	
	socket.on('error', function(message) {
		currentPage.setError(message);
	});
	
	socket.on('listenerCount', function(roomId, listenerCount) {
		frontPage.updateListeners(roomId, listenerCount);
	});
}

$(document).ready(function(){
	var frontPage = new FrontPage();
  var connection = new ServerConnection(frontPage);

	$(document).on('click', '#addRoom', function() {
		connection.createRoom($("input#roomName").val());
		$("input#roomName").val('');
	});

	$(document).on('click', '#openAdd', function() {
	  $('#addWrapper').css({ height: $('#addContainer').height() });
	});
});