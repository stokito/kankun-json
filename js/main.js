var all_switches = {};

$(document).ready( function() {
  // get the list of switches to poll
  $.ajax( { url: 'switches.json', dataType: 'json' } )
    .fail( function( e, textStatus ) {
      alert( 'Cannot find any switches\nPlease check for switches.json file.\nError: ' + textStatus );
    })
    .done( function( data ) {
      // create a section for each switch
      var $switchesSet = $('#switches-set');
      var menuCollapsed = data.switches.length > 1 ? 'true' : 'false';
      $.each( data.switches, function( i, switchMeta ) {
        if (!switchMeta.id) {
          var switchId = 'SW-' + slugify( switchMeta.DisplayName );
          switchMeta.id = switchId;
        }
        all_switches[switchMeta.id] = switchMeta;

        var $switchTemplate = $('<div data-role="collapsible"> \
            <h3 class="colapseable-header"><span class="displayName"></span><img class="imgSignal" src="images/wifi_a1.png"  height="25" width="20" align="right"></h3> \
            <div class="colapseable-content"> \
              <div> \
                <div class="actions"></div> \
                <div class="ui-field-contain"> \
                  <label>Delay mins:</label> \
                  <input type="range" class="slider-fill" value="60" min="0" max="300"  step="15" data-highlight="true"/> \
                </div> \
              </div> \
            </div> \
            <table class="infotbl"></table> \
            <table class="jobtbl"></table> \
          </div>');
        $switchTemplate.attr('id', switchMeta.id)
            .attr('data-collapsed', menuCollapsed)
            .find('.displayName').text(switchMeta.DisplayName);
        $switchesSet.append($switchTemplate);

        UpdateSwitchData( switchMeta );
        setInterval( function() { UpdateSwitchData( switchMeta ) }, 5000 );
      });
      $switchesSet.collapsibleset().trigger( 'create' );
    });
});

function takeAction( url, switchMeta, $sliderFill ) {
  // if the url includes mins it's a delayed action, use the value from the slider.
  if ( url.lastIndexOf( '&mins=60' ) > 0 ) {
    var v = $sliderFill.val();
    url = url.replace( '&mins=60', '&mins=' + v );
  }
  $.getJSON( url + '&callback=?', function( result ) {
    UpdateSwitchData( switchMeta );
  });
}

function UpdateSwitchData( switchMeta ) {
  var $switchTemplate = $('#' + switchMeta.id);
  $.ajax( { url: buildActionUrl( switchMeta, '/cgi-bin/json.cgi' ), dataType: 'jsonp' } )
    .fail( function( e, textStatus ) {
      $switchTemplate.find('.imgSignal').attr( 'src', 'images/wifi_a2.png' );
      alert( 'Unable to connect: ' + textStatus );
    })
    .done( function( data ) { // enable switch
      //add the data from the device to the array
      $.extend( switchMeta, data );

      //check the wifi signal
      var imgSig = ( 'images/' + getSignalStrengthImage( switchMeta.info.signal ) );
      $switchTemplate.find('.imgSignal').attr( 'src', imgSig );

      $switchTemplate.find('.displayName').text( switchMeta.DisplayName );
      var $sliderFill = $switchTemplate.find('.slider-fill');
      // show actions
      var $actionsListContent = $switchTemplate.find('.actions').empty();
      $.each( switchMeta.links.actions, function ( key, data ) {
        var actionUrl = buildActionUrl( switchMeta, data );
        $('<button class="ui-btn action-' + key + '"></button>' )
            .text(key)
            .click(function( evt ) {
               takeAction( actionUrl, switchMeta, $sliderFill );
            })
            .appendTo($actionsListContent);
      });

      //show network info
      $switchTemplate.find('.infotbl').empty()
        .append('<tr><td>Uptime:</td><td>' + switchMeta.info.uptime + '</td></tr>')
        .append('<tr><td>IP:</td><td>' + switchMeta.ip + '</td></tr>')
        .append('<tr><td>MAC:</td><td>' + switchMeta.info.macaddr + '</td></tr>')
        .append('<tr><td>SSID:</td><td>' + switchMeta.info.ssid + '</td></tr>')
        .append('<tr><td>Channel:</td><td>' + switchMeta.info.channel + '</td></tr>')
        .append('<tr><td>Signal:</td><td>' + switchMeta.info.signal + ' dBm</td></tr>');

      //update switch based on actual reported state
      $.getJSON( buildActionUrl( switchMeta, switchMeta.links.meta.state ) + '&callback=?', function( result ) {
        $switchTemplate.find('.displayName').text( switchMeta.DisplayName + ' (' + result.state + ')' );
      });

      //list any scheduled jobs
      var getjobs_url = buildActionUrl( switchMeta, '/cgi-bin/json.cgi?get=jobs' );
      var $jobTable = $switchTemplate.find('.jobtbl');
      $jobTable.empty();
      $.getJSON( getjobs_url + '&callback=?', function( result ) {
        $.each( result.jobs, function ( key, data ) {
          var action = ( ( data.queue == 'b' ) ? 'on' : 'off' );
          var cancel_url = buildActionUrl( switchMeta, '/cgi-bin/json.cgi?canceljob=' + data.jobid );
          var $cancelBtn = $('<a class="ui-btn ui-icon-delete ui-btn-icon-left">cancel</a>')
              .click(function (evt) {
                takeAction(cancel_url, switchMeta, null);
              });
          var $jobRow = $('<tr></tr>').append($('<td></td>').text(action)).append($('<td></td>').text(data.date)).append($('<td></td>').append($cancelBtn));
          $jobTable.append( $jobRow);
        });
      });

    });
}

function getSignalStrengthImage( dBm ) {
  var wifiImages = [ 'wifi_a6.png', 'wifi_a5.png', 'wifi_a4.png', 'wifi_a3.png', 'wifi_a2.png'];

  var signalStrength = Math.ceil( Math.abs( dBm ) / 10 );

  if ( signalStrength > 7 )
    signalStrength = 8;
  if ( signalStrength < 5)
    signalStrength = 4;
  return wifiImages[signalStrength - 4];
}

function slugify( text ) {
  return text.toString().toLowerCase()
    .replace( /\s+/g, '-' )           // Replace spaces with -
    .replace( /[^\w\-]+/g, '' )       // Remove all non-word chars
    .replace( /--+/g, '-' )         // Replace multiple - with single -
    .replace( /^-+/, '' )             // Trim - from start of text
    .replace( /-+$/, '' );            // Trim - from end of text
}

function buildActionUrl( switchMeta, url ) {
  var base_url = switchMeta.baseUrl ? switchMeta.baseUrl : 'http://' + switchMeta.ip;
  // fix legacy links: remove http://ip part. We'll use ip instead
  if (url.startsWith( 'http://' )) {
    return url.replace( /(http:\/\/.*?)(\/.*)/, base_url + '$2' );
  } else {
    return base_url + url;
  }
}
