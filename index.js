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

function handleMessage(uData, uID, cID, text, e){
	// I can hear it already: "isn't that inefficient?"
	// Yes. It is. But channel state might change and I don't want to deal with cache invalidation
	if(settings.listenChannelNames && settings.listenChannelNames.indexOf(client.channels[cID].name) == -1) return;
	console.log('"'+text+'"');
}

client.on('ready',main);
client.on('disconnect',connect);
client.on('message',handleMessage);
// let's get this party started
connect();
