var createPlaylist = function(playlistName) {
  var url = '/playlists/?name=' + playlistName;
  $.ajax({ url: url, type: 'POST', success: function(result) {
    $('div#playlists').append('<a href=\'/playlists/' + result._id + '/play\'>' + result.name + '</a>');
  }});
}

$(document).ready(function() {
  $('button#addPlaylist').on('click', function() {
    createPlaylist($("input#playlistName").val());
  });

  $('#openAdd').click(function() {
    console.log('wt');
    $('#addWrapper').css({ height: $('#addContainer').height() });
  })
});
