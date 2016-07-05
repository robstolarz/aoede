var Discord = require('discord.io');
var fs = require('fs');
var settings = JSON.parse(fs.readFileSync('settings.json'));

var client = new Discord.Client({
	token: settings.token
});

function main(){
	console.log('(Re)connected!');
}

function connect(){
	console.log('(Re)connecting to server...');
	client.connect();
}

client.on('ready',main);
client.on('disconnect',connect);
// let's get this party started
connect();
