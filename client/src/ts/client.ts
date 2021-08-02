import { io } from "socket.io-client";
import * as api from "../../../common/ts/api";
import * as chat from "./chat";
import { me, localPilots, processNewLocalPilot } from "./pilots";
import * as cookies from "./cookies";


// const _ip = process.env.NODE_ENV == "development" ? "http://localhost:3000" :
const _ip = "192.168.1.101:3000";
const socket = io(_ip, {
//   withCredentials: true,
//   extraHeaders: {
//     "xcNav": "abcd"
//   }
});

socket.on("connect", () => {
    console.log("connected:", socket.id);

    if (me.secret_id == "") {
        register();
    } else {
        login();
    }
});
  
socket.on("disconnect", () => {
    console.log("disconnected:", socket.id);
});


// ############################################################################
//
//     Async Receive from Server
//
// ############################################################################

// --- new text message from server
socket.on("TextMessage", (msg: api.TextMessage) => {
    console.log("Msg from server", msg);

    if (msg.group_id == me.group) {
        // TODO: manage message ordering (msg.index and msg.time)
        chat.createMessage(msg.pilot_id, msg.text, false, null, false);
    } else {
        // getting messages from the wrong group!
        console.error("Wrong group ID!", me.group, msg.group_id);
    }
});

//--- receive location of other pilots
socket.on("PilotTelemetry", (msg: api.PilotTelemetry) => {
    // if we know this pilot, update their telemetry
    if (Object.keys(localPilots).indexOf(msg.pilot_id) > -1) {
        localPilots[msg.pilot_id].updateTelemetry(msg.telemetry);
    }
});

// --- new Pilot to group
socket.on("PilotJoinedGroup", (msg: api.PilotJoinedGroup) => {
    if (msg.pilot.id == me.id) return;
    // update localPilots with new info
    processNewLocalPilot(msg.pilot);
});

// --- Pilot left group
socket.on("PilotLeftGroup", (msg: api.PilotLeftGroup) => {
    if (msg.pilot_id == me.id) return;
    // TODO: should we perge them from local or mark them inactive?
    if (msg.new_group_id != api.nullID) {
        // TODO: prompt yes/no should we follow them to new group
    }
});


// ############################################################################
//
//     Async Send to Server
//
// ############################################################################

// --- send a text message
export function chatMsg(text: string) {
    const textMsg = {
        timestamp: {
            msec: Date.now(),
        } as api.Timestamp,
        index: 0,
        group_id: me.group,
        pilot_id: me.id,
        text: text,
    } as api.TextMessage;

    socket.emit("TextMessage", textMsg);
}

// --- send our telemetry
export function sendTelemetry(timestamp: api.Timestamp, geoPos: GeolocationCoordinates, fuel: number) {
    if (!socket.connected) return;

    const msg = {
        timestamp: timestamp,
        pilot_id: me.id,
        telemetry: {
            geoPos: geoPos,
            fuel: fuel,
        } as api.Telemetry,
    } as api.PilotTelemetry;
    socket.emit("PilotTelemetry", msg);
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
        sponsor: api.nullID, // TODO: include sponsor ID (pilot who invited)
    } as api.RegisterRequest;
    socket.emit("RegisterRequest", request);
}

socket.on("RegisterResponse", (msg: api.RegisterResponse) => {
    if (msg.status) {
        // TODO: handle error
        // msg.status (api.ErrorCode)
        console.error("Error Registering");
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
        if (msg.api_version > api.api_version) {
            console.error("Client is out of date!");
        } else if (msg.api_version < api.api_version) {
            console.error("Server is out of date!");
        }

        // save id
        cookies.set("me.public_id", msg.pilot_id, 9999);



        // follow link
        const queryString = window.location.search;
        const urlParams = new URLSearchParams(queryString);

        if (urlParams.has("invite")) {
            const invite_id = urlParams.get("invite");
            console.log("Following url to join", invite_id);
            joinGroup(invite_id);
        } else if (me.group != api.nullID) {
            // attempt to re-join group
            joinGroup(me.group);
        }


        // update invite-link
        const invite = document.getElementById("inviteLink") as HTMLInputElement;
        invite.value = window.location.href + "?invite=" + me.id;
    }
});


// ############################################################################
//
//     Update Profile
//
// ############################################################################

// TODO: implement request/response


// ############################################################################
//
//     Get Group Info
//
// ############################################################################
export function requestGroupInfo(group_id: api.ID) {
    const request = {
        group_id: group_id,
    } as api.GroupInfoRequest;
    socket.emit("GroupInfoRequest", request);
}

socket.on("GroupInfoResponse", (msg: api.GroupInfoResponse) => {
    if (msg.status) {
        // TODO: handle error
        // msg.status (api.ErrorCode)
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
            console.log("New Remote Pilot", pilot);
            if (pilot.id != me.id) processNewLocalPilot(pilot);
        });
    }
});


// ############################################################################
//
//     Get Chat Log
//
// ############################################################################

// TODO: implement request/response


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
            console.error("Attempted to join invalid group.");
            me.group = api.nullID;
        } else {
            console.error("Error joining group", msg.status);
        }
    } else {
        console.log("Confirmed in group", msg.group_id);
        me.group = msg.group_id;
        
        // update group info
        requestGroupInfo(me.group);
    }
    cookies.set("me.group", me.group, 30);

    console.log("Joined group", me.group);
});


// ############################################################################
//
//     Leave group
//
// ############################################################################

// TODO: implement request/response
