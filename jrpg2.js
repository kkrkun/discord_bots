const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require('discord.js');

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

let VCID = "1064461324135960617";
let VCID2 = "1064461356574703626";
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

    // VC内のメンバーを取得し、ミュートしていない人を先に処理するようにソート
    const membersToProcess = excludeMoved
        ? Array.from(voiceChannel.members.values()).filter(member => mute || !movedSet.has(member.id))
        : Array.from(voiceChannel.members.values());

    // ミュートしていない人を先に、ミュートしている人を後にソート
    membersToProcess.sort((a, b) => {
        if (mute) {
            const aMuted = (a.voice?.serverMute || a.voice?.selfMute) ? 1 : 0;
            const bMuted = (b.voice?.serverMute || b.voice?.selfMute) ? 1 : 0;
            return aMuted - bMuted; // false (0) が先、true (1) が後になる
        } else {
            const aSelfMuted = a.voice?.selfMute ? 1 : 0;
            const bSelfMuted = b.voice?.selfMute ? 1 : 0;
            return aSelfMuted - bSelfMuted;
        }
    });


    const result = await processMembers(membersToProcess, member =>
        member.voice.setMute(mute).then(() => member.displayName)
    );

    const embed = new EmbedBuilder()
        .setTitle(`ミュート${mute ? '' : '解除'}が完了しました。`)
        .addFields(
            { name: `成功した人`, value: result.ok.length ? result.ok.join(', ') : 'なし', inline: true },
            { name: `失敗した人`, value: result.no.length ? result.no.join(', ') : 'なし', inline: true }
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
    if (message.guild.id === "1371754113754206228") {
        VCID = "1371766551216132097";
        VCID2 = "1371754113754206232";
    } else {
        VCID = "1064461324135960617";
        VCID2 = "1064461356574703626";
    }

    if (message.content === "!?m on" || message.content === "!?[人狼RPG] ☽夜☽") {
        try {
            await handleMuteCommand(message, true, VCID3, movedMembersAlt);
        } catch (error) {
            console.error(error);
        }
    }

    if (message.content === "!?m off" || message.content === "!?[人狼RPG] ☀昼☀") {
        try {
            await handleMuteCommand(message, false, VCID3, movedMembersAlt);
        } catch (error) {
            console.error(error);
        }
    }

    if (message.content === "!?move all" || message.content === "!?[人狼RPG] ゲーム終了") {
        try {
            await handleMoveCommand(message, VCID4, VCID3, undefined, movedMembersAlt);
            await handleMuteCommand(message, false, VCID3, movedMembersAlt, false); // ミュート解除時に移動されたメンバーも含む
            movedMembersAlt.clear(); // リセット
        } catch (error) {
            console.error(error);
        }
    }

    if (message.content.startsWith("!?m ") || message.content.startsWith("!?moff ")) {
        try {
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
        } catch (error) {
            console.error(error);
        }
    }

    if (message.content.startsWith("!?move ") || message.content.startsWith("!?move2 ")) {
        try {
            const [command, targetNickname] = message.content.split(' ');
            const fromChannelId = command.startsWith("!?") ? (command.includes("move2") ? VCID4 : VCID3) : (command.includes("move2") ? VCID2 : VCID);
            const toChannelId = command.startsWith("!?") ? (command.includes("move2") ? VCID3 : VCID4) : (command.includes("move2") ? VCID : VCID2);
            const mute = command.includes("move2");
            const voiceChannel = message.guild.channels.cache.get(fromChannelId);
            const movedSet = command.startsWith("!?") ? movedMembersAlt : movedMembers;
            if (voiceChannel) {
                const targetMember = voiceChannel.members.find(member => member.nickname === targetNickname);
                if (targetMember) {
                    if (targetMember.voice.channel) {
                        try {
                            await targetMember.voice.setChannel(toChannelId);
                            await targetMember.voice.setMute(mute);
                            movedSet.add(targetMember.id);
                        } catch (error) {
                            console.error(`Error moving member ${targetMember.id}:`, error);
                        }
                    } else {
                        console.log(`Skipping ${targetMember.id}: not in a voice channel.`);
                    }
                }
            }
        } catch (error) {
            console.error(error);
        }
    }
});

// Discordにログイン
client.login(process.env.TOKEN3);
