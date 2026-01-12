const discord = require('discord.js');
const config = require('./config.json');

const client = new discord.Client({
  intents: [
    discord.GatewayIntentBits.DirectMessages,
  ],
  partials: [discord.Partials.Channel],
});

client.once(discord.Events.ClientReady, (readyClient) => {
	console.log(`Logged in as ${readyClient.user.tag}`);
});

client.on(discord.Events.InteractionCreate, (interaction) => {
	if (!interaction.isChatInputCommand()) return; 
    const command = interaction.commandName;
    if (command == 'greet') {
        interaction.reply(config.greet_msg);
        const author = interaction?.member?.user;
        console.log(`greeted ${author?.global_name} (@${author?.username})`);
    }
});

client.on('messageCreate', (message) => {
  if (message.channel.type !== discord.ChannelType.DM || message.author.bot) 
    return;

  console.log(JSON.stringify(message, null, 2));
  const title = `${message.author.globalName} (@${message.author.username})`;
  const body = message.content;
  sendNotification({title, message: body});
  console.log(`\
${'='.repeat(60)}
${title}
${message.content}
${'='.repeat(60)}`);

    if (config.response_msg) {
        message.channel.send(config.response_msg);
    }
});

function sendNotification(parameters) {
    fetch('https://api.pushover.net/1/messages.json', {
        method: 'post',
        body: new URLSearchParams({
            token: config.pushover.token,
            user: config.pushover.user,
            device: config.pushover.device,
            ...parameters
        }),
    });
}

const rest = new discord.REST().setToken(config.discord.token);
const commands = [
    new discord.SlashCommandBuilder().setName('greet').setDescription('says hi')
        .setContexts(
            discord.InteractionContextType.PrivateChannel,
            discord.InteractionContextType.BotDM,
            discord.InteractionContextType.Guild
        ),
];

rest.put(discord.Routes.applicationCommands(config.discord.clientId), { body: commands });
client.login(config.discord.token);