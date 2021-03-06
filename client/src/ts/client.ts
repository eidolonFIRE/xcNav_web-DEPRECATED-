import { io, Socket } from "socket.io-client";
import * as _ from "lodash";

import * as api from "../../../server/src/ts/api";
import { hash_flightPlanData, hash_pilotMeta } from "../../../server/src/ts/apiUtil";
import * as chat from "./chat";
import { me, localPilots, processNewLocalPilot, hasLocalPilot } from "./pilots";
import * as cookies from "./cookies";
import { contacts, updateContactEntry, updateInviteLink } from "./contacts";
import { planManager } from "./flightPlan";
import { times } from "lodash";
import { refreshAllMapMarkers } from "./flightPlanUI";


const host_url = window.location.href.split(":").slice(1,2).join("");

// const _ip = process.env.NODE_ENV == "development" ?  host_url + ":3000" : 
const _ip = "https://xcnav-server.herokuapp.com";

console.log("Connecting to: ", _ip);

const socket = io(_ip, {
    withCredentials: true,
    secure: true,
    rejectUnauthorized: false,
});

socket.on("connect", () => {
    console.log("Backend Connected:", socket.id, _ip);
    // hide "disconnected" indicators
    document.querySelectorAll(".offlineIndicator").forEach((e: HTMLImageElement) => {
        e.style.visibility = "hidden";
    });
});
  
socket.on("disconnect", () => {
    console.log("Backend Disconnected:", socket.id);
    // show "disconnected" indicators
    document.querySelectorAll(".offlineIndicator").forEach((e: HTMLImageElement) => {
        e.style.visibility = "visible";
    });
});


export function setupBackendConnection() {
    if (me.secret_id == "") {
        register();
    } else {
        login();
    }
}



// ############################################################################
//
//     Async Receive from Server
//
// ############################################################################

// --- new text message from server
socket.on("TextMessage", (msg: api.TextMessage) => {
    if (msg.group_id == me.group) {
        chat.processTextMessage(msg);
    } else {
        // getting messages from the wrong group!
        console.error("Wrong group ID!", me.group, msg.group_id);
    }
});

//--- receive location of other pilots
socket.on("PilotTelemetry", (msg: api.PilotTelemetry) => {
    // if we know this pilot, update their telemetry
    if (hasLocalPilot(msg.pilot_id)) {
        localPilots[msg.pilot_id].updateTelemetry(msg.telemetry, msg.timestamp);
    } else {
        console.warn("Unrecognized local pilot", msg.pilot_id);
        requestGroupInfo(me.group);
    }
});

// --- new Pilot to group
socket.on("PilotJoinedGroup", (msg: api.PilotJoinedGroup) => {
    if (msg.pilot.id != me.id) {
        // update localPilots with new info
        processNewLocalPilot(msg.pilot);
    }
});

// --- Pilot left group
socket.on("PilotLeftGroup", (msg: api.PilotLeftGroup) => {
    if (msg.pilot_id == me.id) return;
    delete localPilots[msg.pilot_id];
    if (msg.new_group_id != api.nullID) {
        // TODO: prompt yes/no should we follow them to new group
    }
});

// --- Full flight plan sync
socket.on("FlightPlanSync", (msg: api.FlightPlanSync) => {
    planManager.plans["group"].replaceData(msg.flight_plan);
});

// --- Process an update to group flight plan
socket.on("FlightPlanUpdate", (msg: api.FlightPlanUpdate) => {
    // make backup copy of the plan
    const plan = planManager.plans["group"];
    const backup = _.cloneDeep(plan.plan);

    // update the plan
    switch (msg.action) {
        case api.WaypointAction.delete:
            // Delete a waypoint
            plan.spliceWaypoints(msg.index, 1);
            break;
        case api.WaypointAction.new:
            // insert a new waypoint
            plan.spliceWaypoints(msg.index, 0, msg.data);
            break;
        case api.WaypointAction.sort:
            // Reorder a waypoint
            const wp = plan.plan.waypoints[msg.index];
            plan.spliceWaypoints(msg.index, 1);
            plan.spliceWaypoints(msg.new_index, 0, wp);
            break;
        case api.WaypointAction.modify:
            // Make updates to a waypoint
            if (msg.data != null) {
                plan.plan.waypoints[msg.index] = msg.data;
            }
            break;
        case api.WaypointAction.none:
            // no-op
            break;
    }

    const hash = hash_flightPlanData(plan.plan);
    if (hash != msg.hash) {
        // DE-SYNC ERROR
        // restore backup
        console.warn("Group Flightplan De-sync!", hash, msg.hash);
        planManager.plans["group"].replaceData(backup);

        // we are out of sync!
        requestGroupInfo(me.group);
    }

    plan.refreshMapMarkers();
});

// --- Process Pilot Waypoint selections
socket.on("PilotWaypointSelections", (msg: api.PilotWaypointSelections) => {
    Object.entries(msg).forEach(([pilot_id, wp]) => {
        console.log(pilot_id, "selected wp", wp);
        if (hasLocalPilot(pilot_id)) {
            localPilots[pilot_id].current_waypoint = wp;
        } else {
            // we don't have this pilot?
            requestGroupInfo(me.group);
        }
    });
});

// ############################################################################
//
//     Async Send to Server
//
// ############################################################################

// --- send a text message
export function sendTextMessage(msg: api.TextMessage) {
    socket.emit("TextMessage", msg);
}

// --- send our telemetry
export function sendTelemetry(timestamp: api.Timestamp, geoPos: GeolocationCoordinates, fuel: number) {
    if (!socket.connected) return;

    const msg: api.PilotTelemetry = {
        timestamp: timestamp,
        pilot_id: me.id,
        telemetry: {
            geoPos: geoPos,
            fuel: fuel,
        } as api.Telemetry,
    };
    socket.emit("PilotTelemetry", msg);
}

export function updateWaypoint(msg: api.FlightPlanUpdate) {
    console.log("TX waypoint update:",  msg)
    socket.emit("FlightPlanUpdate", msg);
}

export function sendWaypointSelection() {
    const msg: api.PilotWaypointSelections = {}
    msg[me.id] = me.current_waypoint;
    socket.emit("PilotWaypointSelections", msg);
}

// ############################################################################
//
//     Register
//
// ############################################################################
export function register() {
    const pilot = {
        id: me.id,
        name: me.name,
    } as api.PilotMeta;
    const request = {
        pilot: pilot,
    } as api.RegisterRequest;
    socket.emit("RegisterRequest", request);
}

socket.on("RegisterResponse", (msg: api.RegisterResponse) => {
    if (msg.status) {
        // TODO: handle error
        // msg.status (api.ErrorCode)
        console.error("Error Registering", msg.status);
    } else {
        // update my ID
        me.secret_id = msg.secret_id;
        me.id = msg.pilot_id;
        cookies.set("me.public_id", msg.pilot_id, 9999);
        cookies.set("me.secret_id", msg.secret_id, 9999);

        // proceed to login
        login();
    }
});


// ############################################################################
//
//     Login
//
// ############################################################################
export function login() {
    const request = {
        secret_id: me.secret_id,
        pilot_id: me.id,
    } as api.LoginRequest;
    socket.emit("LoginRequest", request);
}

socket.on("LoginResponse", (msg: api.LoginResponse) => {
    if (msg.status) {
        if (msg.status == api.ErrorCode.invalid_secret_id || msg.status == api.ErrorCode.invalid_id) {
            // we aren't registered on this server
            register();
            return;
        } else {
            console.error("Error Logging in.");
        }
    } else {
        // compare API version
        // TODO: should have big warning banners for this
        if (msg.api_version > api.api_version) {
            console.error("Client is out of date!");
        } else if (msg.api_version < api.api_version) {
            console.error("Server is out of date!");
        }

        // save id
        me.id = msg.pilot_id;
        cookies.set("me.public_id", msg.pilot_id, 9999);

        // update profile
        if (msg.pilot_meta_hash != hash_pilotMeta(me)) {
            console.warn("Server had outdate profile meta.");
            pushProfile();
        }

        // follow invite link
        const queryString = window.location.search;
        const urlParams = new URLSearchParams(queryString);
        if (urlParams.has("invite")) {
            // join using url invite
            const invite_id = urlParams.get("invite").toLowerCase();
            console.log("Following url invite", invite_id);
            joinGroup(invite_id);
        } else if (me.group != api.nullID) {
            // attempt to re-join group
            console.log("Rejoining previous group", me.group);
            joinGroup(me.group);
        }

        updateInviteLink(me.id);
    }
});


// ############################################################################
//
//     Update Profile
//
// ############################################################################
export function pushProfile() {
    const request: api.UpdateProfileRequest = {
        pilot: {
            id: me.id,
            name: me.name,
            avatar: me.avatar,
        },
        secret_id: me.secret_id
    }
    socket.emit("UpdateProfileRequest", request);
}

socket.on("UpdateProfileResponse", (msg: api.UpdateProfileResponse) => {
    if (msg.status) {
        console.error("Error Updating profile", msg.status);
    }
});


// ############################################################################
//
//     Get Group Info
//
// ############################################################################
export function requestGroupInfo(group_id: api.ID) {
    const request: api.GroupInfoRequest = {
        group_id: group_id,
    };
    socket.emit("GroupInfoRequest", request);
}

socket.on("GroupInfoResponse", (msg: api.GroupInfoResponse) => {
    if (msg.status) {
        console.error("Error getting group info", msg.status);
    } else {
        // ignore if it's not a group I'm in
        if (msg.group_id != me.group) {
            console.warn("Received info for another group.");
            return;
        }

        // update map layers from group
        msg.map_layers.forEach((layer: string) => {
            // TODO: handle map_layers from the group
        });

        // update localPilots with new info
        msg.pilots.forEach((pilot: api.PilotMeta) => {
            if (pilot.id != me.id) processNewLocalPilot(pilot);
        });

        planManager.plans["group"].replaceData(msg.flight_plan);
    }
});


// ############################################################################
//
//     Get Chat Log
//
// ############################################################################

export function requestChatLog(group_id: api.ID, since: api.Timestamp) {
    const request: api.ChatLogRequest = {
        time_window: {
            // no farther back than 30 minutes
            start: Math.max(since, Date.now() - 6000 * 30),
            end: Date.now()
        },
        group_id: group_id
    };
    socket.emit("ChatLogRequest", request);
}

socket.on("ChatLogResponse", (msg: api.ChatLogResponse) => {
    if (msg.status) {
        console.error("ChatLogRequest Failed", msg.status);
    } else {
        if (msg.group_id == me.group) {
            Object.values(msg.msgs).forEach((msg: api.TextMessage) => {
                // handle each message
                chat.processTextMessage(msg, true);
            });
        } else {
            console.error("Wrong group ID!", me.group, msg.group_id);
        }
    }
});


// ############################################################################
//
//     Join a group
//
// ############################################################################
export function joinGroup(target_id: api.ID) {
    const request = {
        target_id: target_id,
    } as api.JoinGroupRequest;
    socket.emit("JoinGroupRequest", request);
    console.log("Requesting Join Group", target_id);
}

socket.on("JoinGroupResponse", (msg: api.JoinGroupResponse) => {
    if (msg.status) {
        // not a valid group
        if (msg.status == api.ErrorCode.invalid_id) {
            console.warn("Attempted to join invalid group", msg.group_id);
        } else if (msg.status == api.ErrorCode.no_op && msg.group_id == me.group) {
            // we were already in this group... update anyway
            me.group = msg.group_id;
        } else {
            console.error("Error joining group", msg.status);
        }
    } else {
        // successfully joined group
        me.group = msg.group_id;
        // clear the invite from the url
        window.history.pushState({}, document.title, window.location.pathname)

        requestChatLog(me.group, chat.last_msg_timestamp);
    }    
});


// ############################################################################
//
//     Leave group
//
// ############################################################################
export function leaveGroup(prompt_split: boolean) {
    const request: api.LeaveGroupRequest = {
        prompt_split: prompt_split
    }
    socket.emit("LeaveGroupRequest", request);
}

socket.on("LeaveGroupResponse", (msg: api.LeaveGroupResponse) => {
    if (msg.status) {
        if (msg.status == api.ErrorCode.no_op && me.group == api.nullID) {
            // It's ok, we were pretty sure we weren't in a group anyway.
        } else {
            console.error("Error leaving group", msg.status);
        }
    } else {
        me.group = msg.group_id;
    }
});


// ############################################################################
//
//     Get Pilot Statuses
//
// ############################################################################
export function checkPilotsOnline(pilots: any[]) {
    const request = {
        pilot_ids: []
    } as api.PilotsStatusRequest;
    Object.values(pilots).forEach((pilot) => {
        request.pilot_ids.push(pilot.id);
    });
    socket.emit("PilotsStatusRequest", request);
}

socket.on("PilotsStatusResponse", (msg: api.PilotsStatusResponse) => {
    if (msg.status) {
        console.error("Error getting pilot statuses", msg.status);
    } else {
        // TODO: should this be throttled?
        Object.entries(msg.pilots_online).forEach(([pilot_id, online]) => {
            contacts[pilot_id].online = online;
            updateContactEntry(pilot_id);
        });
    }
});
