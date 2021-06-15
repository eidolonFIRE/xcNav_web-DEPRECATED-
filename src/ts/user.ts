/*
    Manage current user identification info here.
*/


import * as proto from "../proto/protocol";
import { make_uuid } from "./util";
import * as client from "./client";


interface User {
    name: string,
    ID: proto.ID,
    group:  proto.ID,
}

let me = {
    name: "",
    ID: "",
    group: "",
}


// grab username initially
if (localStorage.getItem("user_name") != null) {
    me.name = localStorage.getItem("user_name");
    me.ID = localStorage.getItem("user_ID");
    me.group = localStorage.getItem("user_group");

    // TODO: verify group is still active in server (rejoin the group)
} else {
    // YOU NEED TO SET USERNAME!
    setName(prompt("Please enter your name"));
}



export function setName(newName: string) {
    me.name = newName;
    me.ID = make_uuid(10);
    me.group = "";

    localStorage.setItem("user_name", me.name);
    localStorage.setItem("user_ID", me.ID);
    localStorage.setItem("user_group", me.group);

    // DEBUG USE ONLY
    client.register();
}

export function ID(): proto.ID {
    return me.ID;
}

export function name(): string {
    return me.name;
}

export function group(): proto.ID {
    return me.group;
}