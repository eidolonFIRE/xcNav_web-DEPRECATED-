import QRCode from 'qrcode'

import default_avatar from "../img/default_avatar.png";

import * as api from "../../../server/src/ts/api";
import * as client from "./client";
import * as cookies from "./cookies";
import { hasLocalPilot, LocalPilot, localPilots } from "./pilots";


interface Contact extends api.PilotMeta {
    online: boolean
}
interface SavedContact {
    i: api.ID
    n: string
}

type Contacts = Record<api.ID, Contact>;

export let contacts: Contacts = {};
let inviteLink = "";



export function getAvatar(pilot_id: api.ID) {
    const av = contacts[pilot_id].avatar;
    return (av == null || av == "") ? default_avatar : av;
}


export function updateContact(pilot: api.PilotMeta) {
    if (Object.keys(contacts).indexOf(pilot.id) < 0) {
        // we don't have this contact yet, add them
        const new_contact: Contact = {
            online: false,
            ...pilot,
        }
        contacts[pilot.id] = new_contact;
        console.log("New contact", pilot.id, pilot.name);
    } else {
        // update existing contact
        contacts[pilot.id].avatar = pilot.avatar;
        contacts[pilot.id].name = pilot.name;
    }
    saveContacts();
    updateContactEntry(pilot.id);
}



function refreshContactListUI() {
    const list = document.getElementById("contactList") as HTMLUListElement;

    // empty list
    while (list.firstChild) {
        list.removeChild(list.lastChild);
    }

    function make_entry(pilot_id: api.ID, allow_join: boolean) {
        // set html
        const pilot = contacts[pilot_id];
        const entry = document.createElement("li") as HTMLLIElement;
        const avatar = document.createElement("img") as HTMLImageElement;
        avatar.src = getAvatar(pilot_id);
        avatar.className = "pilot-avatar-icon";
        entry.appendChild(avatar);
        entry.innerHTML += pilot.name;
        entry.className = "list-group-item";
        entry.id = "pilot_contact_" + pilot.id;
        // entry.setAttribute("data-bs-dismiss", "offcanvas");
        // entry.setAttribute("data-bs-toggle", "offcanvas");

        let mini_menu_toggle = false;
        entry.addEventListener("click", (ev: MouseEvent) => {
            if (!mini_menu_toggle) {
                // --- Show mini-menu for contact options
                // TODO: showing a mini-menu should hide all other mini-menus
                mini_menu_toggle = true;

                // mini-menu div
                const div = document.createElement("div") as HTMLDivElement;
                div.id = "mini_contact_menu_" + pilot_id;
                div.className = "row";
                entry.appendChild(div);

                // button icons
                const join_icon = document.createElement("i");
                join_icon.className = "fas fa-user-plus";
                const del_icon = document.createElement("i");
                del_icon.className = "fas fa-trash";

                // Join button
                if (allow_join) {
                    const join_btn = document.createElement("button") as HTMLButtonElement;
                    join_btn.className = "btn col btn-outline-primary";
                    join_btn.appendChild(join_icon);
                    join_btn.innerHTML += "&nbsp;Join";
                    join_btn.setAttribute("data-bs-dismiss", "offcanvas");
                    div.appendChild(join_btn);
                    join_btn.addEventListener("click", (ev: MouseEvent) => {
                        // Join group!
                        client.joinGroup(pilot.id);
                    });
                }

                // delete button
                const del_btn = document.createElement("button") as HTMLButtonElement;
                del_btn.className = "btn col-2 btn-outline-danger";
                del_btn.appendChild(del_icon);
                div.appendChild(del_btn);
                del_btn.addEventListener("click", (ev: MouseEvent) => {
                    if (confirm("Forget this pilot?" + ` \"${pilot.name}\"`)) {
                        // Trash the contact
                        console.log("Deleting Contact", pilot_id);
                        delete contacts[pilot_id];
                        saveContacts();

                        // remove list entry
                        list.removeChild(entry);
                    }
                });
            } else {
                mini_menu_toggle = false;
                const mini_menu = document.getElementById("mini_contact_menu_" + pilot_id);
                if (mini_menu != null) {
                    entry.removeChild(mini_menu);
                }
            }
        });

        // TODO: long click to delete

        return entry;
    }

    // Label who is in the group
    if (Object.keys(localPilots).length > 0) {
        const label_group = document.createElement("p") as HTMLParagraphElement;
        label_group.textContent = "Pilots in Group"
        list.appendChild(label_group);
    }

    // add all the local pilots (pilots in my group)
    Object.values(localPilots).forEach((pilot: LocalPilot) => {
        // make the list item
        list.appendChild(make_entry(pilot.id, false));

        // update entry appearance
        updateContactEntry(pilot.id);
    });


    if (Object.keys(localPilots).length > 0) {
        const label_online = document.createElement("p") as HTMLParagraphElement;
        label_online.textContent = "Other Contacts";
        label_online.style.marginTop = "2em";
        list.appendChild(label_online);   
    } else {
        list.innerHTML += "<br>";
    }

    // Add contacts that are online
    Object.values(contacts).forEach((pilot) => {
        if (pilot.online && !hasLocalPilot(pilot.id)) {
            list.appendChild(make_entry(pilot.id, true));
            updateContactEntry(pilot.id);
        }
    });

    // Add contacts that are offline
    Object.values(contacts).forEach((pilot) => {
        if (!pilot.online && !hasLocalPilot(pilot.id)) {
            list.appendChild(make_entry(pilot.id, true));
            updateContactEntry(pilot.id);
        }
    });
}


export function updateContactEntry(pilot_id: api.ID) {
    // update entry appearance
    const entry = document.getElementById("pilot_contact_" + pilot_id) as HTMLUListElement;
    if (entry != null) {
        const is_online = contacts[pilot_id].online;
        const is_same_group = hasLocalPilot(pilot_id);
        entry.style.fontWeight = is_same_group ? "bold" : "normal";
        entry.style.color = is_online ? "black" : "grey";
    }
}


function saveContacts() {
    // we save more often than we load, so just save the whole Contact list with extra data
    let save_format: SavedContact[] = [];
    Object.values(contacts).forEach((each) => {
        // pack basic info into cookie
        save_format.push({
            i: each.id,
            n: each.name,
        });

        // save avatar into localstorage
        if (each.avatar != "" && each.avatar != null) {
            localStorage.setItem("avatar_" + each.id, each.avatar);
        }
    });
    cookies.set("user.contacts", JSON.stringify(save_format), 9999);
}


function loadContacts() {
    console.log("Loading Contacts");
    contacts = {};
    const contacts_from_mem = cookies.get("user.contacts");
    if (contacts_from_mem != "" && contacts_from_mem != null) {
        const parsed: SavedContact[] = JSON.parse(contacts_from_mem);
        parsed.forEach((each) => {
            const cached_avatar = localStorage.getItem("avatar_" + each.i);
            contacts[each.i] = {
                online: false,
                id: each.i,
                name: each.n,
                avatar: cached_avatar == null ? "" : cached_avatar,
            } as Contact;
        });
    }
}


export function updateInviteLink(target_id: api.ID) {
    let ref = window.location.href;
    inviteLink = window.location.href.replace("/#", "") + "?invite=" + target_id;

    console.log("Update Link Set:", inviteLink, target_id);

    // https://github.com/soldair/node-qrcode
    QRCode.toDataURL(inviteLink, {
            scale: 1,
            margin: 1,
            errorCorrectionLevel: "low",
        } as QRCode.QRCodeToDataURLOptions)
        .then(url => {
            const QRimg = document.getElementById("inviteQR") as HTMLImageElement;
            QRimg.src = url;
        })
        .catch(err => {
            console.error(err)
        });
}


export function setupContactsUI() {
    // --- Copy invite link
    const copyInvite = document.getElementById("copyInviteURL") as HTMLButtonElement;
    copyInvite.addEventListener("click", (ev: MouseEvent) => {
        navigator.clipboard.writeText(inviteLink);
    });
    if (!navigator.clipboard) {
        copyInvite.disabled = true;
    }

    // --- When menu opens...
    const contactsMenu = document.getElementById('contactsMenu')
    contactsMenu.addEventListener('show.bs.offcanvas', function () {
        // TODO: does this need to be rate limited? Will this get too slow with big contact list?
        if (Object.values(contacts).length > 0) {
            client.checkPilotsOnline(Object.values(contacts));
        }
        refreshContactListUI();
    });

    // --- Leave Group Button
    const leaveGroupBtn = document.getElementById("leaveGroupBtn") as HTMLButtonElement;
    leaveGroupBtn.addEventListener("click", (ev: MouseEvent) => {
        // clear out the list of local pilots
        Object.keys(localPilots).forEach(pilot_id => {
            delete localPilots[pilot_id];
        });
        // TODO: need controls for split to new group (hard coded to 'false' for now)
        client.leaveGroup(false);
    });

    // --- Load Contacts from memory
    loadContacts();
}
