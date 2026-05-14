// CLASSES

class Network {
    constructor(url) {
        this.socket = null;
        this.url = `ws://${url}/api/`;
    }

    connect() {
        this.socket = new WebSocket(this.url);

        // this.socket.onopen = () => console.log("connected");

        this.socket.onclose = () => {
            console.log("Disconnected");
            setTimeout(() => this.connect(), 3000);
        }

        this.socket.onmessage = (e) => {
            this.handle(JSON.parse(e.data));
        }
    }

    send(type, data) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ type: type, data: data }));
        } else {
            console.error("WebSocket Closed");
        }
    }

    handle(message) {

        switch (message.type) {
            case "KEY":
                state.key = message.data.key;
                state.id = message.data.id;
                console.log(state.key);
                alert(state.key);
                document.getElementById("keyholder").innerText = state.key;
                break;
            case "ERROR" || "INFO":
                console.log(message.data);
                break;
            case "GAME_DATA":
                state.turn = message.data.turn;
                state.players = message.data.players;
                if (state.turn === current_player.id) {
                    document.getElementById("roll").disabled = false;
                } else {
                    document.getElementById("roll").disabled = true;
                }
                state.players.forEach((item) => {
                    display_player(item)
                });
                list_player_generator();
                //console.log(state.players[0].pos);

                break;
            case "JOIN_DATA":
                state.id = message.data.id;
                state.key = message.data.key;
                localStorage.setItem("current_game_id", state.id);
                localStorage.setItem("current_player_id", current_player.id);
                console.log(state);
                break;
            case "PLAYER_DATA":
                current_player = message.data;
                console.log(current_player);
                break;
            default:
                break;
        }
    };
}

class Player {

    id = generateUUID(); //crypto.randomUUID();
    pos = {
        cur: 0,
        wrp: 0,
        prw: 0
    };
    stat = {
        last_nsix: 0,
        six_count: 0,
        one_count: 0,
    }
    dice = 0;

    constructor(name, color, symbol) {
        this.name = name;
        this.color = color;
        this.symbol = symbol;
    };
}


// MAIN

const url = window.location.hostname;

const socket = new Network(url);

socket.connect();

let current_player = {}

let state = {
    id: "",
    key: "",
    turn: "",
    players: []
}

field_generation();

document.getElementById("single").addEventListener("click", (e) => { main(false, true); toggle_menu() });

document.getElementById("join").addEventListener("click", (e) => { main(true, false); toggle_menu() });

document.getElementById("reconnect").addEventListener("click", (e) => { reconnect_game(); toggle_menu() });

document.getElementById("admin").addEventListener("click", (e) => { main(true, true); toggle_menu() });

document.getElementById("roll").addEventListener("click", (e) => { make_move() });

document.getElementById("menu-btn").addEventListener("click", (e) => { toggle_menu() });

document.getElementById("back").addEventListener("click", (e) => { toggle_menu() });





// FUNCTIONS

function main(is_mp, is_adm) {

    if (is_mp && is_adm) {
        socket.send("CREATE");
    } else if (is_mp && !is_adm) {
        let p_name = document.getElementById("name").value;
        let p_color = document.getElementById("color").value;
        let p_symbol = "_";
        let p_key = document.getElementById("key").value;

        p_key = p_key.toUpperCase();

        current_player = new Player(p_name, p_color, p_symbol);

        socket.send("JOIN", { key: p_key, player: current_player });
    }
}

function field_generation() {
    let t = document.getElementById("field");
    let a = [];
    let html = `<table class="field-table"><tr>`;

    for (let i = 0; i < 8; i++) {
        p = i * 9;
        n = 72 - i * 9;

        if (i % 2 == 0) {
            for (let j = 1; j <= 9; j++) {
                a[p] = n;
                p++;
                n--;
            }
        } else {
            p += 8;
            for (let j = 1; j <= 9; j++) {
                a[p] = n;
                p--;
                n--;
            }
        }
    };

    a.forEach((item, i) => {
        html += `<td><div class="cont"><div class="num"></div><div id="${item}" class="cell"></div></div></td>`;
        if ((i + 1) % 9 === 0 && i !== a.length - 1) {
            html += `</tr><tr>`;
        }
    });

    html += `</tr></table>`;

    t.innerHTML = html;

    t.addEventListener("click", (e) => {
        console.log(e.target); // REWORK!!!
    });
}

function display_player(player) {
    let html = `<div id="${player.id}" style="background-color: #${player.color};" class="player"></div>`;

    const a = document.getElementById(player.id);
    if (a) { a.remove() };

    const b = document.getElementById(`${player.pos.cur}`);
    if (b) { b.innerHTML += html };
}

function display_list_player(player) {
    return `<div id="${player.id}" class="player-item ${is_turn(player.id)}"><div class="player-color" style="background-color: #${player.color};"></div> <p>${player.name}</p> <div class="player-pos"> ${is_warp(player.pos)} </div> ${html_dice(player.dice)} </div>`;
}

function is_turn(player_id) {
    if (state.turn === player_id) {
        return "active";
    } else {
        return "";
    }
}

function is_warp(pos) {
    if (pos.cur === pos.wrp) {
        return `<p>${pos.cur}</p>`;
    } else {
        return `<p>${pos.wrp}</p><img id="arrow-left" src="media/arrow.png" alt="arrow left"><p>${pos.cur}</p>`
    }
}

function list_player_generator() {
    let a = "";
    const b = document.getElementById("player-list");

    state.players.forEach((item) => {
        a += display_list_player(item);
    })

    b.innerHTML = a;
}

function join_game() {
    let key = document.getElementById("key").value;
    let name = document.getElementById("name").value;
    let color = document.getElementById("color").value;

    current_player = new Player(name, color, "_");

    console.log(current_player);

    socket.send("JOIN", { key: key, player: current_player });
}

function make_move() {
    if (state.turn === current_player.id) {
        socket.send("MOVE", { game_id: state.id, player_id: current_player.id });
    }
}

function reconnect_game(game_id = localStorage.getItem("current_game_id"), player_id = localStorage.getItem("current_player_id")) {
    state.id = game_id;
    socket.send("RECONNECT", { game_id, player_id });
}

function html_dice(num) {
    let a = "";

    switch (num) {
        case 1:
            a = `<div class="player-dice"> <div class="player-dice-row"> <div class=""></div> <div class=""></div> <div class=""></div> </div> <div class="player-dice-row"> <div class=""></div> <div class="active"></div> <div class=""></div> </div> <div class="player-dice-row"> <div class=""></div> <div class=""></div> <div class=""></div> </div> </div>`
            break;
        case 2:
            a = `<div class="player-dice"> <div class="player-dice-row"> <div class=""></div> <div class=""></div> <div class="active"></div> </div> <div class="player-dice-row"> <div class=""></div> <div class=""></div> <div class=""></div> </div> <div class="player-dice-row"> <div class="active"></div> <div class=""></div> <div class=""></div> </div> </div>`;
            break;
        case 3:
            a = `<div class="player-dice"> <div class="player-dice-row"> <div class=""></div> <div class=""></div> <div class="active"></div> </div> <div class="player-dice-row"> <div class=""></div> <div class="active"></div> <div class=""></div> </div> <div class="player-dice-row"> <div class="active"></div> <div class=""></div> <div class=""></div> </div> </div>`;
            break;
        case 4:
            a = `<div class="player-dice"> <div class="player-dice-row"> <div class="active"></div> <div class=""></div> <div class="active"></div> </div> <div class="player-dice-row"> <div class=""></div> <div class=""></div> <div class=""></div> </div> <div class="player-dice-row"> <div class="active"></div> <div class=""></div> <div class="active"></div> </div> </div>`;
            break;
        case 5:
            a = `<div class="player-dice"> <div class="player-dice-row"> <div class="active"></div> <div class=""></div> <div class="active"></div> </div> <div class="player-dice-row"> <div class=""></div> <div class="active"></div> <div class=""></div> </div> <div class="player-dice-row"> <div class="active"></div> <div class=""></div> <div class="active"></div> </div> </div>`;
            break;
        case 6:
            a = `<div class="player-dice"> <div class="player-dice-row"> <div class="active"></div> <div class=""></div> <div class="active"></div> </div> <div class="player-dice-row"> <div class="active"></div> <div class=""></div> <div class="active"></div> </div> <div class="player-dice-row"> <div class="active"></div> <div class=""></div> <div class="active"></div> </div> </div>`;
            break;
        default:
            break;
    }

    return a;
}

function toggle_menu() {
    document.getElementById("menu").classList.toggle("active")
    document.getElementById("game").classList.toggle("active")
};



// FOR DEVELOPMENT ONLY

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0,
            v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}