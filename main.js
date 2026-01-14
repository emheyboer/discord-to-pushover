const discord = require('discord.js');
const config = require('./config.json');

const stats = {};

const client = new discord.Client({
    intents: [
    discord.GatewayIntentBits.DirectMessages,
    ],
    partials: [discord.Partials.Channel],
});

client.once(discord.Events.ClientReady, (readyClient) => {
    console.log(`Logged in as ${JSON.stringify(readyClient.user.tag)}`);
});

client.on(discord.Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return; 
    const command = interaction.commandName;
    const author = interaction?.member?.user;
    switch (command) {
        case 'greet':
            interaction.reply(config.greet_msg);
            console.log('greeted', JSON.stringify(`${author?.global_name} (@${author?.username})`));
            break;
        case 'stats':
            if (!stats['sent']) {
                await getStats();
            }
            interaction.reply(`i've received ${stats['sent'].toLocaleString()} messages this month`);
            console.log('sent stats to', JSON.stringify(`${author?.global_name} (@${author?.username})`));
            break;
    }
});

client.on('messageCreate', (message) => {
    if (message.channel.type !== discord.ChannelType.DM || message.author.bot) return;

    console.log(JSON.stringify(message, null, 2));
    const title = `${message.author.globalName} (@${message.author.username})`;
    let body = message.cleanContent;

    message.attachments.each(attach => {
        body += `<img src="${attach.url}">`;
    })

    sendNotification({title, message: body});
    console.log(`\
${'='.repeat(60)}
${JSON.stringify(title)}
${JSON.stringify(body)}
${'='.repeat(60)}`);

    if (config.response_msg) {
        message.channel.send(config.response_msg);
    }
});

async function sendNotification(parameters) {
    const response = await fetch('https://api.pushover.net/1/messages.json', {
        method: 'post',
        body: new URLSearchParams({
            token: config.pushover.token,
            user: config.pushover.user,
            device: config.pushover.device,
            html: 1,
            ...parameters
        }),
    });

    const json = await response.json();
    
    const http_status = response.status;
    const json_status = json.status;
    const success = http_status == 200 && json_status == 1;
    if (success) {
        const headers = response.headers;
        stats['limit'] = Number(headers['x-limit-app-limit']);
        stats['remaining'] = Number(headers['x-limit-app-remaining']);
        stats['reset'] = new Date(Number(headers['x-limit-app-reset']) * 1000);
        stats['sent'] = stats['limit'] - stats['remaining'];
        return;
    } 
    
    console.error(JSON.stringify(json, null, 2));
    if (http_status >= 400 && http_status < 500) {
        console.error(`received ${http_status} error from pushover; shutting down...`);
        process.exit(1);
    } else {
        console.error(`received ${http_status} error from pushover`);
    }
}

async function getStats() {
    const response = await fetch(`https://api.pushover.net/1/apps/limits.json?token=${config.pushover.token}`);
    const json = await response.json();

    stats['limit'] = json['limit'];
    stats['remaining'] = json['remaining'];
    stats['reset'] = json['reset'];
    stats['sent'] = stats['limit'] - stats['remaining'];
}

const rest = new discord.REST().setToken(config.discord.token);
const commands = [
    new discord.SlashCommandBuilder().setName('greet').setDescription('says hi')
        .setContexts(
            discord.InteractionContextType.PrivateChannel,
            discord.InteractionContextType.BotDM,
            discord.InteractionContextType.Guild
        ),
    new discord.SlashCommandBuilder().setName('stats').setDescription('shows some stats')
    .setContexts(
        discord.InteractionContextType.PrivateChannel,
        discord.InteractionContextType.BotDM,
        discord.InteractionContextType.Guild
    ),
];

rest.put(discord.Routes.applicationCommands(config.discord.clientId), { body: commands });
client.login(config.discord.token);