$(document).ready(function() {
	localStorage.setItem('spewzik_base_url', 'http://spewzik.herokuapp.com');
	loadRoomsDetails();
});

$(document).on('click', 'button#submit', function() {
	var room = $('input[name="room"]:checked');
	localStorage.setItem('spewzik_room_id', room.attr('data-roomid'));
	localStorage.setItem('spewzik_room_name', room.attr('data-roomname'));
	$('div#message').text('k');
});

$(document).on('click', 'input', function() {
	$('div#message').text('');
});
  
function loadRoomsDetails() {
	chrome.extension.sendRequest({ action: 'getRoomsDetails', baseUrl: localStorage.getItem('spewzik_base_url') }, function(response) {
		var rooms = JSON.parse(response.responseText);
		var roomId = localStorage.getItem('spewzik_room_id');
		var roomsDiv = $('div#rooms');
		for (var i in rooms) {
			var room = rooms[i];
			var html = '<input data-roomid="' + room._id + '" data-roomname="' + room.name + '" type="radio" name="room"';
			if (roomId === room._id) {
				html = html + ' checked';
			}
			html = html + ' />' + room.name + '</input><br>';
			roomsDiv.append(html);
		}
		roomsDiv.append('<button id="submit">Select Room</button>');
	});
}