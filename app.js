/**
 * Module dependencies.
 */
var express = require('express');
var routes = require('./routes');
var http = require('http');
var path = require('path');
var player = require('./player');

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
	app.use(express.errorHandler());
}

app.get('/', routes.index);
app.get('/rooms/:room_id', routes.getRoom);
app.get('/rooms/:room_id/current', routes.getCurrentTrack);
app.post('/rooms/:room_id/tracks', routes.addTrackToPlaylist);

var server = http.createServer(app).listen(app.get('port'), function(){
	console.log('Express server listening on port ' + app.get('port'));
});

var io = require('socket.io').listen(server);
player.startPlayingAllRooms();

io.sockets.on('connection', player.connectSocket);

exports.io = io;