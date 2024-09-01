const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require('discord.js');
const http = require('http');
http.createServer(function(request, response)
{
	response.writeHead(200, {'Content-Type': 'text/plain'});
	response.end('Bot is online!');
}).listen(8000);
console.log("Botを起動しました。");

// Discord.jsクライアントの初期化
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent,
    ],
    partials: [
        Partials.User,
        Partials.Channel,
        Partials.GuildMember,
        Partials.Message,
        Partials.Reaction,
    ],
});

const VCID = "1064461324135960617";
const VCID2 = "1064461356574703626";
const VCID3 = "1165551153791127562";
const VCID4 = "1165551032009490482";
const EXEMPT_IDS = new Set(["935599318738567219", "518899666637553667", "943931882138136586"]);
const movedMembers = new Set();
const movedMembersAlt = new Set();
const deathList = new Set();

// メンバーを処理する関数
async function processMembers(members, action) {
    const results = await Promise.allSettled(members.map(member => action(member)));
    const ok = results.filter(result => result.status === 'fulfilled').map(result => result.value);
    const no = results.filter(result => result.status === 'rejected').map(result => result.reason);

    return {
        ok: ok.length ? ok : ['なし'],
        no: no.length ? no : ['なし']
    };
}

// ミュートコマンドの処理
async function handleMuteCommand(message, mute, channelId, movedSet, excludeMoved = true) {
    const voiceChannel = message.guild.channels.cache.get(channelId);
    if (!voiceChannel || voiceChannel.members.size === 0) {
        const embed = new EmbedBuilder()
            .setTitle('VCに誰もいないため実行できませんでした。')
            .setColor('#f54242');
        return message.channel.send({ embeds: [embed] });
    }

    const membersToProcess = excludeMoved
        ? Array.from(voiceChannel.members.values()).filter(member => mute || !movedSet.has(member.id))
        : Array.from(voiceChannel.members.values());

    const result = await processMembers(membersToProcess, member => 
        member.voice.setMute(mute).then(() => member.displayName)
    );

    const embed = new EmbedBuilder()
        .setTitle(`ミュート${mute ? '' : '解除'}が完了しました。`)
        .addFields(
            { name: `成功した人`, value: result.ok.join(', '), inline: true },
            { name: `失敗した人`, value: result.no.join(', '), inline: true }
        )
        .setColor('#48f542');
    message.channel.send({ embeds: [embed] });
}

// 移動コマンドの処理
async function handleMoveCommand(message, fromChannelId, toChannelId, mute, movedSet) {
    const fromChannel = message.guild.channels.cache.get(fromChannelId);
    if (!fromChannel || fromChannel.members.size === 0) return;

    const result = await processMembers(
        Array.from(fromChannel.members.values()).filter(member => !EXEMPT_IDS.has(member.id)),
        member => member.voice.setChannel(toChannelId).then(() => {
            if (mute !== undefined) {
                return member.voice.setMute(mute).then(() => member.displayName);
            }
            return member.displayName;
        })
    );

    result.ok.forEach(memberName => {
        const member = fromChannel.members.find(m => m.displayName === memberName);
        if (member) movedSet.add(member.id);
    });
}

// メッセージの受信イベントの処理
client.on("messageCreate", async (message) => {
    if (message.content.startsWith("mcid:")) {
        if (message.channel.id !== "1064310706469605536") return;
        if (!message.member.bannable) return message.channel.send('botがあなたのニックネームを変更することができません');
        await message.member.roles.add('1064310860081807471');
        await message.guild.members.cache.get(message.author.id).setNickname(message.content.slice(5));
        message.reply('ロールを付与しました。');
    }

    if (message.content === "!m on" || message.content === "![人狼RPG] ☽夜☽") {
        await handleMuteCommand(message, true, VCID, movedMembers);
    }

    if (message.content === "!m off" || message.content === "![人狼RPG] ☀昼☀") {
        await handleMuteCommand(message, false, VCID, movedMembers);
    }

    if (message.content === "!move all" || message.content === "![人狼RPG] ゲーム終了") {
        await handleMoveCommand(message, VCID2, VCID, undefined, movedMembers);
        await handleMuteCommand(message, false, VCID, movedMembers, false); // ミュート解除時に移動されたメンバーも含む
        movedMembers.clear(); // リセット
    }

    if (message.content === "!?m on" || message.content === "!?[人狼RPG] ☽夜☽") {
        await handleMuteCommand(message, true, VCID3, movedMembersAlt);
    }

    if (message.content === "!?m off" || message.content === "!?[人狼RPG] ☀昼☀") {
        await handleMuteCommand(message, false, VCID3, movedMembersAlt);
    }

    if (message.content === "!?move all" || message.content === "!?[人狼RPG] ゲーム終了") {
        await handleMoveCommand(message, VCID4, VCID3, undefined, movedMembersAlt);
        await handleMuteCommand(message, false, VCID3, movedMembersAlt, false); // ミュート解除時に移動されたメンバーも含む
        movedMembersAlt.clear(); // リセット
    }

    if (message.content.startsWith("!m ") || message.content.startsWith("!moff ") || message.content.startsWith("!?m ") || message.content.startsWith("!?moff ")) {
        const [command, targetNickname] = message.content.split(' ');
        const mute = !command.includes('moff');
        const VC = !command.startsWith('!?');
        const voiceChannel1 = message.guild.channels.cache.get(VC ? VCID : VCID3);
        const voiceChannel2 = message.guild.channels.cache.get(VC ? VCID2 : VCID4);
        // VCID と VCID2 のメンバーを結合して一つの配列にします
        const membersInBothChannels = [...(voiceChannel1?.members.values() || []), ...(voiceChannel2?.members.values() || [])];
        
        // 対象のニックネームを持つメンバーを検索します
        const targetMember = membersInBothChannels.find(member => member.nickname === targetNickname);
        
        // メンバーが見つかった場合、ミュートまたはミュート解除を実行します
        if (targetMember) {
            await targetMember.voice.setMute(mute);
        }
    }

    if (message.content.startsWith("!move ") || message.content.startsWith("!move2 ") || message.content.startsWith("!?move ") || message.content.startsWith("!?move2 ")) {
        const [command, targetNickname] = message.content.split(' ');
        const fromChannelId = command.startsWith("!?") ? (command.includes("move2") ? VCID4 : VCID3) : (command.includes("move2") ? VCID2 : VCID);
        const toChannelId = command.startsWith("!?") ? (command.includes("move2") ? VCID3 : VCID4) : (command.includes("move2") ? VCID : VCID2);
        const mute = command.includes("move2");
        const voiceChannel = message.guild.channels.cache.get(fromChannelId);
        const movedSet = command.startsWith("!?") ? movedMembersAlt : movedMembers;
        if (voiceChannel) {
            const targetMember = voiceChannel.members.find(member => member.nickname === targetNickname);
            if (targetMember) {
                await targetMember.voice.setMute(mute);
                await targetMember.voice.setChannel(toChannelId);
                movedSet.add(targetMember.id);
            }
        }
    }

    // !syabekuraコマンドの処理
    if (message.content.startsWith("!syabekura_off ")) {
        const targetNickname = message.content.slice(15);
        const voiceChannel = message.guild.channels.cache.get(VCID);
        if (voiceChannel) {
            const targetMember = voiceChannel.members.find(member => member.nickname === targetNickname);
            if (targetMember) {
                await Promise.all([
                    targetMember.voice.setMute(false),
                    targetMember.voice.setDeaf(false)
                ]);
            }
        }
    }

    if (message.content.startsWith("!syabekura_death ")) {
        const targetNickname = message.content.slice(17);
        const voiceChannel = message.guild.channels.cache.get(VCID);
        if (voiceChannel) {
            const targetMember = voiceChannel.members.find(member => member.nickname === targetNickname);
            if (targetMember) {
                await Promise.all([
                    targetMember.voice.setMute(true),
                    targetMember.voice.setDeaf(false)
                ]);
                deathList.add(targetMember.id);
            }
        }
    }

    if (message.content.startsWith("!syabekura_kari ")) {
        deathList.clear();
        const targetNickname = message.content.slice(16);
        const voiceChannel = message.guild.channels.cache.get(VCID);
        if (voiceChannel) {
            const targetMember = voiceChannel.members.find(member => member.nickname === targetNickname);
            if (targetMember) {
                await Promise.all([
                    targetMember.voice.setMute(false),
                    targetMember.voice.setDeaf(false)
                ]);
                deathList.add(targetMember.id);
            }
        }
    }

    if (message.content === "!syabekura on") {
        const voiceChannel = message.guild.channels.cache.get(VCID);
        if (voiceChannel && voiceChannel.members.size > 0) {
            await Promise.all(Array.from(voiceChannel.members.values()).map(member => {
                if (!deathList.has(member.id)) {
                    return Promise.all([
                        member.voice.setMute(true),
                        member.voice.setDeaf(true)
                    ]);
                }
                return null;
            }));
        } else {
            const embed = new EmbedBuilder()
                .setTitle('VCに誰もいないため実行できませんでした。')
                .setColor('#f54242');
            message.channel.send({ embeds: [embed] });
        }
    }

    if (message.content === "!syabekura list-reset") {
        deathList.clear();
    }

    if (message.content === "!syabekura off") {
        const voiceChannel = message.guild.channels.cache.get(VCID);
        if (voiceChannel && voiceChannel.members.size > 0) {
            await Promise.all(Array.from(voiceChannel.members.values()).map(member => 
                Promise.all([
                    member.voice.setMute(false),
                    member.voice.setDeaf(false)
                ])
            ));
        } else {
            const embed = new EmbedBuilder()
                .setTitle('VCに誰もいないため実行できませんでした。')
                .setColor('#f54242');
            message.channel.send({ embeds: [embed] });
        }
        deathList.clear();
    }

    if (message.content === "!m me") {
        try {
            await message.member.voice.setMute(false);
            const embed = new EmbedBuilder()
                .setTitle('ミュート解除が完了しました。')
                .setColor('#48f542');
            message.reply({ embeds: [embed] });
        } catch {
            const embed = new EmbedBuilder()
                .setTitle('VCにいないため実行できませんでした。')
                .setColor('#f54242');
            message.reply({ embeds: [embed] });
        }
    }
});

// Discordにログイン
client.login(process.env.TOKEN);
