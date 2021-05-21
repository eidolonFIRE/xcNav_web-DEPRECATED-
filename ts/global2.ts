

// for testing & while no API yet for receiving messages:
// allow fake message receipts by pressing 1 or 2 on desktop browsers
// Note the slightly different handling depending on whether
// user is on the map or has the messages interface open when these come in

// this is all for testing messaging. Both the buttons and the 1 and 2 keydowns
// generate fake incoming messages
let tnf = function(e)
{
	G.messages.createMessage( "Caleb", "Do you see the coyote right below us ?", /* isEmergency= */false, /* playSound= */true );
}
let tnf2 = function(e)
{
	G.messages.createMessage( "Adrien", "Motor quit, need to land", /* isEmergency= */true, /* playSound= */true );
}

/*
$("#testNotification").onclick = tnf;
$("#testNotification2").onclick = tnf2;
*/


// these hacks interfere with actual text input a
window.onkeydown = function( e )
{
	switch( e.key ) {
		case '`': 	{
						console.log( "Toggling Simulated Locations" );
						($("#simLocations") as HTMLInputElement).click(); 
					}
					break;
	}
	return true; /* event is handled. no one else needs to do anything */
}


// ========================================================
//  emergency speech button
// ========================================================
if(0)($("#emergency") as HTMLInputElement).onclick = function(e)
{
	let msg = "Emergency message from Matt Cowan: Need to land.";
	msg = "Alert ! Airplane at your 6 oh clock. Distance: 5 miles. Height: 2000 feet.";
	G.sounds.speak( msg, "Samantha", 0.8, 0.9 );  // Karen is a good Ozzie female
	console.log( msg );
};