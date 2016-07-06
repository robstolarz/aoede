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

var playersByVcID = {};

function isPlaying(vcID){
	return (playersByVcID[vcID]||{}).isPlaying || false;
}

function getVolume(vcID){
	return (playersByVcID[vcID]||{}).volume || (settings.ffmpeg||{}).defaultVolume || 0.15;
}

function playFile(vcID, filename, then){
	// TODO: make this configurable
	var stereo = true;
	// set up arguments to ffmpeg
	console.log("playing file " + filename);
	var defaultVolume = getVolume(vcID);
	var ffArgs = ['-i', filename, '-f', 's16le', '-ar', '48000', '-af', 'volume='+defaultVolume, '-ac', stereo?2:1, 'pipe:1', '-stdin'];
	var ffmpeg = spawn((settings.ffmpeg||{}).binaryLocation || 'ffmpeg', ffArgs, {stdio: ['pipe', 'pipe', 'ignore']});
	console.log("spawned ffmpeg");
	client.joinVoiceChannel(vcID, function(){
		console.log("joined channel");
		client.getAudioContext({channel: vcID, stereo: stereo}, function(context){
			console.log(context);
			ffmpeg.stdout.once('readable', function(){
				console.log("sending contents");
				context.send(ffmpeg.stdout);
				// create new player. (sorry this is here, sorry it looks so bad!)
				playersByVcID[vcID] = playersByVcID[vcID] || {};
				playersByVcID[vcID].stdin = ffmpeg.stdin;
				playersByVcID[vcID].volume = defaultVolume;
			});
			var reference = playersByVcID[vcID]; // this will always point to the right one ;)
			ffmpeg.stdout.once('end', function(){
				reference.isPlaying = false;
				if(then) return then();
			});
		});
	});
}

function changeVolume(vcID,args){
	args = args.trim();
	var adjust = false;
	if(args.charAt(0) == '+' || args.charAt(0) == '-'){
		adjust = args.charAt(0);
		args = args.substring(1,args.length);
	}
	var amount = parseFloat(args);
	var volume;
	if(adjust)
		volume = getVolume(vcID) + amount * (adjust == '+' ? 1 : -1);
	else
		volume = amount;
	volume = Math.max(0,Math.min(1,volume)); // constrain volume to avoid clipping and negatives
	playersByVcID[vcID].volume = volume;
	playersByVcID[vcID].stdin.cork();
	playersByVcID[vcID].stdin.write('cvolume -1 volume '+volume+'\n'); // security warning, don't mess this up
	playersByVcID[vcID].stdin.uncork();
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
			var vcID = client.servers[client.channels[cID].guild_id].members[uID].voice_channel_id;
			var oldVcID = client.servers[client.channels[cID].guild_id].members[client.id].voice_channel_id;
			if((playersByVcID[vcID]||{}).isPlaying) return; // fail to summon to channels already occupied
			client.joinVoiceChannel(vcID);
			// if it's switching voice channels, we need to switch the references too
			// remember: if your code needs to reference its player, it needs to keep a reference and not just use its ID
			// otherwise I keel u
			if(playersByVcID[oldVcID]){
				playersByVcID[vcID] = playersByVcID[oldVcID];
				delete playersByVcID[oldVcID];
			}
			break;
		case "playfile":
			playFile(client.servers[client.channels[cID].guild_id].members[client.id].voice_channel_id,comArgs);
			break;
		case "volume":
			changeVolume(client.servers[client.channels[cID].guild_id].members[client.id].voice_channel_id,comArgs);
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
