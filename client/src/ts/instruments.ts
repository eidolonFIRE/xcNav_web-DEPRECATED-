import { myPlan } from "./flightPlan";
import { curFlightDist_mi, curFlightDuration_h_mm } from "./flightRecorder";
import { me } from "./pilots";
import { $, geoTolatlng, km2Miles, meters2Feet, mSecToStr_h_mm } from "./util";


//	----------------------------------------------------------------------------
//  udpate instrument displays
//	----------------------------------------------------------------------------
export function udpateInstruments() {
    $("#telemetrySpd").innerText = me.geoPos.speed.toFixed(0);
    $("#telemetryHdg").innerText = ((me.geoPos.heading + 360) % 360).toFixed(0);
    $("#telemetryAlt").innerText = (me.geoPos.altitude * meters2Feet).toFixed(0);
    $("#telemetryFuel").innerText = me.fuel.toFixed(1);

    // flight timer
    const inst_duration = document.getElementById("flightDuration") as HTMLBodyElement;
    inst_duration.innerHTML = curFlightDuration_h_mm() + "&nbsp;&nbsp;&nbsp;&nbsp;" + curFlightDist_mi() + " mi";

    
    let col = "#0E6EFD"; // regular button blue
    if( me.fuel < 2 )
        col = "red";
    else if( me.fuel < 4 ) // should be "fuel needed to get to LZ ?"
        col = "orange";
    $("#fuelBingoPanel").style.backgroundColor = col;
    
    
    let estFuelBurn: number = 4;  // L/h
    let timeLeft: number  = me.fuel / estFuelBurn * 60; // L / L/h => h -> minutes
    timeLeft = Math.floor( timeLeft );
    let hours = Math.floor( timeLeft/60 );
    let minutes = timeLeft - 60*hours;
    let extraZero = minutes<10 ? '0' : '';
    let displayTimeLeft = (hours>0 ? hours.toString() : '' ) + ':' + extraZero + minutes.toString();
    let rangeLeft = (me.geoPos.speed * timeLeft / 60) * km2Miles;     // km/h * h -> km -> mi
    $("#fuelEstimates").innerHTML = displayTimeLeft + " / " + rangeLeft.toFixed(0) + "mi<br>@ " + estFuelBurn.toFixed(1) + "L/h";

    // Waypoints - Next - Trip
    const fp_nextWp = document.getElementById("fp_nextWp") as HTMLBodyElement;
    const fp_trip = document.getElementById("fp_trip") as HTMLBodyElement;
    if (myPlan.cur_waypoint >= 0) {
        // TODO: support different geometries
        const next_wp = myPlan.waypoints[myPlan.cur_waypoint];
        const next_dist = next_wp.geo[0].distanceTo(geoTolatlng(me.geoPos));

        const next_time = next_dist / me.geoPos.speed * km2Miles * 3600;

        fp_nextWp.innerHTML = mSecToStr_h_mm(next_time) + "&nbsp;&nbsp;&nbsp;" + (next_dist * km2Miles / 1000).toFixed(1) + " mi";

    } else {
        fp_nextWp.innerHTML = "-";
        fp_trip.innerHTML = "-";
    }

    
    
}