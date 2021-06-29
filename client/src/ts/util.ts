/*
    Misc utilities and constants
*/

import * as L from "leaflet";
import * as GeometryUtil from "leaflet-geometryutil";
import { getMap } from "./mapUI";


// Use $(Selector) without jQuery
// https://developer.mozilla.org/en-US/docs/Web/API/Document/querySelector
export function $(query: string): any {
	return (query[0] === '#') ? document.querySelector(query) : document.querySelectorAll(query);
}


export const meters2Feet = 3.28084;
export const kmh2mph = 0.621371;
export const km2Miles = 0.621371;

// TODO: pick sensible colors that are clear on map
export const colors = [ 'aqua', 'black', 'blue', 'fuchsia', 'green', 'lime', 'maroon', 'navy', 'olive', 'purple', 'yellow' ];


// Create a UUID (for api.ID)
export function make_uuid(len: number): string {
    const u8 = new Uint8Array(len);
    window.crypto.getRandomValues(u8);
    return btoa(String.fromCharCode.apply(null, u8))
}


export function randInt (min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomCentered() {
    return Math.random()*2 - 1; // centered, -1..1
}

export function geoTolatlng(geoPos: GeolocationCoordinates): L.LatLng {
    return new L.LatLng(
        geoPos.latitude,
        geoPos.longitude,
        geoPos.altitude
    );
}

export function rawTolatlng(lat: number, lng: number, alt: number): L.LatLng {
    return new L.LatLng(
        lat,
        lng,
        alt
    );
}

export function objTolatlng(point_obj: any): L.LatLng {
    return new L.LatLng(
        point_obj.lat,
        point_obj.lng,
        point_obj.alt
    );
}

export function geoDistance(seg_start: L.LatLng, seg_end: L.LatLng): number {
    return L.GeometryUtil.distance(getMap(), seg_start, seg_end);
    // TODO: better to use this? seg_start.distanceTo(seg_end);
}

export function geoHeading(seg_start: L.LatLng, seg_end: L.LatLng): number {
    return L.GeometryUtil.bearing(seg_start, seg_end);
}

export function mSecToStr_h_mm(duration: number): string {
    let sec_num = duration / 1000;
    let hours   = Math.floor(sec_num / 3600);
    let minutes = Math.floor((sec_num - (hours * 3600)) / 60);
    return hours.toString() + ':' + minutes.toString().padStart(2, "0");
}

export function strFormat(format: string, args: Record<string, string>): string {
    let retval = format;
    Object.keys(args).forEach((key: string) => {
        retval = retval.replace("{" + key + "}", args[key]);
    });
    return retval;
}
