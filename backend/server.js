const WebSocket = require("ws");

const games = new Map();
const keys = new Map();

const wss = new WebSocket.Server({host: "0.0.0.0", port: 3000 });

wss.on("connection", (ws) => {
    ws.on("message", (message) => {
        let m = JSON.parse(message);
        let game;

        console.log(m.type);

        switch (m.type) {
            case "CREATE":
                game = new Game();
                games.set(game.id, game);
                keys.set(game.get_key(), game.id);
                game.add_listener(ws);
                ws.send(resp("KEY", { key: game.get_key(), id: game.id }));
                console.log(`game ${game.id} started`);
                break;

            case "JOIN":

                // let player = new Player(m.data.player.id, m.data.player.name, m.data.player.color, m.data.player.symbol);

                if (keys.has(m.data.key)) {
                    games.get(keys.get(m.data.key)).add_listener(ws);
                    ws.send(resp("INFO", games.get(keys.get(m.data.key)).add_player(m.data.player)));
                    ws.send(resp("JOIN_DATA", { id: games.get(keys.get(m.data.key)).id, key: games.get(keys.get(m.data.key)).get_key() }))
                    games.get(keys.get(m.data.key)).broadcast();
                    console.log(`player ${m.data.player.id} added`);
                } else {
                    ws.send(resp("ERROR", "Key isn't exist"));
                    console.log("error: add player");
                }
                break;

            case "RECONNECT":
                if (games.has(m.data.game_id)) {
                    game = games.get(m.data.game_id);
                    game.players.forEach((item, i) => {
                        if (item.id === m.data.player_id) {
                            game.add_listener(ws);
                            ws.send(resp("PLAYER_DATA", game.players[i]));
                            game.broadcast();
                        }
                        // ws.send(resp("ERROR", "Player isn't exist"));
                    })
                } else {
                    ws.send(resp("ERROR", "Game isn't exist"));
                }
                break;

            case "MOVE":
                if (!games.has(m.data.game_id)) {
                    ws.send(resp("ERROR", "Game isn't exist"));
                    console.log("error: move: game not exist");
                    break;
                }
                game = games.get(m.data.game_id);
                let player;
                game.players.forEach((item, i) => {
                    if (item.id === m.data.player_id) {
                        player = game.players[i];
                    }
                })
                if (player === undefined) {
                    ws.send(resp("ERROR", "Player isn't exist"));
                    onsole.log("error: move: player not exist");
                    break;
                }
                game.move(player);
                game.broadcast();
                break;

            default:
                break;

        }
    })
});

console.log(`server started on ${wss.host}, port ${wss.port}`);
// console.log("Server started");


function resp(type, data) {
    return JSON.stringify({ type: type, data: data });
}


class Player {

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

    constructor(/*id,*/ name, color, symbol) {
        //this.id = id
        this.name = name;
        this.color = color;
        this.symbol = symbol;
    };
}

class Game {

    id = crypto.randomUUID();
    step = 0;
    turn = 0;
    players = [];
    create_time = Date.now();

    // Network

    add_listener(ws) {
        ws.game_id = this.id;
    };

    broadcast() {
        wss.clients.forEach((client) => {
            if (client.game_id === this.id && client.readyState === 1) {
                client.send(this.form_response("GAME_DATA", { turn: this.players[this.turn].id, players: this.players }));
            }
        })
    };

    form_response(type, data) {
        return JSON.stringify({ type: type, data: data })
    }

    // Players

    add_player(player) {

        this.players.forEach((item) => {
            if (item.id === player.id) return "Already Exist";
        })
        this.players.push(player);
        return "Player Added";
    };

    delete_player(player_id) {
        this.players.forEach((item, index) => {
            if (item.id === player_id) {
                this.players.splice(index, 1);
                return "Player Deleted";
            }
            return "Not Exist"
        })
    };

    get_key() {
        return this.id.split("-")[1].toUpperCase();
    };

    // Game

    move(player) {

        if (this.players[this.turn] !== player) {
            console.log("not your turn");

            return "Not Your Turn";
        }

        player.pos.prw = player.pos.cur;
        let pos = player.pos.cur;
        let add = this.roll_dice();
        player.dice = add;

        if (pos == 0 && add == 6) {
            add = 0;
            pos = 1;
            player.stat.last_nsix = 1;
        } else if (pos == 0) {
            add = 0;
        }

        if (pos + add > 72) {
            pos = 72;
            add = 0;
        }

        if (add == 6 && player.stat.six_count >= 2) {
            player.stat.six_count = 0;
            pos = player.stat.last_nsix;
            add = 0;
        } else if (add == 6) {
            player.stat.six_count++;
        } else {
            player.stat.last_nsix = pos;
            player.stat.six_count = 0;
        }

        if (pos > 68 && pos < 72) {
            if (add > 3) add = 0;

            if (add == 1 && player.stat.one_count >= 2) {
                pos = 51;
                add = 0;
                player.stat.one_count = 0
            } else if (add == 1) {
                player.stat.one_count++;
            }
        }

        player.pos.wrp = pos + add;

        player.pos.cur = this.warp(pos + add);

        this.players[this.turn] = player

        this.set_turn();

        console.log(`player ${player.id} moved on position ${player.pos.cur}`);

        return "Player Moved";
    };

    set_turn(t = -1) {
        const len = this.players.length;

        if (t == -1) {
            this.turn = (this.turn + 1) % len;
            return "Turn Increased";
        } else if (t < len && t >= 0) {
            this.turn = t;
            return `Turn Set on ${t}`;
        } else {
            return "Error Turn";
        }
    };

    roll_dice(dice = 0) {
        if (dice === 0) {
            let a = new Uint32Array(1);
            crypto.getRandomValues(a);
            return 1 + (a[0] % 6);
        } else {
            return dice;
        }
    }

    warp(pos) {
        const warp = new Map([
            [10, 23],
            [16, 4],
            [20, 32],
            [24, 7],
            [28, 50],
            [37, 66],
            [45, 67],
            [52, 35],
            [55, 3],
            [63, 2],
            [12, 8],
            [17, 69],
            [22, 60],
            [27, 41],
            [29, 6],
            [44, 9],
            [46, 62],
            [54, 68],
            [61, 13],
            [72, 51]
        ]);

        if (warp.has(pos)) {
            return warp.get(pos);
        } else {
            return pos;
        }
    }






}