var Discord = require('discord.io');
var fs = require('fs');
var settings = JSON.parse(fs.readFileSync('settings.json'));

var client = new Discord.Client({
	token: settings.token
});

function main(){
	console.log('(Re)connected!');
}

var clientShouldConnect = true;
function connect(){
	if(!clientShouldConnect) return;
	console.log('(Re)connecting to server...');
	client.connect();
}

function handleMessage(uData, uID, cID, text, e){
	// I can hear it already: "isn't that inefficient?"
	// Yes. It is. But channel state might change and I don't want to deal with cache invalidation
	if(settings.listenChannelNames && settings.listenChannelNames.indexOf(client.channels[cID].name) == -1) return;
	// TODO: customizable command prefix / regex
	var comName = /\s*!(\S*)/.exec(text);
	if(!comName) return;
	comName = comName[1];
	switch(comName){
		case "summon":
			client.joinVoiceChannel(client.servers[client.channels[cID].guild_id].members[uID].voice_channel_id);
			break;
	}
}

// gracefully disconnect when asked to exit
require('death')(function(){
	clientShouldConnect = false;
	client.disconnect();
});

client.on('ready',main);
client.on('disconnect',connect);
client.on('message',handleMessage);
// let's get this party started
connect();
