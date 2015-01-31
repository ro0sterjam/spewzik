/**
 * Module dependencies.
 */
var express = require('express');
var morgan = require('morgan');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var errorhandler = require('errorhandler')
var routes = require('./routes');
var http = require('http');
var path = require('path');
var player = require('./player');

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(morgan('dev'));
app.use(bodyParser());
app.use(methodOverride());
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
	app.use(errorhandler());
}

app.get('/', routes.index);
app.get('/rooms/:room_id', routes.room);
app.get('/rooms', routes.getRooms);
app.get('/rooms/:room_id/current', routes.getCurrentTrack);
app.post('/rooms/:room_id/tracks', routes.addTrackToPlaylist);

var server = http.createServer(app).listen(app.get('port'), function(){
	console.log('Express server listening on port ' + app.get('port'));
});

var io = require('socket.io').listen(server);
player.startPlayingAllRooms();

io.of('/front').on('connection', player.connectIndex);
io.of('/room').on('connection', player.connectRoom);

exports.io = io;