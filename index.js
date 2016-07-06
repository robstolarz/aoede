var spawn = require('child_process').spawn;
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

function playFile(vcID, filename, then){
	// TODO: make this configurable
	var stereo = true;
	// set up arguments to ffmpeg
	console.log("playing file " + filename);
	var ffArgs = ['-i', filename, '-f', 's16le', '-ar', '48000', '-ac', stereo?2:1, 'pipe:1'];
	var ffmpeg = spawn((settings.ffmpeg||{}).binaryLocation || 'ffmpeg', ffArgs, {stdio: ['pipe', 'pipe', 'ignore']});
	console.log("spawned ffmpeg");
	client.joinVoiceChannel(vcID, function(){
		console.log("joined channel");
		client.getAudioContext({channel: vcID, stereo: stereo}, function(context){
			console.log(context);
			ffmpeg.stdout.once('readable', function(){
				console.log("sending contents");
				context.send(ffmpeg.stdout);
			});
			ffmpeg.stdout.once('end', function(){
				if(then) return then();
			});
		});
	});
}

function handleMessage(uData, uID, cID, text, e){
	// I can hear it already: "isn't that inefficient?"
	// Yes. It is. But channel state might change and I don't want to deal with cache invalidation
	if(settings.listenChannelNames && settings.listenChannelNames.indexOf(client.channels[cID].name) == -1) return;
	// TODO: customizable command prefix / regex
	var comName = /\s*!(\S*)/.exec(text);
	if(!comName) return;
	var comArgs = text.substring(comName.index + comName[1].length + 2);
	comName = comName[1];
	switch(comName){
		case "summon":
			client.joinVoiceChannel(client.servers[client.channels[cID].guild_id].members[uID].voice_channel_id);
			break;
		case "playfile":
			playFile(client.servers[client.channels[cID].guild_id].members[client.id].voice_channel_id,comArgs);
			break;
	}
}

// gracefully disconnect when asked to exit
require('death')(function(){
	clientShouldConnect = false;
	if(client.connected) client.disconnect();
	process.exit(0);
});

client.on('ready',main);
client.on('disconnect',connect);
client.on('message',handleMessage);
// let's get this party started
connect();
