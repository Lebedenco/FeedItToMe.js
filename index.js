const FeedParser = require('feedparser');
const request = require('request');
const fs = require("fs");
const Discord = require('discord.js');
const feed = require("./Feed.json");

const client = new Discord.Client();
const currentDir = __dirname;
const token = feed.token;
const channelID = feed.channel.id;

let channel;

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);

    channel = client.channels.get(channelID);

    checkFeed()
        .then(() => {
            save();
        })
        .catch((error) => {
            console.log(error);
        });

    start();
});

client.on('message', async msg => {
    // Ping
    if (msg.content === '!ping') {
        msg.reply('Pong!');
    }

    // Clear messages from current channel
    if (msg.content === "!clear") {
        const fetched = await msg.channel.fetchMessages();

        msg.channel.bulkDelete(fetched)
            .catch(error => msg.reply(`Couldn't delete messages because of: ${error}`));
    }

    // Command to add to FeedItToMe
    if (msg.content === "!add") {
        msg.channel.send("Tell me the name: ")
            .then(() => {
                msg.channel.awaitMessages(response => response.author === msg.author, {
                        max: 1,
                        time: 300000,
                        errors: ['time']
                    })
                    .then((collected) => {
                        name = collected.first().content;

                        msg.channel.send("Now tell me the URL: ")
                            .then(() => {
                                msg.channel.awaitMessages(response => response.author === msg.author, {
                                        max: 1,
                                        time: 300000,
                                        errors: ['time']
                                    })
                                    .then((collected) => {
                                        url = collected.first().content;

                                        msg.channel.send(`All right! ${name} will be added.`);

                                        add(name, url);
                                    })
                            });
                    })
            });
    }

    // Command to remove from FeedItToMe
    if (msg.content === "!remove") {
        msg.channel.send("Tell me the name: ")
            .then(() => {
                msg.channel.awaitMessages(response => response.author === msg.author, {
                        max: 1,
                        time: 300000,
                        error: ['time']
                    })
                    .then((collected) => {
                        name = collected.first().content;

                        remove(name)
                            .then(() => {
                                msg.channel.send(`All right! ${name} will be removed.`);

                                save();
                            })
                            .catch((error) => {
                                msg.channel.send(error);
                            });
                    })
                    .catch(e => msg.reply("Timeout!"));           
            });
    }

    // Command to save your feed
    if (msg.content === "!save") {
        msg.channel.send("All saved!");

        save();
    }

    // Command to check single feed. Example: "!check Feed Name"
    if (msg.content.startsWith("!check ")) {
        const name = msg.content.substring(7);

        checkFor(name)
            .then((f) => {
                console.log(f);
                if (f !== undefined) 
                    msg.channel.send(`Name: **${f.name}**\nLast entry: **${f.title}**\nUpdated on: **${f.date}**\nLink: ${f.updated}`);
                else
                    msg.channel.send(`Sorry! I can't find ${name} on your feed.`);
            })
            .catch((error) => {
                msg.channel.send(error);
            });
    }
});

client.login(token);

function getFeed(urlfeed, callback) {
    const req = request(urlfeed);
    const feedparser = new FeedParser();
    const feedItems = [];

    req.on("response", function (response) {
        const stream = this;
        if (response.statusCode == 200) {
            stream.pipe(feedparser);
        }
    });

    req.on("error", function (err) {
        console.log("getFeed: err.message == " + err.message);
    });

    feedparser.on("readable", function () {
        try {
            let item = this.read(),
                flnew;
            if (item !== null) {
                feedItems.push(item);
            }
        } catch (err) {
            console.log("getFeed: err.message == " + err.message);
        }
    });

    feedparser.on("end", function () {
        callback(undefined, feedItems);
    });

    feedparser.on("error", function (err) {
        console.log("getFeed: err.message == " + err.message);
        callback(err);
    });
}

function checkFeed() {
    return new Promise((resolve, reject) => {
        feed.feeds.forEach(f => {
            getFeed(f.link, (err, feedItems) => {
                if (!err) {
                    const updatedFeed = feedItems[0];
                    
                    if (f.updated !== updatedFeed.link) {
                        f.updated = updatedFeed.link;
                        channel.send(`\nNew **${f.name}!**\nTitle: **${updatedFeed.title}**\nUpdated on: **${updatedFeed.date}**\nLink: ${f.updated}`);
                    } else {
                        console.log(`\n${f.name} is updated!`);
                    }
                } else {
                    console.log(err);

                    reject(`\nThere was an error when checking the feed.`);
                }
            });
        });

        setTimeout(() => {
            resolve();
        }, 10000); 
    });
}

function checkFor(name) {
    return new Promise((resolve, reject) => {
        let check;
        
        feed.feeds.forEach(f => {
            if (f.name === name) {
                getFeed(f.link, (err, feedItems) => {
                    if (!err) {
                        check = {
                            name: f.name,
                            title: feedItems[0].title,
                            date: feedItems[0].date,
                            updated: f.updated
                        };
                    } else {
                        console.log(err);
                        reject(`Sorry, there was an error when getting the feed.`);
                    }
                });
            }
        });

        setTimeout(() => {
            resolve(check);
        }, 2000);
    });
}

function remove(name) {
    return new Promise((resolve, reject) => {
        for (let i = 0; i < feed.feeds.length; i++) {
            if (feed.feeds[i].name === name) {
                feed.feeds.splice(i, 1);

                resolve();
            }
        }

        reject(`Sorry! I can't find ${name} on your feed.`);
    });
}

function add(name, link) {
    const f = {
        name,
        link,
        updated: "new"
    };

    feed.feeds.push(f);

    save();
}

function save() {
    fs.writeFile(currentDir + "/Feed.json", JSON.stringify(feed), err => {
        if (err) {
            console.log(err);
        }
    });

    console.log("All saved!");
}

function start() {
    setInterval(() => {
        checkFeed()
            .then(() => {
                save();
            })
            .catch((error) => {
                console.log(error);
            });
    }, 300000);
}